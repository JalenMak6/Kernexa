"""
scan_tasks.py
Background task functions called by FastAPI endpoints and the scheduler:
  - run_and_save()         — Linux scan flow
  - run_windows_and_save() — Windows scan flow
"""

import json
import uuid
from datetime import datetime, timezone

from scanner import run_patch_scan, run_windows_patch_scan
from enricher import enrich_all
from database import (
    save_to_db, save_windows_to_db,
    get_latest_scan, get_latest_windows_scan,
    save_host_ports,
    get_conn,
)
from reports.linux   import send_scan_report
from reports.windows import send_windows_scan_report

# Shared scan state — imported by main.py and scheduler.py
running_scans: dict[str, str] = {}


def run_and_save(scan_id: str, scanned_at: datetime):
    """Linux scan — runs playbook, saves to DB, enriches CVEs, emails report."""
    try:
        running_scans[scan_id] = "running"
        output = run_patch_scan()
        save_to_db(output, scan_id, scanned_at)

        # Save open port data for each host
        for host, data in output.get('hosts', {}).items():
            ports = data.get('open_ports', [])
            if ports:
                save_host_ports(scan_id, host, ports)

        running_scans[scan_id] = "enriching"
        print(f"Scan {scan_id} saved — starting CVE enrichment")
        enrich_all()
        print(f"Scan {scan_id} enrichment complete")
        running_scans[scan_id] = "complete"
        try:
            scan_data = get_latest_scan()
            if scan_data:
                send_scan_report(scan_data, scan_id)
        except Exception as e:
            print(f"Email report error (non-fatal): {e}")
    except Exception as e:
        running_scans[scan_id] = f"failed: {str(e)}"
        print(f"run_and_save error: {e}")


def run_windows_and_save(scan_id: str, scanned_at: datetime):
    """Windows scan — runs playbook, saves to DB, emails report."""
    try:
        running_scans[scan_id] = "running"

        # Insert scan_run row so windows_scan_results has a valid FK
        conn   = get_conn()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO scan_runs (scan_id, scanned_at, status, rc, host_failures, ansible_log)
                VALUES (%s, %s, %s, %s, %s, %s)
            ''', (scan_id, scanned_at, 'running', None, '{}', ''))
            conn.commit()
        finally:
            cursor.close()
            conn.close()

        output = run_windows_patch_scan()

        # Update scan_run with final status
        conn   = get_conn()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                UPDATE scan_runs
                SET status = %s, rc = %s, host_failures = %s, ansible_log = %s
                WHERE scan_id = %s
            ''', (
                output['status'],
                output['rc'],
                json.dumps(output.get('failures', {})),
                output.get('ansible_log', ''),
                scan_id,
            ))
            conn.commit()
        finally:
            cursor.close()
            conn.close()

        save_windows_to_db(output, scan_id)

        # Save open port data for each Windows host
        for host, data in output.get('hosts', {}).items():
            ports = data.get('open_ports', [])
            if ports:
                save_host_ports(scan_id, host, ports)

        running_scans[scan_id] = "complete"
        print(f"Windows scan {scan_id} complete — {len(output['hosts'])} hosts, {len(output['failures'])} failures")

        try:
            records = get_latest_windows_scan()
            if records:
                send_windows_scan_report(records, scan_id, scanned_at.isoformat())
        except Exception as e:
            print(f"Windows email report error (non-fatal): {e}")

    except Exception as e:
        running_scans[scan_id] = f"failed: {str(e)}"
        print(f"run_windows_and_save error: {e}")