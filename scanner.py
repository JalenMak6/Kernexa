import ansible_runner
import os
from database import get_active_inventory_credentials


def parse_packages(package_lines: list) -> list:
    return [line.strip() for line in package_lines if line.strip()]


# ── Linux patch scan ──────────────────────────────────────────────────────────

def run_patch_scan() -> dict:
    creds = get_active_inventory_credentials()
    if not creds:
        raise RuntimeError("No credentials found for active inventory. Set credentials in Settings first.")

    # Clear any cached extravars/env from previous runs (e.g. Windows scan)
    # to prevent ansible_shell_type=powershell bleeding into Linux scans
    for stale in ["/app/env/extravars", "/app/env/envvars"]:
        if os.path.exists(stale):
            os.remove(stale)

    extravars = {
        'ansible_connection':      'ssh',         # explicitly SSH — overrides any cached winrm
        'ansible_shell_type':      'sh',          # explicitly sh — overrides any cached powershell
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
    """
    Runs win_patch_scan.yml via ansible-runner against [windows_hosts].
    Reads WinRM credentials and the active Windows inventory from the database,
    writes the inventory to /app/inventory/win_hosts, then runs the playbook.
    """
    from database import get_windows_credentials, get_active_windows_inventory

    creds = get_windows_credentials()
    if not creds:
        raise RuntimeError("No Windows credentials configured. Go to Settings → Windows WinRM Credentials.")

    win_inv = get_active_windows_inventory()
    if not win_inv:
        raise RuntimeError("No active Windows inventory found. Activate a Windows inventory in Inventories.")

    # Write Windows inventory to its own file — never touches /app/inventory/hosts
    win_inv_path = "/app/inventory/win_hosts"
    os.makedirs(os.path.dirname(win_inv_path), exist_ok=True)
    content = win_inv['content'].replace('\r\n', '\n').replace('\r', '\n')
    with open(win_inv_path, "w") as f:
        f.write(content)

    # Build ansible_user — include domain prefix if provided
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

    # Clean up Windows-specific env files after scan so they don't
    # bleed into subsequent Linux scans
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
                'hostname':  msg.get('hostname', host),
                'osName':    msg.get('osName', ''),
                'osVersion': msg.get('osVersion', ''),
                'updates':   msg.get('updates', []),
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