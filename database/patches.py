"""
database/patches.py
Patch job history persistence and retrieval.
"""

from database.connection import get_conn


def save_patch_job(job_id: str, advisory_id: str, packages: list,
                   hosts: list, dry_run: bool, triggered_by: str = "user"):
    """Create a new patch job record."""
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO patch_jobs
                (job_id, advisory_id, packages, hosts, dry_run, status, triggered_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        ''', (
            job_id,
            advisory_id,
            packages,
            hosts,
            dry_run,
            'running',
            triggered_by,
        ))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def update_patch_job(job_id: str, status: str, results: dict = None):
    """Update patch job status and results."""
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        import json
        cursor.execute('''
            UPDATE patch_jobs
            SET status = %s, results = %s, completed_at = NOW()
            WHERE job_id = %s
        ''', (
            status,
            json.dumps(results or {}),
            job_id,
        ))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def get_patch_job(job_id: str) -> dict | None:
    """Get a single patch job by ID."""
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT job_id, advisory_id, packages, hosts, dry_run,
                   status, results, triggered_by, created_at, completed_at
            FROM patch_jobs
            WHERE job_id = %s
        ''', (job_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return {
            'job_id':       row[0],
            'advisory_id':  row[1],
            'packages':     row[2],
            'hosts':        row[3],
            'dry_run':      row[4],
            'status':       row[5],
            'results':      row[6] or {},
            'triggered_by': row[7],
            'created_at':   row[8].isoformat() + 'Z' if row[8] else None,
            'completed_at': row[9].isoformat() + 'Z' if row[9] else None,
        }
    finally:
        cursor.close()
        conn.close()


def get_patch_history(limit: int = 50) -> list:
    """Get recent patch job history."""
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT job_id, advisory_id, packages, hosts, dry_run,
                   status, results, triggered_by, created_at, completed_at
            FROM patch_jobs
            ORDER BY created_at DESC
            LIMIT %s
        ''', (limit,))
        rows = cursor.fetchall()
        return [
            {
                'job_id':       r[0],
                'advisory_id':  r[1],
                'packages':     r[2],
                'hosts':        r[3],
                'dry_run':      r[4],
                'status':       r[5],
                'results':      r[6] or {},
                'triggered_by': r[7],
                'created_at':   r[8].isoformat() + 'Z' if r[8] else None,
                'completed_at': r[9].isoformat() + 'Z' if r[9] else None,
            }
            for r in rows
        ]
    finally:
        cursor.close()
        conn.close()