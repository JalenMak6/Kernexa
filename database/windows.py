"""
database/windows.py
Windows patch scan data persistence and retrieval:
  save_windows_to_db, get_latest_windows_scan
"""

from datetime import datetime
from database.connection import get_conn


def save_windows_to_db(output: dict, scan_id: str):
    """Persist Windows patch scan results — one row per pending KB per host."""
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        for host, data in output['hosts'].items():
            os_name    = data.get('osName', '')
            os_version = data.get('osVersion', '')

            def _parse_ts(val):
                if not val:
                    return None
                try:
                    return datetime.fromisoformat(val.replace('Z', '+00:00'))
                except Exception:
                    return None

            for update in data.get('updates', []):
                cursor.execute('''
                    INSERT INTO windows_scan_results (
                        scan_id, hostname, os_name, os_version,
                        kb_id, patch_id, patch_name, version,
                        published_date_time, reboot_required,
                        classification, msrc_severity,
                        classification_priority, query_run_date_time
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ''', (
                    scan_id,
                    data.get('hostname', host),
                    os_name, os_version,
                    update.get('KBID', ''),
                    update.get('patchId', ''),
                    update.get('patchName', ''),
                    update.get('version', ''),
                    _parse_ts(update.get('publishedDateTime')),
                    update.get('rebootRequired', ''),
                    update.get('classification', ''),
                    update.get('msrcSeverity', ''),
                    int(update.get('classificationPriority', 0) or 0),
                    _parse_ts(update.get('queryRunDateTime')),
                ))

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def get_latest_windows_scan() -> list:
    """Returns all KB records from the most recent Windows scan including timestamp."""
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT DISTINCT w.scan_id, s.scanned_at
            FROM windows_scan_results w
            JOIN scan_runs s ON s.scan_id = w.scan_id
            ORDER BY s.scanned_at DESC
            LIMIT 1
        ''')
        row = cursor.fetchone()
        if not row:
            return []
        scan_id    = row[0]
        scanned_at = row[1].isoformat() + 'Z'

        cursor.execute('''
            SELECT
                hostname, os_name, os_version,
                kb_id, patch_id, patch_name, version,
                published_date_time, reboot_required,
                classification, msrc_severity,
                classification_priority, query_run_date_time
            FROM windows_scan_results
            WHERE scan_id = %s
            ORDER BY hostname, classification_priority, kb_id
        ''', (scan_id,))

        rows = cursor.fetchall()
        return [
            {
                'scan_id':                scan_id,
                'scanned_at':             scanned_at,
                'hostname':               row[0],
                'osName':                 row[1],
                'osVersion':              row[2],
                'KBID':                   row[3],
                'patchId':                row[4],
                'patchName':              row[5],
                'version':                row[6],
                'publishedDateTime':      row[7].strftime('%Y-%m-%dT%H:%M:%SZ') if row[7] else None,
                'rebootRequired':         row[8],
                'classification':         row[9],
                'msrcSeverity':           row[10],
                'classificationPriority': row[11],
                'queryRunDateTime':       row[12].strftime('%Y-%m-%dT%H:%M:%SZ') if row[12] else None,
            }
            for row in rows
        ]
    finally:
        cursor.close()
        conn.close()