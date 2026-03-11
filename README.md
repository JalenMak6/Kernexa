# Kernexa

A patch compliance platform for Linux infrastructure. Kernexa uses Ansible to scan remote hosts for pending security patches, outdated kernels, and CVE advisories — all surfaced in a clean web dashboard.

![Kernexa Dashboard1](images/Dashboard11.png)
![Kernexa Dashboard3](images/Dashboard3.png)
![Kernexa Dashboard4](images/Dashboard4.png)


## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3 / FastAPI |
| Scanner | Ansible + ansible-runner |
| Database | PostgreSQL 16 |
| Frontend | React + Vite |
| Deployment | Docker Compose |

## Current Supported OS and CVE advisories

| Distribution | Versions | CVE Source |
|---|---|---|
| RHEL | 7, 8, 9, 10 | Red Hat Security API (RHSA) |
| Rocky Linux | 8, 9 | Rocky Errata API (RLSA) |
| Ubuntu | 20.04, 22.04, 24.04 | Ubuntu CVE Tracker |

> Other distributions are scanned for kernel/package status but CVE enrichment will not be available.

---

## Quick Start

**1. Clone and configure**
```bash
git clone <your-repo-url>
cd kernexa
cp .env.example .env        # edit with your preferred credentials
```

**2. Generate a credentials encryption key**
```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```
Add the output to your `.env` as `CREDENTIALS_KEY`.

**3. Start services**
```bash
docker compose up --build -d
```

Open [http://localhost:8000](http://localhost:8000) — Adminer at [http://localhost:8080](http://localhost:8080).

---

## Configuration

### .env

Copy `.env.example` to `.env` and set your own values. This file is never committed.

```env
POSTGRES_DB=kernexa
POSTGRES_USER=kernexa_user
POSTGRES_PASSWORD=changeme
POSTGRES_PORT=5432
NVD_API_KEY=your-nvd-api-key-here
CREDENTIALS_KEY=your-fernet-key-here
```

The app reads these automatically via Docker Compose — no need to edit `database.py` or `docker-compose.yml`.

**NVD_API_KEY** is optional but recommended — it raises the NVD rate limit significantly when scoring CVEs. Get one free at [nvd.nist.gov/developers/request-an-api-key](https://nvd.nist.gov/developers/request-an-api-key).

**CREDENTIALS_KEY** is required. Generate a valid Fernet key with:
```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```
Keep this key safe — losing it means existing encrypted credentials in the DB can no longer be decrypted and will need to be re-entered in the UI.

### SSH Credentials

SSH credentials are entered through the UI per inventory. They are encrypted with AES-256 (Fernet) before being written to the database, and decrypted at scan time before being passed to ansible-runner. No plaintext credentials are ever written to disk or stored in the database.

---

## Project Structure

```
.
├── main.py              # FastAPI — all API routes
├── scanner.py           # ansible-runner integration
├── database.py          # DB queries (psycopg2)
├── enricher.py          # CVE enrichment (RHSA / RLSA / Ubuntu) + CVSS scoring
├── init_db.py           # Schema init — safe to re-run on upgrades
├── patch_scan.yml       # Ansible playbook
├── docker-compose.yml
├── Dockerfile
├── .env                 # Your local config (not committed)
├── .env.example         # Template — copy to .env
├── inventory/hosts      # Active inventory (written at runtime)
└── patch-scan-ui/       # React + Vite frontend source
```

---

## How It Works

1. Upload an Ansible inventory and set SSH credentials in the UI
2. Trigger a scan manually or let the auto-scheduler run every 3 hours
3. Ansible collects kernel versions and pending security packages from each host using raw SSH — no Python version requirement on remote hosts
4. Results are saved to PostgreSQL and CVE data is enriched from upstream security APIs
5. CVSS scores are fetched automatically — Red Hat Security Data API as primary source, NVD as fallback
6. The dashboard shows compliance status, outdated kernels, CVE advisories, and CVSS scores per host

---

## Features

**Scanning**
- Kernel compliance — current vs latest available kernel per host
- Pending security packages per host
- Raw SSH scanning — works on any Python version including Python 2.6, 3.6, or no Python at all
- Auto-scheduler runs every 3 hours; manual trigger available from the UI
- Scan failure capture — per-host Ansible errors and unreachable hosts surfaced in the UI with full Ansible log

**CVE Advisories**
- Enriched from Red Hat (RHSA), Rocky Linux (RLSA), and Ubuntu CVE Tracker
- CVSS scores fetched automatically after every scan — Red Hat scores preferred, NVD fallback for unscored CVEs
- Score badge shows source (`RH` or `NVD`) so you know whether the score reflects RHEL-specific context
- Sortable by CVSS score; filterable by severity

**Host Management**
- Tag hosts with labels like `production`, `staging`, `dmz`, `web`, `db`, `infra` or any custom tag
- Filter the dashboard and VM Inventory by tag
- Tags persist across scans and are managed inline from the host table

**Security**
- SSH credentials encrypted at rest using AES-256 (Fernet symmetric encryption)
- Encryption key stored separately in `.env`, never in the database
- Credentials decrypted in memory only at scan time — never written to disk

---

## Database Schema

| Table | Description |
|-------|-------------|
| `scan_runs` | Scan metadata — ID, status, timestamp, return code, per-host failures, Ansible log |
| `scan_results` | Per-host kernel versions and package→source map |
| `scan_packages` | Pending security packages per host per scan |
| `cve_details` | Enriched CVE/advisory data with CVSS scores cached from upstream APIs |
| `inventories` | Uploaded inventory files |
| `credentials` | SSH credentials per inventory (AES-256 encrypted) |
| `hosts` | Known hostnames |
| `host_tags` | Tags assigned to hosts — persists across scans |

---

## API Docs

Full interactive API docs are available at [http://localhost:8000/docs](http://localhost:8000/docs) once the app is running (powered by FastAPI's built-in Swagger UI).

---

## Development

**Backend without Docker**
```bash
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload
```

**Frontend dev server**
```bash
cd patch-scan-ui
npm install
npm run dev    # Vite on :5173 — proxies API calls to :8000
```