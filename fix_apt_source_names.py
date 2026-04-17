#!/usr/bin/env python3
"""
fix_apt_source_names.py
One-time migration: fix remediation text for Ubuntu CVEs where the source
package name ends in '-app' (e.g. 'runc-app', 'containerd-app').

These are Ubuntu-internal source package names that don't exist as apt binary
packages. The binary is the same name without the '-app' suffix.

Run inside the container:
  docker exec -it <container_name> python3 /app/fix_apt_source_names.py
"""
import re
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import get_conn

def fix_remediation(remediation: str, source_pkg: str) -> str:
    """Replace '<source>-app' with '<source>' in apt-get commands."""
    if not remediation or not source_pkg.endswith('-app'):
        return remediation
    stripped = source_pkg[:-4]  # 'runc-app' → 'runc'
    # Replace the source package name in apt commands only (not in free text)
    # Pattern: apt-get ... <source_pkg>  →  apt-get ... <stripped>
    fixed = remediation.replace(
        f'apt-get update && apt-get upgrade {source_pkg}',
        f'apt-get update && apt-get upgrade {stripped}'
    ).replace(
        f'apt-get install --only-upgrade {source_pkg}',
        f'apt-get install --only-upgrade {stripped}'
    )
    return fixed

conn   = get_conn()
cursor = conn.cursor()

cursor.execute("""
    SELECT advisory_id, source_package, remediation
    FROM cve_details
    WHERE source_package LIKE '%%-app'
      AND remediation IS NOT NULL
""")
rows = cursor.fetchall()

print(f"Found {len(rows)} CVE records with '-app' source packages")

updated = 0
for advisory_id, source_pkg, remediation in rows:
    fixed = fix_remediation(remediation, source_pkg)
    if fixed != remediation:
        cursor.execute(
            "UPDATE cve_details SET remediation = %s WHERE advisory_id = %s",
            (fixed, advisory_id)
        )
        print(f"  Fixed: {advisory_id} ({source_pkg} → {source_pkg[:-4]})")
        updated += 1
    else:
        print(f"  Skip:  {advisory_id} ({source_pkg}) — no change needed")

conn.commit()
cursor.close()
conn.close()
print(f"\nDone — updated {updated}/{len(rows)} records")
