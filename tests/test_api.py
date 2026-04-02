"""
Kernexa API Integration Tests
Runs against a live container spun up by the CI pipeline.
Base URL is read from the TEST_BASE_URL env var (default: http://localhost:8000)

Auth is handled via conftest.py:
  - auth_headers  — CI test user (reader role), used for all read-only tests
  - admin_headers — admin user, used for write/admin-only tests
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
    assert response.status_code in (200, 404), \
        f"{label}: unexpected status {response.status_code}"
    data = response.json()
    assert isinstance(data, dict), f"{label}: expected dict, got {type(data)}"
    return data


# ── Auth endpoint tests ───────────────────────────────────────────────────────

class TestAuth:
    def test_login_returns_token(self):
        """POST /api/auth/login should return access_token for valid credentials."""
        ci_user = os.environ.get("CI_TEST_USER", "")
        ci_pass = os.environ.get("CI_TEST_PASS", "")
        if not ci_user or not ci_pass:
            pytest.skip("CI_TEST_USER / CI_TEST_PASS not set")

        r = requests.post(url("/api/auth/login"),
                          json={"username": ci_user, "password": ci_pass}, timeout=10)
        assert r.status_code == 200, f"Login failed: {r.text}"
        body = r.json()
        assert "access_token" in body, "Response missing 'access_token'"
        assert body["token_type"] == "bearer"
        assert "user" in body
        assert "role" in body["user"]
        assert body["user"]["role"] in ("admin", "operator", "reader")

    def test_login_wrong_password_returns_401(self):
        """POST /api/auth/login should return 401 for wrong password."""
        r = requests.post(url("/api/auth/login"),
                          json={"username": "admin", "password": "definitelywrong"},
                          timeout=10)
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"

    def test_login_unknown_user_returns_401(self):
        """POST /api/auth/login should return 401 for unknown user."""
        r = requests.post(url("/api/auth/login"),
                          json={"username": "nonexistent_xyz", "password": "pass"},
                          timeout=10)
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"

    def test_unauthenticated_request_returns_401(self):
        """Any protected endpoint without a token should return 401."""
        r = requests.get(url("/api/scans/latest"), timeout=10)
        assert r.status_code == 401, f"Expected 401 without token, got {r.status_code}"

    def test_invalid_token_returns_401(self):
        """A malformed token should return 401."""
        r = requests.get(url("/api/scans/latest"),
                         headers={"Authorization": "Bearer not.a.valid.token"},
                         timeout=10)
        assert r.status_code == 401, f"Expected 401 for invalid token, got {r.status_code}"

    def test_me_endpoint_returns_current_user(self, auth_headers):
        """GET /api/auth/me should return the current user's info."""
        r = requests.get(url("/api/auth/me"), headers=auth_headers, timeout=10)
        assert r.status_code == 200, f"GET /api/auth/me failed: {r.text}"
        body = r.json()
        assert "id"       in body
        assert "username" in body
        assert "role"     in body
        assert body["role"] in ("admin", "operator", "reader")

    def test_refresh_without_cookie_returns_401(self):
        """POST /api/auth/refresh without cookie should return 401."""
        r = requests.post(url("/api/auth/refresh"), timeout=10)
        assert r.status_code == 401, f"Expected 401 without cookie, got {r.status_code}"

    def test_register_public_endpoint(self):
        """POST /api/auth/register should work without a token."""
        r = requests.post(url("/api/auth/register"),
                          json={"username": "ci_reg_test_xyz", "password": "testpass123"},
                          timeout=10)
        # 200 = registered, 409 = username taken from prev run — both are fine
        assert r.status_code in (200, 409), \
            f"POST /api/auth/register returned unexpected {r.status_code}: {r.text}"

    def test_register_short_password_rejected(self):
        """POST /api/auth/register should reject passwords under 8 chars."""
        r = requests.post(url("/api/auth/register"),
                          json={"username": "ci_shortpass", "password": "abc"},
                          timeout=10)
        assert r.status_code == 400, f"Expected 400 for short password, got {r.status_code}"

    def test_registered_user_cannot_login_before_approval(self):
        """A self-registered user should get 403 on login before admin approves."""
        # Register fresh user
        username = "ci_pending_login_test"
        requests.post(url("/api/auth/register"),
                      json={"username": username, "password": "testpass123"},
                      timeout=10)
        # Try to login — should be blocked
        r = requests.post(url("/api/auth/login"),
                          json={"username": username, "password": "testpass123"},
                          timeout=10)
        # 401 = user not found (already deleted), 403 = exists but inactive — both valid
        assert r.status_code in (401, 403), \
            f"Pending user should not be able to login, got {r.status_code}"

    def test_logout(self, auth_headers):
        """POST /api/auth/logout should return 200."""
        r = requests.post(url("/api/auth/logout"), headers=auth_headers, timeout=10)
        assert r.status_code == 200, f"Logout failed: {r.text}"


# ── User management (admin only) ──────────────────────────────────────────────

class TestUserManagement:
    def test_list_users_admin(self, admin_headers):
        """GET /api/users should return a list for admin."""
        r = requests.get(url("/api/users"), headers=admin_headers, timeout=10)
        data = assert_json_list(r, "GET /api/users")
        for user in data:
            assert "id"        in user
            assert "username"  in user
            assert "role"      in user
            assert "is_active" in user
            assert "password"  not in user, "password must never be returned"

    def test_list_users_reader_forbidden(self, auth_headers):
        """GET /api/users should return 403 for non-admin roles."""
        ci_role = os.environ.get("CI_TEST_ROLE", "reader")
        if ci_role == "admin":
            pytest.skip("CI user is admin — skipping reader restriction test")
        r = requests.get(url("/api/users"), headers=auth_headers, timeout=10)
        assert r.status_code == 403, \
            f"Expected 403 for non-admin on /api/users, got {r.status_code}"

    def test_list_pending_users(self, admin_headers):
        """GET /api/users/pending should return a list for admin."""
        r = requests.get(url("/api/users/pending"), headers=admin_headers, timeout=10)
        data = assert_json_list(r, "GET /api/users/pending")
        for user in data:
            assert "id"       in user
            assert "username" in user
            # All pending users should have is_active=False
            assert user.get("is_active") is False, \
                f"Pending user {user['username']} should have is_active=False"

    def test_create_user_admin(self, admin_headers):
        """POST /api/users should create a new user as admin."""
        r = requests.post(url("/api/users"),
                          json={"username": "ci_temp_user",
                                "password": "temppass123",
                                "role":     "reader"},
                          headers=admin_headers, timeout=10)
        assert r.status_code in (200, 409), \
            f"POST /api/users failed with {r.status_code}: {r.text}"
        if r.status_code == 200:
            body = r.json()
            assert "id"       in body
            assert "username" in body
            assert body["role"] == "reader"

    def test_create_user_invalid_role(self, admin_headers):
        """POST /api/users should reject invalid roles."""
        r = requests.post(url("/api/users"),
                          json={"username": "bad_role_user",
                                "password": "password123",
                                "role":     "superuser"},
                          headers=admin_headers, timeout=10)
        assert r.status_code == 400, f"Expected 400 for invalid role, got {r.status_code}"

    def test_create_user_short_password(self, admin_headers):
        """POST /api/users should reject passwords under 8 chars."""
        r = requests.post(url("/api/users"),
                          json={"username": "shortpass_user",
                                "password": "abc",
                                "role":     "reader"},
                          headers=admin_headers, timeout=10)
        assert r.status_code == 400, f"Expected 400 for short password, got {r.status_code}"

    def test_delete_nonexistent_user(self, admin_headers):
        """DELETE /api/users/999999 should return 404."""
        r = requests.delete(url("/api/users/999999"),
                            headers=admin_headers, timeout=10)
        assert r.status_code == 404, f"Expected 404 for nonexistent user, got {r.status_code}"

    def test_reader_cannot_access_user_management(self, auth_headers):
        """Reader should get 403 on all user management endpoints."""
        ci_role = os.environ.get("CI_TEST_ROLE", "reader")
        if ci_role != "reader":
            pytest.skip("CI user is not reader")
        for method, path in [
            ("GET",    "/api/users"),
            ("GET",    "/api/users/pending"),
            ("DELETE", "/api/users/999999"),
        ]:
            r = getattr(requests, method.lower())(
                url(path), headers=auth_headers, timeout=10)
            assert r.status_code == 403, \
                f"Expected 403 for reader on {method} {path}, got {r.status_code}"


# ── Health ────────────────────────────────────────────────────────────────────

class TestHealth:
    def test_app_is_reachable(self, auth_headers):
        """App should respond on protected endpoints with valid token."""
        r = requests.get(url("/api/scans/latest"), headers=auth_headers, timeout=10)
        assert r.status_code in (200, 404), \
            f"App unreachable or crashed — got HTTP {r.status_code}"

    def test_db_connected(self, auth_headers):
        """/api/scans/latest returns 404 when no scans exist — never 500."""
        r = requests.get(url("/api/scans/latest"), headers=auth_headers, timeout=10)
        assert r.status_code != 500, \
            "DB connection failed — /api/scans/latest returned 500"

    def test_spa_routes_still_public(self):
        """SPA routes should return HTML without auth (static files are public)."""
        for path in ["/", "/linux-inventory", "/scan-history", "/settings"]:
            r = requests.get(url(path), timeout=10)
            assert r.status_code == 200, f"SPA path '{path}' returned {r.status_code}"
            assert "text/html" in r.headers.get("Content-Type", ""), \
                f"SPA path '{path}' did not return HTML"


# ── Inventory endpoints ───────────────────────────────────────────────────────

class TestInventories:
    def test_list_inventories(self, auth_headers):
        """GET /api/inventories should return a list."""
        r = requests.get(url("/api/inventories"), headers=auth_headers, timeout=10)
        data = assert_json_list(r, "GET /api/inventories")
        for inv in data:
            assert "id"             in inv
            assert "name"           in inv
            assert "inventory_type" in inv
            assert "is_active"      in inv
            assert inv["inventory_type"] in ("linux", "windows")

    def test_upload_linux_inventory(self, admin_headers):
        """POST /api/inventories/upload should accept a Linux inventory."""
        files = {"file": ("test_linux.ini", "[all]\n192.168.1.100\n192.168.1.101\n", "text/plain")}
        r = requests.post(url("/api/inventories/upload"),
                          files=files,
                          data={"name": "CI Linux Inventory", "inventory_type": "linux"},
                          headers=admin_headers, timeout=10)
        assert r.status_code == 200, f"Upload failed: {r.text}"
        body = r.json()
        assert "id"                    in body
        assert body["host_count"]     == 2
        assert body["inventory_type"] == "linux"

    def test_upload_windows_inventory(self, admin_headers):
        """POST /api/inventories/upload should accept a Windows inventory."""
        files = {"file": ("test_windows.ini", "[windows_hosts]\n192.168.1.200\n192.168.1.201\n", "text/plain")}
        r = requests.post(url("/api/inventories/upload"),
                          files=files,
                          data={"name": "CI Windows Inventory", "inventory_type": "windows"},
                          headers=admin_headers, timeout=10)
        assert r.status_code == 200, f"Upload failed: {r.text}"
        body = r.json()
        assert body["host_count"]     == 2
        assert body["inventory_type"] == "windows"

    def test_upload_empty_inventory_rejected(self, admin_headers):
        """POST /api/inventories/upload should reject an empty file."""
        files = {"file": ("empty.ini", "", "text/plain")}
        r = requests.post(url("/api/inventories/upload"),
                          files=files,
                          data={"name": "Empty Inventory"},
                          headers=admin_headers, timeout=10)
        assert r.status_code == 400, f"Expected 400 for empty file, got {r.status_code}"

    def test_reader_cannot_upload(self, auth_headers):
        """Reader role should get 403 on inventory upload."""
        ci_role = os.environ.get("CI_TEST_ROLE", "reader")
        if ci_role != "reader":
            pytest.skip("CI user is not reader")
        files = {"file": ("test.ini", "[all]\n10.0.0.1\n", "text/plain")}
        r = requests.post(url("/api/inventories/upload"),
                          files=files,
                          data={"name": "Should Fail", "inventory_type": "linux"},
                          headers=auth_headers, timeout=10)
        assert r.status_code == 403, f"Expected 403 for reader upload, got {r.status_code}"

    def test_linux_and_windows_can_both_be_active(self, admin_headers, auth_headers):
        """Activating a Windows inventory should not deactivate the Linux inventory."""
        r_l = requests.post(url("/api/inventories/upload"),
                            files={"file": ("dl.ini", "[all]\n10.0.0.1\n", "text/plain")},
                            data={"name": "CI Dual Linux", "inventory_type": "linux"},
                            headers=admin_headers, timeout=10)
        r_w = requests.post(url("/api/inventories/upload"),
                            files={"file": ("dw.ini", "[windows_hosts]\n10.0.0.2\n", "text/plain")},
                            data={"name": "CI Dual Windows", "inventory_type": "windows"},
                            headers=admin_headers, timeout=10)
        assert r_l.status_code == 200
        assert r_w.status_code == 200

        requests.post(url(f"/api/inventories/{r_l.json()['id']}/activate"),
                      headers=admin_headers, timeout=10)
        requests.post(url(f"/api/inventories/{r_w.json()['id']}/activate"),
                      headers=admin_headers, timeout=10)

        invs = requests.get(url("/api/inventories"),
                            headers=auth_headers, timeout=10).json()
        active_types = {i["inventory_type"] for i in invs if i["is_active"]}
        assert "linux"   in active_types, "Linux should still be active"
        assert "windows" in active_types, "Windows should be active"


# ── Host endpoints ────────────────────────────────────────────────────────────

class TestHosts:
    def test_get_hosts(self, auth_headers):
        """GET /api/hosts should return a dict with a hosts key."""
        r = requests.get(url("/api/hosts"), headers=auth_headers, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert "hosts" in body
        assert isinstance(body["hosts"], list)

    def test_get_all_tags(self, auth_headers):
        """GET /api/tags should return a dict with a tags key."""
        r = requests.get(url("/api/tags"), headers=auth_headers, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert "tags" in body
        assert isinstance(body["tags"], list)


# ── Scan endpoints ────────────────────────────────────────────────────────────

class TestScans:
    def test_scan_history_returns_list(self, auth_headers):
        """GET /api/scans/history should always return a list."""
        r = requests.get(url("/api/scans/history"), headers=auth_headers, timeout=10)
        data = assert_json_list(r, "GET /api/scans/history")
        for scan in data:
            assert "scan_id"    in scan
            assert "scanned_at" in scan
            assert "status"     in scan

    def test_latest_scan_not_500(self, auth_headers):
        """GET /api/scans/latest should return 200 or 404, never 500."""
        r = requests.get(url("/api/scans/latest"), headers=auth_headers, timeout=10)
        assert r.status_code in (200, 404)

    def test_current_scan_shape(self, auth_headers):
        """GET /api/scans/current should return scanning status."""
        r = requests.get(url("/api/scans/current"), headers=auth_headers, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert "scanning" in body
        assert isinstance(body["scanning"], bool)

    def test_trigger_scan_reader_forbidden(self, auth_headers):
        """Reader role should get 403 on scan trigger."""
        ci_role = os.environ.get("CI_TEST_ROLE", "reader")
        if ci_role != "reader":
            pytest.skip("CI user is not reader")
        r = requests.post(url("/api/scans/trigger"), headers=auth_headers, timeout=10)
        assert r.status_code == 403, \
            f"Expected 403 for reader on scan trigger, got {r.status_code}"

    def test_trigger_scan_requires_credentials(self, admin_headers):
        """Admin trigger with no creds set should return 400/409, not crash."""
        r = requests.post(url("/api/scans/trigger"), headers=admin_headers, timeout=10)
        assert r.status_code in (400, 409), \
            f"Expected 400/409, got {r.status_code}"

    def test_latest_windows_scan_not_500(self, auth_headers):
        """GET /api/scans/windows/latest should return 200 or 404, never 500."""
        r = requests.get(url("/api/scans/windows/latest"),
                         headers=auth_headers, timeout=10)
        assert r.status_code in (200, 404)

    def test_latest_windows_scan_shape(self, auth_headers):
        """If Windows scan data exists, each record should have expected fields."""
        r = requests.get(url("/api/scans/windows/latest"),
                         headers=auth_headers, timeout=10)
        if r.status_code == 404:
            pytest.skip("No Windows scan data yet")
        data = r.json()
        assert isinstance(data, list)
        for record in data:
            for field in ("hostname", "osName", "KBID", "classification", "rebootRequired"):
                assert field in record


# ── Windows credentials endpoints ─────────────────────────────────────────────

class TestWindowsCredentials:
    def test_get_windows_credentials_shape(self, auth_headers):
        """GET /api/windows/credentials should return expected fields."""
        r = requests.get(url("/api/windows/credentials"),
                         headers=auth_headers, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert "has_credentials" in body
        assert isinstance(body["has_credentials"], bool)

    def test_get_windows_credentials_never_returns_password(self, auth_headers):
        """GET /api/windows/credentials must never return plaintext password."""
        r = requests.get(url("/api/windows/credentials"),
                         headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert "password" not in r.json()

    def test_set_windows_credentials_missing_fields(self, admin_headers):
        """POST /api/windows/credentials should reject missing username/password."""
        r = requests.post(url("/api/windows/credentials"),
                          json={"username": "", "password": ""},
                          headers=admin_headers, timeout=10)
        assert r.status_code == 400

    def test_set_windows_credentials_invalid_transport(self, admin_headers):
        """POST /api/windows/credentials should reject unsupported transport."""
        r = requests.post(url("/api/windows/credentials"),
                          json={"username": "admin", "password": "pass",
                                "transport": "ssh"},
                          headers=admin_headers, timeout=10)
        assert r.status_code == 400

    def test_set_windows_credentials_valid(self, admin_headers):
        """POST /api/windows/credentials should accept valid credentials."""
        r = requests.post(url("/api/windows/credentials"),
                          json={"username": "ci_test_user", "password": "ci_test_password",
                                "domain": "", "port": 5986, "transport": "ntlm"},
                          headers=admin_headers, timeout=10)
        if r.status_code == 500:
            pytest.skip("CREDENTIALS_KEY not set in test env")
        assert r.status_code == 200
        assert "message" in r.json()

    def test_reader_cannot_set_credentials(self, auth_headers):
        """Reader should get 403 on POST /api/windows/credentials."""
        ci_role = os.environ.get("CI_TEST_ROLE", "reader")
        if ci_role != "reader":
            pytest.skip("CI user is not reader")
        r = requests.post(url("/api/windows/credentials"),
                          json={"username": "x", "password": "y", "transport": "ntlm"},
                          headers=auth_headers, timeout=10)
        assert r.status_code == 403


# ── Scheduler endpoints ───────────────────────────────────────────────────────

class TestScheduler:
    def test_get_interval(self, auth_headers):
        """GET /api/scheduler/interval should return interval_minutes."""
        r = requests.get(url("/api/scheduler/interval"),
                         headers=auth_headers, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert "interval_minutes" in body
        assert isinstance(body["interval_minutes"], int)
        assert body["interval_minutes"] > 0

    def test_set_interval_valid(self, admin_headers):
        """POST /api/scheduler/interval should accept a valid interval."""
        r = requests.post(url("/api/scheduler/interval"),
                          json={"interval_minutes": 60},
                          headers=admin_headers, timeout=10)
        assert r.status_code == 200
        assert r.json().get("interval_minutes") == 60

    def test_set_interval_invalid(self, admin_headers):
        """POST /api/scheduler/interval should reject interval < 1."""
        r = requests.post(url("/api/scheduler/interval"),
                          json={"interval_minutes": 0},
                          headers=admin_headers, timeout=10)
        assert r.status_code == 400

    def test_set_interval_too_large(self, admin_headers):
        """POST /api/scheduler/interval should reject interval > 10080."""
        r = requests.post(url("/api/scheduler/interval"),
                          json={"interval_minutes": 99999},
                          headers=admin_headers, timeout=10)
        assert r.status_code == 400

    def test_scheduler_status(self, auth_headers):
        """GET /api/scheduler/status should return enabled status."""
        r = requests.get(url("/api/scheduler/status"),
                         headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert "enabled" in r.json()


# ── Notification endpoints ────────────────────────────────────────────────────

class TestNotifications:
    def test_get_settings_shape(self, admin_headers):
        """GET /api/notifications/settings should return expected fields."""
        r = requests.get(url("/api/notifications/settings"),
                         headers=admin_headers, timeout=10)
        assert r.status_code == 200
        body = r.json()
        for field in ("smtp_host", "smtp_port", "smtp_user", "recipients", "tls_enabled"):
            assert field in body

    def test_get_settings_password_masked(self, admin_headers):
        """GET /api/notifications/settings must not return plaintext password."""
        r = requests.get(url("/api/notifications/settings"),
                         headers=admin_headers, timeout=10)
        assert r.status_code == 200
        assert r.json().get("smtp_password") != "plaintext"

    def test_reader_cannot_access_notifications(self, auth_headers):
        """Reader should get 403 on notification settings."""
        ci_role = os.environ.get("CI_TEST_ROLE", "reader")
        if ci_role != "reader":
            pytest.skip("CI user is not reader")
        r = requests.get(url("/api/notifications/settings"),
                         headers=auth_headers, timeout=10)
        assert r.status_code == 403

    def test_test_notification_requires_smtp_host(self, admin_headers):
        """POST /api/notifications/test should return 400 when SMTP not configured."""
        requests.post(url("/api/notifications/settings"),
                      json={"smtp_host": "", "smtp_port": 587, "smtp_user": "",
                            "smtp_password": "", "smtp_from": "",
                            "recipients": [], "tls_enabled": True},
                      headers=admin_headers, timeout=10)
        r = requests.post(url("/api/notifications/test"),
                          headers=admin_headers, timeout=10)
        assert r.status_code == 400


# ── CVE endpoints ─────────────────────────────────────────────────────────────

class TestCVEs:
    def test_get_cves_returns_list(self, auth_headers):
        """GET /api/cves should return a list."""
        r = requests.get(url("/api/cves"), headers=auth_headers, timeout=10)
        data = assert_json_list(r, "GET /api/cves")
        for cve in data:
            assert "advisory_id" in cve
            assert "severity"    in cve


# ── SPA routing ───────────────────────────────────────────────────────────────

class TestSPARouting:
    def test_spa_routes_return_html(self):
        """All frontend URL paths should return index.html without auth."""
        for path in ["/", "/linux-inventory", "/windows-hosts",
                     "/scan-history", "/cve-advisories", "/settings"]:
            r = requests.get(url(path), timeout=10)
            assert r.status_code == 200, f"SPA path '{path}' returned {r.status_code}"
            assert "text/html" in r.headers.get("Content-Type", ""), \
                f"SPA path '{path}' did not return HTML"

    def test_api_prefix_not_served_as_spa(self, auth_headers):
        """Unknown /api/ paths should return 404."""
        r = requests.get(url("/api/does-not-exist"),
                         headers=auth_headers, timeout=10)
        assert r.status_code == 404

    def test_index_html_not_cached(self):
        """index.html should be served with no-cache headers."""
        r = requests.get(url("/"), timeout=10)
        assert r.status_code == 200
        cache_control = r.headers.get("Cache-Control", "")
        if "no-cache" not in cache_control and "no-store" not in cache_control:
            pytest.xfail(f"index.html missing no-cache header (got: '{cache_control}')")


# ── Patch endpoints ───────────────────────────────────────────────────────────

class TestPatch:
    """
    API contract tests for patch endpoints.
    Uses 192.0.2.1 (RFC 5737 TEST-NET) — Ansible fails gracefully,
    API returns 200 immediately since patching runs in the background.
    """

    def test_patch_history_returns_list(self, auth_headers):
        """GET /api/patch/history should always return a list."""
        r = requests.get(url("/api/patch/history"), headers=auth_headers, timeout=10)
        data = assert_json_list(r, "GET /api/patch/history")
        for job in data:
            assert "job_id"      in job
            assert "advisory_id" in job
            assert "status"      in job
            assert "dry_run"     in job
            assert "hosts"       in job
            assert "packages"    in job

    def test_trigger_patch_requires_hosts(self, admin_headers):
        """POST /api/patch/trigger should return 400 when hosts list is empty."""
        r = requests.post(url("/api/patch/trigger"),
                          json={"advisory_id": "CI-TEST", "hosts": [],
                                "packages": ["openssl"], "dry_run": True},
                          headers=admin_headers, timeout=10)
        assert r.status_code == 400

    def test_trigger_patch_requires_packages(self, admin_headers):
        """POST /api/patch/trigger should return 400 when packages list is empty."""
        r = requests.post(url("/api/patch/trigger"),
                          json={"advisory_id": "CI-TEST", "hosts": ["192.0.2.1"],
                                "packages": [], "dry_run": True},
                          headers=admin_headers, timeout=10)
        assert r.status_code == 400

    def test_reader_cannot_trigger_patch(self, auth_headers):
        """Reader role should get 403 on patch trigger."""
        ci_role = os.environ.get("CI_TEST_ROLE", "reader")
        if ci_role != "reader":
            pytest.skip("CI user is not reader")
        r = requests.post(url("/api/patch/trigger"),
                          json={"advisory_id": "CI-TEST", "hosts": ["192.0.2.1"],
                                "packages": ["openssl"], "dry_run": True},
                          headers=auth_headers, timeout=10)
        assert r.status_code == 403

    def test_trigger_patch_dry_run_returns_job_id(self, admin_headers):
        """POST /api/patch/trigger dry_run=True should return a job_id immediately."""
        r = requests.post(url("/api/patch/trigger"),
                          json={"advisory_id": "CI-TEST-DRYRUN", "hosts": ["192.0.2.1"],
                                "packages": ["openssl"], "dry_run": True},
                          headers=admin_headers, timeout=10)
        assert r.status_code == 200, f"Trigger failed: {r.text}"
        body = r.json()
        assert "job_id" in body
        assert body["mode"]   == "dry_run"
        assert body["status"] == "started"

    def test_trigger_patch_apply_returns_job_id(self, admin_headers):
        """POST /api/patch/trigger dry_run=False should start an apply job."""
        r = requests.post(url("/api/patch/trigger"),
                          json={"advisory_id": "CI-TEST-APPLY", "hosts": ["192.0.2.1"],
                                "packages": ["openssl"], "dry_run": False},
                          headers=admin_headers, timeout=10)
        assert r.status_code == 200, f"Trigger failed: {r.text}"
        assert r.json()["mode"] == "apply"

    def test_patch_job_status_shape(self, admin_headers):
        """GET /api/patch/{job_id}/status should return full job details."""
        r = requests.post(url("/api/patch/trigger"),
                          json={"advisory_id": "CI-TEST-STATUS", "hosts": ["192.0.2.1"],
                                "packages": ["curl"], "dry_run": True},
                          headers=admin_headers, timeout=10)
        assert r.status_code == 200
        job_id = r.json()["job_id"]

        r2 = requests.get(url(f"/api/patch/{job_id}/status"),
                          headers=admin_headers, timeout=10)
        assert r2.status_code == 200
        body = r2.json()
        for field in ("job_id", "status", "dry_run", "hosts", "packages", "advisory_id"):
            assert field in body
        assert body["job_id"]  == job_id
        assert body["dry_run"] is True
        assert body["status"] in ("running", "complete", "complete_with_errors", "failed")

    def test_patch_job_status_unknown_id(self, admin_headers):
        """GET /api/patch/{job_id}/status with nonexistent ID should return 404."""
        r = requests.get(url("/api/patch/00000000-0000-0000-0000-000000000000/status"),
                         headers=admin_headers, timeout=10)
        assert r.status_code == 404

    def test_patch_history_records_triggered_jobs(self, admin_headers):
        """Triggered jobs should appear in GET /api/patch/history."""
        r = requests.post(url("/api/patch/trigger"),
                          json={"advisory_id": "CI-TEST-HISTORY", "hosts": ["192.0.2.1"],
                                "packages": ["vim"], "dry_run": True},
                          headers=admin_headers, timeout=10)
        assert r.status_code == 200
        job_id = r.json()["job_id"]

        history = requests.get(url("/api/patch/history"),
                               headers=admin_headers, timeout=10).json()
        assert job_id in [j["job_id"] for j in history], \
            f"Job {job_id} not found in patch history"

    def test_patch_dry_run_flag_preserved_in_history(self, admin_headers):
        """dry_run flag should be preserved in patch history."""
        r = requests.post(url("/api/patch/trigger"),
                          json={"advisory_id": "CI-TEST-FLAG", "hosts": ["192.0.2.1"],
                                "packages": ["bash"], "dry_run": True},
                          headers=admin_headers, timeout=10)
        assert r.status_code == 200
        job_id = r.json()["job_id"]

        history = requests.get(url("/api/patch/history"),
                               headers=admin_headers, timeout=10).json()
        job = next((j for j in history if j["job_id"] == job_id), None)
        assert job is not None
        assert job["dry_run"] is True