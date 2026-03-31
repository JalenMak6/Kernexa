import ansible_runner
import os
from database import get_active_inventory_credentials


def parse_packages(package_lines: list) -> list:
    return [line.strip() for line in package_lines if line.strip()]


def _parse_windows_ports(port_records: list) -> list:
    """
    Parse open_ports from Windows playbook output.
    Each record is already a dict with protocol, bind_address, port, service, pid
    (parsed by Ansible set_fact in the playbook).
    Classifies exposure same as Linux: external / internal / interface.
    """
    ports = []
    seen  = set()
    for r in port_records:
        if not isinstance(r, dict):
            continue
        protocol     = str(r.get('protocol', 'tcp')).lower().strip()
        bind_address = str(r.get('bind_address', '')).strip()
        port_str     = str(r.get('port', '')).strip()
        service      = str(r.get('service', 'unknown')).strip() or 'unknown'
        pid_str      = str(r.get('pid', '')).strip()

        if not port_str.isdigit():
            continue
        # Skip IPv6
        if ':' in bind_address and bind_address not in ('0.0.0.0',):
            continue

        port = int(port_str)
        pid  = int(pid_str) if pid_str.isdigit() else None

        key = (protocol, bind_address, port)
        if key in seen:
            continue
        seen.add(key)

        if bind_address == '0.0.0.0':
            exposure = 'external'
        elif bind_address in ('127.0.0.1', '::1'):
            exposure = 'internal'
        else:
            exposure = 'interface'

        ports.append({
            'protocol':     protocol,
            'bind_address': bind_address,
            'port':         port,
            'state':        'LISTEN',
            'service':      service,
            'pid':          pid,
            'exposure':     exposure,
        })

    ports.sort(key=lambda p: p['port'])
    return ports


def parse_ports(port_lines: list) -> list:
    """
    Parse port lines emitted by the playbook.
    Each line: PROTOCOL|BIND_ADDRESS|PORT|SERVICE|PID
    e.g.: tcp|0.0.0.0|22|sshd|1234
    Returns a sorted list of dicts.
    """
    ports = []
    seen  = set()
    for line in port_lines:
        line = line.strip()
        if not line:
            continue
        parts = line.split('|')
        if len(parts) < 4:
            continue
        protocol     = parts[0].lower().strip()
        bind_address = parts[1].strip()
        port_str     = parts[2].strip()
        service      = parts[3].strip() or "unknown"
        pid_str      = parts[4].strip() if len(parts) > 4 else ""

        # Skip non-numeric ports and any IPv6 addresses
        if not port_str.isdigit():
            continue
        if ':' in bind_address:
            continue

        port = int(port_str)
        pid  = int(pid_str) if pid_str.isdigit() else None

        # Deduplicate same protocol + bind + port
        key = (protocol, bind_address, port)
        if key in seen:
            continue
        seen.add(key)

        ports.append({
            'protocol':     protocol,
            'bind_address': bind_address,
            'port':         port,
            'state':        'LISTEN',
            'service':      service,
            'pid':          pid,
        })

    ports.sort(key=lambda p: p['port'])
    return ports


# ── Linux patch scan ──────────────────────────────────────────────────────────

def run_patch_scan() -> dict:
    creds = get_active_inventory_credentials()
    if not creds:
        raise RuntimeError("No credentials found for active inventory. Set credentials in Settings first.")

    # Clear any cached extravars/env from previous runs (e.g. Windows scan)
    for stale in ["/app/env/extravars", "/app/env/envvars"]:
        if os.path.exists(stale):
            os.remove(stale)

    extravars = {
        'ansible_connection':      'ssh',
        'ansible_shell_type':      'sh',
        'ansible_user':            creds['username'],
        'ansible_password':        creds['password'],
        'ansible_become':          True,
        'ansible_become_method':   'sudo',
        'ansible_become_pass':     creds['password'],
        'ansible_ssh_common_args': '-o StrictHostKeyChecking=no',
    }

    result = ansible_runner.run(
        private_data_dir='/app',
        playbook='linux_patch_scan.yml',
        quiet=False,
        cmdline='-i /app/inventory/hosts --forks 50 --timeout 10',
        extravars=extravars,
    )

    output = {
        'status':   result.status,
        'rc':       result.rc,
        'hosts':    {},
        'failures': {},
    }

    try:
        output['ansible_log'] = ''.join(list(result.stdout))
    except Exception:
        output['ansible_log'] = ''

    for event in result.events:
        event_type = event.get('event', '')
        ed   = event.get('event_data', {})
        host = ed.get('remote_addr') or ed.get('host')
        task = ed.get('task', '')
        res  = ed.get('res', {})

        if event_type == 'runner_on_ok':
            if task != 'Print kernel version and packages' or not host:
                continue
            if 'msg' not in res:
                continue

            msg  = res['msg']
            flat = {}
            if isinstance(msg, list):
                for item in msg:
                    flat.update(item)
            elif isinstance(msg, dict):
                flat = msg

            if 'pending_security_packages' in flat:
                flat['pending_security_packages'] = parse_packages(flat['pending_security_packages'])
            if 'current_kernel_version' in flat:
                flat['current_kernel_version'] = flat['current_kernel_version'].strip()
            if 'latest_available_kernel_version' in flat:
                flat['latest_available_kernel_version'] = flat['latest_available_kernel_version'].strip()
            if 'last_reboot_time' in flat:
                flat['last_reboot_time'] = flat['last_reboot_time'].strip()
            if 'advisory_ids' in flat:
                flat['advisory_ids'] = [a.strip() for a in flat['advisory_ids'] if a.strip()]
            else:
                flat['advisory_ids'] = []
            if 'package_source_map' in flat:
                source_map = {}
                for line in flat['package_source_map']:
                    if ':' in line:
                        binary, source = line.split(':', 1)
                        source_map[binary.strip()] = source.strip()
                flat['package_source_map'] = source_map

            # Parse open ports
            flat['open_ports'] = parse_ports(flat.get('open_ports', []))

            output['hosts'][host] = flat

        elif event_type == 'runner_on_failed':
            if not host:
                continue
            if host not in output['failures']:
                output['failures'][host] = {
                    'reason': 'task_failed',
                    'task':   task,
                    'msg':    res.get('msg', 'Unknown error'),
                    'rc':     res.get('rc'),
                    'stderr': res.get('stderr', '').strip(),
                    'stdout': res.get('stdout', '').strip(),
                }

        elif event_type == 'runner_on_unreachable':
            if not host:
                continue
            output['failures'][host] = {
                'reason': 'unreachable',
                'task':   task,
                'msg':    res.get('msg', 'Host unreachable'),
                'rc':     None,
                'stderr': '',
                'stdout': '',
            }

    return output


# ── Windows patch scan ────────────────────────────────────────────────────────

def run_windows_patch_scan() -> dict:
    from database import get_windows_credentials, get_active_windows_inventory

    creds = get_windows_credentials()
    if not creds:
        raise RuntimeError("No Windows credentials configured. Go to Settings → Windows WinRM Credentials.")

    win_inv = get_active_windows_inventory()
    if not win_inv:
        raise RuntimeError("No active Windows inventory found. Activate a Windows inventory in Inventories.")

    win_inv_path = "/app/inventory/win_hosts"
    os.makedirs(os.path.dirname(win_inv_path), exist_ok=True)
    content = win_inv['content'].replace('\r\n', '\n').replace('\r', '\n')
    with open(win_inv_path, "w") as f:
        f.write(content)

    ansible_user = f"{creds['domain']}\\{creds['username']}" if creds.get('domain') else creds['username']

    extravars = {
        'ansible_user':                         ansible_user,
        'ansible_password':                     creds['password'],
        'ansible_port':                         creds['port'],
        'ansible_connection':                   'winrm',
        'ansible_winrm_transport':              creds['transport'],
        'ansible_winrm_server_cert_validation': 'ignore',
        'ansible_winrm_kerberos_delegation':    'true',
        'ansible_become':                       False,
        'ansible_shell_type':                   'powershell',
    }

    result = ansible_runner.run(
        private_data_dir='/app',
        playbook='win_patch_scan.yml',
        quiet=False,
        cmdline=f'-i {win_inv_path} --forks 20 --timeout 120',
        extravars=extravars,
    )

    for stale in ["/app/env/extravars", "/app/env/envvars"]:
        if os.path.exists(stale):
            try:
                os.remove(stale)
            except Exception:
                pass

    output = {
        'status':   result.status,
        'rc':       result.rc,
        'hosts':    {},
        'failures': {},
    }

    try:
        output['ansible_log'] = ''.join(list(result.stdout))
    except Exception:
        output['ansible_log'] = ''

    for event in result.events:
        event_type = event.get('event', '')
        ed   = event.get('event_data', {})
        host = ed.get('remote_addr') or ed.get('host')
        task = ed.get('task', '')
        res  = ed.get('res', {})

        if event_type == 'runner_on_ok':
            if task != 'Print Windows patch compliance data' or not host:
                continue
            if 'msg' not in res:
                continue

            msg = res['msg']
            if not isinstance(msg, dict):
                continue

            output['hosts'][host] = {
                'hostname':   msg.get('hostname', host),
                'osName':     msg.get('osName', ''),
                'osVersion':  msg.get('osVersion', ''),
                'updates':    msg.get('updates', []),
                'open_ports': _parse_windows_ports(msg.get('open_ports', [])),
            }

        elif event_type == 'runner_on_failed':
            if not host:
                continue
            if host not in output['failures']:
                output['failures'][host] = {
                    'reason': 'task_failed',
                    'task':   task,
                    'msg':    res.get('msg', 'Unknown error'),
                    'rc':     res.get('rc'),
                    'stderr': res.get('stderr', '').strip(),
                    'stdout': res.get('stdout', '').strip(),
                }

        elif event_type == 'runner_on_unreachable':
            if not host:
                continue
            output['failures'][host] = {
                'reason': 'unreachable',
                'task':   task,
                'msg':    res.get('msg', 'Host unreachable'),
                'rc':     None,
                'stderr': '',
                'stdout': '',
            }

    return output



# ── Security patch applicator ─────────────────────────────────────────────────

def run_patch_job(hosts: list, packages: list, dry_run: bool = True,
                  advisory_id: str = '') -> dict:
    """
    Runs patch_apply.yml against specified hosts.
    dry_run=True  → simulate with --assumeno / --dry-run
    dry_run=False → actually applies the patches
    """
    creds = get_active_inventory_credentials()
    if not creds:
        raise RuntimeError("No credentials found for active inventory.")

    for stale in ["/app/env/extravars", "/app/env/envvars"]:
        if os.path.exists(stale):
            os.remove(stale)

    # Write a temporary inventory for just the target hosts
    import tempfile
    inv_content = "[patch_targets]\n" + "\n".join(hosts) + "\n"
    tmp_inv = tempfile.NamedTemporaryFile(
        mode='w', suffix='.ini', dir='/app/inventory',
        delete=False, prefix='patch_'
    )
    tmp_inv.write(inv_content)
    tmp_inv.close()

    import re as _re
    # Use advisory ID for RHEL advisories (RHSA/ALSA/RLSA etc.)
    # For everything else (CVE IDs, package names) use the packages list
    _is_rhel_advisory = bool(_re.match(r'^(RHSA|ALSA|RLSA|RHBA|RHEA)-', advisory_id or ''))
    pkg_str = advisory_id if _is_rhel_advisory else ' '.join(packages)

    extravars = {
        'ansible_connection':      'ssh',
        'ansible_shell_type':      'sh',
        'ansible_user':            creds['username'],
        'ansible_password':        creds['password'],
        'ansible_become':          True,
        'ansible_become_method':   'sudo',
        'ansible_become_pass':     creds['password'],
        'ansible_ssh_common_args': '-o StrictHostKeyChecking=no',
        'target_hosts':            'patch_targets',
        'packages':                pkg_str,
        'advisory_id':             advisory_id or '',
        'dry_run':                 'true' if dry_run else 'false',
    }

    result = ansible_runner.run(
        private_data_dir='/app',
        playbook='patch_apply.yml',
        quiet=False,
        cmdline=f'-i {tmp_inv.name} --forks 20 --timeout 120',
        extravars=extravars,
    )

    # Clean up temp inventory
    try:
        os.remove(tmp_inv.name)
    except Exception:
        pass

    output = {
        'status':   result.status,
        'rc':       result.rc,
        'dry_run':  dry_run,
        'hosts':    {},
        'failures': {},
    }

    try:
        output['ansible_log'] = ''.join(list(result.stdout))
    except Exception:
        output['ansible_log'] = ''

    def parse_yum_stdout(stdout: str) -> dict:
        """
        Parse yum/dnf stdout to extract package upgrade info.
        Returns dict: { pkg_name: { 'from': old_ver, 'to': new_ver } }

        Yum output sections we care about:
          Upgrading:
            kernel   x86_64  5.14.0-511  baseos  89M
          ...
        """
        import re
        packages = {}
        lines    = stdout.splitlines()
        in_section = False
        current_section = None

        for line in lines:
            stripped = line.strip()
            # Detect section headers
            if stripped in ('Upgrading:', 'Installing:', 'Updating:'):
                in_section   = True
                current_section = stripped.rstrip(':').lower()
                continue
            if stripped in ('Transaction Summary', 'Skipped (dependency problems):', ''):
                in_section = False
                continue
            if in_section and stripped and not stripped.startswith('('):
                # "kernel   x86_64   5.14.0-611.36.1.el9_7   baseos   89 M"
                parts = stripped.split()
                if len(parts) >= 3:
                    pkg_name = parts[0]
                    new_ver  = parts[2]
                    packages[pkg_name] = {'action': current_section, 'to': new_ver, 'from': ''}

        # Also look for "Upgrading  : pkg-old -> pkg-new" style (older yum)
        for line in lines:
            m = re.match(r'\s+(?:Upgrading|Updating)\s+:\s+(\S+)\s+(\S+)\s*->\s*(\S+)', line)
            if m:
                pkg_name = m.group(1)
                packages[pkg_name] = {'action': 'upgrading', 'from': m.group(2), 'to': m.group(3)}

        return packages

    def parse_apt_stdout(stdout: str) -> dict:
        """
        Parse apt-get upgrade stdout for upgrade info.
        Handles both --dry-run and actual upgrade output.

        Dry-run lines:
          Inst coreutils [8.30-3] (8.32-4 Ubuntu)
          Inst openssl [1.1.1f-1] (1.1.1f-1ubuntu2.22 Ubuntu)

        Actual upgrade lines:
          Unpacking coreutils (8.32-4) over (8.30-3) ...
        """
        import re
        packages = {}
        for line in stdout.splitlines():
            # Dry-run: Inst pkg [old_ver] (new_ver distro)
            m = re.match(r'Inst (\S+)(?:\s+\[([^\]]+)\])?\s+\((\S+)', line)
            if m:
                pkg_name = m.group(1)
                old_ver  = m.group(2) or ''
                new_ver  = m.group(3) or ''
                packages[pkg_name] = {'action': 'upgrading', 'from': old_ver, 'to': new_ver}
                continue
            # Actual: Unpacking pkg (new) over (old)
            m2 = re.match(r'Unpacking (\S+) \(([^)]+)\) over \(([^)]+)\)', line)
            if m2:
                pkg_name = m2.group(1)
                new_ver  = m2.group(2)
                old_ver  = m2.group(3)
                packages[pkg_name] = {'action': 'upgraded', 'from': old_ver, 'to': new_ver}
        return packages

    for event in result.events:
        event_type = event.get('event', '')
        ed   = event.get('event_data', {})
        host = ed.get('remote_addr') or ed.get('host')
        task = ed.get('task', '')
        res  = ed.get('res', {})

        if event_type == 'runner_on_ok' and task == 'Print patch results' and host:
            msg = res.get('msg', {})
            if isinstance(msg, dict):
                stdout    = str(msg.get('stdout', ''))
                os_family = msg.get('os_family', 'redhat')
                pkg_info  = parse_yum_stdout(stdout) if os_family == 'redhat' else parse_apt_stdout(stdout)

                output['hosts'][host] = {
                    'hostname':    msg.get('hostname', host),
                    'advisory_id': msg.get('advisory_id', advisory_id),
                    'changed':     msg.get('changed', False),
                    'failed':      msg.get('failed', False),
                    'dry_run':     msg.get('dry_run', dry_run),
                    'packages':    pkg_info,
                    'stdout':      stdout,
                    'rc':          msg.get('rc', 0),
                }

        elif event_type == 'runner_on_failed' and host:
            if host not in output['failures']:
                output['failures'][host] = {
                    'reason': 'task_failed',
                    'task':   task,
                    'msg':    res.get('msg', 'Unknown error'),
                }

        elif event_type == 'runner_on_unreachable' and host:
            output['failures'][host] = {
                'reason': 'unreachable',
                'msg':    res.get('msg', 'Host unreachable'),
            }

    return output