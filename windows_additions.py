# ============================================================
# ADD TO init_db.py — inside the init() function
# ============================================================

# Windows WinRM credentials (single global record — not per-inventory)
cursor.execute('''
    CREATE TABLE IF NOT EXISTS windows_credentials (
        id        INTEGER PRIMARY KEY DEFAULT 1,
        username  TEXT NOT NULL DEFAULT '',
        password  TEXT NOT NULL DEFAULT '',
        domain    TEXT NOT NULL DEFAULT '',
        port      INTEGER NOT NULL DEFAULT 5986,
        transport TEXT NOT NULL DEFAULT 'ntlm',
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT single_win_creds CHECK (id = 1)
    )
''')
cursor.execute("ALTER TABLE windows_credentials ADD COLUMN IF NOT EXISTS domain    TEXT NOT NULL DEFAULT ''")
cursor.execute("ALTER TABLE windows_credentials ADD COLUMN IF NOT EXISTS port      INTEGER NOT NULL DEFAULT 5986")
cursor.execute("ALTER TABLE windows_credentials ADD COLUMN IF NOT EXISTS transport TEXT NOT NULL DEFAULT 'ntlm'")


# ============================================================
# ADD TO database.py
# ============================================================

def save_windows_credentials(username: str, password: str, domain: str = "",
                              port: int = 5986, transport: str = "ntlm"):
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO windows_credentials (id, username, password, domain, port, transport, updated_at)
            VALUES (1, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (id) DO UPDATE SET
                username   = EXCLUDED.username,
                password   = EXCLUDED.password,
                domain     = EXCLUDED.domain,
                port       = EXCLUDED.port,
                transport  = EXCLUDED.transport,
                updated_at = NOW()
        ''', (username, _encrypt(password), domain, port, transport))
        conn.commit()
    except Exception as e:
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
            'password':   _decrypt(row[1]),
            'domain':     row[2],
            'port':       row[3],
            'transport':  row[4],
            'updated_at': row[5].isoformat() + 'Z',
        }
    finally:
        cursor.close()
        conn.close()


# ============================================================
# ADD TO main.py — models section
# ============================================================

class WindowsCredentialsUpdate(BaseModel):
    username:  str
    password:  str
    domain:    str = ""
    port:      int = 5986
    transport: str = "ntlm"   # ntlm | kerberos | basic


# ============================================================
# ADD TO main.py — imports from database
# ============================================================
# Add to the existing database import block:
#   save_windows_credentials, get_windows_credentials,


# ============================================================
# ADD TO main.py — Windows credentials endpoints
# (place near the existing /api/credentials endpoints)
# ============================================================

@app.get("/api/windows/credentials")
async def get_windows_creds():
    creds = get_windows_credentials()
    if not creds:
        return {"has_credentials": False, "username": "", "domain": ""}
    return {
        "has_credentials": True,
        "username":   creds["username"],
        "domain":     creds["domain"],
        "port":       creds["port"],
        "transport":  creds["transport"],
        "updated_at": creds["updated_at"],
    }

@app.post("/api/windows/credentials")
async def set_windows_creds(body: WindowsCredentialsUpdate):
    if not body.username or not body.password:
        raise HTTPException(status_code=400, detail="Username and password are required")
    if body.transport not in ("ntlm", "kerberos", "basic"):
        raise HTTPException(status_code=400, detail="transport must be ntlm, kerberos, or basic")
    save_windows_credentials(
        username=body.username,
        password=body.password,
        domain=body.domain,
        port=body.port,
        transport=body.transport,
    )
    return {"message": "Windows credentials saved"}