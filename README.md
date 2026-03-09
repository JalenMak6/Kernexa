# Patch Scan Platform

A web application for scanning Linux hosts for pending security patches using Ansible. The platform provides a React frontend and a FastAPI backend, orchestrating Ansible playbooks to collect kernel version and pending package data from remote hosts.

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3 / FastAPI |
| Scanner | ansible-runner + custom playbook |
| Database | PostgreSQL 16 (psycopg2) |
| Frontend | React + Vite (JSX) |
| Deployment | Docker Compose |

## Prerequisites

- Docker & Docker Compose
- Node.js + npm (for frontend development)
- Python 3.12+ (for local development without Docker)

## Quick Start

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd patch-scan-platform

# 2. Build and start services (app on :8000, postgres on :5432, adminer on :8080)
docker compose up --build -d

# 3. Initialize the database schema (run once)
docker compose exec app python init_db.py

# 4. Build the frontend
cd patch-scan-ui
npm install
npm run build
# The dist/ output is served by FastAPI automatically
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

Adminer (DB GUI) is available at [http://localhost:8080](http://localhost:8080).

## Project Structure

```
.
├── main.py              # FastAPI app — all API routes
├── scanner.py           # ansible-runner integration
├── database.py          # All DB queries (psycopg2)
├── init_db.py           # Creates DB tables
├── patch_scan.yml       # Ansible playbook
├── docker-compose.yml   # Docker Compose config
├── Dockerfile           # App container build
├── inventory/
│   └── hosts            # Active inventory file (written at runtime)
├── env/
│   └── extravars        # Ansible SSH credentials (NOT committed)
├── artifacts/           # Ansible runner job artifacts (runtime, not committed)
├── dist/                # Built frontend (served by FastAPI)
└── patch-scan-ui/       # React + Vite source
    └── src/
        ├── App.jsx
        ├── utils/api.js
        └── components/
            ├── InventoryManager.jsx
            ├── CredentialsForm.jsx
            ├── HostsManager.jsx
            ├── HostRow.jsx
            └── StatCard.jsx
```

## Configuration

### Database

Configured via Docker Compose environment variables:

| Variable | Value |
|----------|-------|
| Host | `db` (Docker internal) / `localhost:5432` (external) |
| Database | `patchscan` |
| User | `patchadmin` |
| Password | `patchpassword` |

> **Note:** Change the default credentials before deploying to any environment accessible outside localhost.

### SSH Credentials

SSH credentials are entered through the UI and stored in the `credentials` database table (plaintext). They are written to `env/extravars` at scan time and are **not** stored in the repository.

## API Reference

### Inventories

#### `GET /api/inventories`
Returns a list of all saved inventory files.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Production Hosts",
    "host_count": 5,
    "is_active": true,
    "created_at": "2026-03-01T10:00:00Z"
  }
]
```

---

#### `POST /api/inventories/upload`
Upload a new Ansible inventory file. Accepts `multipart/form-data`.

**Form fields:**
| Field | Type | Description |
|-------|------|-------------|
| `file` | file | Ansible INI-format inventory file |
| `name` | string | Display name for the inventory |

**Response:**
```json
{
  "id": 2,
  "name": "Staging Hosts",
  "host_count": 3,
  "message": "Uploaded 3 hosts"
}
```

**Errors:**
- `400` — No valid hosts found in the uploaded file

---

#### `POST /api/inventories/{id}/activate`
Sets the specified inventory as active and writes it to `inventory/hosts`.

**Response:**
```json
{ "message": "Activated inventory with 5 hosts" }
```

---

#### `DELETE /api/inventories/{id}`
Deletes the specified inventory.

**Response:**
```json
{ "message": "Deleted" }
```

---

### Credentials

#### `POST /api/credentials`
Save SSH credentials for a specific inventory. Stored plaintext in the database and used at scan time.

**Request body:**
```json
{
  "inventory_id": 1,
  "username": "ansible",
  "password": "secret"
}
```

**Response:**
```json
{ "message": "Credentials saved" }
```

**Errors:**
- `400` — Username and password are required

---

#### `GET /api/credentials/{inventory_id}`
Fetch saved credentials for an inventory. Password is never returned.

**Response (credentials exist):**
```json
{
  "username": "ansible",
  "has_credentials": true,
  "updated_at": "2026-03-01T10:00:00Z"
}
```

**Response (no credentials):**
```json
{ "username": "", "has_credentials": false }
```

---

### Hosts

#### `GET /api/hosts`
Returns the list of hosts from the currently active inventory file (`inventory/hosts`).

**Response:**
```json
{ "hosts": ["192.168.1.10", "192.168.1.11", "web01.example.com"] }
```

---

#### `POST /api/hosts`
Overwrites the active inventory file with a new host list. Hosts are written under the `[all]` group.

**Request body:**
```json
{ "hosts": ["192.168.1.10", "192.168.1.11"] }
```

**Response:**
```json
{
  "message": "Inventory updated with 2 hosts",
  "hosts": ["192.168.1.10", "192.168.1.11"]
}
```

**Errors:**
- `400` — Host list cannot be empty

---

### Scans

#### `POST /api/scans/trigger`
Triggers a background patch scan against the active inventory using saved credentials.

**Response:**
```json
{
  "scan_id": "a1b2c3d4-...",
  "status": "started",
  "scanned_at": "2026-03-08T12:00:00Z"
}
```

**Errors:**
- `400` — No credentials set for the active inventory
- `409` — A scan is already in progress

---

#### `GET /api/scans/current`
Returns the status of any in-progress scan. Useful for syncing state across browser tabs.

**Response (scan running):**
```json
{ "scanning": true, "scan_id": "a1b2c3d4-...", "status": "running" }
```

**Response (no active scan):**
```json
{ "scanning": false }
```

---

#### `GET /api/scans/latest`
Returns the results of the most recent completed scan, including per-host kernel versions and pending packages.

**Errors:**
- `404` — No scans found

---

#### `GET /api/scans/history`
Returns a list of all past scan runs with metadata (scan_id, status, return code, timestamp).

---

#### `GET /api/scans/{scan_id}/status`
Poll the status of a specific scan by its ID.

**Response:**
```json
{ "scan_id": "a1b2c3d4-...", "status": "complete" }
```

Possible status values: `pending`, `running`, `complete`, `failed: <reason>`, `unknown`

---

### Scheduler

#### `GET /api/scheduler/status`
Returns the status of the auto-scan scheduler (runs every 3 hours automatically).

**Response:**
```json
{
  "enabled": true,
  "next_run": "2026-03-08T15:00:00Z",
  "interval_minutes": 3
}
```

---

### CVEs

#### `GET /api/cves`
Returns enriched CVE details for packages detected in the latest scan.

---

## Scan Flow

1. User triggers a scan via `POST /api/scans/trigger` (or auto-scan fires every 3 hours)
2. API validates credentials and active inventory, then spawns a background task
3. `scanner.py` writes SSH creds to `env/extravars` and invokes `ansible-runner`
4. Ansible executes `patch_scan.yml` against `inventory/hosts`
5. Results are parsed from `runner_on_ok` events for the `"print kernel version and packages"` task
6. `database.py:save_to_db()` persists results to `scan_runs`, `scan_results`, and `scan_packages`
7. CVE enrichment runs automatically after the scan completes

## Database Schema

| Table | Description |
|-------|-------------|
| `scan_runs` | Scan metadata: scan_id, status, rc, timestamp |
| `scan_results` | Per-host kernel version info |
| `scan_packages` | Pending security packages per host per scan |
| `inventories` | Uploaded inventory files (stored as text) |
| `credentials` | SSH credentials per inventory (one-to-one, plaintext) |
| `hosts` | Legacy table (not actively used) |

## Development

### Backend only (no Docker)

```bash
pip install -r requirements.txt
# Set up a local PostgreSQL instance and update connection string in database.py
uvicorn main:app --reload
```

### Frontend only

```bash
cd patch-scan-ui
npm install
npm run dev   # Vite dev server on :5173
```

> Point the Vite proxy to `http://localhost:8000` for API calls during development.
