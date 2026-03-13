import psycopg2
import json
from datetime import datetime
import os
from cryptography.fernet import Fernet, InvalidToken

DB_CONFIG = {
    'host':     os.environ.get('DB_HOST', 'db'),
    'port':     int(os.environ.get('DB_PORT', 5432)),
    'dbname':   os.environ.get('DB_NAME', 'kernexa'),
    'user':     os.environ.get('DB_USER', 'kernexa_user'),
    'password': os.environ.get('DB_PASSWORD', 'supersecret'),
}


# ── credential encryption ─────────────────────────────────────────────────────

def _get_fernet() -> Fernet:
    key = os.environ.get('CREDENTIALS_KEY', '').strip()
    if not key:
        raise RuntimeError(
            "CREDENTIALS_KEY is not set in .env. "
            "Generate one with: python3 -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    try:
        return Fernet(key.encode())
    except Exception as e:
        raise RuntimeError(f"CREDENTIALS_KEY is invalid: {e}")

def _encrypt(plaintext: str) -> str:
    return _get_fernet().encrypt(plaintext.encode()).decode()

def _decrypt(ciphertext: str) -> str:
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except (InvalidToken, Exception):
        return ciphertext

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
        ''', (inventory_id, username, _encrypt(password)))
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
            'password':   _decrypt(row[1]),
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
        return {'username': row[0], 'password': _decrypt(row[1]), 'inventory_id': row[2]}
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

        hostnames = [h['host'] for h in result['hosts']]
        tags_map  = get_tags_for_hosts(hostnames)
        for h in result['hosts']:
            h['tags'] = tags_map.get(h['host'], [])

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
                COUNT(DISTINCT sr.host) as host_count,
                COUNT(DISTINCT CASE
                    WHEN sr.current_kernel_version IS NOT NULL
                      AND sr.latest_available_kernel_version IS NOT NULL
                      AND sr.latest_available_kernel_version != ''
                      AND sr.current_kernel_version = sr.latest_available_kernel_version
                    THEN sr.host END) as compliant_count,
                COUNT(DISTINCT CASE
                    WHEN sr.current_kernel_version IS NOT NULL
                      AND sr.latest_available_kernel_version IS NOT NULL
                      AND sr.latest_available_kernel_version != ''
                      AND sr.current_kernel_version != sr.latest_available_kernel_version
                    THEN sr.host END) as outdated_count
            FROM scan_runs s
            LEFT JOIN scan_results sr ON s.scan_id = sr.scan_id
            GROUP BY s.scan_id, s.scanned_at, s.status, s.rc, s.host_failures
            ORDER BY s.scanned_at DESC
        ''')
        rows = cursor.fetchall()
        return [
            {
                'scan_id':         row[0],
                'scanned_at':      row[1].isoformat() + 'Z',
                'status':          row[2],
                'rc':              row[3],
                'failure_count':   len(row[4]) if row[4] else 0,
                'host_count':      row[5],
                'compliant_count': row[6],
                'outdated_count':  row[7],
            }
            for row in rows
        ]
    finally:
        cursor.close()
        conn.close()

def get_scan_failures(scan_id: str) -> dict:
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
                cd.cvss_score,
                cd.cvss_vector,
                cd.cvss_version,
                cd.cvss_source,
                ARRAY_AGG(DISTINCT sr.host) FILTER (WHERE sr.host IS NOT NULL) as affected_hosts
            FROM cve_details cd
            LEFT JOIN scan_results sr ON sr.scan_id = %s AND (
                (cd.advisory_id ~ \'^(RLSA|RHSA)-\'
                    AND cd.advisory_id = ANY(sr.advisory_ids::text[]))
                OR
                (cd.advisory_id LIKE \'CVE-%%\'
                    AND cd.source_package IS NOT NULL
                    AND EXISTS (
                        SELECT 1 FROM jsonb_each_text(sr.package_source_map) kv
                        WHERE kv.value = cd.source_package
                    )
                )
            )
            GROUP BY cd.advisory_id, cd.synopsis, cd.severity, cd.cve_ids,
                     cd.description, cd.fetched_at, cd.remediation, cd.source_package,
                     cd.cvss_score, cd.cvss_vector, cd.cvss_version, cd.cvss_source
            ORDER BY
                CASE cd.severity
                    WHEN \'Critical\'  THEN 1
                    WHEN \'Important\' THEN 2
                    WHEN \'Moderate\'  THEN 3
                    WHEN \'Low\'       THEN 4
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
                'cvss_score':     float(row[7]) if row[7] is not None else None,
                'cvss_vector':    row[8],
                'cvss_version':   row[9],
                'cvss_source':    row[10],
                'affected_hosts': row[11] or [],
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

# ── host tags ─────────────────────────────────────────────────────────────────

def get_tags_for_host(hostname: str) -> list[str]:
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('SELECT tag FROM host_tags WHERE hostname = %s ORDER BY tag', (hostname,))
        return [row[0] for row in cursor.fetchall()]
    finally:
        cursor.close()
        conn.close()

def get_all_tags() -> list[str]:
    conn = get_conn()
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
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'INSERT INTO host_tags (hostname, tag) VALUES (%s, %s) ON CONFLICT DO NOTHING',
            (hostname, tag)
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

def remove_tag(hostname: str, tag: str):
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('DELETE FROM host_tags WHERE hostname = %s AND tag = %s', (hostname, tag))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

def get_tags_for_hosts(hostnames: list[str]) -> dict[str, list[str]]:
    if not hostnames:
        return {}
    conn = get_conn()
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

# ── notification settings ─────────────────────────────────────────────────────

def get_notification_settings() -> dict:
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT smtp_host, smtp_port, smtp_user, smtp_password,
                   smtp_from, recipients, tls_enabled
            FROM notification_settings
            WHERE id = 1
        ''')
        row = cursor.fetchone()
        if not row:
            return {
                'smtp_host': '', 'smtp_port': 587, 'smtp_user': '',
                'smtp_password': '', 'smtp_from': '', 'recipients': [],
                'tls_enabled': True
            }
        return {
            'smtp_host':     row[0] or '',
            'smtp_port':     row[1] or 587,
            'smtp_user':     row[2] or '',
            'smtp_password': row[3] or '',
            'smtp_from':     row[4] or '',
            'recipients':    row[5] or [],
            'tls_enabled':   row[6] if row[6] is not None else True,
        }
    finally:
        cursor.close()
        conn.close()

def save_notification_settings(smtp_host: str, smtp_port: int, smtp_user: str,
                                smtp_password: str, smtp_from: str,
                                recipients: list, tls_enabled: bool):
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO notification_settings
                (id, smtp_host, smtp_port, smtp_user, smtp_password, smtp_from, recipients, tls_enabled)
            VALUES (1, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                smtp_host     = EXCLUDED.smtp_host,
                smtp_port     = EXCLUDED.smtp_port,
                smtp_user     = EXCLUDED.smtp_user,
                smtp_password = EXCLUDED.smtp_password,
                smtp_from     = EXCLUDED.smtp_from,
                recipients    = EXCLUDED.recipients,
                tls_enabled   = EXCLUDED.tls_enabled,
                updated_at    = NOW()
        ''', (smtp_host, smtp_port, smtp_user, smtp_password,
              smtp_from, recipients, tls_enabled))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

# ── scan interval ─────────────────────────────────────────────────────────────

def get_scan_interval() -> int:
    """Return the auto-scan interval in minutes (default 180 = 3 hours)."""
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT scan_interval FROM notification_settings WHERE id = 1")
        row = cursor.fetchone()
        return row[0] if row else 180
    finally:
        cursor.close()
        conn.close()

def save_scan_interval(interval_minutes: int):
    """Persist the auto-scan interval (minutes) to the DB."""
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO notification_settings (id, scan_interval)
            VALUES (1, %s)
            ON CONFLICT (id) DO UPDATE SET
                scan_interval = EXCLUDED.scan_interval,
                updated_at    = NOW()
        ''', (interval_minutes,))
        conn.commit()
    finally:
        cursor.close()
        conn.close()

# ── per-host drill-down ───────────────────────────────────────────────────────

def get_host_history(hostname: str) -> list:
    conn = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT
                sr.scan_id,
                s.scanned_at,
                sr.current_kernel_version,
                sr.latest_available_kernel_version,
                sr.os_version,
                sr.last_reboot_time,
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
                cd.cvss_score,
                cd.cvss_vector,
                cd.cvss_version,
                cd.cvss_source,
                cd.remediation
            FROM cve_details cd
            JOIN scan_results sr ON sr.scan_id = %s AND sr.host = %s AND (
                (cd.advisory_id ~ \'^(RLSA|RHSA)-\'
                    AND cd.advisory_id = ANY(sr.advisory_ids::text[]))
                OR
                (cd.advisory_id LIKE \'CVE-%%\'
                    AND cd.source_package IS NOT NULL
                    AND EXISTS (
                        SELECT 1 FROM jsonb_each_text(sr.package_source_map) kv
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
        ''', (latest_scan_id, hostname))

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