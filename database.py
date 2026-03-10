import psycopg2
import json
from datetime import datetime
import os

DB_CONFIG = {
    'host':     os.environ.get('DB_HOST', 'db'),
    'port':     int(os.environ.get('DB_PORT', 5432)),
    'dbname':   os.environ.get('DB_NAME', 'kernexa'),
    'user':     os.environ.get('DB_USER', 'kernexa_user'),
    'password': os.environ.get('DB_PASSWORD', 'supersecret'),
}

def get_conn():
    return psycopg2.connect(**DB_CONFIG)

# ── inventories ───────────────────────────────────────────────────────────────

def get_inventories():
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT i.id, i.name, i.host_count, i.uploaded_at, i.is_active,
                   CASE WHEN c.id IS NOT NULL THEN TRUE ELSE FALSE END as has_credentials
            FROM inventories i
            LEFT JOIN credentials c ON c.inventory_id = i.id
            ORDER BY i.uploaded_at DESC
        ''')
        rows = cursor.fetchall()
        return [
            {
                'id':              row[0],
                'name':            row[1],
                'host_count':      row[2],
                'uploaded_at':     row[3].isoformat() + 'Z',
                'is_active':       row[4],
                'has_credentials': row[5]
            }
            for row in rows
        ]
    finally:
        cursor.close()
        conn.close()

def get_inventory_content(inv_id: int) -> str:
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('SELECT content FROM inventories WHERE id = %s', (inv_id,))
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Inventory {inv_id} not found")
        return row[0]
    finally:
        cursor.close()
        conn.close()

def save_inventory(name: str, content: str, host_count: int) -> int:
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO inventories (name, content, host_count, is_active)
            VALUES (%s, %s, %s, FALSE)
            RETURNING id
        ''', (name, content, host_count))
        inv_id = cursor.fetchone()[0]
        conn.commit()
        return inv_id
    except Exception as e:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

def activate_inventory(inv_id: int) -> str:
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('UPDATE inventories SET is_active = FALSE')
        cursor.execute('''
            UPDATE inventories SET is_active = TRUE
            WHERE id = %s
            RETURNING content
        ''', (inv_id,))
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Inventory {inv_id} not found")
        conn.commit()
        return row[0]
    except Exception as e:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

def delete_inventory(inv_id: int):
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('DELETE FROM inventories WHERE id = %s', (inv_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

# ── credentials ───────────────────────────────────────────────────────────────

def save_credentials(inventory_id: int, username: str, password: str):
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO credentials (inventory_id, username, password, updated_at)
            VALUES (%s, %s, %s, NOW())
            ON CONFLICT (inventory_id)
            DO UPDATE SET username   = EXCLUDED.username,
                          password   = EXCLUDED.password,
                          updated_at = NOW()
        ''', (inventory_id, username, password))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

def get_credentials(inventory_id: int) -> dict | None:
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT username, password, updated_at
            FROM credentials
            WHERE inventory_id = %s
        ''', (inventory_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return {
            'username':   row[0],
            'password':   row[1],
            'updated_at': row[2].isoformat() + 'Z'
        }
    finally:
        cursor.close()
        conn.close()

def get_active_inventory_credentials() -> dict | None:
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT c.username, c.password, i.id
            FROM credentials c
            JOIN inventories i ON i.id = c.inventory_id
            WHERE i.is_active = TRUE
            LIMIT 1
        ''')
        row = cursor.fetchone()
        if not row:
            return None
        return {'username': row[0], 'password': row[1], 'inventory_id': row[2]}
    finally:
        cursor.close()
        conn.close()

# ── scan data ─────────────────────────────────────────────────────────────────

def save_to_db(output: dict, scan_id: str, scanned_at: datetime):
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO scan_runs (scan_id, scanned_at, status, rc, host_failures, ansible_log)
            VALUES (%s, %s, %s, %s, %s, %s)
        ''', (
            scan_id,
            scanned_at,
            output['status'],
            output['rc'],
            json.dumps(output.get('failures', {})),
            output.get('ansible_log', ''),
        ))

        for host, data in output['hosts'].items():
            cursor.execute('''
                INSERT INTO scan_results (
                    scan_id, host, current_kernel_version,
                    latest_available_kernel_version, os_version,
                    last_reboot_time, advisory_ids, package_source_map
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ''', (
                scan_id,
                host,
                data.get('current_kernel_version'),
                data.get('latest_available_kernel_version'),
                data.get('os_version'),
                data.get('last_reboot_time'),
                data.get('advisory_ids', []),
                json.dumps(data.get('package_source_map', {}))
            ))

            for package in data.get('pending_security_packages', []):
                cursor.execute('''
                    INSERT INTO scan_packages (scan_id, host, package_name)
                    VALUES (%s, %s, %s)
                ''', (scan_id, host, package))

        conn.commit()
    except Exception as e:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

def get_latest_scan():
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT scan_id, scanned_at, status, rc, host_failures
            FROM scan_runs
            ORDER BY scanned_at DESC
            LIMIT 1
        ''')
        scan = cursor.fetchone()
        if not scan:
            return None

        scan_id, scanned_at, status, rc, host_failures = scan

        cursor.execute('''
            SELECT host, current_kernel_version, latest_available_kernel_version,
                   os_version, last_reboot_time, advisory_ids
            FROM scan_results
            WHERE scan_id = %s
        ''', (scan_id,))
        hosts = cursor.fetchall()

        result = {
            'scan_id':       scan_id,
            'scanned_at':    scanned_at.isoformat() + 'Z',
            'status':        status,
            'rc':            rc,
            'host_failures': host_failures or {},
            'hosts':         []
        }

        for host, current_kernel, latest_kernel, os_version, last_reboot_time, advisory_ids in hosts:
            cursor.execute('''
                SELECT package_name FROM scan_packages
                WHERE scan_id = %s AND host = %s
                ORDER BY package_name
            ''', (scan_id, host))
            packages = [row[0] for row in cursor.fetchall()]

            result['hosts'].append({
                'host':                            host,
                'os_version':                      os_version,
                'current_kernel_version':          current_kernel,
                'latest_available_kernel_version': latest_kernel,
                'last_reboot_time':                last_reboot_time,
                'advisory_ids':                    advisory_ids or [],
                'pending_security_packages':       packages,
                'package_count':                   len(packages),
            })

        return result
    finally:
        cursor.close()
        conn.close()

def get_scan_history():
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT
                s.scan_id,
                s.scanned_at,
                s.status,
                s.rc,
                s.host_failures,
                COUNT(DISTINCT sr.host) as host_count
            FROM scan_runs s
            LEFT JOIN scan_results sr ON s.scan_id = sr.scan_id
            GROUP BY s.scan_id, s.scanned_at, s.status, s.rc, s.host_failures
            ORDER BY s.scanned_at DESC
        ''')
        rows = cursor.fetchall()
        return [
            {
                'scan_id':       row[0],
                'scanned_at':    row[1].isoformat() + 'Z',
                'status':        row[2],
                'rc':            row[3],
                'failure_count': len(row[4]) if row[4] else 0,
                'host_count':    row[5],
            }
            for row in rows
        ]
    finally:
        cursor.close()
        conn.close()

def get_scan_failures(scan_id: str) -> dict:
    """Return per-host failure details and ansible log for a given scan."""
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT host_failures, ansible_log, status, rc, scanned_at
            FROM scan_runs
            WHERE scan_id = %s
        ''', (scan_id,))
        row = cursor.fetchone()
        if not row:
            return None
        host_failures, ansible_log, status, rc, scanned_at = row
        return {
            'scan_id':       scan_id,
            'scanned_at':    scanned_at.isoformat() + 'Z',
            'status':        status,
            'rc':            rc,
            'host_failures': host_failures or {},
            'ansible_log':   ansible_log or '',
        }
    finally:
        cursor.close()
        conn.close()

def get_hosts():
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('SELECT hostname FROM hosts WHERE active = TRUE ORDER BY hostname')
        return [row[0] for row in cursor.fetchall()]
    finally:
        cursor.close()
        conn.close()

def get_cve_details():
    """Return all CVE details joined with affected hosts from latest scan."""
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
            SELECT
                cd.advisory_id,
                cd.synopsis,
                cd.severity,
                cd.cve_ids,
                cd.description,
                cd.fetched_at,
                cd.remediation,
                ARRAY_AGG(DISTINCT sr.host) FILTER (WHERE sr.host IS NOT NULL) as affected_hosts
            FROM cve_details cd
            LEFT JOIN scan_results sr ON sr.scan_id = %s AND (
                (cd.advisory_id ~ '^(RLSA|RHSA)-'
                    AND cd.advisory_id = ANY(sr.advisory_ids::text[]))
                OR
                (cd.advisory_id LIKE 'CVE-%%'
                    AND cd.source_package IS NOT NULL
                    AND EXISTS (
                        SELECT 1 FROM jsonb_each_text(sr.package_source_map) kv
                        WHERE kv.value = cd.source_package
                    )
                )
            )
            GROUP BY cd.advisory_id, cd.synopsis, cd.severity, cd.cve_ids,
                     cd.description, cd.fetched_at, cd.remediation, cd.source_package
            ORDER BY
                CASE cd.severity
                    WHEN 'Critical'  THEN 1
                    WHEN 'Important' THEN 2
                    WHEN 'Moderate'  THEN 3
                    WHEN 'Low'       THEN 4
                    ELSE 5
                END,
                cd.advisory_id
        ''', (latest_scan_id,))

        rows = cursor.fetchall()
        return [
            {
                'advisory_id':    row[0],
                'synopsis':       row[1],
                'severity':       row[2],
                'cve_ids':        row[3] or [],
                'description':    row[4],
                'fetched_at':     row[5].isoformat() + 'Z',
                'remediation':    row[6],
                'affected_hosts': row[7] or [],
            }
            for row in rows
        ]
    finally:
        cursor.close()
        conn.close()

def save_hosts(hostnames: list):
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('DELETE FROM hosts')
        for h in hostnames:
            cursor.execute('''
                INSERT INTO hosts (hostname, active)
                VALUES (%s, TRUE)
                ON CONFLICT (hostname) DO UPDATE SET active = TRUE
            ''', (h,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()