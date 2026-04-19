import psycopg2
from database import DB_CONFIG

def init():
    conn   = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    try:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS scan_runs (
                id            SERIAL PRIMARY KEY,
                scan_id       TEXT NOT NULL UNIQUE,
                scanned_at    TIMESTAMP NOT NULL,
                status        TEXT,
                rc            INTEGER,
                host_failures JSONB DEFAULT '{}'::jsonb,
                ansible_log   TEXT
            )
        ''')
        cursor.execute("ALTER TABLE scan_runs ADD COLUMN IF NOT EXISTS host_failures JSONB DEFAULT '{}'::jsonb")
        cursor.execute("ALTER TABLE scan_runs ADD COLUMN IF NOT EXISTS ansible_log TEXT")

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS scan_results (
                id                              SERIAL PRIMARY KEY,
                scan_id                         TEXT NOT NULL REFERENCES scan_runs(scan_id),
                host                            TEXT NOT NULL,
                current_kernel_version          TEXT,
                latest_available_kernel_version TEXT,
                os_version                      TEXT,
                last_reboot_time                TEXT,
                advisory_ids                    TEXT[],
                package_source_map              JSONB DEFAULT '{}'::jsonb
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS scan_packages (
                id           SERIAL PRIMARY KEY,
                scan_id      TEXT NOT NULL REFERENCES scan_runs(scan_id),
                host         TEXT NOT NULL,
                package_name TEXT NOT NULL
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS cve_details (
                id             SERIAL PRIMARY KEY,
                advisory_id    TEXT UNIQUE,
                cve_ids        TEXT[],
                severity       TEXT,
                synopsis       TEXT,
                description    TEXT,
                fetched_at     TIMESTAMP DEFAULT NOW(),
                remediation    TEXT,
                source_package TEXT,
                cvss_score     NUMERIC(3,1),
                cvss_vector    TEXT,
                cvss_version   TEXT,
                cvss_source    TEXT,
                nvd_fetched_at TIMESTAMP
            )
        ''')
        cursor.execute("ALTER TABLE cve_details ADD COLUMN IF NOT EXISTS cvss_score NUMERIC(3,1)")
        cursor.execute("ALTER TABLE cve_details ADD COLUMN IF NOT EXISTS cvss_vector TEXT")
        cursor.execute("ALTER TABLE cve_details ADD COLUMN IF NOT EXISTS cvss_version TEXT")
        cursor.execute("ALTER TABLE cve_details ADD COLUMN IF NOT EXISTS cvss_source TEXT")
        cursor.execute("ALTER TABLE cve_details ADD COLUMN IF NOT EXISTS nvd_fetched_at TIMESTAMP")

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS inventories (
                id             SERIAL PRIMARY KEY,
                name           TEXT NOT NULL,
                content        TEXT NOT NULL,
                host_count     INTEGER,
                uploaded_at    TIMESTAMP DEFAULT NOW(),
                is_active      BOOLEAN DEFAULT FALSE,
                inventory_type TEXT NOT NULL DEFAULT 'linux'
            )
        ''')
        cursor.execute("ALTER TABLE inventories ADD COLUMN IF NOT EXISTS inventory_type TEXT NOT NULL DEFAULT 'linux'")

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS credentials (
                id           SERIAL PRIMARY KEY,
                inventory_id INTEGER NOT NULL REFERENCES inventories(id) ON DELETE CASCADE,
                username     TEXT NOT NULL,
                password     TEXT NOT NULL,
                updated_at   TIMESTAMP DEFAULT NOW(),
                UNIQUE(inventory_id)
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS hosts (
                id       SERIAL PRIMARY KEY,
                hostname TEXT NOT NULL UNIQUE,
                added_at TIMESTAMP DEFAULT NOW(),
                active   BOOLEAN DEFAULT TRUE
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS host_tags (
                id       SERIAL PRIMARY KEY,
                hostname TEXT NOT NULL,
                tag      TEXT NOT NULL,
                UNIQUE(hostname, tag)
            )
        ''')
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_host_tags_hostname ON host_tags(hostname)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_host_tags_tag ON host_tags(tag)")

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS notification_settings (
                id            INTEGER PRIMARY KEY DEFAULT 1,
                smtp_host     TEXT    NOT NULL DEFAULT '',
                smtp_port     INTEGER NOT NULL DEFAULT 587,
                smtp_user     TEXT    NOT NULL DEFAULT '',
                smtp_password TEXT    NOT NULL DEFAULT '',
                smtp_from     TEXT    NOT NULL DEFAULT '',
                recipients    TEXT[]  NOT NULL DEFAULT '{}',
                tls_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
                scan_interval INTEGER NOT NULL DEFAULT 180,
                updated_at    TIMESTAMP DEFAULT NOW(),
                CONSTRAINT single_row CHECK (id = 1)
            )
        ''')
        cursor.execute("ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS scan_interval INTEGER NOT NULL DEFAULT 180")

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS windows_credentials (
                id         INTEGER PRIMARY KEY DEFAULT 1,
                username   TEXT    NOT NULL DEFAULT '',
                password   TEXT    NOT NULL DEFAULT '',
                domain     TEXT    NOT NULL DEFAULT '',
                port       INTEGER NOT NULL DEFAULT 5986,
                transport  TEXT    NOT NULL DEFAULT 'ntlm',
                updated_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT single_win_creds CHECK (id = 1)
            )
        ''')
        cursor.execute("ALTER TABLE windows_credentials ADD COLUMN IF NOT EXISTS domain    TEXT    NOT NULL DEFAULT ''")
        cursor.execute("ALTER TABLE windows_credentials ADD COLUMN IF NOT EXISTS port      INTEGER NOT NULL DEFAULT 5986")
        cursor.execute("ALTER TABLE windows_credentials ADD COLUMN IF NOT EXISTS transport TEXT    NOT NULL DEFAULT 'ntlm'")

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS windows_scan_results (
                id                      SERIAL PRIMARY KEY,
                scan_id                 TEXT        NOT NULL REFERENCES scan_runs(scan_id),
                hostname                TEXT        NOT NULL,
                os_name                 TEXT,
                os_version              TEXT,
                kb_id                   TEXT,
                patch_id                TEXT,
                patch_name              TEXT,
                version                 TEXT,
                published_date_time     TIMESTAMPTZ,
                reboot_required         TEXT,
                classification          TEXT,
                msrc_severity           TEXT,
                classification_priority INTEGER,
                query_run_date_time     TIMESTAMPTZ
            )
        ''')
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_win_scan_results_scan_id  ON windows_scan_results(scan_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_win_scan_results_hostname ON windows_scan_results(hostname)")

        # ── Host open ports ────────────────────────────────────────────────────
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS host_ports (
                id           SERIAL PRIMARY KEY,
                scan_id      TEXT    NOT NULL REFERENCES scan_runs(scan_id),
                host         TEXT    NOT NULL,
                port         INTEGER NOT NULL,
                protocol     TEXT,
                state        TEXT,
                bind_address TEXT,
                service      TEXT,
                pid          INTEGER
            )
        ''')
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_host_ports_scan_id ON host_ports(scan_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_host_ports_host    ON host_ports(host)")

        # ── Patch jobs ─────────────────────────────────────────────────────────
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS patch_jobs (
                id           SERIAL PRIMARY KEY,
                job_id       TEXT        NOT NULL UNIQUE,
                advisory_id  TEXT,
                packages     TEXT[]      NOT NULL DEFAULT '{}',
                hosts        TEXT[]      NOT NULL DEFAULT '{}',
                dry_run      BOOLEAN     NOT NULL DEFAULT TRUE,
                status       TEXT        NOT NULL DEFAULT 'running',
                results      JSONB       DEFAULT '{}'::jsonb,
                triggered_by TEXT        NOT NULL DEFAULT 'user',
                created_at   TIMESTAMP   DEFAULT NOW(),
                completed_at TIMESTAMP
            )
        ''')
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_patch_jobs_advisory ON patch_jobs(advisory_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_patch_jobs_status   ON patch_jobs(status)")

        # ── Users ──────────────────────────────────────────────────────────────
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id              SERIAL PRIMARY KEY,
                username        TEXT NOT NULL UNIQUE,
                hashed_password TEXT NOT NULL,
                role            TEXT NOT NULL DEFAULT 'reader'
                                    CHECK (role IN ('admin', 'operator', 'reader')),
                is_active       BOOLEAN NOT NULL DEFAULT true,
                auth_source     TEXT NOT NULL DEFAULT 'local'
                                    CHECK (auth_source IN ('local', 'ldap')),
                created_by      TEXT NOT NULL DEFAULT 'system',
                created_at      TIMESTAMP DEFAULT NOW(),
                last_login      TIMESTAMP
            )
        ''')
        # Migration: add auth_source to existing deployments
        cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_source TEXT NOT NULL DEFAULT 'local' CHECK (auth_source IN ('local', 'ldap'))")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)")

        # ── Refresh tokens ─────────────────────────────────────────────────────
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id          SERIAL PRIMARY KEY,
                user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token       TEXT NOT NULL UNIQUE,
                expires_at  TIMESTAMP NOT NULL,
                revoked     BOOLEAN NOT NULL DEFAULT false,
                created_at  TIMESTAMP DEFAULT NOW()
            )
        ''')
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user   ON refresh_tokens(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token  ON refresh_tokens(token)")

        # ── LDAP settings ──────────────────────────────────────────────────────
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS ldap_settings (
                id               SERIAL PRIMARY KEY,
                enabled          BOOLEAN NOT NULL DEFAULT false,
                host             TEXT NOT NULL DEFAULT '',
                port             INTEGER NOT NULL DEFAULT 389,
                use_ssl          BOOLEAN NOT NULL DEFAULT false,
                use_starttls     BOOLEAN NOT NULL DEFAULT false,
                tls_verify       BOOLEAN NOT NULL DEFAULT true,
                bind_dn          TEXT NOT NULL DEFAULT '',
                bind_password    TEXT NOT NULL DEFAULT '',
                base_dn          TEXT NOT NULL DEFAULT '',
                user_attr        TEXT NOT NULL DEFAULT 'sAMAccountName',
                admin_group      TEXT NOT NULL DEFAULT '',
                operator_group   TEXT NOT NULL DEFAULT '',
                reader_group     TEXT NOT NULL DEFAULT '',
                ca_cert          TEXT NOT NULL DEFAULT '',
                updated_at       TIMESTAMP DEFAULT NOW()
            )
        ''')
        # Ensure exactly one row exists
        cursor.execute('''
            INSERT INTO ldap_settings (id) VALUES (1)
            ON CONFLICT (id) DO NOTHING
        ''')

        conn.commit()
        print("Database tables created/migrated successfully")

    except Exception as e:
        conn.rollback()
        print(f"Error: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

    # ── Seed users from environment variables ──────────────────────────────────
    _seed_users()


def _seed_users():
    """
    Create users from environment variables on startup.
    All operations are idempotent — existing users are never overwritten.

    Required:
        KERMONIX_ADMIN_USER / KERMONIX_ADMIN_PASS   — admin account

    Optional demo accounts:
        KERMONIX_OPERATOR_USER / KERMONIX_OPERATOR_PASS  — operator role
        KERMONIX_READER_USER  / KERMONIX_READER_PASS     — reader role

    Optional CI account:
        CI_TEST_USER / CI_TEST_PASS / CI_TEST_ROLE (default: reader)
    """
    import os
    import bcrypt
    from database.users import user_exists, create_user

    def _hash(password: str) -> str:
        return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    def _seed(username, password, role, label=""):
        if not username or not password:
            return
        if user_exists(username):
            print(f"User '{username}' already exists — skipping")
            return
        create_user(
            username=username,
            hashed_password=_hash(password),
            role=role,
            created_by="system",
        )
        print(f"Created {label or role} user '{username}'")

    # Admin — warn if not set
    admin_user = os.environ.get("KERMONIX_ADMIN_USER", "").strip()
    admin_pass = os.environ.get("KERMONIX_ADMIN_PASS", "").strip()
    if admin_user and admin_pass:
        _seed(admin_user, admin_pass, "admin", "admin")
    else:
        print("WARNING: KERMONIX_ADMIN_USER / KERMONIX_ADMIN_PASS not set — no admin created")

    # Optional operator demo account
    _seed(
        os.environ.get("KERMONIX_OPERATOR_USER", "").strip(),
        os.environ.get("KERMONIX_OPERATOR_PASS", "").strip(),
        "operator", "operator",
    )

    # Optional reader demo account
    _seed(
        os.environ.get("KERMONIX_READER_USER", "").strip(),
        os.environ.get("KERMONIX_READER_PASS", "").strip(),
        "reader", "reader",
    )

    # Optional CI test user
    ci_role = os.environ.get("CI_TEST_ROLE", "reader").strip()
    _seed(
        os.environ.get("CI_TEST_USER", "").strip(),
        os.environ.get("CI_TEST_PASS", "").strip(),
        ci_role if ci_role in ("admin", "operator", "reader") else "reader",
        f"CI ({ci_role})",
    )

if __name__ == "__main__":
    init()