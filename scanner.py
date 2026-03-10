import ansible_runner
import os
import yaml
from database import get_active_inventory_credentials

EXTRAVARS_PATH = "./env/extravars"


def parse_packages(package_lines: list) -> list:
    return [line.strip() for line in package_lines if line.strip()]


def run_patch_scan() -> dict:
    # Load credentials from DB for the active inventory
    creds = get_active_inventory_credentials()
    if not creds:
        raise RuntimeError("No credentials found for active inventory. Set credentials in Settings first.")

    # Write extravars with SSH credentials
    extravars = {
        'ansible_user':            creds['username'],
        'ansible_password':        creds['password'],
        'ansible_become':          True,
        'ansible_become_method':   'sudo',
        'ansible_become_pass':     creds['password'],
        'ansible_ssh_common_args': '-o StrictHostKeyChecking=no',
    }
    os.makedirs(os.path.dirname(EXTRAVARS_PATH), exist_ok=True)
    with open(EXTRAVARS_PATH, "w") as f:
        yaml.dump(extravars, f, default_flow_style=False)

    # Run the playbook
    result = ansible_runner.run(
        private_data_dir='./',
        playbook='patch_scan.yml',
        quiet=False,
        cmdline="--forks 50 --timeout 10"
    )

    output = {
        'status':   result.status,
        'rc':       result.rc,
        'hosts':    {},
        'failures': {},  # host -> {task, msg, stderr, rc}
    }

    # Collect the full ansible stdout log
    try:
        stdout_lines = list(result.stdout)
        output['ansible_log'] = ''.join(stdout_lines)
    except Exception:
        output['ansible_log'] = ''

    for event in result.events:
        event_type = event.get('event', '')
        ed   = event.get('event_data', {})
        host = ed.get('remote_addr') or ed.get('host')
        task = ed.get('task', '')
        res  = ed.get('res', {})

        # ── capture successful scan results ───────────────────────────────────
        if event_type == 'runner_on_ok':
            if task != 'Print kernel version and packages' or not host:
                continue
            if 'msg' not in res:
                continue

            msg = res['msg']
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

        # ── capture task failures ─────────────────────────────────────────────
        elif event_type == 'runner_on_failed':
            if not host:
                continue
            failure = {
                'reason':  'task_failed',
                'task':    task,
                'msg':     res.get('msg', 'Unknown error'),
                'rc':      res.get('rc'),
                'stderr':  res.get('stderr', '').strip(),
                'stdout':  res.get('stdout', '').strip(),
            }
            # keep the first failure per host (usually the root cause)
            if host not in output['failures']:
                output['failures'][host] = failure

        # ── capture unreachable hosts ─────────────────────────────────────────
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