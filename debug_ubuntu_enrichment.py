#!/usr/bin/env python3
"""
Run this inside the container to trace the Ubuntu CVE enrichment pipeline:
  docker exec -it <container_name> python3 /app/debug_ubuntu_enrichment.py
"""
import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))

import requests
from database import get_conn

UBUNTU_CVES_API = "https://ubuntu.com/security/cves.json?package={}&limit=20&offset=0"

UBUNTU_CODENAMES = {
    '20.04': 'focal',
    '22.04': 'jammy',
    '24.04': 'noble',
    '24.10': 'oracular',
    '25.04': 'plucky',
}

DEBIAN_CODENAMES = {
    '10': 'buster',
    '11': 'bullseye',
    '12': 'bookworm',
    '13': 'trixie',
}

ACTIVE_STATUSES = ('needed', 'active', 'deferred', 'pending', 'released', 'needs-triage')


def get_codename(os_version):
    if not os_version:
        return None
    for v, c in UBUNTU_CODENAMES.items():
        if v in os_version:
            return c
    for v, c in DEBIAN_CODENAMES.items():
        if f' {v}' in os_version or os_version.endswith(v):
            return c
    return None


print("=" * 70)
print("UBUNTU/DEBIAN CVE ENRICHMENT DIAGNOSTIC")
print("=" * 70)

conn   = get_conn()
cursor = conn.cursor()

# ── Step 1: Latest scan_id ───────────────────────────────────────────────
print("\n[STEP 1] Finding latest Linux scan_id...")
cursor.execute("""
    SELECT s.scan_id, s.scanned_at, s.status
    FROM scan_runs s
    WHERE EXISTS (SELECT 1 FROM scan_results sr WHERE sr.scan_id = s.scan_id)
    ORDER BY s.scanned_at DESC LIMIT 3
""")
rows = cursor.fetchall()
if not rows:
    print("  ERROR: No scan_runs with scan_results found. Run a scan first.")
    sys.exit(1)
for r in rows:
    print(f"  scan_id={r[0]}  scanned_at={r[1]}  status={r[2]}")
latest_scan_id = rows[0][0]
print(f"  → Using: {latest_scan_id}")

# ── Step 2: All hosts in that scan ──────────────────────────────────────
print("\n[STEP 2] All hosts in latest scan...")
cursor.execute("""
    SELECT sr.host, sr.os_version,
           (SELECT COUNT(*) FROM scan_packages sp
            WHERE sp.scan_id = sr.scan_id AND sp.host = sr.host) as pkg_count,
           sr.package_source_map
    FROM scan_results sr
    WHERE sr.scan_id = %s
    ORDER BY sr.host
""", (latest_scan_id,))
all_hosts = cursor.fetchall()
if not all_hosts:
    print("  ERROR: scan_results empty for this scan_id")
    sys.exit(1)
for host, os_ver, pkg_count, psm in all_hosts:
    psm_size = len(psm) if psm else 0
    print(f"  host={host}  os_version='{os_ver}'  scan_packages={pkg_count}  source_map_entries={psm_size}")
    if psm:
        sample = dict(list(psm.items())[:3])
        print(f"    source_map sample: {sample}")

# ── Step 3: Ubuntu/Debian hosts ─────────────────────────────────────────
print("\n[STEP 3] Filtering Ubuntu/Debian hosts and resolving codenames...")
ubuntu_hosts = []
for host, os_ver, pkg_count, psm in all_hosts:
    codename = get_codename(os_ver)
    if not codename:
        print(f"  SKIP {host}: os_version='{os_ver}' → no codename matched")
        continue
    # Get packages
    cursor.execute("""
        SELECT package_name FROM scan_packages
        WHERE scan_id = %s AND host = %s ORDER BY package_name
    """, (latest_scan_id, host))
    pkgs = [r[0] for r in cursor.fetchall()]
    if not pkgs:
        print(f"  SKIP {host}: no scan_packages rows found")
        continue
    print(f"  OK {host}: os='{os_ver}' → codename='{codename}', {len(pkgs)} packages")
    ubuntu_hosts.append({
        'host': host,
        'codename': codename,
        'packages': pkgs,
        'source_map': psm or {},
    })

if not ubuntu_hosts:
    print("  ERROR: No Ubuntu/Debian hosts with packages found!")
    cursor.close()
    conn.close()
    sys.exit(1)
 
# ── Step 4: Resolve source names & probe API ────────────────────────────
print("\n[STEP 4] Resolving binary→source names and probing Ubuntu CVE API...")
seen = set()
api_results = []
for h in ubuntu_hosts:
    print(f"\n  Host: {h['host']} ({h['codename']})")
    for pkg in h['packages']:
        binary = pkg.split('/')[0].split('=')[0].split(':')[0].strip()
        src    = h['source_map'].get(binary, '')
        # Clean up source name
        if src:
            src = src.split('(')[0].strip()  # strip version "(1.2.3)"
            if ':' in src:
                src = src.split(':')[-1].strip()
        src = src or binary  # fallback to binary if source empty/missing

        key = (src, h['codename'])
        if key in seen:
            continue
        seen.add(key)

        # Hit the API
        try:
            url  = UBUNTU_CVES_API.format(src)
            resp = requests.get(url, timeout=10)
            if resp.status_code != 200:
                print(f"    {binary} → {src}: HTTP {resp.status_code}")
                api_results.append({'binary': binary, 'source': src, 'http': resp.status_code, 'matching': 0})
                continue

            cves = resp.json().get('cves', [])
            total = resp.json().get('total_results', 0)
            matching = 0
            statuses_seen = set()
            for c in cves:
                for p in c.get('packages', []):
                    for s in p.get('statuses', []):
                        cn = (s.get('release_codename') or s.get('distro_series') or s.get('codename') or '')
                        st = s.get('status', '')
                        if cn == h['codename']:
                            statuses_seen.add(st)
                            if st in ACTIVE_STATUSES:
                                matching += 1

            tag = 'binary==source' if binary == src else f'binary={binary}'
            print(f"    {tag} → src='{src}': total={total} matching_statuses={matching} all_noble_statuses={statuses_seen}")
            api_results.append({'binary': binary, 'source': src, 'http': 200, 'total': total, 'matching': matching})
        except Exception as e:
            print(f"    {binary} → {src}: EXCEPTION {e}")
            api_results.append({'binary': binary, 'source': src, 'error': str(e)})

# ── Step 5: Summary ──────────────────────────────────────────────────────
print("\n[STEP 5] Summary")
no_source_map = [h for h in ubuntu_hosts if not h['source_map']]
empty_source  = [r for r in api_results if r.get('binary') == r.get('source')]
zero_total    = [r for r in api_results if r.get('total', -1) == 0]
zero_match    = [r for r in api_results if r.get('total', 0) > 0 and r.get('matching', 0) == 0]
has_cves      = [r for r in api_results if r.get('matching', 0) > 0]

print(f"  Hosts with empty source_map: {len(no_source_map)}")
print(f"  Packages where binary==source (no dpkg-query hit): {len(empty_source)}")
print(f"  Packages with 0 API results (likely binary name sent): {len(zero_total)}")
print(f"  Packages with results but 0 matching statuses: {len(zero_match)}")
print(f"  Packages that WOULD produce CVEs: {len(has_cves)}")

if has_cves:
    print(f"\n  These packages should produce CVEs:")
    for r in has_cves:
        print(f"    {r['source']} → {r['matching']} CVEs")
    print("\n  → Trigger enrichment: POST /api/scans/enrich")
elif no_source_map:
    print("\n  DIAGNOSIS: source_map is empty — dpkg-query failed on remote hosts.")
    print("  FIX: Run a new scan. If dpkg-query still fails, check sudo/permissions on Ubuntu hosts.")
elif zero_total:
    print("\n  DIAGNOSIS: Binary package names being sent to Ubuntu CVE API (returns 0).")
    print("  FIX: source_map must map binary→source names (e.g. libssl3t64→openssl).")
    print("  Check dpkg-query is working on the remote Ubuntu hosts.")
else:
    print("\n  DIAGNOSIS: API returns results but no CVEs match your release+status filter.")
    print("  Check the codename detection and status filter.")

# ── Step 6: Check cve_details ────────────────────────────────────────────
print("\n[STEP 6] Current cve_details contents")
cursor.execute("SELECT COUNT(*) FROM cve_details WHERE advisory_id LIKE 'RLSA-%' OR advisory_id LIKE 'RHSA-%' OR advisory_id LIKE 'ALSA-%'")
rh_count = cursor.fetchone()[0]
cursor.execute("SELECT COUNT(*) FROM cve_details WHERE advisory_id LIKE 'CVE-%'")
cve_count = cursor.fetchone()[0]
print(f"  RHSA/RLSA/ALSA entries: {rh_count}")
print(f"  CVE-* entries:          {cve_count}")

cursor.close()
conn.close()
print("\n" + "=" * 70)
