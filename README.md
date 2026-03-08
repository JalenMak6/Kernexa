# Kernexa - Patch Scan Platform

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
│   └── extravars        # Ansible SSH credentials (NOT committed — see below)
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

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventories` | List all inventories |
| POST | `/api/inventories/upload` | Upload inventory file (multipart) |
| POST | `/api/inventories/{id}/activate` | Set active inventory |
| DELETE | `/api/inventories/{id}` | Delete inventory |
| GET | `/api/credentials` | List credentials |
| POST | `/api/credentials` | Save SSH credentials for an inventory |
| GET | `/api/hosts` | List hosts from active inventory |
| POST | `/api/hosts` | Overwrite active inventory hosts |
| POST | `/api/scans/trigger` | Trigger a background scan |
| GET | `/api/scans/latest` | Latest scan results |
| GET | `/api/scans/history` | Scan run history |
| GET | `/api/scans/{scan_id}/status` | Poll scan status |

## Scan Flow

1. User triggers a scan via `POST /api/scans/trigger`
2. API validates credentials and active inventory, then spawns a background task
3. `scanner.py` writes SSH creds to `env/extravars` and invokes `ansible-runner`
4. Ansible executes `patch_scan.yml` against `inventory/hosts`
5. Results are parsed from `runner_on_ok` events for the `"print kernel version and packages"` task
6. `database.py:save_to_db()` persists results to `scan_runs`, `scan_results`, and `scan_packages`

## Database Schema

| Table | Description |
|-------|-------------|
| `scan_runs` | Scan metadata: scan_id, status, rc, timestamp |
| `scan_results` | Per-host kernel version info |
| `scan_packages` | Pending security packages per host per scan |
| `inventories` | Uploaded inventory files (stored as text) |
| `credentials` | SSH credentials per inventory (one-to-one) |
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
