# Patch Scan Platform

A web application for scanning Linux hosts for pending security patches using Ansible.

## Repo Files

- `README.md` — user-facing documentation (setup, API reference, scan flow)
- `.gitignore` — excludes `artifacts/`, `env/extravars`, `inventory/hosts`, `__pycache__/`, `node_modules/`, `dist/`, `.env`

## Architecture

- **Backend**: Python/FastAPI (`main.py`) — REST API + serves React SPA from `dist/`
- **Scanner**: `scanner.py` — wraps `ansible_runner` to execute `patch_scan.yml` playbook
- **Database**: PostgreSQL via `psycopg2` (`database.py`) — connection targets host `db:5432`
- **Frontend**: React (JSX) + Vite in `patch-scan-ui/`
- **Deployment**: Docker Compose (`docker-compose.yml`) — `app` + `db` services

## Running the Project

```bash
# Start everything (app on :8000, postgres on :5432)
docker compose up --build -d

# Initialize DB schema (run once or after schema changes)
python init_db.py

# Build the frontend (output goes to patch-scan-ui/dist, then copy/mount to dist/)
cd patch-scan-ui && npm install && npm run build
```

## Key File Locations

| File | Purpose |
|------|---------|
| `main.py` | FastAPI app, all API routes |
| `scanner.py` | Ansible runner integration |
| `database.py` | All DB queries (psycopg2) |
| `init_db.py` | Creates DB tables |
| `patch_scan.yml` | Ansible playbook |
| `inventory/hosts` | Active inventory file (written at runtime) |
| `env/extravars` | Ansible credentials file (not being used for now, you need to input your credentials) |
| `patch-scan-ui/src/` | React source |
| `artifacts/` | Ansible runner job artifacts |

## Database Schema

- `scan_runs` — scan metadata (scan_id, status, rc, timestamp)
- `scan_results` — per-host kernel version info
- `scan_packages` — pending security packages per host per scan
- `inventories` — Ansible inventory files (stored as text content)
- `credentials` — SSH credentials per inventory (one-to-one, plaintext)
- `hosts` — legacy table (not actively used)

DB config: `host=db, port=5432, dbname=patchscan, user=patchadmin, password=patchpassword`

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
3. Ansible executes `patch_scan.yml` against `inventory/hosts`
4. Results parsed from `runner_on_ok` events for task `"print kernel version and packages"`
5. `database.py:save_to_db()` stores results in `scan_runs`, `scan_results`, `scan_packages`

## Frontend

- React + Vite; source in `patch-scan-ui/src/`
- `App.jsx` — main app component
- `src/utils/api.js` — API client
- `src/components/` — InventoryManager, CredentialsForm, HostsManager, HostRow, StatCard
- Built output served by FastAPI from `dist/` as a SPA (catch-all route)
