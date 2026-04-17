import { useState, useEffect, useCallback } from "react";
import { useTheme } from "./context/ThemeContext.jsx";

import { apiFetch, apiPost, setLogoutCallback, clearToken, tryRefreshOnLoad, logout as apiLogout } from "./utils/api";
import { kernelOutdated, fmtDate } from "./utils/helpers.jsx";
import { osFamily } from "./utils/filters.jsx";
import { Icon, Icons } from "./utils/icons.jsx";
import { exportToCSV } from "./utils/csv.js";

import { LoginPage }              from "./components/LoginPage.jsx";
import { RegisterPage }           from "./components/RegisterPage.jsx";
import { StatCard }               from "./components/StatCard.jsx";
import { HostRow }                from "./components/HostRow.jsx";
import { HostsManager }           from "./components/HostsManager.jsx";
import { InventoryManager }       from "./components/InventoryManager.jsx";
import { CveTab }                 from "./components/CveTab.jsx";
import { ScanFailuresModal }      from "./components/ScanFailuresModal.jsx";
import { SettingsTab }            from "./components/SettingsTab.jsx";
import { WindowsTab }             from "./components/WindowsTab.jsx";
import { WindowsCredentialsForm } from "./components/WindowsCredentialsForm.jsx";
import { DashboardTab }           from "./components/DashboardTab.jsx";
import { HostsTab }               from "./components/HostsTab.jsx";
import { ScanHistoryTab }         from "./components/ScanHistoryTab.jsx";
import { ChatWidget }             from "./components/ChatWidget.jsx";
import { UsersTab }               from "./components/UsersTab.jsx";

const TAB_TO_PATH = {
  dashboard: "/",
  hosts:     "/linux-inventory",
  windows:   "/windows-hosts",
  history:   "/scan-history",
  cves:      "/cve-advisories",
  settings:  "/settings",
  users:     "/users",
};
const PATH_TO_TAB = Object.fromEntries(Object.entries(TAB_TO_PATH).map(([k, v]) => [v, k]));
function tabFromUrl() { return PATH_TO_TAB[window.location.pathname] || "dashboard"; }

export default function App() {

  // ── ALL HOOKS MUST BE BEFORE ANY EARLY RETURNS ────────────────────────────

  // Auth state
  const [user,        setUser]        = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);

  // Tab state
  const [tab, setTab] = useState(() => tabFromUrl());

  // Data state
  const [latestScan,  setLatestScan]  = useState(null);
  const [history,     setHistory]     = useState([]);
  const [cves,        setCves]        = useState([]);
  const [cvesLoading, setCvesLoading] = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  // Scan state
  const [scanning,    setScanning]    = useState(false);
  const [scanId,      setScanId]      = useState(null);
  const [scanStatus,  setScanStatus]  = useState(null);
  const [winScanning, setWinScanning] = useState(false);
  const [winScanId,   setWinScanId]   = useState(null);
  const [winRecords,  setWinRecords]  = useState([]);

  // Inventory state
  const [inventoryCount,       setInventoryCount]       = useState(0);
  const [activeInventoryName,  setActiveInventoryName]  = useState(null);
  const [activeInventoryId,    setActiveInventoryId]    = useState(null);
  const [activeHasCredentials, setActiveHasCredentials] = useState(false);
  const [activeWindowsInv,     setActiveWindowsInv]     = useState(null);
  const [winCredsReady,        setWinCredsReady]        = useState(false);

  // UI state
  const [isCollapsed,          setIsCollapsed]          = useState(false); // Sidebar toggle state
  const [winCredsVersion,      setWinCredsVersion]      = useState(0);
  const [showWinCredsModal,    setShowWinCredsModal]    = useState(false);
  const [showHostsManager,     setShowHostsManager]     = useState(false);
  const [showInventoryManager, setShowInventoryManager] = useState(false);
  const [selectedScanId,       setSelectedScanId]       = useState(null);
  const [refreshing,           setRefreshing]           = useState(false);
  const [refreshedAt,          setRefreshedAt]          = useState(null);

  // Filter state
  const [search,             setSearch]             = useState("");
  const [sortCol,            setSortCol]            = useState("host");
  const [sortDir,            setSortDir]            = useState("asc");
  const [filterOS,           setFilterOS]           = useState("all");
  const [filterKernelStatus, setFilterKernelStatus] = useState("all");
  const [filterPatchStatus,  setFilterPatchStatus]  = useState("all");
  const [filterTag,          setFilterTag]          = useState("all");

  // Interval state
  const [intervalMinutes, setIntervalMinutes] = useState(180);
  const [intervalValue,   setIntervalValue]   = useState(3);
  const [intervalUnit,    setIntervalUnit]    = useState("hours");
  const [intervalSaving,  setIntervalSaving]  = useState(false);
  const [intervalSaved,   setIntervalSaved]   = useState(false);

  // Theme
  const { darkMode, toggle: toggleDark } = useTheme();

  // Pending registration count — admin only, polled every 30s
  const [pendingCount, setPendingCount] = useState(0);
  useEffect(() => {
    if (!user || user.role !== "admin") return;
    const fetch = () => apiFetch("/api/users/pending").then(p => setPendingCount(p.length)).catch(() => {});
    fetch();
    const iv = setInterval(fetch, 30000);
    return () => clearInterval(iv);
  }, [user]);

  // ── Auth bootstrap ────────────────────────────────────────────────────────
  useEffect(() => {
    setLogoutCallback(() => { setUser(null); clearToken(); });
    tryRefreshOnLoad().then(ok => {
      if (ok) {
        apiFetch("/api/auth/me")
          .then(me => setUser(me))
          .catch(() => setUser(null))
          .finally(() => setAuthLoading(false));
      } else {
        setAuthLoading(false);
      }
    });
  }, []);

  // ── Browser back/forward ──────────────────────────────────────────────────
  useEffect(() => {
    const onPop = () => setTab(tabFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchLatest = useCallback(async () => {
    try { const data = await apiFetch("/api/scans/latest"); setLatestScan(data); setError(null); }
    catch (e) { if (!e.message?.includes("404")) setError(e.message); }
    finally { setLoading(false); }
  }, []);

  const fetchHistory = useCallback(async () => {
    try { setHistory(await apiFetch("/api/scans/history")); } catch {}
  }, []);

  const fetchCves = useCallback(async () => {
    setCvesLoading(true);
    try { setCves(await apiFetch("/api/cves")); } catch {}
    finally { setCvesLoading(false); }
  }, []);

  const fetchInventoryInfo = useCallback(async () => {
    try { const d = await apiFetch("/api/hosts"); setInventoryCount(d.hosts?.length || 0); } catch {}
    try {
      const invs          = await apiFetch("/api/inventories");
      const activeLinux   = invs.find(i => i.is_active && (i.inventory_type === "linux" || !i.inventory_type));
      const activeWindows = invs.find(i => i.is_active && i.inventory_type === "windows");
      setActiveInventoryName(activeLinux?.name || null);
      setActiveInventoryId(activeLinux?.id || null);
      setActiveHasCredentials(activeLinux?.has_credentials || false);
      setActiveWindowsInv(activeWindows ? { name: activeWindows.name, host_count: activeWindows.host_count } : null);
    } catch {}
  }, []);

  const fetchWinCredsStatus = useCallback(async () => {
    try { const d = await apiFetch("/api/windows/credentials"); setWinCredsReady(d.has_credentials === true); }
    catch { setWinCredsReady(false); }
  }, []);

  const fetchWinLatest = useCallback(async () => {
    try { const data = await apiFetch("/api/scans/windows/latest"); setWinRecords(Array.isArray(data) ? data : []); }
    catch { setWinRecords([]); }
  }, []);

  // ── Initial load — only after auth ───────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    fetchLatest(); fetchHistory(); fetchInventoryInfo();
    fetchCves(); fetchWinCredsStatus(); fetchWinLatest();
    apiFetch("/api/scans/current")
      .then(d => { if (d.scanning) { setScanning(true); setScanId(d.scan_id); } })
      .catch(() => {});
    apiFetch("/api/scheduler/interval").then(d => {
      const mins = d.interval_minutes || 180;
      const { value, unit } = minutesToUnitValue(mins);
      setIntervalMinutes(mins); setIntervalValue(value); setIntervalUnit(unit);
    }).catch(() => {});
  }, [user]);

  useEffect(() => { if (user && tab === "cves") fetchCves(); }, [tab, user]);

  // ── Poll Linux scan ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!scanning || !scanId) return;
    const iv = setInterval(async () => {
      try {
        const s = await apiFetch(`/api/scans/${scanId}/status`);
        setScanStatus(s.status);
        if (s.status === "enriching") { await fetchLatest(); await fetchHistory(); }
        else if (s.status === "complete") {
          setScanning(false); setScanId(null); setScanStatus(null);
          await fetchLatest(); await fetchHistory(); await fetchCves();
        } else if (s.status?.startsWith("failed")) {
          setScanning(false); setScanId(null); setScanStatus(null);
          setError(`Scan failed: ${s.status}`); await fetchHistory();
        }
      } catch {}
    }, 4000);
    return () => clearInterval(iv);
  }, [scanning, scanId]);

  // ── Poll Windows scan ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!winScanning || !winScanId) return;
    const iv = setInterval(async () => {
      try {
        const s = await apiFetch(`/api/scans/${winScanId}/status`);
        if (s.status === "complete") { setWinScanning(false); setWinScanId(null); fetchWinLatest(); }
        else if (s.status?.startsWith("failed")) { setWinScanning(false); setWinScanId(null); setError(`Windows scan failed: ${s.status}`); }
      } catch {}
    }, 4000);
    return () => clearInterval(iv);
  }, [winScanning, winScanId]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const minutesToUnitValue = (mins) => {
    if (mins % 1440 === 0) return { value: mins / 1440, unit: "days" };
    if (mins % 60   === 0) return { value: mins / 60,   unit: "hours" };
    return { value: mins, unit: "minutes" };
  };
  const unitValueToMinutes = (value, unit) => {
    if (unit === "days")  return value * 1440;
    if (unit === "hours") return value * 60;
    return value;
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const changeTab = (t) => {
    setTab(t);
    window.history.pushState({ tab: t }, "", TAB_TO_PATH[t] || "/");
  };

  const handleLogin  = (userData) => setUser(userData);
  const handleLogout = async () => { await apiLogout(); setUser(null); };

  const saveInterval = async () => {
    const mins = unitValueToMinutes(intervalValue, intervalUnit);
    if (!mins || mins < 1) return;
    setIntervalSaving(true);
    try {
      await apiPost("/api/scheduler/interval", { interval_minutes: mins });
      setIntervalMinutes(mins); setIntervalSaved(true);
      setTimeout(() => setIntervalSaved(false), 2500);
    } catch {} finally { setIntervalSaving(false); }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchLatest(), fetchHistory(), fetchInventoryInfo(), fetchCves(), fetchWinCredsStatus(), fetchWinLatest()]);
    setRefreshing(false); setRefreshedAt(new Date());
    setTimeout(() => setRefreshedAt(null), 2500);
  };

  const triggerScan = async () => {
    if (inventoryCount === 0) { setError("No hosts in inventory."); return; }
    if (!activeHasCredentials) { setError("No SSH credentials set."); return; }
    try { setScanning(true); setError(null); const res = await apiPost("/api/scans/trigger"); setScanId(res.scan_id); }
    catch (e) { setScanning(false); setError(e.message); }
  };

  const triggerWindowsScan = async () => {
    if (!winCredsReady) { setError("No Windows credentials set."); return; }
    try {
      setWinScanning(true); setError(null);
      const res = await apiPost("/api/scans/trigger-windows");
      if (!res?.scan_id) throw new Error("No scan_id returned");
      setWinScanId(res.scan_id);
    } catch (e) { setWinScanning(false); setError("Windows scan failed: " + e.message); }
  };

  // ── CONDITIONAL RENDERS (after all hooks) ─────────────────────────────────

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a" }}>
        <div style={{ width: 36, height: 36, border: "3px solid #334155", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) {
    if (showRegister) return <RegisterPage onBackToLogin={() => setShowRegister(false)} />;
    return <LoginPage onLogin={handleLogin} onRegister={() => setShowRegister(true)} />;
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const hosts          = latestScan?.hosts || [];
  const totalHosts     = hosts.length;
  const outdatedHosts  = hosts.filter(h => kernelOutdated(h.current_kernel_version, h.latest_available_kernel_version)).length;
  const compliantHosts = totalHosts - outdatedHosts;
  const compliancePct  = totalHosts ? Math.round((compliantHosts / totalHosts) * 100) : 0;
  const complianceData = [
    { name: "Compliant", value: compliantHosts, color: "#10b981" },
    { name: "Outdated",  value: outdatedHosts,  color: "#ef4444" },
  ];
  const topPackages = (() => {
    const counts = {};
    hosts.forEach(h => (h.pending_security_packages || []).forEach(p => {
      const name = p.split("-")[0]; counts[name] = (counts[name] || 0) + 1;
    }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));
  })();

  const filteredHosts = hosts.filter(h => {
    const matchSearch = h.host.toLowerCase().includes(search.toLowerCase()) ||
      (h.current_kernel_version || "").toLowerCase().includes(search.toLowerCase()) ||
      (h.os_version || "").toLowerCase().includes(search.toLowerCase());
    const matchOS     = filterOS === "all" || osFamily(h.os_version) === filterOS;
    const isOutdated  = kernelOutdated(h.current_kernel_version, h.latest_available_kernel_version);
    const matchKernel = filterKernelStatus === "all" || (filterKernelStatus === "outdated" && isOutdated) || (filterKernelStatus === "uptodate" && !isOutdated);
    const pkgCount    = h.pending_security_packages?.length || 0;
    const matchPatch  = filterPatchStatus === "all" || (filterPatchStatus === "dirty" && pkgCount > 0) || (filterPatchStatus === "clean" && pkgCount === 0);
    const matchTag    = filterTag === "all" || (h.tags || []).includes(filterTag);
    return matchSearch && matchOS && matchKernel && matchPatch && matchTag;
  }).sort((a, b) => {
    let av = a[sortCol] || "", bv = b[sortCol] || "";
    if (sortCol === "package_count") { av = a.pending_security_packages?.length || 0; bv = b.pending_security_packages?.length || 0; }
    if (typeof av === "number") return sortDir === "asc" ? av - bv : bv - av;
    return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const activeFilterCount = [filterOS !== "all", filterKernelStatus !== "all", filterPatchStatus !== "all", filterTag !== "all"].filter(Boolean).length;
  const clearFilters = () => { setFilterOS("all"); setFilterKernelStatus("all"); setFilterPatchStatus("all"); setFilterTag("all"); setSearch(""); };
  const sortBy = (col) => {
    if (!col) return;
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const scanDisabled    = scanning || winScanning || inventoryCount === 0 || !activeHasCredentials;
  const winScanDisabled = scanning || winScanning || !winCredsReady;
  const scanTooltip     = inventoryCount === 0 ? "No hosts — upload an inventory first" : !activeHasCredentials ? "Set SSH credentials before scanning" : "";
  const winScanTooltip  = !winCredsReady ? "Set Windows credentials in Settings first" : scanning || winScanning ? "A scan is already in progress" : "";
  const criticalCount   = cves.filter(c => c.severity === "Critical").length;
  const importantCount  = cves.filter(c => c.severity === "Important").length;

  const tabTitle = { dashboard: "Overview", hosts: "Linux Inventory", windows: "Windows Hosts", history: "Scan History", cves: "CVE Advisories", settings: "Settings", users: "User Management" }[tab] || "Overview";

  const filterProps = {
    hosts, filteredHosts, totalHosts, activeFilterCount, clearFilters,
    filterOS, setFilterOS, filterKernelStatus, setFilterKernelStatus,
    filterPatchStatus, setFilterPatchStatus, filterTag, setFilterTag,
    search, setSearch, sortCol, sortDir, sortBy,
  };

  // Sidebar dynamic width variable
  const currentSidebarWidth = isCollapsed ? 76 : 250;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", overflowX: "hidden" }}>

      {/* ── SIDEBAR ── */}
      <div style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: currentSidebarWidth, background: "#0f172a", display: "flex", flexDirection: "column", borderRight: "1px solid #1e293b", zIndex: 50, transition: "width 0.2s ease-in-out" }}>
        
        {/* Header & Logo */}
        <div style={{ padding: "20px 16px", borderBottom: "1px solid #1e293b", position: "relative" }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: isCollapsed ? "8px" : "8px 12px", display: "flex", alignItems: "center", justifyContent: "center", height: 44, transition: "padding 0.2s" }}>
            {isCollapsed ? (
              <span style={{ fontWeight: 800, fontSize: 20, color: "#1e3a8a" }}>K</span>
            ) : (
              <img src="/kernexa.png" alt="Kernexa" style={{ width: "100%", maxHeight: 40, objectFit: "contain" }} />
            )}
          </div>
          {!isCollapsed && (
            <div style={{ textAlign: "center", color: "#475569", fontSize: 10, letterSpacing: "0.05em", marginTop: 8, whiteSpace: "nowrap" }}>Security Compliance Platform</div>
          )}
          
          {/* Toggle Button */}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            style={{ position: "absolute", top: 32, right: -12, background: "#3b82f6", border: "none", color: "#fff", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 4px rgba(0,0,0,0.2)", zIndex: 60 }}
          >
            {isCollapsed ? "›" : "‹"}
          </button>
        </div>

        {/* Navigation */}
        <nav style={{ padding: "16px 12px", flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {[
            { id: "dashboard", label: "Dashboard",       icon: "host"    },
            { id: "hosts",     label: "Linux Inventory", icon: "kernel"  },
            { id: "windows",   label: "Windows Hosts",   icon: "servers" },
            { id: "history",   label: "Scan History",    icon: "history" },
          ].map(item => (
            <button key={item.id} title={isCollapsed ? item.label : ""} onClick={() => changeTab(item.id)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "none", display: "flex", alignItems: "center", justifyContent: isCollapsed ? "center" : "flex-start", gap: 10, cursor: "pointer", marginBottom: 4, fontFamily: "inherit", fontSize: 13, fontWeight: 500, background: tab === item.id ? "#1e293b" : "transparent", color: tab === item.id ? "#f8fafc" : "#64748b", transition: "all 0.15s" }}>
              <Icon d={Icons[item.icon]} size={16} color={tab === item.id ? "#3b82f6" : "#475569"} />
              {!isCollapsed && <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>}
            </button>
          ))}

          <button title={isCollapsed ? "CVE Advisories" : ""} onClick={() => changeTab("cves")} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "none", display: "flex", alignItems: "center", justifyContent: isCollapsed ? "center" : "space-between", cursor: "pointer", marginBottom: 4, fontFamily: "inherit", fontSize: 13, fontWeight: 500, background: tab === "cves" ? "#1e293b" : "transparent", color: tab === "cves" ? "#f8fafc" : "#64748b", transition: "all 0.15s", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon d={Icons.warning} size={16} color={tab === "cves" ? "#3b82f6" : "#475569"} />
              {!isCollapsed && <span style={{ whiteSpace: "nowrap" }}>CVE Advisories</span>}
            </div>
            {(criticalCount + importantCount) > 0 && (
              isCollapsed 
                ? <span style={{ position: "absolute", top: 8, right: 8, width: 8, height: 8, background: "#dc2626", borderRadius: "50%" }} />
                : <span style={{ background: "#dc2626", color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999 }}>{criticalCount + importantCount}</span>
            )}
          </button>

          <button title={isCollapsed ? "Settings" : ""} onClick={() => changeTab("settings")} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "none", display: "flex", alignItems: "center", justifyContent: isCollapsed ? "center" : "flex-start", gap: 10, cursor: "pointer", marginBottom: 4, fontFamily: "inherit", fontSize: 13, fontWeight: 500, background: tab === "settings" ? "#1e293b" : "transparent", color: tab === "settings" ? "#f8fafc" : "#64748b", transition: "all 0.15s" }}>
            <Icon d={Icons.key} size={16} color={tab === "settings" ? "#3b82f6" : "#475569"} />
            {!isCollapsed && <span style={{ whiteSpace: "nowrap" }}>Settings</span>}
          </button>

          {/* User Management — admin only */}
          {user?.role === "admin" && (
            <button title={isCollapsed ? "User Management" : ""} onClick={() => changeTab("users")} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "none", display: "flex", alignItems: "center", justifyContent: isCollapsed ? "center" : "space-between", cursor: "pointer", marginBottom: 4, fontFamily: "inherit", fontSize: 13, fontWeight: 500, background: tab === "users" ? "#1e293b" : "transparent", color: tab === "users" ? "#f8fafc" : "#64748b", transition: "all 0.15s", position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tab === "users" ? "#3b82f6" : "#475569"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                {!isCollapsed && <span style={{ whiteSpace: "nowrap" }}>User Management</span>}
              </div>
              {pendingCount > 0 && (
                isCollapsed 
                  ? <span style={{ position: "absolute", top: 8, right: 8, width: 8, height: 8, background: "#f59e0b", borderRadius: "50%" }} />
                  : <span style={{ background: "#f59e0b", color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999 }}>{pendingCount}</span>
              )}
            </button>
          )}

          <div style={{ borderTop: "1px solid #1e293b", margin: "12px 0" }} />

          {[
            { label: "Inventories",  icon: "file",    badge: (activeInventoryName || activeWindowsInv) ? "active" : null, onClick: () => setShowInventoryManager(true) },
            { label: "Manage Hosts", icon: "servers", badge: inventoryCount > 0 ? String(inventoryCount) : null,          onClick: () => setShowHostsManager(true) },
          ].map(item => (
            <button key={item.label} title={isCollapsed ? item.label : ""} onClick={item.onClick} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "none", display: "flex", alignItems: "center", justifyContent: isCollapsed ? "center" : "space-between", cursor: "pointer", marginBottom: 4, fontFamily: "inherit", fontSize: 13, fontWeight: 500, background: "transparent", color: "#64748b", transition: "all 0.15s", position: "relative" }}
              onMouseEnter={e => e.currentTarget.style.background = "#1e293b"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon d={Icons[item.icon]} size={16} color="#475569" />
                {!isCollapsed && <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>}
              </div>
              {item.badge && !isCollapsed && <span style={{ background: "#1e3a5f", color: "#93c5fd", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999 }}>{item.badge}</span>}
              {item.badge && isCollapsed && <span style={{ position: "absolute", top: 8, right: 8, width: 6, height: 6, background: "#3b82f6", borderRadius: "50%" }} />}
            </button>
          ))}

          {!isCollapsed && (activeInventoryName || activeWindowsInv) && (
            <div style={{ margin: "8px 4px 0", display: "flex", flexDirection: "column", gap: 6 }}>
              {activeInventoryName && (
                <div style={{ padding: "10px 12px", background: "#0f2d1f", borderRadius: 8, border: "1px solid #166534" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                    <div style={{ fontSize: 10, color: "#4ade80", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>🐧 Linux</div>
                    <span style={{ fontSize: 9, color: "#166534", background: "#14532d", padding: "1px 6px", borderRadius: 999, fontWeight: 600 }}>ACTIVE</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#86efac", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeInventoryName}</div>
                  <div style={{ fontSize: 10, color: "#166534", marginTop: 1 }}>{inventoryCount} host{inventoryCount !== 1 ? "s" : ""}</div>
                  <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 4 }}>
                    {activeHasCredentials
                      ? <><Icon d={Icons.check} size={11} color="#4ade80" /><span style={{ fontSize: 10, color: "#4ade80" }}>SSH credentials set</span></>
                      : <><Icon d={Icons.warning} size={11} color="#fb923c" /><button onClick={() => setShowInventoryManager(true)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#fb923c", textDecoration: "underline", padding: 0, fontFamily: "inherit", whiteSpace: "nowrap" }}>Set SSH credentials</button></>}
                  </div>
                </div>
              )}
              {activeWindowsInv && (
                <div style={{ padding: "10px 12px", background: "#0f1f3d", borderRadius: 8, border: "1px solid #1e3a5f" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                    <div style={{ fontSize: 10, color: "#93c5fd", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>🪟 Windows</div>
                    <span style={{ fontSize: 9, background: "#172554", padding: "1px 6px", borderRadius: 999, fontWeight: 600, color: "#60a5fa" }}>ACTIVE</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#bfdbfe", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeWindowsInv.name}</div>
                  <div style={{ fontSize: 10, color: "#3b82f6", marginTop: 1 }}>{activeWindowsInv.host_count} host{activeWindowsInv.host_count !== 1 ? "s" : ""}</div>
                  <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 4 }}>
                    {winCredsReady
                      ? <><Icon d={Icons.check} size={11} color="#4ade80" /><span style={{ fontSize: 10, color: "#4ade80" }}>WinRM credentials set</span></>
                      : <><Icon d={Icons.warning} size={11} color="#fbbf24" /><button onClick={() => changeTab("settings")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#fbbf24", textDecoration: "underline", padding: 0, fontFamily: "inherit", whiteSpace: "nowrap" }}>Set WinRM credentials</button></>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dark mode toggle + Sign out — pinned to bottom of sidebar */}
          <div style={{ borderTop: "1px solid #1e293b", marginTop: 16, paddingTop: 12 }}>
            {isCollapsed ? (
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }} title={user?.username}>
                  {user?.username?.[0]?.toUpperCase() || "?"}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", marginBottom: 4 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                  {user?.username?.[0]?.toUpperCase() || "?"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.username}</div>
                  <div style={{ fontSize: 10, color: "#475569", textTransform: "capitalize" }}>{user?.role}</div>
                </div>
              </div>
            )}
            
            {/* Dark mode toggle */}
            <button
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              onClick={toggleDark}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #1e293b", background: "transparent", cursor: "pointer", fontSize: 12, color: "#64748b", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: isCollapsed ? "center" : "space-between", gap: 8, transition: "all 0.15s", marginBottom: 4 }}
              onMouseEnter={e => { e.currentTarget.style.background = "#1e293b"; e.currentTarget.style.color = "#f1f5f9"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#64748b"; }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {darkMode ? (
                  /* Sun icon */
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                ) : (
                  /* Moon icon */
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                )}
                {!isCollapsed && <span style={{ whiteSpace: "nowrap" }}>{darkMode ? "Light mode" : "Dark mode"}</span>}
              </div>
              {!isCollapsed && (
                <div style={{
                  width: 32, height: 18, borderRadius: 9, border: "1px solid #334155",
                  background: darkMode ? "#3b82f6" : "#1e293b",
                  position: "relative", transition: "background 0.2s",
                  flexShrink: 0,
                }}>
                  <div style={{
                    position: "absolute", top: 2, left: darkMode ? 15 : 2,
                    width: 12, height: 12, borderRadius: "50%",
                    background: "#fff", transition: "left 0.2s",
                  }} />
                </div>
              )}
            </button>

            <button title={isCollapsed ? "Sign out" : ""} onClick={handleLogout}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #1e293b", background: "transparent", cursor: "pointer", fontSize: 12, color: "#64748b", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: isCollapsed ? "center" : "flex-start", gap: 8, transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#1e293b"; e.currentTarget.style.color = "#f87171"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#64748b"; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              {!isCollapsed && <span style={{ whiteSpace: "nowrap" }}>Sign out</span>}
            </button>
          </div>

        </nav>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ marginLeft: currentSidebarWidth, padding: "32px", minHeight: "100vh", width: `calc(100vw - ${currentSidebarWidth}px)`, transition: "margin-left 0.2s ease-in-out, width 0.2s ease-in-out, background 0.2s ease" }}>

        {/* Topbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>{tabTitle}</h1>
            {latestScan && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Last scan: {fmtDate(latestScan.scanned_at)}</div>}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10 }}>
              <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>Auto-scan every</span>
              <input type="number" min={1} max={999} value={intervalValue} onChange={e => setIntervalValue(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: 52, padding: "5px 0", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "inherit", textAlign: "center", background: "var(--bg-card)", outline: "none" }} />
              <div style={{ display: "flex", background: "var(--bg-subtle)", borderRadius: 8, padding: 3, gap: 2 }}>
                {["minutes", "hours", "days"].map(u => (
                  <button key={u} onClick={() => setIntervalUnit(u)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: intervalUnit === u ? "var(--bg-card)" : "transparent", color: intervalUnit === u ? "var(--text-primary)" : "var(--text-ghost)", fontSize: 12, fontWeight: intervalUnit === u ? 700 : 500, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>{u}</button>
                ))}
              </div>
              <button onClick={saveInterval} disabled={intervalSaving} style={{ padding: "5px 14px", borderRadius: 8, border: "none", background: intervalSaved ? "linear-gradient(135deg,#22c55e,#16a34a)" : "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: intervalSaving ? "not-allowed" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap", opacity: intervalSaving ? 0.7 : 1 }}>
                {intervalSaving ? "Saving…" : intervalSaved ? "✓ Saved" : "Save"}
              </button>
              {!intervalSaved && <span style={{ fontSize: 11, color: "#cbd5e1" }}>· now: {minutesToUnitValue(intervalMinutes).value} {minutesToUnitValue(intervalMinutes).unit}</span>}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {/* Greeting */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)" }}>
              <span>👋</span>
              <span>Hi, <strong style={{ textTransform: "capitalize" }}>{user?.username}</strong></span>
              <span style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--bg-hover)", border: "1px solid var(--border)", padding: "1px 7px", borderRadius: 999, textTransform: "capitalize", marginLeft: 2 }}>{user?.role}</span>
            </div>

            <button onClick={handleRefresh} disabled={refreshing} style={{ padding: "8px 14px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-card)", cursor: refreshing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: refreshing ? "var(--text-ghost)" : "var(--text-muted)", fontFamily: "inherit" }}>
              <div style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none", display: "flex" }}>
                <Icon d={Icons.refresh} size={13} color={refreshing ? "#94a3b8" : "#475569"} />
              </div>
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            {latestScan && (
              <button onClick={() => exportToCSV(latestScan)} style={{ padding: "8px 14px", border: "1px solid #3b82f6", borderRadius: 8, background: "#eff6ff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#2563eb", fontWeight: 600, fontFamily: "inherit" }}>
                <Icon d={Icons.export} size={13} color="#2563eb" /> Export CSV
              </button>
            )}

            <button onClick={triggerWindowsScan} disabled={winScanDisabled} title={winScanTooltip}
              style={{ padding: "8px 0", borderRadius: 8, border: "none", background: winScanDisabled ? "#e2e8f0" : "linear-gradient(135deg,#0ea5e9,#6366f1)", color: winScanDisabled ? "#94a3b8" : "#fff", fontWeight: 700, fontSize: 12, cursor: winScanDisabled ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: 130, boxShadow: winScanDisabled ? "none" : "0 2px 8px rgba(14,165,233,0.35)" }}>
              {winScanning ? <><div style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Scanning...</> : <>🪟 Win Scan</>}
            </button>

            <button onClick={triggerScan} disabled={scanDisabled} title={scanTooltip}
              style={{ padding: "8px 0", borderRadius: 8, border: "none", background: scanDisabled ? "#e2e8f0" : "linear-gradient(135deg,#3b82f6,#6366f1)", color: scanDisabled ? "#94a3b8" : "#fff", fontWeight: 700, fontSize: 12, cursor: scanDisabled ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: 130, boxShadow: scanDisabled ? "none" : "0 2px 8px rgba(59,130,246,0.35)" }}>
              {scanning ? <><div style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Scanning...</> : <><Icon d={Icons.scan} size={13} color={scanDisabled ? "#94a3b8" : "#fff"} />Linux Scan</>}
            </button>
          </div>
        </div>

        {/* Status hints */}
        {scanning    && <div style={{ fontSize: 11, color: "#64748b", textAlign: "right", marginTop: -20, marginBottom: 16, animation: "pulse 2s infinite" }}>{scanStatus === "enriching" ? "⚡ Enriching CVE data..." : "🐧 Linux Ansible playbook running..."}</div>}
        {winScanning && <div style={{ fontSize: 11, color: "#0ea5e9", textAlign: "right", marginTop: -20, marginBottom: 16, animation: "pulse 2s infinite" }}>🪟 Windows Ansible playbook running...</div>}

        {/* Banners */}
        {activeInventoryName && !activeHasCredentials && !error && (
          <div style={{ background: "var(--orange-tint)", border: "1px solid var(--orange-border)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "var(--orange)", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon d={Icons.key} size={16} color="var(--orange)" /><span>SSH credentials not set for <strong>{activeInventoryName}</strong>.</span></div>
            <button onClick={() => setShowInventoryManager(true)} style={{ background: "var(--orange)", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", marginLeft: 12, whiteSpace: "nowrap" }}>Set Credentials</button>
          </div>
        )}
        {error && (
          <div style={{ background: "var(--red-tint)", border: "1px solid var(--red-border)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "var(--red)", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon d={Icons.warning} size={16} color="var(--red)" />{error}</div>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer" }}><Icon d={Icons.close} size={14} color="#dc2626" /></button>
          </div>
        )}

        {/* Tab content */}
        {tab === "cves"     && <CveTab cves={cves} loading={cvesLoading} />}
        {tab === "windows"  && <div style={{ animation: "fadeIn 0.3s ease" }}><WindowsTab /></div>}
        {tab === "settings" && <div style={{ animation: "fadeIn 0.3s ease" }}><SettingsTab key={winCredsVersion} onWinCredsSaved={fetchWinCredsStatus} onShowWinCreds={() => setShowWinCredsModal(true)} /></div>}
        {tab === "users"    && user?.role === "admin" && <UsersTab currentUser={user} />}

        {tab !== "cves" && tab !== "settings" && tab !== "windows" && tab !== "users" && (
          loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
              <div style={{ width: 32, height: 32, border: "3px solid #e2e8f0", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            </div>
          ) : !latestScan && winRecords.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 32px", background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)" }}>
              <Icon d={Icons.scan} size={48} color="var(--text-disabled)" />
              <div style={{ marginTop: 16, fontSize: 18, fontWeight: 700, color: "var(--text-secondary)" }}>No scan data yet</div>
              <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 6, marginBottom: 20 }}>
                {inventoryCount === 0 ? "Upload an inventory file, set credentials and run a scan"
                  : !activeHasCredentials ? `${inventoryCount} hosts ready — set SSH credentials first`
                  : `${inventoryCount} hosts ready — click Linux Scan to start`}
              </div>
              {inventoryCount === 0
                ? <button onClick={() => setShowInventoryManager(true)} style={{ padding: "10px 20px", background: "#0f172a", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8 }}><Icon d={Icons.upload} size={14} color="#fff" /> Upload Inventory</button>
                : !activeHasCredentials ? <button onClick={() => setShowInventoryManager(true)} style={{ padding: "10px 20px", background: "#c2410c", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8 }}><Icon d={Icons.key} size={14} color="#fff" /> Set SSH Credentials</button>
                : null}
            </div>
          ) : (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              {tab === "dashboard" && <DashboardTab {...filterProps} compliantHosts={compliantHosts} outdatedHosts={outdatedHosts} compliancePct={compliancePct} complianceData={complianceData} topPackages={topPackages} winRecords={winRecords} cves={cves} changeTab={changeTab} showInventoryManager={showInventoryManager} setShowInventoryManager={setShowInventoryManager} />}
              {tab === "hosts"     && <HostsTab {...filterProps} />}
              {tab === "history"   && <ScanHistoryTab history={history} onSelectScan={setSelectedScanId} />}
            </div>
          )
        )}
      </div>

      {/* Modals */}
      {showHostsManager     && <HostsManager     onClose={() => setShowHostsManager(false)} onSaved={fetchInventoryInfo} />}
      {showInventoryManager && <InventoryManager onClose={() => { setShowInventoryManager(false); fetchInventoryInfo(); }} onActivated={fetchInventoryInfo} />}
      {selectedScanId       && <ScanFailuresModal scanId={selectedScanId} onClose={() => setSelectedScanId(null)} />}
      {showWinCredsModal    && <WindowsCredentialsForm onClose={() => { setShowWinCredsModal(false); fetchWinCredsStatus(); setWinCredsVersion(v => v + 1); }} />}

      {/* Refresh toast */}
      {refreshedAt && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 999, background: "#0f172a", color: "#4ade80", padding: "10px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.2)", animation: "fadeIn 0.2s ease" }}>
          <Icon d={Icons.check} size={13} color="#4ade80" />
          Refreshed at {refreshedAt.toLocaleTimeString()}
        </div>
      )}

      <ChatWidget />
    </div>
  );
}