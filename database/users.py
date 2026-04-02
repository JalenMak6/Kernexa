"""
database/users.py
User account CRUD and refresh token management.
"""

import json
from datetime import datetime, timezone
from database.connection import get_conn


# ── User CRUD ─────────────────────────────────────────────────────────────────

def create_user(username: str, hashed_password: str, role: str,
                created_by: str = "system", is_active: bool = True) -> dict:
    """Create a new user. Raises if username already exists."""
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO users (username, hashed_password, role, is_active, created_by)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, username, role, is_active, created_at, last_login
        ''', (username, hashed_password, role, is_active, created_by))
        row = cursor.fetchone()
        conn.commit()
        return _row_to_user(row)
    except Exception as e:
        conn.rollback()
        if "unique" in str(e).lower():
            raise ValueError(f"Username '{username}' already exists")
        raise
    finally:
        cursor.close()
        conn.close()


def get_user_by_username(username: str) -> dict | None:
    """Get a user by username including hashed_password for auth."""
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT id, username, hashed_password, role, is_active, created_at, last_login
            FROM users WHERE username = %s
        ''', (username,))
        row = cursor.fetchone()
        if not row:
            return None
        return {
            "id":              row[0],
            "username":        row[1],
            "hashed_password": row[2],
            "role":            row[3],
            "is_active":       row[4],
            "created_at":      row[5].isoformat() + "Z" if row[5] else None,
            "last_login":      row[6].isoformat() + "Z" if row[6] else None,
        }
    finally:
        cursor.close()
        conn.close()


def get_user_by_id(user_id: int) -> dict | None:
    """Get a user by ID (no password returned)."""
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT id, username, role, is_active, created_at, last_login
            FROM users WHERE id = %s
        ''', (user_id,))
        row = cursor.fetchone()
        return _row_to_user(row) if row else None
    finally:
        cursor.close()
        conn.close()


def list_users() -> list:
    """List all users (no passwords)."""
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT id, username, role, is_active, created_at, last_login
            FROM users ORDER BY id
        ''')
        return [_row_to_user(row) for row in cursor.fetchall()]
    finally:
        cursor.close()
        conn.close()


def update_user(user_id: int, updates: dict) -> dict | None:
    """
    Update user fields. Allowed fields: role, is_active, hashed_password.
    Returns updated user or None if not found.
    """
    allowed = {"role", "is_active", "hashed_password"}
    fields  = {k: v for k, v in updates.items() if k in allowed}
    if not fields:
        raise ValueError("No valid fields to update")

    set_clause = ", ".join(f"{k} = %s" for k in fields)
    values     = list(fields.values()) + [user_id]

    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute(f'''
            UPDATE users SET {set_clause}
            WHERE id = %s
            RETURNING id, username, role, is_active, created_at, last_login
        ''', values)
        row = cursor.fetchone()
        conn.commit()
        return _row_to_user(row) if row else None
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def delete_user(user_id: int) -> bool:
    """Delete a user. Returns True if deleted, False if not found."""
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        deleted = cursor.rowcount > 0
        conn.commit()
        return deleted
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def update_last_login(user_id: int) -> None:
    """Update the last_login timestamp for a user."""
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE users SET last_login = NOW() WHERE id = %s",
            (user_id,)
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()


def user_exists(username: str) -> bool:
    """Check if a username already exists."""
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT 1 FROM users WHERE username = %s", (username,))
        return cursor.fetchone() is not None
    finally:
        cursor.close()
        conn.close()


# ── Refresh token management ──────────────────────────────────────────────────

def save_refresh_token(user_id: int, token: str, expires_at: datetime) -> None:
    """Store a refresh token in the DB."""
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO refresh_tokens (user_id, token, expires_at)
            VALUES (%s, %s, %s)
        ''', (user_id, token, expires_at))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def get_refresh_token(token: str) -> dict | None:
    """Look up a refresh token. Returns None if not found or revoked."""
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT id, user_id, token, expires_at, revoked
            FROM refresh_tokens
            WHERE token = %s AND revoked = false AND expires_at > NOW()
        ''', (token,))
        row = cursor.fetchone()
        if not row:
            return None
        return {
            "id":         row[0],
            "user_id":    row[1],
            "token":      row[2],
            "expires_at": row[3].isoformat() + "Z" if row[3] else None,
            "revoked":    row[4],
        }
    finally:
        cursor.close()
        conn.close()


def revoke_refresh_token(token: str) -> None:
    """Revoke a specific refresh token (logout)."""
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE refresh_tokens SET revoked = true WHERE token = %s",
            (token,)
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()


def revoke_all_user_tokens(user_id: int) -> None:
    """Revoke all refresh tokens for a user (force logout everywhere)."""
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE refresh_tokens SET revoked = true WHERE user_id = %s",
            (user_id,)
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()


def cleanup_expired_tokens() -> int:
    """Delete expired refresh tokens from DB. Returns count deleted."""
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked = true"
        )
        count = cursor.rowcount
        conn.commit()
        return count
    finally:
        cursor.close()
        conn.close()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _row_to_user(row) -> dict:
    """Convert a DB row (no password) to a user dict."""
    return {
        "id":         row[0],
        "username":   row[1],
        "role":       row[2],
        "is_active":  row[3],
        "created_at": row[4].isoformat() + "Z" if row[4] else None,
        "last_login": row[5].isoformat() + "Z" if row[5] else None,
    }