"""
database/settings.py
Notification settings and scan interval persistence.
"""

from database.connection import get_conn


def get_notification_settings() -> dict:
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT smtp_host, smtp_port, smtp_user, smtp_password,
                   smtp_from, recipients, tls_enabled
            FROM notification_settings WHERE id = 1
        ''')
        row = cursor.fetchone()
        if not row:
            return {
                'smtp_host': '', 'smtp_port': 587, 'smtp_user': '',
                'smtp_password': '', 'smtp_from': '', 'recipients': [],
                'tls_enabled': True,
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
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO notification_settings
                (id, smtp_host, smtp_port, smtp_user, smtp_password,
                 smtp_from, recipients, tls_enabled)
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
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def get_scan_interval() -> int:
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('SELECT scan_interval FROM notification_settings WHERE id = 1')
        row = cursor.fetchone()
        return row[0] if row else 180
    finally:
        cursor.close()
        conn.close()


def save_scan_interval(interval_minutes: int):
    conn   = get_conn()
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