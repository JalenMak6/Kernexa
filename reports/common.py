"""
reports/common.py
Shared helpers used by both linux.py and windows.py:
  - classify_os()       — normalise OS string to sheet-name key
  - _xl_header_style()  — dark header row styling
  - _xl_cell_border()   — light cell border
  - sheet_sort_key()    — sort OS sheet tabs consistently
"""

import re
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side


def classify_os(os_version: str) -> str:
    if not os_version:
        return "Unknown"
    v = os_version.lower()
    if "red hat" in v or "rhel" in v:
        m = re.search(r'(\d+)', os_version)
        return f"RHEL {m.group(1)}" if m else "RHEL"
    if "rocky" in v:
        m = re.search(r'(\d+)', os_version)
        return f"Rocky {m.group(1)}" if m else "Rocky"
    if "alma" in v:
        m = re.search(r'(\d+)', os_version)
        return f"Alma {m.group(1)}" if m else "Alma"
    if "centos" in v:
        m = re.search(r'(\d+)', os_version)
        return f"CentOS {m.group(1)}" if m else "CentOS"
    if "ubuntu" in v:
        m = re.search(r'(\d+\.\d+)', os_version)
        return f"Ubuntu {m.group(1)}" if m else "Ubuntu"
    if "debian" in v:
        m = re.search(r'(\d+)', os_version)
        return f"Debian {m.group(1)}" if m else "Debian"
    if "windows" in v:
        if "2022" in v: return "Windows 2022"
        if "2019" in v: return "Windows 2019"
        if "2016" in v: return "Windows 2016"
        if "2012" in v: return "Windows 2012"
        if "10"   in v: return "Windows 10"
        if "11"   in v: return "Windows 11"
        return "Windows"
    return os_version[:31]


def sheet_sort_key(name: str) -> tuple:
    parts  = name.split()
    prefix = parts[0] if parts else ""
    num_str = parts[1] if len(parts) > 1 else "0"
    try:
        num = float(num_str)
    except ValueError:
        num = 0
    return (prefix, num)


def xl_header_style():
    fill   = PatternFill("solid", fgColor="0F172A")
    font   = Font(bold=True, color="FFFFFF", size=10)
    align  = Alignment(horizontal="center", vertical="center", wrap_text=False)
    thin   = Side(style="thin", color="334155")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    return fill, font, align, border


def xl_cell_border():
    thin = Side(style="thin", color="E2E8F0")
    return Border(left=thin, right=thin, top=thin, bottom=thin)