# Kernexa - Patch Scan Platform

A web application for scanning Linux hosts for pending security patches using Ansible, with CVE enrichment and CVSS scoring from vendor security APIs.

## Repo Files

- `README.md` — user-facing documentation (setup, features, schema)
- `api-endpoints.md` — full API reference with request/response examples
- `.env.example` — template for environment variables (PostgreSQL credentials, NVD API key)
- `.gitignore` — excludes `artifacts/`, `env/extravars`, `inventory/hosts`, `__pycache__/`, `node_modules/`, `dist/`, `.env`, `*.key`, `*.pem`

## Architecture

- **Backend**: Python/FastAPI (`main.py`) — REST API + serves React SPA from `dist/`; APScheduler runs auto-scans every 3 hours
- **Scanner**: `scanner.py` — wraps `ansible_runner` to execute `patch_scan.yml` playbook
- **CVE Enrichment**: `enricher.py` — fetches RHSA/RLSA/Ubuntu CVE data from vendor APIs, scores CVEs via Red Hat Security Data API (primary) and NVD (fallback), caches in DB
- **Database**: PostgreSQL 16 via `psycopg2` (`database.py`) — connection targets host `db:5432`
- **Frontend**: React 19 + Vite 8 in `patch-scan-ui/`
- **Deployment**: Docker Compose (`docker-compose.yml`) — `app`, `db`, `adminer` services on `patch-net` network

## Running the Project

```bash
# Start everything (app on :8000, postgres on :5432, adminer on :8080)
# Schema init, frontend build, and enrichment all run automatically
docker compose up --build -d
```

## API Endpoints

- `GET /api/inventories` — list inventories
- `POST /api/inventories/upload` — upload inventory file (multipart)
- `POST /api/inventories/{id}/activate` — set active inventory (writes to `inventory/hosts`)
- `DELETE /api/inventories/{id}` — delete inventory
- `GET/POST /api/credentials` — manage per-inventory SSH credentials
- `GET /api/hosts` — list hosts from active inventory file
- `POST /api/hosts` — overwrite inventory file
- `GET /api/hosts/{hostname}/tags` — list tags for a host
- `POST /api/hosts/{hostname}/tags` — add a tag to a host
- `DELETE /api/hosts/{hostname}/tags/{tag}` — remove a tag from a host
- `GET /api/tags` — list all unique tags in use
- `POST /api/scans/trigger` — trigger background scan (requires active inventory + credentials)
- `GET /api/scans/current` — returns any in-progress scan (for multi-tab sync)
- `GET /api/scans/latest` — latest scan results with per-host tags
- `GET /api/scans/history` — scan run history
- `GET /api/scans/{scan_id}/status` — poll scan status
- `GET /api/scans/{scan_id}/failures` — per-host failure details + Ansible log
- `GET /api/cves` — all enriched CVE advisories with CVSS scores and affected hosts
- `GET /api/scheduler/status` — auto-scan scheduler state and next run time

## Scan Flow

1. `POST /api/scans/trigger` — validates credentials, spawns background task
2. `scanner.py:run_patch_scan()` — writes `env/extravars` with SSH creds, runs Ansible
3. Ansible executes `patch_scan.yml` against `inventory/hosts` — two-play structure for Python 3.6.8 compatibility on RHEL8 hosts; collects kernel, OS, pending packages, reboot time, advisory IDs
4. Results parsed from `runner_on_ok` events; failures captured via `runner_on_failed` and `runner_on_unreachable`
5. `database.py:save_to_db()` stores results in `scan_runs`, `scan_results`, `scan_packages`
6. `enricher.py:enrich_all()` runs automatically post-scan:
   - Rocky/RHEL advisories fetched from vendor APIs → `cve_details`
   - CVSS scores fetched (Red Hat primary, NVD fallback) → `cve_details`
   - Ubuntu CVEs fetched per source package → `cve_details`
   - CVSS scores refreshed for any new Ubuntu CVEs

## Database Schema (8 Tables)

Initialized by `init_db.py` (safe to re-run — uses `CREATE IF NOT EXISTS` + `ADD COLUMN IF NOT EXISTS`):

- `scan_runs` — scan metadata (scan_id, scanned_at, status, rc, host_failures JSONB, ansible_log)
- `scan_results` — per-host kernel info, package source map, advisory IDs
- `scan_packages` — pending security packages by host and scan
- `cve_details` — cached CVE/advisory data with cvss_score, cvss_vector, cvss_version, cvss_source, nvd_fetched_at
- `inventories` — uploaded Ansible inventory files (content, host count, active flag)
- `credentials` — SSH credentials per inventory
- `hosts` — host registry (hostname, added_at, active flag)
- `host_tags` — tags assigned to hosts (hostname, tag); persists across scans

## Supported OS & CVE Sources

| Distribution | Versions | CVE Source |
|---|---|---|
| RHEL | 8, 9, 10 | Red Hat Security API (RHSA) |
| Rocky Linux | 8, 9 | Rocky Errata API (RLSA) |
| Ubuntu | 20.04, 22.04, 24.04 | Ubuntu CVE Tracker |

> Other distributions are scanned for kernel/package status but CVE enrichment is not available.

## CVSS Scoring

- `enricher.py:enrich_cvss()` runs after every scan with 8 concurrent workers
- Primary source: Red Hat Security Data API (`access.redhat.com/hydra/rest/securitydata/cve/{}.json`) — RHEL-context-aware scores
- Fallback: NVD API v2 (`services.nvd.nist.gov/rest/json/cves/2.0`) — generic scores
- Scores refresh every 7 days; `cvss_source` field records `redhat` or `nvd` per advisory
- NVD API key (`NVD_API_KEY` in `.env`) is optional but recommended to avoid rate limits

## Host Tags

- Stored in `host_tags` table — independent of scans, persist across rebuilds
- Managed inline in the host table UI (click `+ tag`) or via the host detail panel
- Predefined suggestions: `production`, `staging`, `dmz`, `web`, `db`, `infra`; free-form input also supported
- Tags appear as filter chips in Dashboard and VM Inventory views

## Frontend

- React 19 + Vite 8; source in `patch-scan-ui/src/`
- `App.jsx` — main app shell; manages state for scans, hosts, CVEs, filters, tag filter
- `src/utils/api.js` — fetch-based HTTP client for all API endpoints
- `src/utils/helpers.jsx` — date formatting, kernel comparison, badge utilities
- `src/utils/icons.jsx` — reusable SVG icon components
- `src/utils/csv.js` — export scan results to CSV
- `src/components/` — InventoryManager, CredentialsForm, HostsManager, HostRow, CveTab, StatCard
- `HostRow.jsx` — renders per-host row with inline tag editor and host detail panel
- `CveTab.jsx` — CVE table with CVSS badge (score + version + RH/NVD source pill), sort by CVSS, severity filter
- Recharts (`^3.8.0`) for kernel compliance donut and top packages bar chart
- Built output served by FastAPI from `dist/` as a SPA; root static files (e.g. `kernexa.png`) served via `FileResponse`

## Docker

- **Dockerfile**: Multi-stage build — Node 20-alpine (React build) → Python 3.10-slim (runtime + Ansible)
- **docker-compose.yml**: `app` (FastAPI :8000), `db` (PostgreSQL 16 :5432), `adminer` (web DB admin :8080)
- Shared `patch-net` network; persistent volume for PostgreSQL data
- Static assets: `patch-scan-ui/public/kernexa.png` must be present before build — Vite copies it to `dist/`; Cloudflare cache purge required after updates