# Kernexa - Patch Scan Platform

A web application for scanning Linux hosts for pending security patches using Ansible, with CVE enrichment from vendor security APIs.

## Repo Files

- `README.md` — user-facing documentation (setup, API reference, scan flow)
- `.env.example` — template for environment variables (PostgreSQL credentials)
- `.gitignore` — excludes `artifacts/`, `env/extravars`, `inventory/hosts`, `__pycache__/`, `node_modules/`, `dist/`, `.env`, `*.key`, `*.pem`

## Architecture

- **Backend**: Python/FastAPI (`main.py`) — REST API + serves React SPA from `dist/`; APScheduler runs auto-scans every 3 hours
- **Scanner**: `scanner.py` — wraps `ansible_runner` to execute `project/patch_scan.yml` playbook
- **CVE Enrichment**: `enricher.py` — fetches RHSA/RLSA/Ubuntu CVE data from vendor APIs, caches in DB
- **Database**: PostgreSQL 16 via `psycopg2` (`database.py`) — connection targets host `db:5432`
- **Frontend**: React 19 + Vite 8 in `patch-scan-ui/`
- **Deployment**: Docker Compose (`docker-compose.yml`) — `app`, `db`, `adminer` services on `patch-net` network

## Running the Project

```bash
# Start everything (app on :8000, postgres on :5432, adminer on :8080)
docker compose up --build -d

# Initialize DB schema (run once or after schema changes)
python init_db.py

# Build the frontend (output goes to patch-scan-ui/dist, served by FastAPI)
cd patch-scan-ui && npm install && npm run build
```

## API Endpoints

- `GET /api/inventories` — list inventories
- `POST /api/inventories/upload` — upload inventory file (multipart)
- `POST /api/inventories/{id}/activate` — set active inventory (writes to `inventory/hosts`)
- `DELETE /api/inventories/{id}` — delete inventory
- `GET/POST /api/credentials` — manage per-inventory SSH credentials
- `GET /api/hosts` — list hosts from active inventory file
- `POST /api/hosts` — overwrite inventory file
- `POST /api/scans/trigger` — trigger background scan (requires active inventory + credentials)
- `GET /api/scans/latest` — latest scan results
- `GET /api/scans/history` — scan run history
- `GET /api/scans/{scan_id}/status` — poll scan status

## Scan Flow

1. `POST /api/scans/trigger` — validates credentials, spawns background task
2. `scanner.py:run_patch_scan()` — writes `env/extravars` with SSH creds, runs Ansible
3. Ansible executes `project/patch_scan.yml` against `inventory/hosts` — collects kernel, OS, pending packages, reboot time, advisory IDs
4. Results parsed from `runner_on_ok` events for task `"print kernel version and packages"`
5. `database.py:save_to_db()` stores results in `scan_runs`, `scan_results`, `scan_packages`
6. `enricher.py:enrich_all()` fetches CVE details from vendor APIs and caches in `cve_details`

## Database Schema (7 Tables)

Initialized by `init_db.py`:

- `scan_runs` — scan metadata (scan_id, scanned_at, status, return code)
- `scan_results` — per-host kernel info, package source map, advisory IDs
- `scan_packages` — pending security packages by host and scan
- `cve_details` — cached CVE/advisory data from Red Hat, Rocky, Ubuntu APIs
- `inventories` — uploaded Ansible inventory files (content, host count, active flag)
- `credentials` — SSH credentials per inventory
- `hosts` — host registry (hostname, added_at, active flag)

## Supported OS & CVE Sources

| Distribution | Versions | CVE Source |
|---|---|---|
| RHEL | 8, 9, 10 | Red Hat Security API (RHSA) |
| Rocky Linux | 8, 9 | Rocky Errata API (RLSA) |
| Ubuntu | 20.04, 22.04, 24.04 | Ubuntu CVE Tracker |

## Frontend

- React 19 + Vite 8; source in `patch-scan-ui/src/`
- `App.jsx` — main app shell; manages state for inventories, scans, credentials
- `src/utils/api.js` — fetch-based HTTP client for all API endpoints
- `src/utils/helpers.jsx` — date formatting, sorting utilities
- `src/utils/icons.jsx` — reusable SVG icon components
- `src/utils/csv.js` — export scan results to CSV
- `src/components/` — InventoryManager, CredentialsForm, HostsManager, HostRow, CveTab, StatCard
- Recharts (`^3.8.0`) for scan result visualization
- Built output served by FastAPI from `dist/` as a SPA (catch-all route)

## Docker

- **Dockerfile**: Multi-stage build — Node 20-alpine (React build) → Python 3.10-slim (runtime + Ansible)
- **docker-compose.yml**: `app` (FastAPI :8000), `db` (PostgreSQL 16 :5432), `adminer` (web DB admin :8080)
- Shared `patch-net` network; persistent volume for PostgreSQL data
