"""
scheduler.py
APScheduler setup and the scheduled_scan() function that runs
both Linux and Windows scans automatically on a timer.
"""

import uuid
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler

from database import (
    get_active_inventory_credentials,
    get_active_windows_inventory,
    get_windows_credentials,
    get_scan_interval,
)
from scan_tasks import run_and_save, run_windows_and_save, running_scans

scheduler = BackgroundScheduler()


def scheduled_scan():
    """
    Called by APScheduler on interval.
    Runs Linux scan first, then Windows scan if configured.
    Skips entirely if any scan is already in progress.
    """
    # Only start if nothing is running
    already_running = any(v in ("running", "pending") for v in running_scans.values())
    if already_running:
        print("Scheduled scan skipped: a scan is already in progress")
        return

    # ── Linux scan ────────────────────────────────────────────────────────────
    creds = get_active_inventory_credentials()
    if not creds:
        print("Scheduled Linux scan skipped: no credentials set for active Linux inventory")
    else:
        scan_id    = str(uuid.uuid4())
        scanned_at = datetime.now(timezone.utc)
        running_scans[scan_id] = "pending"
        print(f"Scheduled Linux scan starting: {scan_id}")
        run_and_save(scan_id, scanned_at)

    # ── Windows scan ──────────────────────────────────────────────────────────
    try:
        win_inv   = get_active_windows_inventory()
        win_creds = get_windows_credentials()
        if win_inv and win_creds:
            win_scan_id    = str(uuid.uuid4())
            win_scanned_at = datetime.now(timezone.utc)
            running_scans[win_scan_id] = "pending"
            print(f"Scheduled Windows scan starting: {win_scan_id}")
            run_windows_and_save(win_scan_id, win_scanned_at)
        else:
            print("Scheduled Windows scan skipped: no active Windows inventory or credentials")
    except Exception as e:
        print(f"Scheduled Windows scan error (non-fatal): {e}")


def reschedule(interval_minutes: int):
    """Update the scheduler interval."""
    if scheduler.get_job("auto_scan"):
        scheduler.remove_job("auto_scan")
    scheduler.add_job(scheduled_scan, "interval", minutes=interval_minutes, id="auto_scan")
    print(f"Auto-scan rescheduled to every {interval_minutes} minutes")


def start_scheduler():
    """Start the scheduler with the interval stored in DB."""
    interval = get_scan_interval()
    scheduler.add_job(scheduled_scan, "interval", minutes=interval, id="auto_scan")
    scheduler.start()
    print(f"Auto-scan scheduler started (every {interval} minutes)")


def stop_scheduler():
    scheduler.shutdown(wait=False)
    print("Scheduler stopped")