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
        /api/scans/latest returns 404 when no scans exist (DB connected, table exists)
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
        assert_json_list(r, "GET /api/inventories")

    def test_upload_inventory(self):
        """POST /api/inventories/upload should accept a valid inventory file."""
        inventory_content = "[all]\n192.168.1.100\n192.168.1.101\n"
        files = {"file": ("test_inventory.ini", inventory_content, "text/plain")}
        data  = {"name": "CI Test Inventory"}
        r = requests.post(url("/api/inventories/upload"), files=files, data=data, timeout=10)
        assert r.status_code == 200, \
            f"POST /api/inventories/upload failed with {r.status_code}: {r.text}"
        body = r.json()
        assert "id" in body,         "Response missing 'id'"
        assert body["host_count"] == 2, f"Expected 2 hosts, got {body.get('host_count')}"

    def test_upload_empty_inventory_rejected(self):
        """POST /api/inventories/upload should reject an empty file."""
        files = {"file": ("empty.ini", "", "text/plain")}
        data  = {"name": "Empty Inventory"}
        r = requests.post(url("/api/inventories/upload"), files=files, data=data, timeout=10)
        assert r.status_code == 400, \
            f"Expected 400 for empty inventory, got {r.status_code}"


# ── Host endpoints ────────────────────────────────────────────────────────────

class TestHosts:
    def test_get_hosts(self):
        """GET /api/hosts should return a dict with a hosts key."""
        r = requests.get(url("/api/hosts"), timeout=10)
        assert r.status_code == 200, f"GET /api/hosts failed with {r.status_code}"
        body = r.json()
        assert "hosts" in body, "Response missing 'hosts' key"
        assert isinstance(body["hosts"], list), "hosts should be a list"

    def test_get_all_tags(self):
        """GET /api/tags should return a dict with a tags key."""
        r = requests.get(url("/api/tags"), timeout=10)
        assert r.status_code == 200, f"GET /api/tags failed with {r.status_code}"
        body = r.json()
        assert "tags" in body, "Response missing 'tags' key"
        assert isinstance(body["tags"], list), "tags should be a list"


# ── Scan endpoints ────────────────────────────────────────────────────────────

class TestScans:
    def test_scan_history_returns_list(self):
        """GET /api/scans/history should always return a list (empty is fine)."""
        r = requests.get(url("/api/scans/history"), timeout=10)
        data = assert_json_list(r, "GET /api/scans/history")
        # if there are scans, verify the shape of each entry
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
        assert "scanning" in body, "Response missing 'scanning' key"
        assert isinstance(body["scanning"], bool), "'scanning' should be a bool"


# ── Scheduler endpoints ───────────────────────────────────────────────────────

class TestScheduler:
    def test_get_interval(self):
        """GET /api/scheduler/interval should return interval_minutes."""
        r = requests.get(url("/api/scheduler/interval"), timeout=10)
        assert r.status_code == 200, f"GET /api/scheduler/interval failed with {r.status_code}"
        body = r.json()
        assert "interval_minutes" in body, "Response missing 'interval_minutes'"
        assert isinstance(body["interval_minutes"], int), "interval_minutes should be int"
        assert body["interval_minutes"] > 0, "interval_minutes should be > 0"

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


# ── CVE endpoints ─────────────────────────────────────────────────────────────

class TestCVEs:
    def test_get_cves_returns_list(self):
        """GET /api/cves should return a list (empty is fine before any scans)."""
        r = requests.get(url("/api/cves"), timeout=10)
        data = assert_json_list(r, "GET /api/cves")
        # if CVEs exist, verify shape
        for cve in data:
            assert "advisory_id" in cve, "CVE missing 'advisory_id'"
            assert "severity"    in cve, "CVE missing 'severity'"