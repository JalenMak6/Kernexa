import re
import requests
from database import get_conn

ROCKY_ERRATA_API = "https://errata.rockylinux.org/api/v2/advisories/{}"
UBUNTU_CVES_API  = "https://ubuntu.com/security/cves.json?package={}&limit=20"

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

        cursor.execute("SELECT advisory_id FROM cve_details WHERE advisory_id LIKE 'RLSA-%%'")
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

        data = resp.json().get('advisory', {})

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
            pkg_names = sorted({p.rsplit('-', 2)[0] for p in patched_packages})
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

def enrich_advisories():
    pending = get_uncached_advisories()
    if not pending:
        print("Enricher: all Rocky advisories already cached")
        return

    print(f"Enricher: fetching {len(pending)} new Rocky advisories")
    success = 0
    for advisory_id in pending:
        print(f"Enricher: fetching {advisory_id}...")
        try:
            data = fetch_rocky_advisory(advisory_id)
            if data:
                save_cve_details(
                    data['advisory_id'],
                    data['cve_ids'],
                    data['severity'],
                    data['description'],
                    data['synopsis'],
                    data['remediation'],
                    source_package=None,  # Rocky uses advisory_ids for host matching
                )
                success += 1
                print(f"Enricher: {advisory_id} ✓")
        except Exception as e:
            print(f"Enricher: error processing {advisory_id}: {e}")

    print(f"Enricher: cached {success}/{len(pending)} Rocky advisories")

# ── Ubuntu enrichment ─────────────────────────────────────────────────────────

def get_ubuntu_hosts_and_packages() -> list[dict]:
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT scan_id FROM scan_runs
            ORDER BY scanned_at DESC LIMIT 1
        ''')
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
            WHERE sr.scan_id = %s
              AND sr.os_version ILIKE 'Ubuntu%%'
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

            # check if this CVE affects our codename and is still unpatched
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
                notice      = notices[-1]
                synopsis    = notice.get('title', cve_id)
                description = notice.get('description', cve.get('description', ''))
                usn_id      = notice.get('id', '')
                instructions = notice.get('instructions',
                    'In general, a standard system update will make all the necessary changes.')
                remediation = (
                    f"Run: apt-get update && apt-get upgrade {source_package}\n\n"
                    f"Ubuntu Security Notice: {usn_id}\n"
                    f"{instructions}"
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

            # resolve to source package name; strip any version suffix e.g. "pkg (1.2.3)"
            src_name = source_map.get(binary_name, binary_name)
            src_name = src_name.split(' (')[0].strip()

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
                        # update source_package if missing on existing record
                        continue
                    save_cve_details(
                        cve_data['advisory_id'],
                        cve_data['cve_ids'],
                        cve_data['severity'],
                        cve_data['description'],
                        cve_data['synopsis'],
                        cve_data['remediation'],
                        source_package=cve_data['source_package'],
                    )
                    cached_cve_ids.add(cve_data['advisory_id'])
                    new_count += 1
            except Exception as e:
                print(f"Ubuntu enricher: ERROR on {src_name}: {e}")

    print(f"Ubuntu enricher: cached {new_count} new Ubuntu CVEs")

# ── main entry point ──────────────────────────────────────────────────────────

def enrich_all():
    print("enrich_all: starting Rocky enrichment")
    try:
        enrich_advisories()
    except Exception as e:
        print(f"enrich_all: Rocky enrichment failed: {e}")
    print("enrich_all: starting Ubuntu enrichment")
    try:
        enrich_ubuntu_advisories()
    except Exception as e:
        print(f"enrich_all: Ubuntu enrichment failed: {e}")
    print("enrich_all: done")