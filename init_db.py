import psycopg2
from database import DB_CONFIG

def init():
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    try:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS scan_runs (
                id             SERIAL PRIMARY KEY,
                scan_id        TEXT NOT NULL UNIQUE,
                scanned_at     TIMESTAMP NOT NULL,
                status         TEXT,
                rc             INTEGER,
                host_failures  JSONB DEFAULT '{}'::jsonb,
                ansible_log    TEXT
            )
        ''')

        # migrate existing deployments — add columns if they don't exist yet
        cursor.execute('''
            ALTER TABLE scan_runs
            ADD COLUMN IF NOT EXISTS host_failures JSONB DEFAULT '{}'::jsonb
        ''')
        cursor.execute('''
            ALTER TABLE scan_runs
            ADD COLUMN IF NOT EXISTS ansible_log TEXT
        ''')

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
                source_package TEXT
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS hosts (
                id        SERIAL PRIMARY KEY,
                hostname  TEXT NOT NULL UNIQUE,
                added_at  TIMESTAMP DEFAULT NOW(),
                active    BOOLEAN DEFAULT TRUE
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS inventories (
                id          SERIAL PRIMARY KEY,
                name        TEXT NOT NULL,
                content     TEXT NOT NULL,
                host_count  INTEGER,
                uploaded_at TIMESTAMP DEFAULT NOW(),
                is_active   BOOLEAN DEFAULT FALSE
            )
        ''')
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
        conn.commit()
        print("Database tables created/migrated successfully")
    except Exception as e:
        conn.rollback()
        print(f"Error creating tables: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    init()