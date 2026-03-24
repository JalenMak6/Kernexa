"""
database/scans.py
Linux scan data persistence and retrieval:
  save_to_db, get_latest_scan, get_scan_history, get_scan_failures,
  get_cve_details, get_hosts, save_hosts
"""

import json
from datetime import datetime

from database.connection import get_conn
from database.hosts import get_tags_for_hosts


def save_to_db(output: dict, scan_id: str, scanned_at: datetime):
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO scan_runs (scan_id, scanned_at, status, rc, host_failures, ansible_log)
            VALUES (%s, %s, %s, %s, %s, %s)
        ''', (
            scan_id, scanned_at,
            output['status'], output['rc'],
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
                scan_id, host,
                data.get('current_kernel_version'),
                data.get('latest_available_kernel_version'),
                data.get('os_version'),
                data.get('last_reboot_time'),
                data.get('advisory_ids', []),
                json.dumps(data.get('package_source_map', {})),
            ))

            for package in data.get('pending_security_packages', []):
                cursor.execute('''
                    INSERT INTO scan_packages (scan_id, host, package_name)
                    VALUES (%s, %s, %s)
                ''', (scan_id, host, package))

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def get_latest_scan():
    """Returns the most recent Linux scan that has scan_results rows."""
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT s.scan_id, s.scanned_at, s.status, s.rc, s.host_failures
            FROM scan_runs s
            WHERE EXISTS (
                SELECT 1 FROM scan_results sr WHERE sr.scan_id = s.scan_id
            )
            ORDER BY s.scanned_at DESC
            LIMIT 1
        ''')
        scan = cursor.fetchone()
        if not scan:
            return None

        scan_id, scanned_at, status, rc, host_failures = scan

        cursor.execute('''
            SELECT host, current_kernel_version, latest_available_kernel_version,
                   os_version, last_reboot_time, advisory_ids
            FROM scan_results WHERE scan_id = %s
        ''', (scan_id,))
        hosts = cursor.fetchall()

        result = {
            'scan_id':       scan_id,
            'scanned_at':    scanned_at.isoformat() + 'Z',
            'status':        status,
            'rc':            rc,
            'host_failures': host_failures or {},
            'hosts':         [],
        }

        for host, current_kernel, latest_kernel, os_version, last_reboot_time, advisory_ids in hosts:
            cursor.execute('''
                SELECT package_name FROM scan_packages
                WHERE scan_id = %s AND host = %s ORDER BY package_name
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
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT
                s.scan_id, s.scanned_at, s.status, s.rc, s.host_failures,
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
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT host_failures, ansible_log, status, rc, scanned_at
            FROM scan_runs WHERE scan_id = %s
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


def get_cve_details():
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('SELECT scan_id FROM scan_runs ORDER BY scanned_at DESC LIMIT 1')
        row = cursor.fetchone()
        if not row:
            return []
        latest_scan_id = row[0]

        cursor.execute('''
            SELECT
                cd.advisory_id, cd.synopsis, cd.severity, cd.cve_ids,
                cd.description, cd.fetched_at, cd.remediation,
                cd.cvss_score, cd.cvss_vector, cd.cvss_version, cd.cvss_source,
                ARRAY_AGG(DISTINCT sr.host) FILTER (WHERE sr.host IS NOT NULL) as affected_hosts
            FROM cve_details cd
            LEFT JOIN scan_results sr ON sr.scan_id = %s AND (
                (cd.advisory_id ~ \'^(RLSA|RHSA|ALSA)-\'
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


def get_hosts():
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('SELECT hostname FROM hosts WHERE active = TRUE ORDER BY hostname')
        return [row[0] for row in cursor.fetchall()]
    finally:
        cursor.close()
        conn.close()


def save_hosts(hostnames: list):
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('DELETE FROM hosts')
        for h in hostnames:
            cursor.execute('''
                INSERT INTO hosts (hostname, active) VALUES (%s, TRUE)
                ON CONFLICT (hostname) DO UPDATE SET active = TRUE
            ''', (h,))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def save_host_ports(scan_id: str, host: str, ports: list):
    """Save open port data for a host collected during a scan."""
    if not ports:
        return
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        for p in ports:
            cursor.execute('''
                INSERT INTO host_ports
                    (scan_id, host, port, protocol, state, bind_address, service, pid)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ''', (
                scan_id,
                host,
                p['port'],
                p.get('protocol'),
                p.get('state', 'LISTEN'),
                p.get('bind_address'),
                p.get('service'),
                p.get('pid'),
            ))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def get_host_ports(hostname: str) -> list:
    """
    Return open ports for a host from the latest scan.
    Each entry: port, protocol, bind_address, service, pid, exposure.
    exposure is 'external' (0.0.0.0), 'internal' (127.0.0.1),
    or 'interface' (specific IP).
    """
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT s.scan_id FROM scan_runs s
            WHERE EXISTS (
                SELECT 1 FROM host_ports hp
                WHERE hp.scan_id = s.scan_id AND hp.host = %s
            )
            ORDER BY s.scanned_at DESC LIMIT 1
        ''', (hostname,))
        row = cursor.fetchone()
        if not row:
            return []
        latest_scan_id = row[0]

        cursor.execute('''
            SELECT port, protocol, state, bind_address, service, pid
            FROM host_ports
            WHERE scan_id = %s AND host = %s
            ORDER BY port ASC
        ''', (latest_scan_id, hostname))

        rows = cursor.fetchall()
        result = []
        for port, protocol, state, bind_address, service, pid in rows:
            if bind_address == '0.0.0.0':
                exposure = 'external'
            elif bind_address == '127.0.0.1':
                exposure = 'internal'
            else:
                exposure = 'interface'
            result.append({
                'port':         port,
                'protocol':     protocol,
                'state':        state,
                'bind_address': bind_address,
                'service':      service,
                'pid':          pid,
                'exposure':     exposure,
            })
        return result
    finally:
        cursor.close()
        conn.close()