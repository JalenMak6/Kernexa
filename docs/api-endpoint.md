# API Endpoint Reference

Base URL: `http://localhost:8000`

---

## Inventories

### List Inventories
```
GET /api/inventories
```
Returns all saved inventory files.

**Example**
```bash
curl http://localhost:8000/api/inventories
```

**Response**
```json
[
  {
    "id": 1,
    "name": "Production Hosts",
    "host_count": 5,
    "is_active": true,
    "has_credentials": true,
    "uploaded_at": "2026-03-09T10:00:00Z"
  }
]
```

---

### Upload Inventory
```
POST /api/inventories/upload
```
Upload an Ansible inventory file (INI format). Multipart form data.

| Field | Type | Description |
|-------|------|-------------|
| `file` | file | Ansible inventory file |
| `name` | string | Display name for this inventory |

**Example**
```bash
curl -X POST http://localhost:8000/api/inventories/upload \
  -F "name=Production Hosts" \
  -F "file=@./inventory/hosts"
```

**Response**
```json
{
  "id": 1,
  "name": "Production Hosts",
  "host_count": 5,
  "message": "Uploaded 5 hosts"
}
```

---

### Activate Inventory
```
POST /api/inventories/{inv_id}/activate
```
Sets the inventory as active and writes it to `inventory/hosts`.

**Example**
```bash
curl -X POST http://localhost:8000/api/inventories/1/activate
```

**Response**
```json
{
  "message": "Activated inventory with 5 hosts"
}
```

---

### Delete Inventory
```
DELETE /api/inventories/{inv_id}
```

**Example**
```bash
curl -X DELETE http://localhost:8000/api/inventories/1
```

**Response**
```json
{
  "message": "Deleted"
}
```

---

## Credentials

### Save Credentials
```
POST /api/credentials
```
Save SSH credentials for a specific inventory.

**Request Body**
```json
{
  "inventory_id": 1,
  "username": "ansible",
  "password": "s3cr3t"
}
```

**Example**
```bash
curl -X POST http://localhost:8000/api/credentials \
  -H "Content-Type: application/json" \
  -d '{"inventory_id": 1, "username": "ansible", "password": "s3cr3t"}'
```

**Response**
```json
{
  "message": "Credentials saved"
}
```

---

### Get Credentials
```
GET /api/credentials/{inventory_id}
```
Returns the stored username for the inventory. Password is never returned.

**Example**
```bash
curl http://localhost:8000/api/credentials/1
```

**Response**
```json
{
  "username": "ansible",
  "has_credentials": true,
  "updated_at": "2026-03-09T10:00:00Z"
}
```

No credentials set:
```json
{
  "username": "",
  "has_credentials": false
}
```

---

## Hosts

### List Hosts
```
GET /api/hosts
```
Returns hosts from the active inventory file.

**Example**
```bash
curl http://localhost:8000/api/hosts
```

**Response**
```json
{
  "hosts": ["192.168.1.10", "192.168.1.11", "web-server-01"]
}
```

---

### Update Hosts
```
POST /api/hosts
```
Overwrites the inventory file with the provided host list.

**Request Body**
```json
{
  "hosts": ["192.168.1.10", "192.168.1.11", "web-server-01"]
}
```

**Example**
```bash
curl -X POST http://localhost:8000/api/hosts \
  -H "Content-Type: application/json" \
  -d '{"hosts": ["192.168.1.10", "192.168.1.11"]}'
```

**Response**
```json
{
  "message": "Inventory updated with 2 hosts",
  "hosts": ["192.168.1.10", "192.168.1.11"]
}
```

---

### Get Host Tags
```
GET /api/hosts/{hostname}/tags
```
Returns all tags assigned to a specific host.

**Example**
```bash
curl http://localhost:8000/api/hosts/192.168.1.10/tags
```

**Response**
```json
{
  "hostname": "192.168.1.10",
  "tags": ["production", "web"]
}
```

---

### Add Tag to Host
```
POST /api/hosts/{hostname}/tags
```
Adds a tag to a host. Tags are lowercased and must be 32 characters or fewer. Adding a duplicate tag is a no-op.

**Request Body**
```json
{
  "tag": "production"
}
```

**Example**
```bash
curl -X POST http://localhost:8000/api/hosts/192.168.1.10/tags \
  -H "Content-Type: application/json" \
  -d '{"tag": "production"}'
```

**Response** — returns the full updated tag list
```json
{
  "hostname": "192.168.1.10",
  "tags": ["production", "web"]
}
```

---

### Remove Tag from Host
```
DELETE /api/hosts/{hostname}/tags/{tag}
```
Removes a tag from a host.

**Example**
```bash
curl -X DELETE http://localhost:8000/api/hosts/192.168.1.10/tags/production
```

**Response** — returns the full updated tag list
```json
{
  "hostname": "192.168.1.10",
  "tags": ["web"]
}
```

---

### List All Tags
```
GET /api/tags
```
Returns all unique tags currently in use across all hosts, sorted alphabetically.

**Example**
```bash
curl http://localhost:8000/api/tags
```

**Response**
```json
{
  "tags": ["db", "dmz", "infra", "production", "staging", "web"]
}
```

---

## Scans

### Trigger Scan
```
POST /api/scans/trigger
```
Starts a background scan against the active inventory. Requires credentials to be set. CVE enrichment and CVSS scoring run automatically after the scan completes. Returns `409` if a scan is already running.

**Example**
```bash
curl -X POST http://localhost:8000/api/scans/trigger
```

**Response**
```json
{
  "scan_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "started",
  "scanned_at": "2026-03-09T10:00:00Z"
}
```

**Error — no credentials**
```json
{ "detail": "No credentials set for the active inventory. Go to Settings to add credentials." }
```

**Error — scan already running**
```json
{ "detail": "A scan is already in progress" }
```

---

### Current Scan Status
```
GET /api/scans/current
```
Returns any in-progress scan. Useful for syncing state across browser tabs.

**Example**
```bash
curl http://localhost:8000/api/scans/current
```

**Response — scan running**
```json
{
  "scanning": true,
  "scan_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "running"
}
```

**Response — idle**
```json
{
  "scanning": false
}
```

---

### Get Scan Status by ID
```
GET /api/scans/{scan_id}/status
```
Poll the status of a specific scan.

| Status | Description |
|--------|-------------|
| `pending` | Queued, not yet started |
| `running` | Ansible playbook executing |
| `enriching` | Scan saved, CVE enrichment in progress |
| `complete` | Finished successfully |
| `failed: <msg>` | Failed with error message |
| `unknown` | Scan ID not found in memory |

**Example**
```bash
curl http://localhost:8000/api/scans/a1b2c3d4-e5f6-7890-abcd-ef1234567890/status
```

**Response**
```json
{
  "scan_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "complete"
}
```

---

### Latest Scan Results
```
GET /api/scans/latest
```
Returns the most recent completed scan with all host results and assigned tags.

**Example**
```bash
curl http://localhost:8000/api/scans/latest
```

**Response**
```json
{
  "scan_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "scanned_at": "2026-03-09T10:00:00Z",
  "status": "complete",
  "rc": 0,
  "host_failures": {},
  "hosts": [
    {
      "host": "192.168.1.10",
      "os_version": "Rocky Linux 9.3",
      "current_kernel_version": "5.14.0-362.8.1.el9_3.x86_64",
      "latest_available_kernel_version": "5.14.0-427.13.1.el9_4.x86_64",
      "last_reboot_time": "2026-03-07 17:42",
      "advisory_ids": ["RLSA-2024:1234"],
      "pending_security_packages": ["kernel", "openssl"],
      "package_count": 2,
      "tags": ["production", "web"]
    }
  ]
}
```

---

### Scan History
```
GET /api/scans/history
```
Returns a list of all past scan runs.

**Example**
```bash
curl http://localhost:8000/api/scans/history
```

**Response**
```json
[
  {
    "scan_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "scanned_at": "2026-03-09T10:00:00Z",
    "status": "complete",
    "rc": 0,
    "failure_count": 0,
    "host_count": 11
  }
]
```

---

### Scan Failures
```
GET /api/scans/{scan_id}/failures
```
Returns per-host failure details and the full Ansible log for a specific scan.

**Example**
```bash
curl http://localhost:8000/api/scans/a1b2c3d4-e5f6-7890-abcd-ef1234567890/failures
```

**Response**
```json
{
  "scan_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "scanned_at": "2026-03-09T10:00:00Z",
  "status": "complete",
  "rc": 4,
  "host_failures": {
    "192.168.1.99": "UNREACHABLE: Connection timed out"
  },
  "ansible_log": "..."
}
```

---

## Scheduler

### Scheduler Status
```
GET /api/scheduler/status
```
Returns auto-scan scheduler state and next scheduled run time.

**Example**
```bash
curl http://localhost:8000/api/scheduler/status
```

**Response**
```json
{
  "enabled": true,
  "next_run": "2026-03-09T13:00:00Z",
  "interval_minutes": 3
}
```

---

## CVEs

### List CVE Advisories
```
GET /api/cves
```
Returns all enriched CVE/advisory records with CVSS scores, sorted by severity then advisory ID. Includes the list of affected hosts from the latest scan.

**Example**
```bash
curl http://localhost:8000/api/cves
```

**Response**
```json
[
  {
    "advisory_id": "RLSA-2024:1234",
    "synopsis": "Important: openssl security update",
    "severity": "Important",
    "cve_ids": ["CVE-2024-0727"],
    "description": "OpenSSL security fix...",
    "fetched_at": "2026-03-09T10:00:00Z",
    "remediation": "Run: yum update openssl\n\nPatched versions:\n  • openssl-3.0.7-27.el9.x86_64",
    "cvss_score": 7.5,
    "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H",
    "cvss_version": "3.1",
    "cvss_source": "redhat",
    "affected_hosts": ["192.168.1.10", "192.168.1.11"]
  }
]
```

`cvss_source` is either `redhat` (RHEL-context-aware score) or `nvd` (generic fallback score).

---

## Error Responses

All endpoints return standard HTTP status codes with a `detail` field on errors.

| Code | Meaning |
|------|---------|
| `400` | Bad request — missing or invalid input |
| `404` | Resource not found |
| `409` | Conflict — e.g. scan already in progress |
| `500` | Internal server error |

**Example error**
```json
{
  "detail": "No valid hosts found in file"
}
```