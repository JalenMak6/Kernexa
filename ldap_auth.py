"""
ldap_auth.py
LDAP / Active Directory authentication for Kermonix.

Enabled by setting LDAP_HOST in environment variables.
If LDAP_HOST is not set, all functions return None and LDAP is skipped entirely.

Dependencies:
    ldap3>=2.9.1  (add to requirements.txt)

Flow:
    1. Bind to AD using service account (LDAP_BIND_DN / LDAP_BIND_PASSWORD)
    2. Search for user by sAMAccountName (or configured LDAP_USER_ATTR)
    3. Attempt bind with user's own credentials to verify password
    4. Search user's group memberships
    5. Map groups to Kermonix role (admin > operator > reader)
    6. Return (user_dn, display_name, role) or None on failure
"""

import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

LDAP_HOST         = os.environ.get("LDAP_HOST", "").strip()
LDAP_PORT         = int(os.environ.get("LDAP_PORT", 389))
LDAP_USE_SSL      = os.environ.get("LDAP_USE_SSL", "false").lower() == "true"
LDAP_USE_STARTTLS = os.environ.get("LDAP_USE_STARTTLS", "false").lower() == "true"
LDAP_TLS_VERIFY   = os.environ.get("LDAP_TLS_VERIFY", "true").lower() == "true"
LDAP_BIND_DN      = os.environ.get("LDAP_BIND_DN", "").strip()
LDAP_BIND_PASSWORD= os.environ.get("LDAP_BIND_PASSWORD", "").strip()
LDAP_BASE_DN      = os.environ.get("LDAP_BASE_DN", "").strip()
LDAP_USER_ATTR    = os.environ.get("LDAP_USER_ATTR", "sAMAccountName").strip()

# Group DN → role mapping (admin takes priority over operator over reader)
LDAP_ADMIN_GROUP   = os.environ.get("LDAP_ADMIN_GROUP",   "").strip()
LDAP_OPERATOR_GROUP= os.environ.get("LDAP_OPERATOR_GROUP","").strip()
LDAP_READER_GROUP  = os.environ.get("LDAP_READER_GROUP",  "").strip()

LDAP_ENABLED = bool(LDAP_HOST)


def is_ldap_enabled() -> bool:
    if LDAP_ENABLED:
        return True
    # Also check DB-stored settings (configured via UI)
    try:
        from database.ldap_settings import get_ldap_settings_for_auth
        cfg = get_ldap_settings_for_auth()
        return cfg is not None and cfg.get("enabled", False) and bool(cfg.get("host", ""))
    except Exception:
        return False


# ── Helpers ───────────────────────────────────────────────────────────────────

def _escape_filter_value(value: str) -> str:
    """
    Escape special characters in an LDAP filter value per RFC 4515.
    Must be applied to ALL user-controlled values inserted into search filters
    to prevent LDAP injection.
    """
    return (value
            .replace("\\", "\\5c")
            .replace("(", "\\28")
            .replace(")", "\\29")
            .replace("*", "\\2a")
            .replace("\x00", "\\00"))


def _get_connection(bind_dn: str, bind_password: str):
    """
    Create and return a bound ldap3 Connection.
    Supports plain LDAP, LDAPS (with optional cert bypass), and StartTLS.
    Raises on failure.
    """
    from ldap3 import Server, Connection, ALL, Tls
    import ssl

    tls = None
    if LDAP_USE_SSL or LDAP_USE_STARTTLS:
        if not LDAP_TLS_VERIFY:
            # No cert verification — required for AD self-signed certs
            # Use CERT_NONE with no version pin for maximum compatibility
            tls = Tls(validate=ssl.CERT_NONE)
        else:
            tls = Tls(validate=ssl.CERT_REQUIRED)

    server = Server(
        LDAP_HOST,
        port=LDAP_PORT,
        use_ssl=LDAP_USE_SSL,
        tls=tls,
        get_info=ALL,
        connect_timeout=5,
    )

    conn = Connection(
        server,
        user=bind_dn,
        password=bind_password,
        raise_exceptions=True,
        receive_timeout=10,
    )

    if LDAP_USE_STARTTLS:
        conn.open()
        conn.start_tls()
        conn.bind()
        if not conn.bound:
            raise Exception(f"StartTLS bind failed for {bind_dn}: {conn.result}")
    else:
        conn.open()
        conn.bind()
        if not conn.bound:
            raise Exception(f"Bind failed for {bind_dn}: {conn.result}")

    return conn


def _get_user_dn(conn, username: str) -> Optional[tuple]:
    """
    Search for a user by sAMAccountName (or configured attribute).
    Returns (user_dn, display_name, groups) or None if not found.
    """
    search_filter = f"({LDAP_USER_ATTR}={_escape_filter_value(username)})"
    conn.search(
        search_base=LDAP_BASE_DN,
        search_filter=search_filter,
        attributes=["distinguishedName", "displayName", "cn",
                    LDAP_USER_ATTR, "memberOf"],
    )
    if not conn.entries:
        logger.warning(f"[LDAP] User '{username}' not found in directory")
        return None

    entry        = conn.entries[0]
    dn           = entry.entry_dn
    display_name = str(entry.displayName) if entry.displayName else \
                   str(entry.cn)          if entry.cn          else username
    groups       = [str(g).lower() for g in entry.memberOf] if entry.memberOf else []
    return dn, display_name, groups


def _get_user_groups(conn, user_dn: str) -> list[str]:
    """
    Return a list of group DNs the user belongs to.
    Uses memberOf attribute (standard in Active Directory).
    Falls back to recursive group search for OpenLDAP.
    """
    conn.search(
        search_base=user_dn,
        search_filter="(objectClass=*)",
        search_scope="BASE",
        attributes=["memberOf"],
    )
    if not conn.entries:
        return []

    entry = conn.entries[0]
    if not entry.memberOf:
        return []

    # memberOf returns full DNs — normalise to lowercase for comparison
    return [str(g).lower() for g in entry.memberOf]


def _map_groups_to_role(group_dns: list[str]) -> Optional[str]:
    """
    Map a list of group DNs to a Kermonix role.
    Priority: admin > operator > reader.
    Returns None if user is not in any mapped group.
    """
    groups_lower = [g.lower() for g in group_dns]

    if LDAP_ADMIN_GROUP    and LDAP_ADMIN_GROUP.lower()    in groups_lower:
        return "admin"
    if LDAP_OPERATOR_GROUP and LDAP_OPERATOR_GROUP.lower() in groups_lower:
        return "operator"
    if LDAP_READER_GROUP   and LDAP_READER_GROUP.lower()   in groups_lower:
        return "reader"

    return None


# ── Public API ────────────────────────────────────────────────────────────────

def _get_connection_with_cfg(cfg: dict, bind_dn: str, bind_password: str):
    """Create a connection using settings from a config dict."""
    from ldap3 import Server, Connection, ALL, Tls
    import ssl

    use_ssl      = cfg.get("use_ssl",      False)
    use_starttls = cfg.get("use_starttls", False)
    tls_verify   = cfg.get("tls_verify",   True)
    ca_cert      = cfg.get("ca_cert",      "")
    host         = cfg.get("host",         "")
    port         = cfg.get("port",         389)

    tls = None
    if use_ssl or use_starttls:
        if not tls_verify:
            tls = Tls(validate=ssl.CERT_NONE)
        elif ca_cert:
            # Write CA cert to a private temp file (mode 0o600 — owner-only)
            import tempfile, os, base64
            fd, tmp_path = tempfile.mkstemp(suffix=".pem")
            try:
                os.fchmod(fd, 0o600)
                with os.fdopen(fd, "w") as tmp:
                    # ca_cert may be base64-encoded PEM or raw PEM
                    if "BEGIN CERTIFICATE" not in ca_cert:
                        tmp.write(base64.b64decode(ca_cert).decode())
                    else:
                        tmp.write(ca_cert)
                tls = Tls(validate=ssl.CERT_REQUIRED, ca_certs_file=tmp_path)
            finally:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
        else:
            tls = Tls(validate=ssl.CERT_REQUIRED)

    server = Server(
        host,
        port=port,
        use_ssl=use_ssl,
        tls=tls,
        get_info=ALL,
        connect_timeout=5,
    )
    conn = Connection(server, user=bind_dn, password=bind_password,
                      raise_exceptions=True, receive_timeout=10)

    if use_starttls:
        conn.open()
        conn.start_tls()
        conn.bind()
    else:
        conn.open()
        conn.bind()

    if not conn.bound:
        raise Exception(f"Bind failed for {bind_dn}: {conn.result}")
    return conn


def _get_user_dn_cfg(conn, username: str, user_attr: str, base_dn: str) -> Optional[tuple]:
    """Search for user DN using config-specified attribute and base DN.

    If the user is not found under base_dn, falls back to searching from the
    domain root (DC=... components only) so accounts in non-employee OUs
    (e.g. admin or service-account OUs) are still found.
    """
    # Derive the domain root (DC=x,DC=y,...) from the configured base_dn
    domain_root = ",".join(
        part.strip()
        for part in base_dn.split(",")
        if part.strip().upper().startswith("DC=")
    )

    search_bases = [base_dn]
    if domain_root and domain_root.lower() != base_dn.lower():
        search_bases.append(domain_root)

    for search_base in search_bases:
        conn.search(
            search_base=search_base,
            search_filter=f"({user_attr}={_escape_filter_value(username)})",
            attributes=["distinguishedName", "displayName", "cn", user_attr, "memberOf"],
        )
        if conn.entries:
            entry        = conn.entries[0]
            dn           = entry.entry_dn
            display_name = str(entry.displayName) if entry.displayName else \
                           str(entry.cn)          if entry.cn          else username
            groups       = [str(g).lower() for g in entry.memberOf] if entry.memberOf else []
            if search_base != base_dn:
                logger.debug(f"[LDAP] User '{username}' found via domain-root fallback search")
            return dn, display_name, groups

    logger.warning(f"[LDAP] User '{username}' not found in directory (searched: {search_bases})")
    return None


def _get_recursive_groups(conn, user_dn: str) -> list[str]:
    """
    Return all group DNs the user belongs to.

    Strategy (mirrors Grafana's ldap approach):
    1. Forward group search: find group objects where member=<user_dn>.
       This is what Grafana uses and is reliable even when memberOf is
       restricted or not populated.
    2. Recursive OID (LDAP_MATCHING_RULE_IN_CHAIN) for nested memberships.
    3. Plain memberOf re-read as last resort.
    """
    domain_root = ",".join(
        p.strip() for p in user_dn.split(",")
        if p.strip().upper().startswith("DC=")
    ) or user_dn

    escaped_dn = _escape_filter_value(user_dn)

    # Strategy 1 — forward member search (Grafana-style)
    # (&(objectClass=group)(member=<user_dn>)) from domain root
    try:
        conn.search(
            search_base=domain_root,
            search_filter=f"(&(objectClass=group)(member={escaped_dn}))",
            attributes=["distinguishedName"],
        )
        if conn.entries:
            found = [str(e.distinguishedName).lower() for e in conn.entries]
            logger.info(f"[LDAP] Forward group search found {len(found)} group(s)")
            return found
        logger.debug("[LDAP] Forward group search returned no results")
    except Exception as e:
        logger.debug(f"[LDAP] Forward group search failed: {e}")

    # Strategy 2 — recursive OID (transitive membership)
    try:
        conn.search(
            search_base=domain_root,
            search_filter=f"(member:1.2.840.113556.1.4.1941:={escaped_dn})",
            attributes=["distinguishedName"],
        )
        if conn.entries:
            found = [str(e.distinguishedName).lower() for e in conn.entries]
            logger.info(f"[LDAP] Recursive OID group search found {len(found)} group(s)")
            return found
        logger.debug("[LDAP] Recursive OID search returned no results")
    except Exception as e:
        logger.debug(f"[LDAP] Recursive OID search failed: {e}")

    # Strategy 3 — re-read memberOf from user object directly
    try:
        conn.search(
            search_base=user_dn,
            search_filter="(objectClass=*)",
            search_scope="BASE",
            attributes=["memberOf"],
        )
        if conn.entries and conn.entries[0].memberOf:
            found = [str(g).lower() for g in conn.entries[0].memberOf]
            logger.info(f"[LDAP] memberOf re-read found {len(found)} group(s)")
            return found
        logger.debug("[LDAP] memberOf re-read returned no results")
    except Exception as e:
        logger.debug(f"[LDAP] memberOf re-read failed: {e}")

    return []


def _map_groups_to_role_cfg(groups: list, admin_group: str,
                             operator_group: str, reader_group: str) -> Optional[str]:
    """Map group DNs to role using explicit group config."""
    groups_lower = [g.lower() for g in groups]
    if admin_group    and admin_group.lower()    in groups_lower: return "admin"
    if operator_group and operator_group.lower() in groups_lower: return "operator"
    if reader_group   and reader_group.lower()   in groups_lower: return "reader"
    return None


def _get_effective_config() -> dict | None:
    """
    Get LDAP config — DB settings take priority over env vars.
    Returns None if LDAP is not configured/enabled anywhere.
    """
    # Try DB first
    try:
        from database.ldap_settings import get_ldap_settings_for_auth
        db_cfg = get_ldap_settings_for_auth()
        if db_cfg and db_cfg.get("enabled") and db_cfg.get("host"):
            return db_cfg
    except Exception as e:
        logger.debug(f"[LDAP] Could not read DB settings: {e}")

    # Fall back to env vars
    if not LDAP_ENABLED:
        return None
    return {
        "enabled":        True,
        "host":           LDAP_HOST,
        "port":           LDAP_PORT,
        "use_ssl":        LDAP_USE_SSL,
        "use_starttls":   LDAP_USE_STARTTLS,
        "tls_verify":     LDAP_TLS_VERIFY,
        "bind_dn":        LDAP_BIND_DN,
        "bind_password":  LDAP_BIND_PASSWORD,
        "base_dn":        LDAP_BASE_DN,
        "user_attr":      LDAP_USER_ATTR,
        "admin_group":    LDAP_ADMIN_GROUP,
        "operator_group": LDAP_OPERATOR_GROUP,
        "reader_group":   LDAP_READER_GROUP,
        "ca_cert":        "",
    }


def ldap_authenticate(username: str, password: str) -> Optional[dict]:
    """
    Attempt to authenticate a user against LDAP/AD.
    Reads config from DB (if configured) then falls back to env vars.

    Returns a dict on success:
        { "username", "display_name", "role", "auth_source": "ldap" }

    Returns None on any failure — never raises.
    """
    cfg = _get_effective_config()
    if not cfg:
        return None

    bind_dn  = cfg["bind_dn"]
    bind_pw  = cfg["bind_password"]
    base_dn  = cfg["base_dn"]
    user_attr = cfg["user_attr"] or "sAMAccountName"

    if not bind_dn or not bind_pw or not base_dn:
        logger.error("[LDAP] bind_dn, bind_password, base_dn must all be set")
        return None

    try:
        # Step 1 — service account bind to find user DN + groups
        svc_conn = _get_connection_with_cfg(cfg, bind_dn, bind_pw)
        result   = _get_user_dn_cfg(svc_conn, username, user_attr, base_dn)
        if not result:
            svc_conn.unbind()
            return None

        user_dn, display_name, groups = result
        logger.info(f"[LDAP] Found user DN: {user_dn}")
        logger.info(f"[LDAP] Direct memberOf groups for '{username}': {groups}")

        # Step 2 — verify password via UPN then DN
        domain = ".".join(
            part.split("=")[1]
            for part in base_dn.split(",")
            if part.strip().upper().startswith("DC=")
        )
        upn = f"{username}@{domain}"

        bound = False
        for bind_identity in [upn, user_dn]:
            try:
                user_conn = _get_connection_with_cfg(cfg, bind_identity, password)
                bound = True
                logger.debug(f"[LDAP] User bind succeeded with '{bind_identity}'")
                break
            except Exception as e:
                logger.debug(f"[LDAP] User bind failed for '{bind_identity}': {e}")

        if not bound:
            logger.warning(f"[LDAP] Invalid credentials for '{username}'")
            svc_conn.unbind()
            return None

        # Step 3 — map groups to role
        # First try direct memberOf, then fall back to recursive AD group search
        role = _map_groups_to_role_cfg(
            groups,
            cfg.get("admin_group",    ""),
            cfg.get("operator_group", ""),
            cfg.get("reader_group",   ""),
        )
        if not role:
            logger.info(f"[LDAP] Direct memberOf empty for '{username}', running group search")
            groups = _get_recursive_groups(svc_conn, user_dn)
            logger.info(f"[LDAP] Groups found for '{username}': {groups}")
            logger.info(f"[LDAP] Comparing against — admin: '{cfg.get('admin_group','')}'")
            role = _map_groups_to_role_cfg(
                groups,
                cfg.get("admin_group",    ""),
                cfg.get("operator_group", ""),
                cfg.get("reader_group",   ""),
            )
        if not role:
            logger.warning(f"[LDAP] '{username}' not in any mapped group. Groups: {groups}")
            user_conn.unbind()
            svc_conn.unbind()
            return None

        user_conn.unbind()
        svc_conn.unbind()

        logger.info(f"[LDAP] Authenticated '{username}' as '{role}'")
        return {
            "username":     username,
            "display_name": display_name,
            "role":         role,
            "auth_source":  "ldap",
        }

    except Exception as e:
        logger.error(f"[LDAP] Authentication error for '{username}': {e}")
        return None


def test_ldap_connection(cfg: dict = None) -> dict:
    """
    Test LDAP connectivity using the service account.
    Accepts an explicit config dict (from UI form) or uses effective config.

    Returns:
        { "success": bool, "message": str, "config": dict }
    """
    if cfg is None:
        cfg = _get_effective_config()
    if not cfg:
        return {
            "success": False,
            "message": "LDAP is not configured",
            "config":  {},
        }

    config = {
        "host":           cfg.get("host",           ""),
        "port":           cfg.get("port",           389),
        "use_ssl":        cfg.get("use_ssl",        False),
        "use_starttls":   cfg.get("use_starttls",   False),
        "tls_verify":     cfg.get("tls_verify",     True),
        "base_dn":        cfg.get("base_dn",        ""),
        "user_attr":      cfg.get("user_attr",      "sAMAccountName"),
        "admin_group":    cfg.get("admin_group",    "") or "(not set)",
        "operator_group": cfg.get("operator_group", "") or "(not set)",
        "reader_group":   cfg.get("reader_group",   "") or "(not set)",
    }

    host = cfg.get("host", "")
    port = cfg.get("port", 389)

    try:
        conn = _get_connection_with_cfg(cfg, cfg["bind_dn"], cfg["bind_password"])
        conn.unbind()
        return {
            "success": True,
            "message": f"Successfully bound to {host}:{port} as service account",
            "config":  config,
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to connect to {host}:{port}: {str(e)}",
            "config":  config,
        }