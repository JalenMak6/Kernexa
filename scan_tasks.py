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
        # Use the hostname field from the msg (FQDN) not the ansible connection key
        for host, data in output.get('hosts', {}).items():
            ports    = data.get('open_ports', [])
            hostname = data.get('hostname') or host
            if ports:
                save_host_ports(scan_id, hostname, ports)

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


def _cleanup_after_patch(hosts: list, advisory_id: str):
    """
    After a patch, update the scan DB directly so the CVE tab reflects the
    patched state — no rescan needed.

    Ubuntu/Debian CVEs (advisory_id starts with 'CVE-'):
      - Look up source_package from cve_details
      - Delete every scan_packages row for those hosts whose binary maps to
        that source_package in package_source_map
      - Remove the binary→source entries from package_source_map

    RHEL advisories (RLSA/RHSA/ALSA):
      - Remove the advisory_id from scan_results.advisory_ids for those hosts

    Then run cleanup_resolved_advisories() so the CVE disappears from the tab.
    """
    from enricher import cleanup_resolved_advisories
    conn   = get_conn()
    cursor = conn.cursor()
    try:
        # Resolve source_package for CVE-* advisories
        source_pkg = None
        if advisory_id and advisory_id.startswith('CVE-'):
            cursor.execute(
                'SELECT source_package FROM cve_details WHERE advisory_id = %s',
                (advisory_id,)
            )
            row = cursor.fetchone()
            if row:
                source_pkg = row[0]

        is_rhel_advisory = advisory_id and bool(
            __import__('re').match(r'^(RHSA|ALSA|RLSA|RHBA|RHEA)-', advisory_id)
        )

        for host in hosts:
            # Find the most recent scan_results row for this host
            cursor.execute('''
                SELECT sr.scan_id, sr.advisory_ids, sr.package_source_map
                FROM scan_results sr
                JOIN scan_runs s ON s.scan_id = sr.scan_id
                WHERE sr.host = %s
                ORDER BY s.scanned_at DESC LIMIT 1
            ''', (host,))
            row = cursor.fetchone()
            if not row:
                continue
            scan_id, advisory_ids, source_map = row
            source_map   = source_map or {}
            advisory_ids = list(advisory_ids or [])

            if is_rhel_advisory:
                # Drop the advisory from the RHEL host's advisory list
                new_ids = [aid for aid in advisory_ids if aid != advisory_id]
                cursor.execute(
                    'UPDATE scan_results SET advisory_ids = %s WHERE scan_id = %s AND host = %s',
                    (new_ids, scan_id, host)
                )

            elif source_pkg:
                # Find every binary package that maps to this source package
                to_remove = {
                    binary for binary, src in source_map.items()
                    if src == source_pkg
                }
                to_remove.add(source_pkg)   # cover binary == source case

                cursor.execute(
                    'DELETE FROM scan_packages WHERE scan_id = %s AND host = %s AND package_name = ANY(%s)',
                    (scan_id, host, list(to_remove))
                )

                new_map = {k: v for k, v in source_map.items() if k not in to_remove}
                cursor.execute(
                    'UPDATE scan_results SET package_source_map = %s WHERE scan_id = %s AND host = %s',
                    (json.dumps(new_map), scan_id, host)
                )

        conn.commit()
        print(f"Post-patch DB update complete — hosts={hosts}, advisory={advisory_id}, source_pkg={source_pkg}")
        cleanup_resolved_advisories()

    except Exception as e:
        conn.rollback()
        print(f"Post-patch DB update error (non-fatal): {e}")
    finally:
        cursor.close()
        conn.close()


def run_patch_and_save(job_id: str, advisory_id: str, hosts: list,
                       packages: list, dry_run: bool, remediation_cmd: str = ''):
    """Run patch playbook and save results to DB."""
    from scanner import run_patch_job
    from database import update_patch_job
    try:
        running_scans[job_id] = "running"
        output = run_patch_job(hosts=hosts, packages=packages,
                               dry_run=dry_run, advisory_id=advisory_id,
                               remediation_cmd=remediation_cmd)

        status = "complete" if output['status'] in ('successful', 'failed') else output['status']
        if output['failures']:
            status = "complete_with_errors"

        update_patch_job(job_id, status, {
            'hosts':    output['hosts'],
            'failures': output['failures'],
            'rc':       output['rc'],
            'dry_run':  dry_run,
        })
        running_scans[job_id] = status

        mode = "DRY RUN" if dry_run else "APPLIED"
        print(f"Patch job {job_id} [{mode}] complete — "
              f"{len(output['hosts'])} hosts, {len(output['failures'])} failures")

        # After a real patch, update the DB directly so the CVE tab reflects
        # the patched state without needing a full rescan.  Runs in a daemon
        # thread so it doesn't block the patch job response.
        if not dry_run:
            import threading
            t = threading.Thread(
                target=_cleanup_after_patch, args=(hosts, advisory_id), daemon=True
            )
            t.start()

    except Exception as e:
        running_scans[job_id] = f"failed: {str(e)}"
        try:
            update_patch_job(job_id, f"failed: {str(e)}", {})
        except Exception:
            pass
        print(f"run_patch_and_save error: {e}")