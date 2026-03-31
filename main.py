"""
main.py — FastAPI application, routes only (~280 lines).

Business logic lives in:
  scan_tasks.py        run_and_save / run_windows_and_save
  scheduler.py         APScheduler + scheduled_scan
  reports/linux.py     build_xlsx / send_scan_report
  reports/windows.py   build_windows_xlsx / send_windows_scan_report
  reports/common.py    classify_os / xl helpers
  scanner.py           ansible_runner wrappers
  database.py          all DB functions
  enricher.py          CVE enrichment
"""

from fastapi import FastAPI, BackgroundTasks, HTTPException, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import List, Optional
import uuid
import os
import smtplib
import json
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate

from database import (
    get_latest_scan, get_latest_windows_scan,
    get_scan_history,
    get_inventories, save_inventory, activate_inventory,
    delete_inventory, get_inventory_content,
    save_credentials, get_credentials, get_active_inventory_credentials,
    save_windows_credentials, get_windows_credentials,
    get_tags_for_host, get_all_tags, add_tag, remove_tag,
    get_cve_details, get_scan_failures, get_host_history, get_host_cves,
    get_notification_settings, save_notification_settings,
    get_scan_interval, save_scan_interval,
    get_host_ports,
    save_patch_job, get_patch_job, get_patch_history,
)
from scan_tasks import run_and_save, run_windows_and_save, running_scans
from scheduler import scheduler, reschedule, start_scheduler, stop_scheduler


INVENTORY_PATH = "./inventory/hosts"

# ── models ────────────────────────────────────────────────────────────────────

class HostsUpdate(BaseModel):
    hosts: List[str]

class ChatMessage(BaseModel):
    message: str
    history: Optional[List[dict]] = []

class TagAdd(BaseModel):
    tag: str

class CredentialsUpdate(BaseModel):
    inventory_id: int
    username: str
    password: str

class WindowsCredentialsUpdate(BaseModel):
    username:  str
    password:  str
    domain:    str = ""
    port:      int = 5986
    transport: str = "ntlm"

class NotificationSettings(BaseModel):
    smtp_host: str
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    recipients: List[str] = []
    tls_enabled: bool = True

class IntervalPayload(BaseModel):
    interval_minutes: int

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

# ── startup / shutdown ────────────────────────────────────────────────────────

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
            # Only restore the active LINUX inventory to hosts file on startup
            active_linux = next(
                (i for i in inventories
                 if i["is_active"] and (i.get("inventory_type") == "linux" or not i.get("inventory_type"))),
                None
            )
            if active_linux:
                content = get_inventory_content(active_linux["id"])
                write_inventory_content(content)
                print(f"Restored active Linux inventory '{active_linux['name']}' with {active_linux['host_count']} hosts")
            else:
                print("No active Linux inventory found at startup")
    except Exception as e:
        print(f"Startup error: {e}")

    start_scheduler()
    yield
    stop_scheduler()

# ── app ───────────────────────────────────────────────────────────────────────

_docs_enabled = os.getenv("ENABLE_DOCS", "false").lower() == "true"
app = FastAPI(
    title="Patch Scan Platform",
    lifespan=lifespan,
    docs_url="/docs"            if _docs_enabled else None,
    redoc_url="/redoc"          if _docs_enabled else None,
    openapi_url="/openapi.json" if _docs_enabled else None,
)

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
async def upload_inventory(
    file: UploadFile = File(...),
    name: str = Form(...),
    inventory_type: str = Form("linux"),
):
    content  = (await file.read()).decode("utf-8")
    hosts    = parse_hosts_from_content(content)
    if not hosts:
        raise HTTPException(status_code=400, detail="No valid hosts found in file")
    inv_type = inventory_type if inventory_type in ("linux", "windows") else "linux"
    inv_id   = save_inventory(name, content, len(hosts), inv_type)
    return {"id": inv_id, "name": name, "host_count": len(hosts),
            "inventory_type": inv_type, "message": f"Uploaded {len(hosts)} hosts"}

@app.post("/api/inventories/{inv_id}/activate")
async def set_active_inventory(inv_id: int):
    content  = activate_inventory(inv_id)
    hosts    = parse_hosts_from_content(content)
    invs     = get_inventories()
    inv      = next((i for i in invs if i["id"] == inv_id), None)
    inv_type = inv["inventory_type"] if inv else "linux"

    if inv_type == "linux":
        write_inventory_content(content)
    else:
        win_path = "/app/inventory/win_hosts"
        os.makedirs(os.path.dirname(win_path), exist_ok=True)
        clean = content.replace('\r\n', '\n').replace('\r', '\n')
        with open(win_path, "w") as f:
            f.write(clean)

    return {"message": f"Activated {inv_type} inventory with {len(hosts)} hosts"}

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

@app.get("/api/windows/credentials")
async def get_windows_creds():
    creds = get_windows_credentials()
    if not creds:
        return {"has_credentials": False, "username": "", "domain": ""}
    return {
        "has_credentials": True,
        "username":   creds["username"],
        "domain":     creds["domain"],
        "port":       creds["port"],
        "transport":  creds["transport"],
        "updated_at": creds["updated_at"],
    }

@app.post("/api/windows/credentials")
async def set_windows_creds(body: WindowsCredentialsUpdate):
    if not body.username or not body.password:
        raise HTTPException(status_code=400, detail="Username and password are required")
    if body.transport not in ("ntlm", "kerberos", "basic"):
        raise HTTPException(status_code=400, detail="transport must be ntlm, kerberos, or basic")
    save_windows_credentials(
        username=body.username, password=body.password,
        domain=body.domain, port=body.port, transport=body.transport,
    )
    return {"message": "Windows credentials saved"}

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

@app.get("/api/hosts/{hostname}/history")
async def get_host_history_endpoint(hostname: str):
    return get_host_history(hostname)

@app.get("/api/hosts/{hostname}/cves")
async def get_host_cves_endpoint(hostname: str):
    return get_host_cves(hostname)

@app.get("/api/tags")
async def list_all_tags():
    return {"tags": get_all_tags()}

@app.get("/api/hosts/{hostname}/tags")
async def get_host_tags(hostname: str):
    return {"hostname": hostname, "tags": get_tags_for_host(hostname)}

@app.post("/api/hosts/{hostname}/tags")
async def add_host_tag(hostname: str, body: TagAdd):
    tag = body.tag.strip().lower()
    if not tag:
        raise HTTPException(status_code=400, detail="Tag cannot be empty")
    if len(tag) > 32:
        raise HTTPException(status_code=400, detail="Tag too long (max 32 chars)")
    add_tag(hostname, tag)
    return {"hostname": hostname, "tags": get_tags_for_host(hostname)}

@app.delete("/api/hosts/{hostname}/tags/{tag}")
async def remove_host_tag(hostname: str, tag: str):
    remove_tag(hostname, tag)
    return {"hostname": hostname, "tags": get_tags_for_host(hostname)}

# ── Linux scan endpoints ──────────────────────────────────────────────────────

@app.post("/api/scans/trigger")
async def trigger_scan(background_tasks: BackgroundTasks):
    creds = get_active_inventory_credentials()
    if not creds:
        raise HTTPException(status_code=400,
            detail="No credentials set for the active inventory.")
    already_running = any(v in ("running", "pending") for v in running_scans.values())
    if already_running:
        raise HTTPException(status_code=409, detail="A scan is already in progress")
    scan_id    = str(uuid.uuid4())
    scanned_at = datetime.now(timezone.utc)
    running_scans[scan_id] = "pending"
    background_tasks.add_task(run_and_save, scan_id, scanned_at)
    return {"scan_id": scan_id, "status": "started", "scanned_at": scanned_at.isoformat()}

# ── Windows scan endpoints ────────────────────────────────────────────────────

@app.post("/api/scans/trigger-windows")
async def trigger_windows_scan(background_tasks: BackgroundTasks):
    already_running = any(v in ("running", "pending") for v in running_scans.values())
    if already_running:
        raise HTTPException(status_code=409, detail="A scan is already in progress")
    scan_id    = str(uuid.uuid4())
    scanned_at = datetime.now(timezone.utc)
    running_scans[scan_id] = "pending"
    background_tasks.add_task(run_windows_and_save, scan_id, scanned_at)
    return {"scan_id": scan_id, "status": "started", "scanned_at": scanned_at.isoformat()}

@app.get("/api/scans/windows/latest")
async def latest_windows_scan():
    data = get_latest_windows_scan()
    if not data:
        raise HTTPException(status_code=404, detail="No Windows scans found")
    return data

# ── shared scan endpoints ─────────────────────────────────────────────────────

@app.get("/api/scans/current")
async def current_scan():
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

@app.get("/api/scans/{scan_id}/failures")
async def get_scan_failures_endpoint(scan_id: str):
    data = get_scan_failures(scan_id)
    if not data:
        raise HTTPException(status_code=404, detail="Scan not found")
    return data

# ── CVE advisories ────────────────────────────────────────────────────────────

@app.get("/api/cves")
async def get_cves():
    return get_cve_details()

# ── scheduler endpoints ───────────────────────────────────────────────────────

@app.get("/api/scheduler/status")
async def scheduler_status():
    job = scheduler.get_job("auto_scan")
    if not job:
        return {"enabled": False}
    return {
        "enabled": True,
        "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
        "interval_minutes": get_scan_interval(),
    }

@app.get("/api/scheduler/interval")
async def get_interval():
    return {"interval_minutes": get_scan_interval()}

@app.post("/api/scheduler/interval")
async def set_interval(body: IntervalPayload):
    minutes = body.interval_minutes
    if minutes < 1:
        raise HTTPException(status_code=400, detail="Interval must be at least 1 minute")
    if minutes > 10080:
        raise HTTPException(status_code=400, detail="Interval must be 7 days or less")
    save_scan_interval(minutes)
    reschedule(minutes)
    return {"interval_minutes": minutes}

# ── notification endpoints ────────────────────────────────────────────────────

@app.get("/api/notifications/settings")
async def get_notification_settings_endpoint():
    s = get_notification_settings()
    if s.get("smtp_password"):
        s["smtp_password"] = "••••••••"
    return s

@app.post("/api/notifications/settings")
async def save_notification_settings_endpoint(body: NotificationSettings):
    existing = get_notification_settings()
    password = body.smtp_password
    if password == "••••••••":
        password = existing.get("smtp_password", "")
    save_notification_settings(
        smtp_host=body.smtp_host, smtp_port=body.smtp_port,
        smtp_user=body.smtp_user, smtp_password=password,
        smtp_from=body.smtp_from, recipients=body.recipients,
        tls_enabled=body.tls_enabled,
    )
    return {"message": "Settings saved"}

@app.post("/api/notifications/test")
async def test_notification(background_tasks: BackgroundTasks):
    settings = get_notification_settings()
    if not settings["smtp_host"]:
        raise HTTPException(status_code=400, detail="SMTP host is not configured")
    if not settings["recipients"]:
        raise HTTPException(status_code=400, detail="No recipients configured")

    def _send_test():
        msg = MIMEMultipart()
        msg["From"]    = settings["smtp_from"] or settings["smtp_user"]
        msg["To"]      = ", ".join(settings["recipients"])
        msg["Date"]    = formatdate(localtime=True)
        msg["Subject"] = "Kernexa — Test Email"
        msg.attach(MIMEText(
            "This is a test email from Kernexa.\n\n"
            "If you received this, your SMTP settings are working correctly.",
            "plain"
        ))
        if settings["tls_enabled"]:
            server = smtplib.SMTP(settings["smtp_host"], settings["smtp_port"], timeout=15)
            server.ehlo(); server.starttls(); server.ehlo()
        else:
            server = smtplib.SMTP_SSL(settings["smtp_host"], settings["smtp_port"], timeout=15)
        if settings["smtp_user"] and settings["smtp_password"]:
            server.login(settings["smtp_user"], settings["smtp_password"])
        server.sendmail(msg["From"], settings["recipients"], msg.as_string())
        server.quit()
        print(f"Test email sent to {settings['recipients']}")

    try:
        _send_test()
        return {"message": f"Test email sent to {', '.join(settings['recipients'])}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Patch endpoints ───────────────────────────────────────────────────────────

@app.post("/api/patch/trigger")
async def trigger_patch(request: Request, background_tasks: BackgroundTasks):
    body = await request.json()
    advisory_id = body.get("advisory_id", "")
    hosts       = body.get("hosts", [])
    packages    = body.get("packages", [])
    dry_run     = body.get("dry_run", True)

    if not hosts:
        raise HTTPException(status_code=400, detail="No hosts specified")
    if not packages:
        raise HTTPException(status_code=400, detail="No packages specified")

    job_id = str(uuid.uuid4())
    save_patch_job(
        job_id      = job_id,
        advisory_id = advisory_id,
        packages    = packages,
        hosts       = hosts,
        dry_run     = dry_run,
    )

    from scan_tasks import run_patch_and_save
    background_tasks.add_task(
        run_patch_and_save, job_id, advisory_id, hosts, packages, dry_run
    )
    running_scans[job_id] = "running"

    mode = "dry_run" if dry_run else "apply"
    return {
        "job_id":  job_id,
        "status":  "started",
        "mode":    mode,
        "hosts":   hosts,
        "packages": packages,
    }

@app.get("/api/patch/{job_id}/status")
async def patch_job_status(job_id: str):
    # Check in-memory first for live status
    mem_status = running_scans.get(job_id)
    job = get_patch_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Patch job not found")
    if mem_status:
        job['status'] = mem_status
    return job

@app.get("/api/patch/history")
async def patch_history():
    return get_patch_history(limit=50)

# ── Host ports endpoint ───────────────────────────────────────────────────────

@app.get("/api/hosts/{hostname}/ports")
async def get_ports(hostname: str):
    ports = get_host_ports(hostname)
    return {"hostname": hostname, "ports": ports}

# ── AI chat — client factory ──────────────────────────────────────────────────

def _get_openai_client():
    """
    Returns (client, model) for either Azure OpenAI or standard OpenAI.

    Azure OpenAI   — set AZURE_OPENAI_API_KEY + AZURE_OPENAI_ENDPOINT
    Standard OpenAI — set OPENAI_API_KEY

    Azure takes priority when both sets of vars are present.

    .env variables:
      # Standard OpenAI
      OPENAI_API_KEY=sk-...

      # Azure OpenAI
      AZURE_OPENAI_API_KEY=...
      AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
      AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini      # your deployment name
      AZURE_OPENAI_API_VERSION=2024-02-01      # optional, defaults to 2024-02-01
    """
    try:
        from openai import AzureOpenAI, OpenAI
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="openai package not installed — run: pip install openai"
        )

    azure_key      = os.getenv("AZURE_OPENAI_API_KEY", "")
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "")

    if azure_key and azure_endpoint:
        client = AzureOpenAI(
            api_key        = azure_key,
            azure_endpoint = azure_endpoint,
            api_version    = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01"),
        )
        model = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")
        print(f"Chat: using Azure OpenAI — endpoint={azure_endpoint} deployment={model}")
        return client, model

    openai_key = os.getenv("OPENAI_API_KEY", "")
    if openai_key:
        client = OpenAI(api_key=openai_key)
        model  = "gpt-4o-mini"
        print("Chat: using standard OpenAI — model=gpt-4o-mini")
        return client, model

    raise HTTPException(
        status_code=500,
        detail=(
            "No OpenAI credentials configured. "
            "Set OPENAI_API_KEY for standard OpenAI, or "
            "AZURE_OPENAI_API_KEY + AZURE_OPENAI_ENDPOINT for Azure OpenAI."
        )
    )

# ── AI chat endpoint ──────────────────────────────────────────────────────────

@app.post("/api/chat")
async def chat(body: ChatMessage):
    client, model = _get_openai_client()

    from chat import SYSTEM_PROMPT, TOOLS, _run_tool

    # Build message list: system + history (last 10 turns) + new user message
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for turn in (body.history or [])[-10:]:
        if turn.get("role") in ("user", "assistant", "tool") and turn.get("content"):
            messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": body.message})

    def stream_response():
        try:
            # ── Tool calling loop ─────────────────────────────────────────────
            # Step 1: Ask the model — it may respond directly or call a tool.
            # Step 2: If it calls tools, execute them and feed results back.
            # Step 3: Repeat until the model produces a final text response.
            # Step 4: Stream the final response token by token.
            MAX_TOOL_ROUNDS = 5
            local_messages  = list(messages)

            for _ in range(MAX_TOOL_ROUNDS):
                response = client.chat.completions.create(
                    model         = model,
                    messages      = local_messages,
                    tools         = TOOLS,
                    tool_choice   = "auto",
                    max_tokens    = 1024,
                    temperature   = 0.3,
                    stream        = False,
                )

                msg = response.choices[0].message

                # No tool calls — model has a final answer, stream it
                if not msg.tool_calls:
                    content = msg.content or ""
                    words   = content.split(" ")
                    for i, word in enumerate(words):
                        chunk = word if i == len(words) - 1 else word + " "
                        yield f"data: {json.dumps({'content': chunk})}\n\n"
                    yield "data: [DONE]\n\n"
                    return

                # Tool calls — execute and append results
                local_messages.append({
                    "role":       "assistant",
                    "content":    msg.content,
                    "tool_calls": [
                        {
                            "id":       tc.id,
                            "type":     "function",
                            "function": {
                                "name":      tc.function.name,
                                "arguments": tc.function.arguments,
                            },
                        }
                        for tc in msg.tool_calls
                    ],
                })

                for tc in msg.tool_calls:
                    try:
                        args = json.loads(tc.function.arguments)
                    except Exception:
                        args = {}
                    result = _run_tool(tc.function.name, args)
                    local_messages.append({
                        "role":         "tool",
                        "tool_call_id": tc.id,
                        "content":      result,
                    })

            # Safety fallback
            yield f"data: {json.dumps({'content': 'Sorry, I could not complete this request.'})}\n\n"
            yield "data: [DONE]\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

# ── serve React SPA — MUST BE LAST ───────────────────────────────────────────

if os.path.exists("dist"):
    app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")
    static_path = os.path.join("dist", full_path)
    if full_path and os.path.isfile(static_path):
        return FileResponse(static_path)
    if os.path.exists("dist/index.html"):
        return FileResponse("dist/index.html")
    return {"message": "Patch Scan Platform API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)