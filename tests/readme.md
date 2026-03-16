# Kernexa API Tests

Integration tests for the Kernexa API. Tests run against a live container and verify that all endpoints return the correct status codes, response shapes, and behaviour.

---

## Structure

```
tests/
└── test_api.py    # pytest integration tests — one class per API group
```

---

## Test Coverage

| Class | Endpoints Tested |
|---|---|
| `TestHealth` | App reachable, DB connected (no 500 errors) |
| `TestInventories` | `GET /api/inventories`, `POST /api/inventories/upload` |
| `TestHosts` | `GET /api/hosts`, `GET /api/tags` |
| `TestScans` | `GET /api/scans/history`, `/latest`, `/current` |
| `TestScheduler` | `GET/POST /api/scheduler/interval`, `GET /api/scheduler/status` |
| `TestNotifications` | `GET /api/notifications/settings` |
| `TestCVEs` | `GET /api/cves` |

---

## Running Tests Locally

**1. Start the stack:**
```bash
cp .env.example .env
# fill in your values
docker compose up -d
```

**2. Wait for the app to be ready:**
```bash
curl http://localhost:8000/api/scans/latest
# should return 200 or 404 — not 500
```

**3. Install test dependencies:**
```bash
pip install -r requirements-test.txt
```

**4. Run the tests:**
```bash
pytest tests/test_api.py --tb=short --verbose
```

**Run a specific test class:**
```bash
pytest tests/test_api.py::TestScans --tb=short --verbose
```

**Run a single test:**
```bash
pytest tests/test_api.py::TestScheduler::test_get_interval --tb=short --verbose
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `TEST_BASE_URL` | `http://localhost:8000` | Base URL of the running app |

Override for a different host:
```bash
TEST_BASE_URL=http://192.168.1.80:8000 pytest tests/test_api.py
```

---

## Running Against the Dev Environment

If the dev container is running on the CI runner VM:
```bash
TEST_BASE_URL=http://<runner-vm-ip>:8000 pytest tests/test_api.py --tb=short --verbose
```

---

## Adding New Tests

Add a new class to `test_api.py` following the existing pattern:

```python
class TestMyFeature:
    def test_something(self):
        r = requests.get(url("/api/my-endpoint"), timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert "expected_key" in body
```

Keep one class per API group and one test per behaviour. Tests should be:
- **Independent** — no test should depend on another test running first
- **Non-destructive** — avoid deleting data that other tests rely on
- **Fast** — each test should complete in under 5 seconds

---

## CI Integration

Tests run automatically in the CI pipeline on every push to the `dev` branch:

```
push to dev → build → scan → test (pytest) → push :latest
                               ↑
                         runs tests/test_api.py
                         against ephemeral container
                         tears down after all tests complete
```

If any test fails, the pipeline stops and the image is not pushed to the registry.