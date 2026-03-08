from fastapi import FastAPI, BackgroundTasks, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from apscheduler.schedulers.background import BackgroundScheduler
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import List
import uuid
import os
import threading
#from enricher import enrich_advisories
from enricher import enrich_all

from scanner import run_patch_scan
from database import (
    save_to_db, get_latest_scan, get_scan_history,
    get_inventories, save_inventory, activate_inventory,
    delete_inventory, get_inventory_content,
    save_credentials, get_credentials, get_active_inventory_credentials,
    get_cve_details
)


INVENTORY_PATH = "./inventory/hosts"

# ── models ────────────────────────────────────────────────────────────────────

class HostsUpdate(BaseModel):
    hosts: List[str]

class CredentialsUpdate(BaseModel):
    inventory_id: int
    username: str
    password: str

# ── helpers ───────────────────────────────────────────────────────────────────

def parse_hosts_from_content(content: str) -> list:
    return [
        l.strip() for l in content.splitlines()
        if l.strip() and not l.startswith("[") and not l.startswith("#")
    ]

def write_inventory_content(content: str):
    os.makedirs(os.path.dirname(INVENTORY_PATH), exist_ok=True)
    with open(INVENTORY_PATH, "w") as f:
        f.write(content)

running_scans = {}
_scan_lock = threading.Lock()

def run_and_save(scan_id: str, scanned_at: datetime):
    try:
        running_scans[scan_id] = "running"
        output = run_patch_scan()
        save_to_db(output, scan_id, scanned_at)
        running_scans[scan_id] = "complete"
        enrich_all()   # ← should be enrich_all, not enrich_advisories
    except Exception as e:
        running_scans[scan_id] = f"failed: {str(e)}"

def scheduled_scan():
    """Called by APScheduler every 3 hours. Skips if a scan is already running."""
    with _scan_lock:
        already_running = any(
            v in ("running", "pending")
            for v in running_scans.values()
        )
        if already_running:
            print("Scheduled scan skipped: a scan is already in progress")
            return

        creds = get_active_inventory_credentials()
        if not creds:
            print("Scheduled scan skipped: no credentials set for active inventory")
            return

        scan_id    = str(uuid.uuid4())
        scanned_at = datetime.now(timezone.utc)
        running_scans[scan_id] = "pending"

    print(f"Scheduled scan starting: {scan_id}")
    run_and_save(scan_id, scanned_at)

# ── scheduler ─────────────────────────────────────────────────────────────────

scheduler = BackgroundScheduler()

# ── startup ───────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        inventories = get_inventories()
        if not inventories:
            if os.path.exists(INVENTORY_PATH):
                with open(INVENTORY_PATH, "r") as f:
                    content = f.read()
                hosts = parse_hosts_from_content(content)
                if hosts:
                    inv_id = save_inventory("Default Inventory", content, len(hosts))
                    activate_inventory(inv_id)
                    print(f"Seeded default inventory with {len(hosts)} hosts")
            else:
                print("No default inventory file found at ./inventory/hosts")
        else:
            active = next((i for i in inventories if i["is_active"]), None)
            if active:
                content = get_inventory_content(active["id"])
                write_inventory_content(content)
                print(f"Restored active inventory '{active['name']}' with {active['host_count']} hosts")
    except Exception as e:
        print(f"Startup error: {e}")

    # start auto-scan scheduler — every 3 hours
    scheduler.add_job(scheduled_scan, "interval", hours=3, id="auto_scan")
    scheduler.start()
    print("Auto-scan scheduler started (every 3 hours)")

    yield

    scheduler.shutdown(wait=False)
    print("Scheduler stopped")

# ── app ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Patch Scan Platform", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── inventory endpoints ───────────────────────────────────────────────────────

@app.get("/api/inventories")
async def list_inventories():
    return get_inventories()

@app.post("/api/inventories/upload")
async def upload_inventory(file: UploadFile = File(...), name: str = Form(...)):
    content = (await file.read()).decode("utf-8")
    hosts = parse_hosts_from_content(content)
    if not hosts:
        raise HTTPException(status_code=400, detail="No valid hosts found in file")
    inv_id = save_inventory(name, content, len(hosts))
    return {"id": inv_id, "name": name, "host_count": len(hosts), "message": f"Uploaded {len(hosts)} hosts"}

@app.post("/api/inventories/{inv_id}/activate")
async def set_active_inventory(inv_id: int):
    content = activate_inventory(inv_id)
    write_inventory_content(content)
    hosts = parse_hosts_from_content(content)
    return {"message": f"Activated inventory with {len(hosts)} hosts"}

@app.delete("/api/inventories/{inv_id}")
async def remove_inventory(inv_id: int):
    delete_inventory(inv_id)
    return {"message": "Deleted"}

# ── credential endpoints ──────────────────────────────────────────────────────

@app.post("/api/credentials")
async def set_credentials(body: CredentialsUpdate):
    if not body.username or not body.password:
        raise HTTPException(status_code=400, detail="Username and password are required")
    save_credentials(body.inventory_id, body.username, body.password)
    return {"message": "Credentials saved"}

@app.get("/api/credentials/{inventory_id}")
async def fetch_credentials(inventory_id: int):
    creds = get_credentials(inventory_id)
    if not creds:
        return {"username": "", "has_credentials": False}
    return {"username": creds["username"], "has_credentials": True, "updated_at": creds["updated_at"]}

# ── host endpoints ────────────────────────────────────────────────────────────

@app.get("/api/hosts")
async def get_hosts_endpoint():
    if not os.path.exists(INVENTORY_PATH):
        return {"hosts": []}
    with open(INVENTORY_PATH, "r") as f:
        lines = f.read().splitlines()
    hosts = [l.strip() for l in lines if l.strip() and not l.startswith("[")]
    return {"hosts": hosts}

@app.post("/api/hosts")
async def update_hosts(body: HostsUpdate):
    if not body.hosts:
        raise HTTPException(status_code=400, detail="Host list cannot be empty")
    content = "[all]\n" + "\n".join(h.strip() for h in body.hosts) + "\n"
    os.makedirs(os.path.dirname(INVENTORY_PATH), exist_ok=True)
    with open(INVENTORY_PATH, "w") as f:
        f.write(content)
    return {"message": f"Inventory updated with {len(body.hosts)} hosts", "hosts": body.hosts}

# ── scan endpoints ────────────────────────────────────────────────────────────

@app.post("/api/scans/trigger")
async def trigger_scan(background_tasks: BackgroundTasks):
    creds = get_active_inventory_credentials()
    if not creds:
        raise HTTPException(
            status_code=400,
            detail="No credentials set for the active inventory. Go to Settings to add credentials."
        )
    already_running = any(v in ("running", "pending") for v in running_scans.values())
    if already_running:
        raise HTTPException(status_code=409, detail="A scan is already in progress")

    scan_id    = str(uuid.uuid4())
    scanned_at = datetime.now(timezone.utc)
    running_scans[scan_id] = "pending"
    background_tasks.add_task(run_and_save, scan_id, scanned_at)
    return {"scan_id": scan_id, "status": "started", "scanned_at": scanned_at.isoformat()}

@app.get("/api/scans/current")
async def current_scan():
    """Returns any in-progress scan so any browser tab can pick up the running state."""
    for scan_id, status in reversed(list(running_scans.items())):
        if status in ("running", "pending"):
            return {"scanning": True, "scan_id": scan_id, "status": status}
    return {"scanning": False}

@app.get("/api/scans/latest")
async def latest_scan():
    data = get_latest_scan()
    if not data:
        raise HTTPException(status_code=404, detail="No scans found")
    return data

@app.get("/api/scans/history")
async def scan_history():
    return get_scan_history()

@app.get("/api/scans/{scan_id}/status")
async def get_scan_status(scan_id: str):
    return {"scan_id": scan_id, "status": running_scans.get(scan_id, "unknown")}

@app.get("/api/scheduler/status")
async def scheduler_status():
    """Returns scheduler info — useful for the UI to show next scan time."""
    job = scheduler.get_job("auto_scan")
    if not job:
        return {"enabled": False}
    return {
        "enabled": True,
        "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
        "interval_minutes": 3
    }

# ── CVE endpoints ─────────────────────────────────────────────────────────────

@app.get("/api/cves")
async def list_cves():
    return get_cve_details()

# ── serve React SPA — MUST BE LAST ───────────────────────────────────────────

if os.path.exists("dist"):
    app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")
    if os.path.exists("dist/index.html"):
        return FileResponse("dist/index.html")
    return {"message": "Patch Scan Platform API"}




if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)