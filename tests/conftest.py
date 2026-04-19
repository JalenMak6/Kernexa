"""
conftest.py
Pytest configuration and shared fixtures for Kernexa API tests.

Required environment variables:
    TEST_BASE_URL   — base URL of the running app (default: http://localhost:8000)
    CI_TEST_USER    — CI test username (must exist in DB, seeded by init_db.py)
    CI_TEST_PASS    — CI test password

The auth fixture logs in once per test session and provides headers to all tests.
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("TEST_BASE_URL", "http://localhost:8000")


def url(path: str) -> str:
    return f"{BASE_URL}{path}"


# ── Session-scoped auth fixture ───────────────────────────────────────────────

@pytest.fixture(scope="session")
def auth_headers():
    """
    Log in with CI test credentials once per session.
    Returns Authorization headers to attach to every request.

    Fails fast with a clear message if:
      - CI_TEST_USER / CI_TEST_PASS env vars are not set
      - Login returns non-200 (user not seeded, wrong password, app not ready)
    """
    ci_user = os.environ.get("CI_TEST_USER", "").strip()
    ci_pass = os.environ.get("CI_TEST_PASS", "").strip()

    if not ci_user or not ci_pass:
        pytest.fail(
            "CI_TEST_USER and CI_TEST_PASS environment variables must be set. "
            "These are seeded into the DB via init_db.py on container startup."
        )

    r = requests.post(
        url("/api/auth/login"),
        json={"username": ci_user, "password": ci_pass},
        timeout=10,
    )

    if r.status_code != 200:
        pytest.fail(
            f"Auth login failed with HTTP {r.status_code}: {r.text}\n"
            f"Make sure CI_TEST_USER='{ci_user}' exists in the DB. "
            f"Check that KERNEXA_ADMIN_USER/PASS and CI_TEST_USER/PASS are set "
            f"and that init_db.py ran on container startup."
        )

    token = r.json().get("access_token")
    if not token:
        pytest.fail(f"Login succeeded but no access_token in response: {r.json()}")

    print(f"\n✓ CI authenticated as '{ci_user}' (role: {r.json()['user']['role']})")
    return {"Authorization": f"Bearer {token}"}


# ── Admin auth fixture (for user management tests) ────────────────────────────

@pytest.fixture(scope="session")
def admin_headers():
    """
    Log in as admin for tests that need admin-only endpoints.
    Skips if KERNEXA_ADMIN_USER / KERNEXA_ADMIN_PASS are not set.
    """
    admin_user = os.environ.get("KERNEXA_ADMIN_USER", "").strip()
    admin_pass = os.environ.get("KERNEXA_ADMIN_PASS", "").strip()

    if not admin_user or not admin_pass:
        pytest.skip("KERNEXA_ADMIN_USER / KERNEXA_ADMIN_PASS not set — skipping admin tests")

    r = requests.post(
        url("/api/auth/login"),
        json={"username": admin_user, "password": admin_pass},
        timeout=10,
    )

    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.text}")

    token = r.json().get("access_token")
    return {"Authorization": f"Bearer {token}"}