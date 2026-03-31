# ── Patch endpoints ───────────────────────────────────────────────────────────
import requests
from .utils import url, assert_json_list

class TestPatch:
    """
    Tests for the patch trigger, status, and history endpoints.

    Strategy: These tests verify the API contract only — not whether patches
    actually succeed on real hosts. We use 192.168.1.102 (RFC 5737 TEST-NET) as
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
                          json={
                              "advisory_id": "CI-TEST-ADVISORY",
                              "hosts":       [],
                              "packages":    ["openssl"],
                              "dry_run":     True,
                          },
                          timeout=10)
        assert r.status_code == 400, \
            f"Expected 400 for empty hosts, got {r.status_code}"

    def test_trigger_patch_requires_packages(self):
        """POST /api/patch/trigger should return 400 when packages list is empty."""
        r = requests.post(url("/api/patch/trigger"),
                          json={
                              "advisory_id": "CI-TEST-ADVISORY",
                              "hosts":       ["192.168.1.102"],   # RFC 5737 TEST-NET — never routable, Ansible will fail gracefully
                              "packages":    [],
                              "dry_run":     True,
                          },
                          timeout=10)
        assert r.status_code == 400, \
            f"Expected 400 for empty packages, got {r.status_code}"

    def test_trigger_patch_dry_run_returns_job_id(self):
        """POST /api/patch/trigger with dry_run=True should start a job and return a job_id."""
        r = requests.post(url("/api/patch/trigger"),
                          json={
                              "advisory_id": "CI-TEST-ADVISORY",
                              "hosts":       ["192.168.1.102"],   # RFC 5737 TEST-NET — never routable, Ansible will fail gracefully
                              "packages":    ["openssl"],
                              "dry_run":     True,
                          },
                          timeout=10)
        assert r.status_code == 200, \
            f"POST /api/patch/trigger failed with {r.status_code}: {r.text}"
        body = r.json()
        assert "job_id" in body,            "Response missing 'job_id'"
        assert "status" in body,            "Response missing 'status'"
        assert "mode"   in body,            "Response missing 'mode'"
        assert body["mode"] == "dry_run",   f"Expected mode='dry_run', got {body.get('mode')}"
        assert body["status"] == "started", f"Expected status='started', got {body.get('status')}"

    def test_trigger_patch_apply_returns_job_id(self):
        """POST /api/patch/trigger with dry_run=False should start an apply job."""
        r = requests.post(url("/api/patch/trigger"),
                          json={
                              "advisory_id": "CI-TEST-ADVISORY",
                              "hosts":       ["192.168.1.102"],   # RFC 5737 TEST-NET — never routable, Ansible will fail gracefully
                              "packages":    ["openssl"],
                              "dry_run":     False,
                          },
                          timeout=10)
        assert r.status_code == 200, \
            f"POST /api/patch/trigger (apply) failed with {r.status_code}: {r.text}"
        body = r.json()
        assert "job_id" in body,           "Response missing 'job_id'"
        assert body["mode"] == "apply",    f"Expected mode='apply', got {body.get('mode')}"

    def test_patch_job_status_shape(self):
        """GET /api/patch/{job_id}/status should return full job details."""
        # Trigger a job first to get a real job_id
        r = requests.post(url("/api/patch/trigger"),
                          json={
                              "advisory_id": "CI-TEST-STATUS",
                              "hosts":       ["192.168.1.102"],   # RFC 5737 TEST-NET — never routable, Ansible will fail gracefully
                              "packages":    ["curl"],
                              "dry_run":     True,
                          },
                          timeout=10)
        assert r.status_code == 200, f"Could not trigger patch job: {r.text}"
        job_id = r.json()["job_id"]

        # Poll status
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
        assert body["job_id"] == job_id, "Returned job_id does not match requested job_id"
        assert body["dry_run"] is True,  "dry_run flag should be True for this job"

    def test_patch_job_status_unknown_id(self):
        """GET /api/patch/{job_id}/status with a nonexistent ID should return 404."""
        r = requests.get(url("/api/patch/00000000-0000-0000-0000-000000000000/status"),
                         timeout=10)
        assert r.status_code == 404, \
            f"Expected 404 for unknown job_id, got {r.status_code}"

    def test_patch_history_records_triggered_jobs(self):
        """Jobs triggered via POST /api/patch/trigger should appear in GET /api/patch/history."""
        # Trigger a job
        r = requests.post(url("/api/patch/trigger"),
                          json={
                              "advisory_id": "CI-TEST-HISTORY",
                              "hosts":       ["192.168.1.102"],   # RFC 5737 TEST-NET — never routable, Ansible will fail gracefully
                              "packages":    ["vim"],
                              "dry_run":     True,
                          },
                          timeout=10)
        assert r.status_code == 200
        job_id = r.json()["job_id"]

        # Check it appears in history
        r2 = requests.get(url("/api/patch/history"), timeout=10)
        assert r2.status_code == 200
        history = r2.json()
        job_ids = [j["job_id"] for j in history]
        assert job_id in job_ids, \
            f"Triggered job {job_id} not found in patch history"

    def test_patch_dry_run_flag_preserved_in_history(self):
        """dry_run flag set at trigger time should be preserved in history."""
        r = requests.post(url("/api/patch/trigger"),
                          json={
                              "advisory_id": "CI-TEST-DRYRUN-FLAG",
                              "hosts":       ["192.168.1.102"],   # RFC 5737 TEST-NET — never routable, Ansible will fail gracefully
                              "packages":    ["bash"],
                              "dry_run":     True,
                          },
                          timeout=10)
        assert r.status_code == 200
        job_id = r.json()["job_id"]

        r2 = requests.get(url("/api/patch/history"), timeout=10)
        history = r2.json()
        job = next((j for j in history if j["job_id"] == job_id), None)
        assert job is not None,      f"Job {job_id} not found in history"
        assert job["dry_run"] is True, "dry_run should be True in history record"