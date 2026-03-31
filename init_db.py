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

        conn.commit()
        print("Database tables created/migrated successfully")
    except Exception as e:
        conn.rollback()
        print(f"Error: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    init()