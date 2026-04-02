"""
database/__init__.py
Re-exports all public functions so existing code can continue using:
  from database import get_conn, save_to_db, get_latest_scan, ...
without any changes.
"""

from database.connection import get_conn, DB_CONFIG

from database.inventories import (
    get_inventories,
    get_inventory_content,
    save_inventory,
    activate_inventory,
    delete_inventory,
    save_credentials,
    get_credentials,
    get_active_inventory_credentials,
    get_active_linux_inventory,
    get_active_windows_inventory,
    save_windows_credentials,
    get_windows_credentials,
)

from database.scans import (
    save_to_db,
    get_latest_scan,
    get_scan_history,
    get_scan_failures,
    get_cve_details,
    get_hosts,
    save_hosts,
    save_host_ports,
    get_host_ports,
)

from database.windows import (
    save_windows_to_db,
    get_latest_windows_scan,
)

from database.hosts import (
    get_tags_for_host,
    get_all_tags,
    add_tag,
    remove_tag,
    get_tags_for_hosts,
    get_host_history,
    get_host_cves,
)

from database.settings import (
    get_notification_settings,
    save_notification_settings,
    get_scan_interval,
    save_scan_interval,
)

from database.patches import (
    save_patch_job,
    update_patch_job,
    get_patch_job,
    get_patch_history,
)

from database.users import (
    create_user,
    get_user_by_username,
    get_user_by_id,
    list_users,
    update_user,
    delete_user,
    update_last_login,
    user_exists,
    save_refresh_token,
    get_refresh_token,
    revoke_refresh_token,
    revoke_all_user_tokens,
    cleanup_expired_tokens,
)

__all__ = [
    # connection
    "get_conn", "DB_CONFIG",
    # inventories
    "get_inventories", "get_inventory_content", "save_inventory",
    "activate_inventory", "delete_inventory",
    # credentials
    "save_credentials", "get_credentials", "get_active_inventory_credentials",
    "get_active_linux_inventory", "get_active_windows_inventory",
    "save_windows_credentials", "get_windows_credentials",
    # linux scans
    "save_to_db", "get_latest_scan", "get_scan_history",
    "get_scan_failures", "get_cve_details", "get_hosts", "save_hosts",
    "save_host_ports", "get_host_ports",
    # windows scans
    "save_windows_to_db", "get_latest_windows_scan",
    # hosts
    "get_tags_for_host", "get_all_tags", "add_tag", "remove_tag",
    "get_tags_for_hosts", "get_host_history", "get_host_cves",
    # settings
    "get_notification_settings", "save_notification_settings",
    "get_scan_interval", "save_scan_interval",
    # patches
    "save_patch_job", "update_patch_job", "get_patch_job", "get_patch_history",
    # users
    "create_user", "get_user_by_username", "get_user_by_id",
    "list_users", "update_user", "delete_user", "update_last_login",
    "user_exists", "save_refresh_token", "get_refresh_token",
    "revoke_refresh_token", "revoke_all_user_tokens", "cleanup_expired_tokens",
]