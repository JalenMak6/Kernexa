import re
import time
import os
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from database import get_conn

ROCKY_ERRATA_API = "https://errata.rockylinux.org/api/v2/advisories/{}"
UBUNTU_CVES_API  = "https://ubuntu.com/security/cves.json?package={}&limit=20"
RHEL_CVE_API     = "https://access.redhat.com/hydra/rest/securitydata/cve.json?advisory={}"
NVD_CVE_API      = "https://services.nvd.nist.gov/rest/json/cves/2.0?cveId={}"
RH_CVE_API       = "https://access.redhat.com/hydra/rest/securitydata/cve/{}.json"

NVD_API_KEY = os.environ.get("NVD_API_KEY", "")

UBUNTU_CODENAMES = {
    '20.04': 'focal',
    '22.04': 'jammy',
    '24.04': 'noble',
    '24.10': 'oracular',
    '25.04': 'plucky',
}

UBUNTU_PRIORITY_MAP = {
    'critical':   'Critical',
    'high':       'Important',
    'medium':     'Moderate',
    'low':        'Low',
    'negligible': 'Low',
    'undefined':  'Low',
}

# ── helpers ───────────────────────────────────────────────────────────────────

def get_ubuntu_codename(os_version: str) -> str | None:
    if not os_version:
        return None
    for version, codename in UBUNTU_CODENAMES.items():
        if version in os_version:
            return codename
    return None

# ── Rocky / RLSA enrichment ───────────────────────────────────────────────────

def get_uncached_advisories() -> list:
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT DISTINCT unnest(advisory_ids)
            FROM scan_results
            WHERE advisory_ids IS NOT NULL AND array_length(advisory_ids, 1) > 0
        ''')
        all_ids = {row[0] for row in cursor.fetchall() if row[0]}
        cursor.execute("SELECT advisory_id FROM cve_details WHERE advisory_id LIKE 'RLSA-%%' OR advisory_id LIKE 'RHSA-%%'")
        cached_ids = {row[0] for row in cursor.fetchall()}
        return list(all_ids - cached_ids)
    finally:
        cursor.close()
        conn.close()

def save_cve_details(advisory_id: str, cve_ids: list, severity: str,
                     description: str, synopsis: str, remediation: str,
                     source_package: str = None):
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO cve_details
                (advisory_id, cve_ids, severity, description, synopsis, remediation, source_package)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (advisory_id) DO UPDATE SET
                cve_ids        = EXCLUDED.cve_ids,
                severity       = EXCLUDED.severity,
                description    = EXCLUDED.description,
                synopsis       = EXCLUDED.synopsis,
                remediation    = EXCLUDED.remediation,
                source_package = EXCLUDED.source_package,
                fetched_at     = NOW()
        ''', (advisory_id, cve_ids, severity, description, synopsis, remediation, source_package))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

def fetch_rocky_advisory(advisory_id: str) -> dict | None:
    try:
        url  = ROCKY_ERRATA_API.format(advisory_id)
        resp = requests.get(url, timeout=(5, 15))
        if resp.status_code != 200:
            print(f"Enricher: {advisory_id} returned HTTP {resp.status_code}, skipping")
            return None

        data        = resp.json().get('advisory', {})
        cve_ids     = [cve['name'] for cve in data.get('cves', [])]
        severity    = data.get('severity', '').replace('SEVERITY_', '').title()
        description = data.get('description', '')
        synopsis    = data.get('synopsis', '')

        patched_packages = []
        for product, pkg_data in data.get('rpms', {}).items():
            for nvra in pkg_data.get('nvras', []):
                if (nvra.endswith('.x86_64.rpm')
                        and 'debuginfo' not in nvra
                        and 'debugsource' not in nvra):
                    patched_packages.append(nvra.replace('.rpm', ''))

        if patched_packages:
            pkg_names   = sorted({p.rsplit('-', 2)[0] for p in patched_packages})
            remediation = (
                f"Run: yum update {' '.join(pkg_names)}\n\n"
                f"Patched versions:\n" +
                "\n".join(f"  • {p}" for p in patched_packages)
            )
        else:
            remediation = "Apply the latest available updates via: yum update"

        return {
            'advisory_id': advisory_id,
            'cve_ids':     cve_ids,
            'severity':    severity,
            'description': description,
            'synopsis':    synopsis,
            'remediation': remediation,
        }
    except Exception as e:
        print(f"Enricher: failed to fetch {advisory_id}: {e}")
        return None

def fetch_rhel_advisory(advisory_id: str) -> dict | None:
    try:
        url  = RHEL_CVE_API.format(advisory_id)
        resp = requests.get(url, timeout=(5, 15))
        if resp.status_code != 200:
            print(f"Enricher: {advisory_id} returned HTTP {resp.status_code}, skipping")
            return None

        cves = resp.json()
        if not cves:
            print(f"Enricher: {advisory_id} returned no CVEs, skipping")
            return None

        cve_ids        = [c['CVE'] for c in cves]
        severity_order = {'critical': 1, 'important': 2, 'moderate': 3, 'low': 4}
        severities     = [c.get('severity', 'unknown').lower() for c in cves]
        top_severity   = min(severities, key=lambda s: severity_order.get(s, 99))
        severity_map   = {'critical': 'Critical', 'important': 'Important', 'moderate': 'Moderate', 'low': 'Low'}
        severity       = severity_map.get(top_severity, 'Moderate')

        first       = cves[0]
        synopsis    = f"RHEL: {advisory_id} - {first.get('bugzilla_description', ', '.join(cve_ids))}"
        description = first.get('bugzilla_description', '')

        all_packages = []
        for c in cves:
            all_packages.extend(c.get('affected_packages', []))
        x86_pkgs = sorted({
            p for p in all_packages
            if 'x86_64' in p and 'debuginfo' not in p and 'debugsource' not in p
        })

        if x86_pkgs:
            pkg_names   = sorted({p.rsplit('-', 2)[0] for p in x86_pkgs})
            remediation = (
                f"Run: yum update {' '.join(pkg_names)}\n\n"
                f"Patched versions:\n" +
                "\n".join(f"  • {p}" for p in x86_pkgs[:20])
            )
        else:
            remediation = "Apply the latest available updates via: yum update"

        return {
            'advisory_id': advisory_id,
            'cve_ids':     cve_ids,
            'severity':    severity,
            'description': description,
            'synopsis':    synopsis,
            'remediation': remediation,
        }
    except Exception as e:
        print(f"Enricher: failed to fetch {advisory_id}: {e}")
        return None

def enrich_advisories():
    pending = get_uncached_advisories()
    if not pending:
        print("Enricher: all RedHat advisories already cached")
        return

    print(f"Enricher: fetching {len(pending)} new advisories")
    success = 0
    for advisory_id in pending:
        print(f"Enricher: fetching {advisory_id}...")
        try:
            if advisory_id.startswith('RLSA'):
                data = fetch_rocky_advisory(advisory_id)
            elif advisory_id.startswith('RHSA'):
                data = fetch_rhel_advisory(advisory_id)
            else:
                print(f"Enricher: unknown advisory format {advisory_id}, skipping")
                continue

            if data:
                save_cve_details(
                    data['advisory_id'], data['cve_ids'], data['severity'],
                    data['description'], data['synopsis'], data['remediation'],
                    source_package=None,
                )
                success += 1
                print(f"Enricher: {advisory_id} ✓")
        except Exception as e:
            print(f"Enricher: error processing {advisory_id}: {e}")

    print(f"Enricher: cached {success}/{len(pending)} advisories")

# ── Ubuntu enrichment ─────────────────────────────────────────────────────────

def get_ubuntu_hosts_and_packages() -> list[dict]:
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('SELECT scan_id FROM scan_runs ORDER BY scanned_at DESC LIMIT 1')
        row = cursor.fetchone()
        if not row:
            return []
        latest_scan_id = row[0]

        cursor.execute('''
            SELECT sr.host, sr.os_version,
                   array_agg(sp.package_name) as packages,
                   sr.package_source_map
            FROM scan_results sr
            JOIN scan_packages sp ON sp.scan_id = sr.scan_id AND sp.host = sr.host
            WHERE sr.scan_id = %s AND sr.os_version ILIKE 'Ubuntu%%'
            GROUP BY sr.host, sr.os_version, sr.package_source_map
        ''', (latest_scan_id,))

        results = []
        for host, os_version, packages, source_map in cursor.fetchall():
            codename = get_ubuntu_codename(os_version)
            if codename and packages:
                results.append({
                    'host':       host,
                    'codename':   codename,
                    'packages':   packages,
                    'source_map': source_map or {},
                })
        return results
    finally:
        cursor.close()
        conn.close()

def get_cached_ubuntu_cve_ids() -> set:
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT advisory_id FROM cve_details WHERE advisory_id LIKE 'CVE-%%'")
        return {row[0] for row in cursor.fetchall()}
    finally:
        cursor.close()
        conn.close()

def fetch_ubuntu_cves_for_package(source_package: str, codename: str) -> list[dict]:
    try:
        url  = UBUNTU_CVES_API.format(source_package)
        resp = requests.get(url, timeout=(5, 20))
        if resp.status_code != 200:
            print(f"Ubuntu enricher: {source_package} returned HTTP {resp.status_code}, skipping")
            return []

        cves    = resp.json().get('cves', [])
        results = []

        for cve in cves:
            cve_id = cve.get('id', '')
            if not cve_id.startswith('CVE-'):
                continue

            affected = False
            for pkg_info in cve.get('packages', []):
                for status_info in pkg_info.get('statuses', []):
                    if (status_info.get('release_codename') == codename
                            and status_info.get('status') in ('needed', 'deferred', 'pending')):
                        affected = True
                        break
                if affected:
                    break

            if not affected:
                continue

            notices = cve.get('notices', [])
            if notices:
                notice       = notices[-1]
                synopsis     = notice.get('title', cve_id)
                description  = notice.get('description', cve.get('description', ''))
                usn_id       = notice.get('id', '')
                instructions = notice.get('instructions', 'In general, a standard system update will make all the necessary changes.')
                remediation  = (
                    f"Run: apt-get update && apt-get upgrade {source_package}\n\n"
                    f"Ubuntu Security Notice: {usn_id}\n{instructions}"
                )
            else:
                synopsis    = f"Ubuntu: {cve_id} affecting {source_package}"
                description = cve.get('description', '')
                remediation = f"Run: apt-get update && apt-get upgrade {source_package}"

            severity = UBUNTU_PRIORITY_MAP.get(cve.get('priority', '').lower(), 'Moderate')
            results.append({
                'advisory_id':    cve_id,
                'cve_ids':        [cve_id],
                'severity':       severity,
                'synopsis':       synopsis,
                'description':    description,
                'remediation':    remediation,
                'source_package': source_package,
            })

        return results
    except Exception as e:
        print(f"Ubuntu enricher: failed to fetch CVEs for {source_package}: {e}")
        return []

def enrich_ubuntu_advisories():
    ubuntu_hosts = get_ubuntu_hosts_and_packages()
    print(f"Ubuntu enricher: found {len(ubuntu_hosts)} Ubuntu hosts with packages")
    for h in ubuntu_hosts:
        print(f"  {h['host']} ({h['codename']}): {len(h['packages'])} packages")

    if not ubuntu_hosts:
        return

    cached_cve_ids    = get_cached_ubuntu_cve_ids()
    seen_pkg_codename = set()
    new_count         = 0

    for host_info in ubuntu_hosts:
        codename   = host_info['codename']
        source_map = host_info['source_map']

        for package in host_info['packages']:
            binary_name = package.split('/')[0].split('=')[0].strip()
            src_name    = source_map.get(binary_name, binary_name)
            src_name    = src_name.split(' (')[0].strip()

            key = (src_name, codename)
            if key in seen_pkg_codename:
                continue
            seen_pkg_codename.add(key)

            print(f"Ubuntu enricher: fetching CVEs for {src_name} ({codename})")
            try:
                cve_list = fetch_ubuntu_cves_for_package(src_name, codename)
                print(f"Ubuntu enricher: {src_name} → {len(cve_list)} CVEs")
                for cve_data in cve_list:
                    if cve_data['advisory_id'] in cached_cve_ids:
                        continue
                    save_cve_details(
                        cve_data['advisory_id'], cve_data['cve_ids'], cve_data['severity'],
                        cve_data['description'], cve_data['synopsis'], cve_data['remediation'],
                        source_package=cve_data['source_package'],
                    )
                    cached_cve_ids.add(cve_data['advisory_id'])
                    new_count += 1
            except Exception as e:
                print(f"Ubuntu enricher: ERROR on {src_name}: {e}")

    print(f"Ubuntu enricher: cached {new_count} new Ubuntu CVEs")

# ── CVSS enrichment (Red Hat primary, NVD fallback) ──────────────────────────

def fetch_rh_cvss(cve_id: str) -> dict | None:
    """Fetch CVSS score from Red Hat Security Data API.
    Tries the CVE endpoint first (cvss3_score field), then searches the
    CVE list endpoint which sometimes has scores when the detail page doesn't.
    Falls back to cvss2 if no v3 available.
    """
    try:
        resp = requests.get(RH_CVE_API.format(cve_id), timeout=(5, 15))
        if resp.status_code == 200:
            data = resp.json()
            # try cvss3 first
            score  = data.get("cvss3_score")
            vector = data.get("cvss3_scoring_vector")
            if score and float(score) > 0:
                return {"score": float(score), "vector": vector, "version": "3.1", "source": "redhat"}
            # try cvss2 fallback
            score  = data.get("cvss_score")
            vector = data.get("cvss_scoring_vector")
            if score and float(score) > 0:
                return {"score": float(score), "vector": vector, "version": "2.0", "source": "redhat"}
            # RH has the CVE record but no score yet (common for recent 2025 CVEs)
            # try the list search endpoint which aggregates differently
            try:
                search_resp = requests.get(
                    f"https://access.redhat.com/hydra/rest/securitydata/cve.json?cve={cve_id}",
                    timeout=(5, 15)
                )
                if search_resp.status_code == 200:
                    items = search_resp.json()
                    if items:
                        item   = items[0]
                        score  = item.get("cvss3_score")
                        vector = item.get("cvss3_scoring_vector")
                        if score and float(score) > 0:
                            return {"score": float(score), "vector": vector, "version": "3.1", "source": "redhat"}
                        score  = item.get("cvss_score")
                        vector = item.get("cvss_scoring_vector")
                        if score and float(score) > 0:
                            return {"score": float(score), "vector": vector, "version": "2.0", "source": "redhat"}
            except Exception:
                pass
        return None
    except Exception as e:
        print(f"RH: failed to fetch {cve_id}: {e}")
        return None

def fetch_nvd_cvss(cve_id: str) -> dict | None:
    """Fetch CVSS score from NVD (fallback for CVEs with no Red Hat data)."""
    try:
        headers = {}
        if NVD_API_KEY:
            headers["apiKey"] = NVD_API_KEY
        resp = requests.get(NVD_CVE_API.format(cve_id), headers=headers, timeout=(5, 15))
        if resp.status_code == 404:
            return None
        if resp.status_code != 200:
            print(f"NVD: {cve_id} returned HTTP {resp.status_code}")
            return None
        vuln_list = resp.json().get("vulnerabilities", [])
        if not vuln_list:
            return None
        metrics = vuln_list[0].get("cve", {}).get("metrics", {})
        for version_key, version_label in [
            ("cvssMetricV31", "3.1"),
            ("cvssMetricV30", "3.0"),
            ("cvssMetricV2",  "2.0"),
        ]:
            entries = metrics.get(version_key, [])
            if entries:
                cvss_data = entries[0].get("cvssData", {})
                score     = cvss_data.get("baseScore")
                vector    = cvss_data.get("vectorString")
                if score is not None:
                    return {"score": float(score), "vector": vector, "version": version_label, "source": "nvd"}
        return None
    except Exception as e:
        print(f"NVD: failed to fetch {cve_id}: {e}")
        return None

def fetch_cvss(cve_id: str) -> dict | None:
    """Try Red Hat first, fall back to NVD."""
    result = fetch_rh_cvss(cve_id)
    if result:
        return result
    return fetch_nvd_cvss(cve_id)

def save_cvss_to_db(advisory_id: str, cvss_score, cvss_vector, cvss_version, cvss_source):
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE cve_details
            SET cvss_score     = %s,
                cvss_vector    = %s,
                cvss_version   = %s,
                cvss_source    = %s,
                nvd_fetched_at = NOW()
            WHERE advisory_id = %s
        """, (cvss_score, cvss_vector, cvss_version, cvss_source, advisory_id))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

def get_cves_needing_cvss_enrichment() -> list[dict]:
    """CVEs with no CVSS score, or score older than 7 days. Critical/Important first."""
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT advisory_id, cve_ids
            FROM cve_details
            WHERE cve_ids IS NOT NULL
              AND array_length(cve_ids, 1) > 0
              AND (
                nvd_fetched_at IS NULL
                OR nvd_fetched_at < NOW() - INTERVAL '7 days'
              )
            ORDER BY
                CASE severity
                    WHEN 'Critical'  THEN 1
                    WHEN 'Important' THEN 2
                    WHEN 'Moderate'  THEN 3
                    WHEN 'Low'       THEN 4
                    ELSE 5
                END
        """)
        return [{"advisory_id": row[0], "cve_ids": row[1]} for row in cursor.fetchall()]
    finally:
        cursor.close()
        conn.close()

def _fetch_best_cvss_for_advisory(record: dict) -> tuple:
    """Worker: try Red Hat first, NVD fallback, keep highest score across up to 3 CVE IDs."""
    advisory_id  = record["advisory_id"]
    cve_ids      = record["cve_ids"]
    best = None
    for cve_id in cve_ids[:3]:
        result = fetch_cvss(cve_id)
        if result and (best is None or result["score"] > best["score"]):
            best = result
    if best:
        return (advisory_id, best["score"], best["vector"], best["version"], best["source"])
    return (advisory_id, None, None, None, None)

def enrich_cvss():
    """
    Pull CVSS scores using Red Hat API (primary) with NVD fallback.
    8 concurrent workers — Red Hat has no rate limit, NVD allows 50 req/30s with key.
    """
    pending = get_cves_needing_cvss_enrichment()
    if not pending:
        print("CVSS enricher: all CVEs already scored")
        return

    print(f"CVSS enricher: scoring {len(pending)} advisories (Red Hat primary, NVD fallback)")

    success = 0
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(_fetch_best_cvss_for_advisory, r): r for r in pending}
        for future in as_completed(futures):
            try:
                advisory_id, score, vector, version, source = future.result()
                save_cvss_to_db(advisory_id, score, vector, version, source)
                if score is not None:
                    print(f"CVSS enricher: {advisory_id} -> {score} v{version} [{source}] OK")
                    success += 1
                else:
                    print(f"CVSS enricher: {advisory_id} -> no score found")
            except Exception as e:
                print(f"CVSS enricher: worker error: {e}")

    print(f"CVSS enricher: scored {success}/{len(pending)} advisories")

# keep old name as alias so any manual calls still work
enrich_nvd_cvss = enrich_cvss

# ── main entry point ──────────────────────────────────────────────────────────

def enrich_all():
    print("enrich_all: starting Rocky/RHEL enrichment")
    try:
        enrich_advisories()
    except Exception as e:
        print(f"enrich_all: Rocky/RHEL enrichment failed: {e}")

    print("enrich_all: starting CVSS enrichment (pre-Ubuntu)")
    try:
        enrich_cvss()
    except Exception as e:
        print(f"enrich_all: CVSS enrichment failed: {e}")

    print("enrich_all: starting Ubuntu enrichment")
    try:
        enrich_ubuntu_advisories()
    except Exception as e:
        print(f"enrich_all: Ubuntu enrichment failed: {e}")

    print("enrich_all: starting CVSS enrichment (post-Ubuntu, new CVEs only)")
    try:
        enrich_cvss()
    except Exception as e:
        print(f"enrich_all: CVSS post-Ubuntu enrichment failed: {e}")

    print("enrich_all: done")