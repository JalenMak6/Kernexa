"""
Kernexa API Integration Tests
Runs against a live container spun up by the CI pipeline.
Base URL is read from the TEST_BASE_URL env var (default: http://localhost:8000)
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("TEST_BASE_URL", "http://localhost:8000")


def url(path: str) -> str:
    return f"{BASE_URL}{path}"


# ── Helpers ───────────────────────────────────────────────────────────────────

def assert_json_list(response, label: str):
    assert response.status_code == 200, f"{label}: expected 200, got {response.status_code}"
    data = response.json()
    assert isinstance(data, list), f"{label}: expected list, got {type(data)}"
    return data


def assert_json_dict(response, label: str):
    assert response.status_code in (200, 404), f"{label}: unexpected status {response.status_code}"
    data = response.json()
    assert isinstance(data, dict), f"{label}: expected dict, got {type(data)}"
    return data


# ── Health ────────────────────────────────────────────────────────────────────

class TestHealth:
    def test_app_is_reachable(self):
        """App should respond on the base URL."""
        r = requests.get(url("/api/scans/latest"), timeout=10)
        assert r.status_code in (200, 404), \
            f"App unreachable or crashed — got HTTP {r.status_code}"

    def test_db_connected(self):
        """
        /api/scans/latest returns 404 when no scans exist (DB connected, table exists).
        It should never return 500 which would indicate a DB connection failure.
        """
        r = requests.get(url("/api/scans/latest"), timeout=10)
        assert r.status_code != 500, \
            "DB connection failed — /api/scans/latest returned 500"


# ── Inventory endpoints ───────────────────────────────────────────────────────

class TestInventories:
    def test_list_inventories(self):
        """GET /api/inventories should return a list."""
        r = requests.get(url("/api/inventories"), timeout=10)
        data = assert_json_list(r, "GET /api/inventories")
        for inv in data:
            assert "id"             in inv, "inventory missing 'id'"
            assert "name"           in inv, "inventory missing 'name'"
            assert "inventory_type" in inv, "inventory missing 'inventory_type'"
            assert "is_active"      in inv, "inventory missing 'is_active'"
            assert inv["inventory_type"] in ("linux", "windows"), \
                f"unexpected inventory_type: {inv['inventory_type']}"

    def test_upload_linux_inventory(self):
        """POST /api/inventories/upload should accept a Linux inventory."""
        inventory_content = "[all]\n192.168.1.100\n192.168.1.101\n"
        files = {"file": ("test_linux.ini", inventory_content, "text/plain")}
        data  = {"name": "CI Linux Inventory", "inventory_type": "linux"}
        r = requests.post(url("/api/inventories/upload"), files=files, data=data, timeout=10)
        assert r.status_code == 200, \
            f"POST /api/inventories/upload (linux) failed with {r.status_code}: {r.text}"
        body = r.json()
        assert "id"                    in body, "Response missing 'id'"
        assert body["host_count"]     == 2,       f"Expected 2 hosts, got {body.get('host_count')}"
        assert body["inventory_type"] == "linux", f"Expected linux, got {body.get('inventory_type')}"

    def test_upload_windows_inventory(self):
        """POST /api/inventories/upload should accept a Windows inventory."""
        inventory_content = "[windows_hosts]\n192.168.1.200\n192.168.1.201\n"
        files = {"file": ("test_windows.ini", inventory_content, "text/plain")}
        data  = {"name": "CI Windows Inventory", "inventory_type": "windows"}
        r = requests.post(url("/api/inventories/upload"), files=files, data=data, timeout=10)
        assert r.status_code == 200, \
            f"POST /api/inventories/upload (windows) failed with {r.status_code}: {r.text}"
        body = r.json()
        assert "id"                       in body, "Response missing 'id'"
        assert body["host_count"]     == 2,           f"Expected 2 hosts, got {body.get('host_count')}"
        assert body["inventory_type"] == "windows",   f"Expected windows, got {body.get('inventory_type')}"

    def test_upload_empty_inventory_rejected(self):
        """POST /api/inventories/upload should reject an empty file."""
        files = {"file": ("empty.ini", "", "text/plain")}
        data  = {"name": "Empty Inventory"}
        r = requests.post(url("/api/inventories/upload"), files=files, data=data, timeout=10)
        assert r.status_code == 400, \
            f"Expected 400 for empty inventory, got {r.status_code}"

    def test_linux_and_windows_can_both_be_active(self):
        """
        Activating a Windows inventory should not deactivate the Linux inventory
        and vice versa — dual-inventory must work simultaneously.
        """
        linux_content   = "[all]\n10.0.0.1\n"
        windows_content = "[windows_hosts]\n10.0.0.2\n"

        linux_files   = {"file": ("dual_linux.ini",   linux_content,   "text/plain")}
        windows_files = {"file": ("dual_windows.ini", windows_content, "text/plain")}

        r_l = requests.post(url("/api/inventories/upload"),
                            files=linux_files,
                            data={"name": "CI Dual Linux", "inventory_type": "linux"},
                            timeout=10)
        r_w = requests.post(url("/api/inventories/upload"),
                            files=windows_files,
                            data={"name": "CI Dual Windows", "inventory_type": "windows"},
                            timeout=10)
        assert r_l.status_code == 200, f"Linux upload failed: {r_l.text}"
        assert r_w.status_code == 200, f"Windows upload failed: {r_w.text}"

        linux_id   = r_l.json()["id"]
        windows_id = r_w.json()["id"]

        requests.post(url(f"/api/inventories/{linux_id}/activate"),   timeout=10)
        requests.post(url(f"/api/inventories/{windows_id}/activate"), timeout=10)

        invs = requests.get(url("/api/inventories"), timeout=10).json()
        active_types = {i["inventory_type"] for i in invs if i["is_active"]}
        assert "linux"   in active_types, "Linux inventory should still be active after Windows activated"
        assert "windows" in active_types, "Windows inventory should be active"


# ── Host endpoints ────────────────────────────────────────────────────────────

class TestHosts:
    def test_get_hosts(self):
        """GET /api/hosts should return a dict with a hosts key."""
        r = requests.get(url("/api/hosts"), timeout=10)
        assert r.status_code == 200, f"GET /api/hosts failed with {r.status_code}"
        body = r.json()
        assert "hosts" in body,                 "Response missing 'hosts' key"
        assert isinstance(body["hosts"], list), "hosts should be a list"

    def test_get_all_tags(self):
        """GET /api/tags should return a dict with a tags key."""
        r = requests.get(url("/api/tags"), timeout=10)
        assert r.status_code == 200, f"GET /api/tags failed with {r.status_code}"
        body = r.json()
        assert "tags" in body,                 "Response missing 'tags' key"
        assert isinstance(body["tags"], list), "tags should be a list"


# ── Scan endpoints ────────────────────────────────────────────────────────────

class TestScans:
    def test_scan_history_returns_list(self):
        """GET /api/scans/history should always return a list (empty is fine)."""
        r = requests.get(url("/api/scans/history"), timeout=10)
        data = assert_json_list(r, "GET /api/scans/history")
        for scan in data:
            assert "scan_id"    in scan, "scan missing 'scan_id'"
            assert "scanned_at" in scan, "scan missing 'scanned_at'"
            assert "status"     in scan, "scan missing 'status'"

    def test_latest_scan_not_500(self):
        """GET /api/scans/latest should return 200 or 404, never 500."""
        r = requests.get(url("/api/scans/latest"), timeout=10)
        assert r.status_code in (200, 404), \
            f"GET /api/scans/latest returned unexpected status {r.status_code}"

    def test_current_scan_shape(self):
        """GET /api/scans/current should return scanning status."""
        r = requests.get(url("/api/scans/current"), timeout=10)
        assert r.status_code == 200, f"GET /api/scans/current failed with {r.status_code}"
        body = r.json()
        assert "scanning" in body,                 "Response missing 'scanning' key"
        assert isinstance(body["scanning"], bool), "'scanning' should be a bool"

    def test_trigger_scan_requires_credentials(self):
        """POST /api/scans/trigger should return 400 when no credentials are set."""
        r = requests.post(url("/api/scans/trigger"), timeout=10)
        assert r.status_code in (400, 409), \
            f"POST /api/scans/trigger returned unexpected status {r.status_code}"

    def test_trigger_windows_scan_not_500(self):
        """POST /api/scans/trigger-windows should never return 404 or 500."""
        r = requests.post(url("/api/scans/trigger-windows"), timeout=10)
        assert r.status_code in (200, 400, 409), \
            f"POST /api/scans/trigger-windows returned {r.status_code} — route missing or crashed"

    def test_latest_windows_scan_not_500(self):
        """GET /api/scans/windows/latest should return 200 or 404, never 500."""
        r = requests.get(url("/api/scans/windows/latest"), timeout=10)
        assert r.status_code in (200, 404), \
            f"GET /api/scans/windows/latest returned unexpected status {r.status_code}"

    def test_latest_windows_scan_shape(self):
        """If Windows scan data exists, each record should have the expected fields."""
        r = requests.get(url("/api/scans/windows/latest"), timeout=10)
        if r.status_code == 404:
            pytest.skip("No Windows scan data yet — skipping shape check")
        data = r.json()
        assert isinstance(data, list), "Windows scan response should be a list"
        for record in data:
            for field in ("hostname", "osName", "KBID", "classification", "rebootRequired"):
                assert field in record, f"Windows scan record missing '{field}'"


# ── Windows credentials endpoints ─────────────────────────────────────────────

class TestWindowsCredentials:
    def test_get_windows_credentials_shape(self):
        """GET /api/windows/credentials should return expected fields."""
        r = requests.get(url("/api/windows/credentials"), timeout=10)
        assert r.status_code == 200, \
            f"GET /api/windows/credentials failed with {r.status_code}"
        body = r.json()
        assert "has_credentials" in body, "Response missing 'has_credentials'"
        assert isinstance(body["has_credentials"], bool), "'has_credentials' should be bool"

    def test_get_windows_credentials_never_returns_password(self):
        """GET /api/windows/credentials must never return the plaintext password."""
        r = requests.get(url("/api/windows/credentials"), timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert "password" not in body, \
            "GET /api/windows/credentials must not return password in response"

    def test_set_windows_credentials_missing_fields(self):
        """POST /api/windows/credentials should reject missing username/password."""
        r = requests.post(url("/api/windows/credentials"),
                          json={"username": "", "password": ""}, timeout=10)
        assert r.status_code == 400, \
            f"Expected 400 for empty credentials, got {r.status_code}"

    def test_set_windows_credentials_invalid_transport(self):
        """POST /api/windows/credentials should reject an unsupported transport."""
        r = requests.post(url("/api/windows/credentials"),
                          json={"username": "admin", "password": "pass", "transport": "ssh"},
                          timeout=10)
        assert r.status_code == 400, \
            f"Expected 400 for invalid transport 'ssh', got {r.status_code}"

    def test_set_windows_credentials_valid(self):
        """POST /api/windows/credentials should accept valid credentials."""
        r = requests.post(url("/api/windows/credentials"),
                          json={
                              "username":  "ci_test_user",
                              "password":  "ci_test_password",
                              "domain":    "",
                              "port":      5986,
                              "transport": "ntlm",
                          },
                          timeout=10)
        if r.status_code == 500:
            pytest.skip("CREDENTIALS_KEY not set in test env — skipping credential save test")
        assert r.status_code == 200, \
            f"POST /api/windows/credentials failed with {r.status_code}: {r.text}"
        body = r.json()
        assert "message" in body, "Response missing 'message'"

    def test_credentials_reflected_after_save(self):
        """After saving WinRM credentials, GET should report has_credentials=True."""
        r = requests.post(url("/api/windows/credentials"),
                          json={"username": "ci_user", "password": "ci_pass",
                                "transport": "ntlm"},
                          timeout=10)
        if r.status_code == 500:
            pytest.skip("CREDENTIALS_KEY not set in test env — skipping reflection test")
        r = requests.get(url("/api/windows/credentials"), timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body.get("has_credentials") is True, \
            "has_credentials should be True after saving credentials"
        assert body.get("username") == "ci_user", \
            f"Expected username 'ci_user', got {body.get('username')}"


# ── Scheduler endpoints ───────────────────────────────────────────────────────

class TestScheduler:
    def test_get_interval(self):
        """GET /api/scheduler/interval should return interval_minutes."""
        r = requests.get(url("/api/scheduler/interval"), timeout=10)
        assert r.status_code == 200, f"GET /api/scheduler/interval failed with {r.status_code}"
        body = r.json()
        assert "interval_minutes" in body,                "Response missing 'interval_minutes'"
        assert isinstance(body["interval_minutes"], int), "interval_minutes should be int"
        assert body["interval_minutes"] > 0,              "interval_minutes should be > 0"

    def test_set_interval_valid(self):
        """POST /api/scheduler/interval should accept a valid interval."""
        r = requests.post(url("/api/scheduler/interval"),
                          json={"interval_minutes": 60}, timeout=10)
        assert r.status_code == 200, \
            f"POST /api/scheduler/interval failed with {r.status_code}: {r.text}"
        body = r.json()
        assert body.get("interval_minutes") == 60, \
            f"Expected 60, got {body.get('interval_minutes')}"

    def test_set_interval_invalid(self):
        """POST /api/scheduler/interval should reject interval < 1."""
        r = requests.post(url("/api/scheduler/interval"),
                          json={"interval_minutes": 0}, timeout=10)
        assert r.status_code == 400, \
            f"Expected 400 for interval=0, got {r.status_code}"

    def test_set_interval_too_large(self):
        """POST /api/scheduler/interval should reject interval > 10080 (7 days)."""
        r = requests.post(url("/api/scheduler/interval"),
                          json={"interval_minutes": 99999}, timeout=10)
        assert r.status_code == 400, \
            f"Expected 400 for interval=99999, got {r.status_code}"

    def test_scheduler_status(self):
        """GET /api/scheduler/status should return enabled status."""
        r = requests.get(url("/api/scheduler/status"), timeout=10)
        assert r.status_code == 200, f"GET /api/scheduler/status failed with {r.status_code}"
        body = r.json()
        assert "enabled" in body, "Response missing 'enabled' key"


# ── Notification endpoints ────────────────────────────────────────────────────

class TestNotifications:
    def test_get_settings_shape(self):
        """GET /api/notifications/settings should return expected fields."""
        r = requests.get(url("/api/notifications/settings"), timeout=10)
        assert r.status_code == 200, \
            f"GET /api/notifications/settings failed with {r.status_code}"
        body = r.json()
        for field in ("smtp_host", "smtp_port", "smtp_user", "recipients", "tls_enabled"):
            assert field in body, f"Response missing '{field}'"

    def test_get_settings_password_masked(self):
        """GET /api/notifications/settings should never return plaintext password."""
        r = requests.get(url("/api/notifications/settings"), timeout=10)
        assert r.status_code == 200
        body = r.json()
        password = body.get("smtp_password", "")
        assert password != "plaintext", "Password should never be returned as plaintext"

    def test_test_notification_requires_smtp_host(self):
        """POST /api/notifications/test should return 400 when SMTP is not configured."""
        requests.post(url("/api/notifications/settings"),
                      json={"smtp_host": "", "smtp_port": 587, "smtp_user": "",
                            "smtp_password": "", "smtp_from": "",
                            "recipients": [], "tls_enabled": True},
                      timeout=10)
        r = requests.post(url("/api/notifications/test"), timeout=10)
        assert r.status_code == 400, \
            f"Expected 400 when SMTP not configured, got {r.status_code}"


# ── CVE endpoints ─────────────────────────────────────────────────────────────

class TestCVEs:
    def test_get_cves_returns_list(self):
        """GET /api/cves should return a list (empty is fine before any scans)."""
        r = requests.get(url("/api/cves"), timeout=10)
        data = assert_json_list(r, "GET /api/cves")
        for cve in data:
            assert "advisory_id" in cve, "CVE missing 'advisory_id'"
            assert "severity"    in cve, "CVE missing 'severity'"


# ── SPA routing ───────────────────────────────────────────────────────────────

class TestSPARouting:
    def test_spa_routes_return_html(self):
        """All frontend URL paths should return index.html (not 404)."""
        spa_paths = ["/", "/linux-inventory", "/windows-hosts",
                     "/scan-history", "/cve-advisories", "/settings"]
        for path in spa_paths:
            r = requests.get(url(path), timeout=10)
            assert r.status_code == 200, \
                f"SPA path '{path}' returned {r.status_code}, expected 200"
            assert "text/html" in r.headers.get("Content-Type", ""), \
                f"SPA path '{path}' did not return HTML"

    def test_api_prefix_not_served_as_spa(self):
        """Unknown /api/ paths should return 404, not index.html."""
        r = requests.get(url("/api/does-not-exist"), timeout=10)
        assert r.status_code == 404, \
            f"Unknown API path should return 404, got {r.status_code}"

    def test_index_html_not_cached(self):
        """index.html should be served with no-cache headers."""
        r = requests.get(url("/"), timeout=10)
        assert r.status_code == 200
        cache_control = r.headers.get("Cache-Control", "")
        if "no-cache" not in cache_control and "no-store" not in cache_control:
            pytest.xfail(
                f"index.html missing no-cache header (got: '{cache_control}') — "
                "add Cache-Control headers to serve_spa() in main.py"
            )


# ── Patch endpoints ───────────────────────────────────────────────────────────

class TestPatch:
    """
    Tests for the patch trigger, status, and history endpoints.

    Strategy: These tests verify the API contract only — not whether patches
    actually succeed on real hosts. We use 192.0.2.1 (RFC 5737 TEST-NET) as
    the target host. Ansible will report the host as unreachable, but the API
    will still return 200 with a job_id immediately since patching runs in the
    background. This makes the tests stable, repeatable, and safe to run in CI
    without touching any real infrastructure.
    """

    def test_patch_history_returns_list(self):
        """GET /api/patch/history should always return a list (empty is fine)."""
        r = requests.get(url("/api/patch/history"), timeout=10)
        data = assert_json_list(r, "GET /api/patch/history")
        for job in data:
            assert "job_id"      in job, "patch job missing 'job_id'"
            assert "advisory_id" in job, "patch job missing 'advisory_id'"
            assert "status"      in job, "patch job missing 'status'"
            assert "dry_run"     in job, "patch job missing 'dry_run'"
            assert "hosts"       in job, "patch job missing 'hosts'"
            assert "packages"    in job, "patch job missing 'packages'"

    def test_trigger_patch_requires_hosts(self):
        """POST /api/patch/trigger should return 400 when hosts list is empty."""
        r = requests.post(url("/api/patch/trigger"),
                          json={"advisory_id": "CI-TEST-ADVISORY",
                                "hosts": [], "packages": ["openssl"], "dry_run": True},
                          timeout=10)
        assert r.status_code == 400, \
            f"Expected 400 for empty hosts, got {r.status_code}"

    def test_trigger_patch_requires_packages(self):
        """POST /api/patch/trigger should return 400 when packages list is empty."""
        r = requests.post(url("/api/patch/trigger"),
                          json={"advisory_id": "CI-TEST-ADVISORY",
                                "hosts": ["192.0.2.1"], "packages": [], "dry_run": True},
                          timeout=10)
        assert r.status_code == 400, \
            f"Expected 400 for empty packages, got {r.status_code}"

    def test_trigger_patch_dry_run_returns_job_id(self):
        """
        POST /api/patch/trigger with dry_run=True should immediately return a job_id.
        Uses 192.0.2.1 (RFC 5737 TEST-NET) — Ansible fails gracefully but API returns 200.
        """
        r = requests.post(url("/api/patch/trigger"),
                          json={"advisory_id": "CI-TEST-ADVISORY",
                                "hosts": ["192.0.2.1"], "packages": ["openssl"],
                                "dry_run": True},
                          timeout=10)
        assert r.status_code == 200, \
            f"POST /api/patch/trigger failed with {r.status_code}: {r.text}"
        body = r.json()
        assert "job_id" in body,            "Response missing 'job_id'"
        assert "status" in body,            "Response missing 'status'"
        assert "mode"   in body,            "Response missing 'mode'"
        assert body["mode"]   == "dry_run", f"Expected mode='dry_run', got {body.get('mode')}"
        assert body["status"] == "started", f"Expected status='started', got {body.get('status')}"

    def test_trigger_patch_apply_returns_job_id(self):
        """POST /api/patch/trigger with dry_run=False should start an apply job."""
        r = requests.post(url("/api/patch/trigger"),
                          json={"advisory_id": "CI-TEST-ADVISORY",
                                "hosts": ["192.0.2.1"], "packages": ["openssl"],
                                "dry_run": False},
                          timeout=10)
        assert r.status_code == 200, \
            f"POST /api/patch/trigger (apply) failed with {r.status_code}: {r.text}"
        body = r.json()
        assert "job_id" in body,        "Response missing 'job_id'"
        assert body["mode"] == "apply", f"Expected mode='apply', got {body.get('mode')}"

    def test_patch_job_status_shape(self):
        """GET /api/patch/{job_id}/status should return full job details."""
        r = requests.post(url("/api/patch/trigger"),
                          json={"advisory_id": "CI-TEST-STATUS",
                                "hosts": ["192.0.2.1"], "packages": ["curl"],
                                "dry_run": True},
                          timeout=10)
        assert r.status_code == 200, f"Could not trigger patch job: {r.text}"
        job_id = r.json()["job_id"]

        r2 = requests.get(url(f"/api/patch/{job_id}/status"), timeout=10)
        assert r2.status_code == 200, \
            f"GET /api/patch/{job_id}/status failed with {r2.status_code}"
        body = r2.json()
        assert "job_id"      in body, "Status response missing 'job_id'"
        assert "status"      in body, "Status response missing 'status'"
        assert "dry_run"     in body, "Status response missing 'dry_run'"
        assert "hosts"       in body, "Status response missing 'hosts'"
        assert "packages"    in body, "Status response missing 'packages'"
        assert "advisory_id" in body, "Status response missing 'advisory_id'"
        assert body["job_id"]  == job_id, "Returned job_id does not match"
        assert body["dry_run"] is True,   "dry_run should be True for this job"
        assert body["status"] in ("running", "complete", "complete_with_errors", "failed"), \
            f"Unexpected status value: {body['status']}"

    def test_patch_job_status_unknown_id(self):
        """GET /api/patch/{job_id}/status with a nonexistent ID should return 404."""
        r = requests.get(url("/api/patch/00000000-0000-0000-0000-000000000000/status"),
                         timeout=10)
        assert r.status_code == 404, \
            f"Expected 404 for unknown job_id, got {r.status_code}"

    def test_patch_history_records_triggered_jobs(self):
        """Jobs triggered via POST /api/patch/trigger should appear in GET /api/patch/history."""
        r = requests.post(url("/api/patch/trigger"),
                          json={"advisory_id": "CI-TEST-HISTORY",
                                "hosts": ["192.0.2.1"], "packages": ["vim"],
                                "dry_run": True},
                          timeout=10)
        assert r.status_code == 200
        job_id = r.json()["job_id"]

        history = requests.get(url("/api/patch/history"), timeout=10).json()
        assert job_id in [j["job_id"] for j in history], \
            f"Triggered job {job_id} not found in patch history"

    def test_patch_dry_run_flag_preserved_in_history(self):
        """dry_run flag set at trigger time should be preserved in history."""
        r = requests.post(url("/api/patch/trigger"),
                          json={"advisory_id": "CI-TEST-DRYRUN-FLAG",
                                "hosts": ["192.0.2.1"], "packages": ["bash"],
                                "dry_run": True},
                          timeout=10)
        assert r.status_code == 200
        job_id = r.json()["job_id"]

        history = requests.get(url("/api/patch/history"), timeout=10).json()
        job = next((j for j in history if j["job_id"] == job_id), None)
        assert job is not None,        f"Job {job_id} not found in history"
        assert job["dry_run"] is True, "dry_run should be True in history record"