"""
database/inventories.py
Inventory management and SSH/WinRM credential storage.
"""

from database.connection import get_conn, encrypt, decrypt


# ── inventories ───────────────────────────────────────────────────────────────

def get_inventories():
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT i.id, i.name, i.host_count, i.uploaded_at, i.is_active,
                   COALESCE(i.inventory_type, 'linux') as inventory_type,
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
                'inventory_type':  row[5],
                'has_credentials': row[6],
            }
            for row in rows
        ]
    finally:
        cursor.close()
        conn.close()


def get_inventory_content(inv_id: int) -> str:
    conn   = get_conn()
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


def save_inventory(name: str, content: str, host_count: int,
                   inventory_type: str = 'linux') -> int:
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO inventories (name, content, host_count, is_active, inventory_type)
            VALUES (%s, %s, %s, FALSE, %s)
            RETURNING id
        ''', (name, content, host_count, inventory_type))
        inv_id = cursor.fetchone()[0]
        conn.commit()
        return inv_id
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def activate_inventory(inv_id: int) -> str:
    """Activate an inventory. Only deactivates inventories of the same type,
    so Linux and Windows can both be active simultaneously."""
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT COALESCE(inventory_type, 'linux') FROM inventories WHERE id = %s",
            (inv_id,)
        )
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Inventory {inv_id} not found")
        inv_type = row[0]

        cursor.execute('''
            UPDATE inventories SET is_active = FALSE
            WHERE COALESCE(inventory_type, 'linux') = %s AND id != %s
        ''', (inv_type, inv_id))

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
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def delete_inventory(inv_id: int):
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('DELETE FROM inventories WHERE id = %s', (inv_id,))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


# ── SSH credentials ───────────────────────────────────────────────────────────

def save_credentials(inventory_id: int, username: str, password: str):
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO credentials (inventory_id, username, password, updated_at)
            VALUES (%s, %s, %s, NOW())
            ON CONFLICT (inventory_id)
            DO UPDATE SET username   = EXCLUDED.username,
                          password   = EXCLUDED.password,
                          updated_at = NOW()
        ''', (inventory_id, username, encrypt(password)))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def get_credentials(inventory_id: int) -> dict | None:
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT username, password, updated_at
            FROM credentials WHERE inventory_id = %s
        ''', (inventory_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return {
            'username':   row[0],
            'password':   decrypt(row[1]),
            'updated_at': row[2].isoformat() + 'Z',
        }
    finally:
        cursor.close()
        conn.close()


def get_active_inventory_credentials() -> dict | None:
    """Returns credentials for the active Linux inventory only."""
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT c.username, c.password, i.id
            FROM credentials c
            JOIN inventories i ON i.id = c.inventory_id
            WHERE i.is_active = TRUE
              AND COALESCE(i.inventory_type, 'linux') = 'linux'
            LIMIT 1
        ''')
        row = cursor.fetchone()
        if not row:
            return None
        return {'username': row[0], 'password': decrypt(row[1]), 'inventory_id': row[2]}
    finally:
        cursor.close()
        conn.close()


def get_active_linux_inventory() -> dict | None:
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT id, name, content, host_count FROM inventories
            WHERE is_active = TRUE
              AND COALESCE(inventory_type, 'linux') = 'linux'
            LIMIT 1
        ''')
        row = cursor.fetchone()
        if not row:
            return None
        return {'id': row[0], 'name': row[1], 'content': row[2], 'host_count': row[3]}
    finally:
        cursor.close()
        conn.close()


def get_active_windows_inventory() -> dict | None:
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT id, name, content, host_count FROM inventories
            WHERE is_active = TRUE AND inventory_type = 'windows'
            LIMIT 1
        ''')
        row = cursor.fetchone()
        if not row:
            return None
        return {'id': row[0], 'name': row[1], 'content': row[2], 'host_count': row[3]}
    finally:
        cursor.close()
        conn.close()


# ── WinRM credentials ─────────────────────────────────────────────────────────

def save_windows_credentials(username: str, password: str, domain: str = "",
                              port: int = 5986, transport: str = "ntlm"):
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO windows_credentials
                (id, username, password, domain, port, transport, updated_at)
            VALUES (1, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (id) DO UPDATE SET
                username   = EXCLUDED.username,
                password   = EXCLUDED.password,
                domain     = EXCLUDED.domain,
                port       = EXCLUDED.port,
                transport  = EXCLUDED.transport,
                updated_at = NOW()
        ''', (username, encrypt(password), domain, port, transport))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def get_windows_credentials() -> dict | None:
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT username, password, domain, port, transport, updated_at
            FROM windows_credentials WHERE id = 1
        ''')
        row = cursor.fetchone()
        if not row:
            return None
        return {
            'username':   row[0],
            'password':   decrypt(row[1]),
            'domain':     row[2],
            'port':       row[3],
            'transport':  row[4],
            'updated_at': row[5].isoformat() + 'Z',
        }
    finally:
        cursor.close()
        conn.close()