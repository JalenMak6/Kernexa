"""
database/hosts.py
Host tags and per-host drill-down queries:
  get_tags_for_host, get_all_tags, add_tag, remove_tag,
  get_tags_for_hosts, get_host_history, get_host_cves
"""

from database.connection import get_conn


# ── host tags ─────────────────────────────────────────────────────────────────

def get_tags_for_host(hostname: str) -> list[str]:
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'SELECT tag FROM host_tags WHERE hostname = %s ORDER BY tag',
            (hostname,)
        )
        return [row[0] for row in cursor.fetchall()]
    finally:
        cursor.close()
        conn.close()


def get_all_tags() -> list[str]:
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('SELECT DISTINCT tag FROM host_tags ORDER BY tag')
        return [row[0] for row in cursor.fetchall()]
    finally:
        cursor.close()
        conn.close()


def add_tag(hostname: str, tag: str):
    tag = tag.strip().lower()
    if not tag:
        raise ValueError("Tag cannot be empty")
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'INSERT INTO host_tags (hostname, tag) VALUES (%s, %s) ON CONFLICT DO NOTHING',
            (hostname, tag)
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def remove_tag(hostname: str, tag: str):
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'DELETE FROM host_tags WHERE hostname = %s AND tag = %s',
            (hostname, tag)
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def get_tags_for_hosts(hostnames: list[str]) -> dict[str, list[str]]:
    if not hostnames:
        return {}
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'SELECT hostname, tag FROM host_tags WHERE hostname = ANY(%s) ORDER BY hostname, tag',
            (hostnames,)
        )
        result = {}
        for hostname, tag in cursor.fetchall():
            result.setdefault(hostname, []).append(tag)
        return result
    finally:
        cursor.close()
        conn.close()


# ── per-host drill-down ───────────────────────────────────────────────────────

def get_host_history(hostname: str) -> list:
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT
                sr.scan_id, s.scanned_at,
                sr.current_kernel_version,
                sr.latest_available_kernel_version,
                sr.os_version, sr.last_reboot_time,
                COUNT(sp.package_name) as package_count
            FROM scan_results sr
            JOIN scan_runs s ON s.scan_id = sr.scan_id
            LEFT JOIN scan_packages sp ON sp.scan_id = sr.scan_id AND sp.host = sr.host
            WHERE sr.host = %s
            GROUP BY sr.scan_id, s.scanned_at, sr.current_kernel_version,
                     sr.latest_available_kernel_version, sr.os_version, sr.last_reboot_time
            ORDER BY s.scanned_at DESC
            LIMIT 30
        ''', (hostname,))
        rows = cursor.fetchall()
        return [
            {
                'scan_id':        row[0],
                'scanned_at':     row[1].isoformat() + 'Z',
                'current_kernel': row[2],
                'latest_kernel':  row[3],
                'os_version':     row[4],
                'last_reboot':    row[5],
                'package_count':  row[6],
                'compliant':      row[2] == row[3] if row[2] and row[3] else None,
            }
            for row in rows
        ]
    finally:
        cursor.close()
        conn.close()


def get_host_cves(hostname: str) -> list:
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        # Use this host's most recent scan, not the global latest scan_id,
        # so a re-scan of another host doesn't clear this host's CVE history.
        cursor.execute('''
            SELECT
                cd.advisory_id, cd.synopsis, cd.severity, cd.cve_ids,
                cd.description, cd.cvss_score, cd.cvss_vector,
                cd.cvss_version, cd.cvss_source, cd.remediation
            FROM cve_details cd
            JOIN (
                SELECT sr.advisory_ids, sr.package_source_map
                FROM scan_results sr
                JOIN scan_runs s ON s.scan_id = sr.scan_id
                WHERE sr.host = %s
                ORDER BY s.scanned_at DESC
                LIMIT 1
            ) latest_host_scan ON (
                (cd.advisory_id ~ \'^(RLSA|RHSA|ALSA)-\'
                    AND cd.advisory_id = ANY(latest_host_scan.advisory_ids::text[]))
                OR
                (cd.advisory_id LIKE \'CVE-%%\'
                    AND cd.source_package IS NOT NULL
                    AND EXISTS (
                        SELECT 1 FROM jsonb_each_text(latest_host_scan.package_source_map) kv
                        WHERE kv.value = cd.source_package
                    )
                )
            )
            ORDER BY
                CASE cd.severity
                    WHEN \'Critical\'  THEN 1
                    WHEN \'Important\' THEN 2
                    WHEN \'Moderate\'  THEN 3
                    WHEN \'Low\'       THEN 4
                    ELSE 5
                END,
                cd.cvss_score DESC NULLS LAST
        ''', (hostname,))

        rows = cursor.fetchall()
        return [
            {
                'advisory_id':  row[0],
                'synopsis':     row[1],
                'severity':     row[2],
                'cve_ids':      row[3] or [],
                'description':  row[4],
                'cvss_score':   float(row[5]) if row[5] is not None else None,
                'cvss_vector':  row[6],
                'cvss_version': row[7],
                'cvss_source':  row[8],
                'remediation':  row[9],
            }
            for row in rows
        ]
    finally:
        cursor.close()
        conn.close()