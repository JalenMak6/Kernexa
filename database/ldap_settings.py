"""
database/ldap_settings.py
LDAP configuration storage — single-row settings table.
DB values override environment variables when present.
Password is stored encrypted using the CREDENTIALS_KEY if available,
otherwise stored as-is (warn in logs).
"""

import os
import logging
from database.connection import get_conn

logger = logging.getLogger(__name__)

CREDENTIALS_KEY = os.environ.get("CREDENTIALS_KEY", "").strip()


def _encrypt(value: str) -> str:
    """Encrypt a string using Fernet if CREDENTIALS_KEY is set."""
    if not value:
        return ""
    if not CREDENTIALS_KEY:
        return value
    try:
        from cryptography.fernet import Fernet
        import base64, hashlib
        key = base64.urlsafe_b64encode(hashlib.sha256(CREDENTIALS_KEY.encode()).digest())
        return Fernet(key).encrypt(value.encode()).decode()
    except Exception as e:
        logger.warning(f"[LDAP] Encryption failed, storing plaintext: {e}")
        return value


def _decrypt(value: str) -> str:
    """Decrypt a Fernet-encrypted string."""
    if not value:
        return ""
    if not CREDENTIALS_KEY:
        return value
    try:
        from cryptography.fernet import Fernet, InvalidToken
        import base64, hashlib
        key = base64.urlsafe_b64encode(hashlib.sha256(CREDENTIALS_KEY.encode()).digest())
        return Fernet(key).decrypt(value.encode()).decode()
    except Exception:
        # Not encrypted or wrong key — return as-is
        return value


def get_ldap_settings() -> dict:
    """
    Get LDAP settings from DB.
    Returns the row as a dict with password decrypted.
    Password is masked in the returned dict for API responses — use
    get_ldap_settings_for_auth() for actual auth use.
    """
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT enabled, host, port, use_ssl, use_starttls, tls_verify,
                   bind_dn, bind_password, base_dn, user_attr,
                   admin_group, operator_group, reader_group, ca_cert, updated_at
            FROM ldap_settings WHERE id = 1
        ''')
        row = cursor.fetchone()
        if not row:
            return _empty_settings()
        return {
            "enabled":        row[0],
            "host":           row[1],
            "port":           row[2],
            "use_ssl":        row[3],
            "use_starttls":   row[4],
            "tls_verify":     row[5],
            "bind_dn":        row[6],
            "bind_password":  "••••••••" if row[7] else "",  # masked for UI
            "base_dn":        row[8],
            "user_attr":      row[9]  or "sAMAccountName",
            "admin_group":    row[10],
            "operator_group": row[11],
            "reader_group":   row[12],
            "ca_cert":        row[13],
            "updated_at":     row[14].isoformat() + "Z" if row[14] else None,
            "has_password":   bool(row[7]),
        }
    finally:
        cursor.close()
        conn.close()


def get_ldap_settings_for_auth() -> dict | None:
    """
    Get LDAP settings with decrypted password for use in authentication.
    Returns None if LDAP is disabled in DB or no settings exist.
    Falls back to env vars if DB has no host configured.
    """
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT enabled, host, port, use_ssl, use_starttls, tls_verify,
                   bind_dn, bind_password, base_dn, user_attr,
                   admin_group, operator_group, reader_group, ca_cert
            FROM ldap_settings WHERE id = 1
        ''')
        row = cursor.fetchone()
        if not row or not row[0] or not row[1]:
            return None  # disabled or not configured in DB
        return {
            "enabled":        row[0],
            "host":           row[1],
            "port":           row[2],
            "use_ssl":        row[3],
            "use_starttls":   row[4],
            "tls_verify":     row[5],
            "bind_dn":        row[6],
            "bind_password":  _decrypt(row[7]),
            "base_dn":        row[8],
            "user_attr":      row[9] or "sAMAccountName",
            "admin_group":    row[10],
            "operator_group": row[11],
            "reader_group":   row[12],
            "ca_cert":        row[13],
        }
    finally:
        cursor.close()
        conn.close()


def save_ldap_settings(settings: dict, keep_password: bool = False) -> dict:
    """
    Save LDAP settings to DB.
    If keep_password=True (password field was left blank in UI), preserve existing password.
    Returns the saved settings (with masked password).
    """
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        # Get existing password if we need to preserve it
        existing_password = ""
        if keep_password:
            cursor.execute("SELECT bind_password FROM ldap_settings WHERE id = 1")
            row = cursor.fetchone()
            existing_password = row[0] if row else ""

        password = existing_password if keep_password else _encrypt(settings.get("bind_password", ""))

        cursor.execute('''
            UPDATE ldap_settings SET
                enabled        = %s,
                host           = %s,
                port           = %s,
                use_ssl        = %s,
                use_starttls   = %s,
                tls_verify     = %s,
                bind_dn        = %s,
                bind_password  = %s,
                base_dn        = %s,
                user_attr      = %s,
                admin_group    = %s,
                operator_group = %s,
                reader_group   = %s,
                ca_cert        = %s,
                updated_at     = NOW()
            WHERE id = 1
        ''', (
            settings.get("enabled",        False),
            settings.get("host",           ""),
            settings.get("port",           389),
            settings.get("use_ssl",        False),
            settings.get("use_starttls",   False),
            settings.get("tls_verify",     True),
            settings.get("bind_dn",        ""),
            password,
            settings.get("base_dn",        ""),
            settings.get("user_attr",      "sAMAccountName"),
            settings.get("admin_group",    ""),
            settings.get("operator_group", ""),
            settings.get("reader_group",   ""),
            settings.get("ca_cert",        ""),
        ))
        conn.commit()
        return get_ldap_settings()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def _empty_settings() -> dict:
    return {
        "enabled":        False,
        "host":           "",
        "port":           389,
        "use_ssl":        False,
        "use_starttls":   False,
        "tls_verify":     True,
        "bind_dn":        "",
        "bind_password":  "",
        "base_dn":        "",
        "user_attr":      "sAMAccountName",
        "admin_group":    "",
        "operator_group": "",
        "reader_group":   "",
        "ca_cert":        "",
        "updated_at":     None,
        "has_password":   False,
    }