"""
chat.py
Tool calling implementation for the Kernexa AI chatbot.

The system prompt is tiny — just role + instructions.
Data is only fetched when the model explicitly calls a tool.

The OpenAI client and model are constructed in main.py (_get_openai_client())
which auto-detects whether to use standard OpenAI or Azure OpenAI based on
the environment variables present:

  Standard OpenAI:  OPENAI_API_KEY
  Azure OpenAI:     AZURE_OPENAI_API_KEY + AZURE_OPENAI_ENDPOINT
                    + AZURE_OPENAI_DEPLOYMENT + AZURE_OPENAI_API_VERSION

Available tools:
  get_linux_summary()              overall Linux compliance stats
  get_linux_host_details(hostname) one host's current status + pending packages
  get_host_history(hostname)       kernel compliance history over time
  get_host_cves(hostname)          CVEs affecting a specific host
  get_all_cves(severity)           full CVE list, optionally filtered by severity
  get_windows_summary()            Windows hosts overview stats
  get_windows_host_kbs(hostname)   all pending KBs for a specific Windows host
  get_scan_history()               last 10 scan run summaries
"""

import json
from database import (
    get_latest_scan,
    get_latest_windows_scan,
    get_cve_details,
    get_scan_history     as db_get_scan_history,
    get_host_history     as db_get_host_history,
    get_host_cves        as db_get_host_cves,
    get_host_ports       as db_get_host_ports,
)

# ── System prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are Kernexa Assistant, an expert in IT security and patch compliance.
You have access to tools that query live infrastructure data from the user's \
Kernexa deployment. Use them to answer questions accurately.

You can answer:
- Linux host compliance, kernel status, pending packages
- CVE advisories and CVSS scores
- Windows KB patch details, classification, reboot requirements
- Host compliance history and trends over time
- General IT security and patch management questions

Always use the tools to fetch current data before answering — never guess host \
names, KB IDs, or CVE IDs. Call only the tools you need for the specific question.
Politely decline questions completely unrelated to IT security or infrastructure.
Keep responses concise and practical.
"""

# ── Tool definitions (sent to OpenAI) ─────────────────────────────────────────

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_linux_summary",
            "description": (
                "Returns overall Linux patch compliance stats from the latest scan: "
                "total hosts, compliant count, outdated count, compliance percentage, "
                "total pending packages, and scan timestamp. "
                "Use this for general questions like 'how many hosts are outdated?' "
                "or 'what is the compliance rate?'"
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_linux_host_details",
            "description": (
                "Returns current status for a specific Linux host: OS version, "
                "current and latest kernel versions, kernel compliance status, "
                "last reboot time, advisory IDs, and full list of pending security packages. "
                "Use when the user asks about a specific host by name or IP."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "hostname": {
                        "type": "string",
                        "description": "The hostname or IP address of the Linux host.",
                    }
                },
                "required": ["hostname"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_host_history",
            "description": (
                "Returns kernel compliance history for a specific Linux host "
                "across the last 30 scan runs, showing whether it was compliant or "
                "outdated at each scan, the kernel version at that time, and pending "
                "package count. Use for questions about trends or 'has this host always "
                "been outdated?'"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "hostname": {
                        "type": "string",
                        "description": "The hostname or IP address of the Linux host.",
                    }
                },
                "required": ["hostname"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_host_cves",
            "description": (
                "Returns all CVE advisories affecting a specific Linux host "
                "from the latest scan, including advisory ID, severity, CVSS score, "
                "synopsis, and remediation command. "
                "Use when the user asks about vulnerabilities on a specific host."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "hostname": {
                        "type": "string",
                        "description": "The hostname or IP address of the Linux host.",
                    }
                },
                "required": ["hostname"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_all_cves",
            "description": (
                "Returns all CVE advisories from the latest scan. "
                "Can be filtered by severity. Each entry includes advisory ID, "
                "severity, CVSS score, affected hosts, and synopsis. "
                "Use for questions like 'show me all Critical CVEs' or "
                "'which CVEs affect the most hosts?'"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "severity": {
                        "type": "string",
                        "enum": ["Critical", "Important", "Moderate", "Low"],
                        "description": "Optional severity filter. Omit to return all severities.",
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_windows_summary",
            "description": (
                "Returns Windows patch compliance overview: total hosts, total pending KBs, "
                "hosts with security/critical updates, hosts needing reboot, and scan timestamp. "
                "Use for general Windows questions like 'how many Windows hosts need a reboot?'"
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_windows_host_kbs",
            "description": (
                "Returns all pending Windows KBs for a specific Windows host, including "
                "KB ID, patch name, classification (Security/Rollup/Definition), "
                "MSRC severity, reboot requirement, and published date. "
                "Use when the user asks about a specific Windows host's patches."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "hostname": {
                        "type": "string",
                        "description": "The hostname or IP address of the Windows host.",
                    }
                },
                "required": ["hostname"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_scan_history",
            "description": (
                "Returns the last 10 scan run summaries: scan timestamp, total hosts scanned, "
                "compliant count, outdated count, and failure count per run. "
                "Use for questions about scan trends or 'when was the last scan?'"
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
]

# ── Tool executors ─────────────────────────────────────────────────────────────

def _run_tool(name: str, arguments: dict) -> str:
    """Execute a tool call and return the result as a JSON string."""
    try:
        if name == "get_linux_summary":
            return _get_linux_summary()
        elif name == "get_linux_host_details":
            return _get_linux_host_details(arguments.get("hostname", ""))
        elif name == "get_host_history":
            return _get_host_history(arguments.get("hostname", ""))
        elif name == "get_host_cves":
            return _get_host_cves(arguments.get("hostname", ""))
        elif name == "get_all_cves":
            return _get_all_cves(arguments.get("severity"))
        elif name == "get_windows_summary":
            return _get_windows_summary()
        elif name == "get_windows_host_kbs":
            return _get_windows_host_kbs(arguments.get("hostname", ""))
        elif name == "get_scan_history":
            return _get_scan_history()
        else:
            return json.dumps({"error": f"Unknown tool: {name}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


def _get_linux_summary() -> str:
    scan = get_latest_scan()
    if not scan:
        return json.dumps({"error": "No Linux scan data available."})
    hosts     = scan.get("hosts", [])
    total     = len(hosts)
    outdated  = sum(
        1 for h in hosts
        if h.get("current_kernel_version") != h.get("latest_available_kernel_version")
        and h.get("current_kernel_version")
    )
    compliant = total - outdated
    pct       = round((compliant / total) * 100) if total else 0
    total_pkgs = sum(len(h.get("pending_security_packages", [])) for h in hosts)
    return json.dumps({
        "scanned_at":       scan.get("scanned_at"),
        "total_hosts":      total,
        "compliant":        compliant,
        "outdated":         outdated,
        "compliance_pct":   pct,
        "total_pending_pkgs": total_pkgs,
        "all_hostnames":    [h["host"] for h in hosts],
    })


def _get_linux_host_details(hostname: str) -> str:
    scan = get_latest_scan()
    if not scan:
        return json.dumps({"error": "No scan data available."})
    host = next((h for h in scan.get("hosts", []) if h["host"] == hostname), None)
    if not host:
        return json.dumps({"error": f"Host '{hostname}' not found in latest scan."})
    current = host.get("current_kernel_version", "")
    latest  = host.get("latest_available_kernel_version", "")
    return json.dumps({
        "hostname":                      host["host"],
        "os_version":                    host.get("os_version"),
        "current_kernel":                current,
        "latest_kernel":                 latest,
        "kernel_compliant":              current == latest and bool(current),
        "last_reboot":                   host.get("last_reboot_time"),
        "advisory_ids":                  host.get("advisory_ids", []),
        "pending_security_packages":     host.get("pending_security_packages", []),
        "pending_package_count":         len(host.get("pending_security_packages", [])),
    })


def _get_host_history(hostname: str) -> str:
    history = db_get_host_history(hostname)
    if not history:
        return json.dumps({"error": f"No history found for host '{hostname}'."})
    return json.dumps({
        "hostname": hostname,
        "history":  history,
    })


def _get_host_cves(hostname: str) -> str:
    cves = db_get_host_cves(hostname)
    if not cves:
        return json.dumps({"hostname": hostname, "cves": [], "message": "No CVEs found for this host."})
    return json.dumps({"hostname": hostname, "cve_count": len(cves), "cves": cves})


def _get_all_cves(severity: str = None) -> str:
    cves = get_cve_details()
    if severity:
        cves = [c for c in cves if c.get("severity") == severity]
    if not cves:
        return json.dumps({"cves": [], "message": f"No CVEs found{' with severity ' + severity if severity else ''}."})
    return json.dumps({
        "total":    len(cves),
        "severity_filter": severity,
        "cves": [
            {
                "advisory_id":    c["advisory_id"],
                "severity":       c.get("severity"),
                "cvss_score":     c.get("cvss_score"),
                "synopsis":       c.get("synopsis"),
                "affected_hosts": c.get("affected_hosts", []),
                "remediation":    (c.get("remediation") or "")[:200],
            }
            for c in cves
        ],
    })


def _get_windows_summary() -> str:
    records = get_latest_windows_scan()
    if not records:
        return json.dumps({"error": "No Windows scan data available."})
    host_map = {}
    for r in records:
        h = r["hostname"]
        if h not in host_map:
            host_map[h] = {"osName": r["osName"], "updates": []}
        host_map[h]["updates"].append(r)
    total_win    = len(host_map)
    total_kbs    = len(records)
    sec_hosts    = sum(1 for d in host_map.values() if any(
        u["classification"] in ("Security Updates", "Critical Updates") for u in d["updates"]))
    reboot_hosts = sum(1 for d in host_map.values() if any(
        u["rebootRequired"] in ("AlwaysRequiresReboot", "CanRequestReboot") for u in d["updates"]))
    return json.dumps({
        "scanned_at":          records[0].get("scanned_at"),
        "total_hosts":         total_win,
        "total_pending_kbs":   total_kbs,
        "hosts_with_security": sec_hosts,
        "hosts_need_reboot":   reboot_hosts,
        "all_hostnames":       list(host_map.keys()),
    })


def _get_windows_host_kbs(hostname: str) -> str:
    records = get_latest_windows_scan()
    if not records:
        return json.dumps({"error": "No Windows scan data available."})
    host_records = [r for r in records if r["hostname"] == hostname]
    if not host_records:
        return json.dumps({"error": f"Windows host '{hostname}' not found in latest scan."})
    return json.dumps({
        "hostname":    hostname,
        "os_name":     host_records[0].get("osName"),
        "os_version":  host_records[0].get("osVersion"),
        "kb_count":    len(host_records),
        "kbs": [
            {
                "kb_id":          r.get("KBID"),
                "patch_name":     r.get("patchName"),
                "classification": r.get("classification"),
                "severity":       r.get("msrcSeverity"),
                "reboot":         r.get("rebootRequired"),
                "published":      r.get("publishedDateTime"),
            }
            for r in host_records
        ],
    })


def _get_scan_history() -> str:
    history = db_get_scan_history()
    if not history:
        return json.dumps({"error": "No scan history available."})
    return json.dumps({"runs": history[:10]})