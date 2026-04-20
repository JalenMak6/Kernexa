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

  // Auth state
  const [user,         setUser]         = useState(null);
  const [authLoading,  setAuthLoading]  = useState(true);
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
  const [isCollapsed,          setIsCollapsed]          = useState(false);
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

  // Pending registration count — admin only
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

  useEffect(() => {
    if (!scanning || !scanId) return;
    const iv = setInterval(async () => {
      try {
        const s = await apiFetch(`/api/scans/${scanId}/status`);
        setScanStatus(s.status);
        if (s.status === "enriching") { await fetchLatest(); await fetchHistory(); }
        else if (s.status === "complete") { setScanning(false); setScanId(null); setScanStatus(null); await fetchLatest(); await fetchHistory(); await fetchCves(); }
        else if (s.status?.startsWith("failed")) { setScanning(false); setScanId(null); setScanStatus(null); setError(`Scan failed: ${s.status}`); await fetchHistory(); }
      } catch {}
    }, 4000);
    return () => clearInterval(iv);
  }, [scanning, scanId]);

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

  const changeTab = (t) => { setTab(t); window.history.pushState({ tab: t }, "", TAB_TO_PATH[t] || "/"); };
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

  // ── Conditional renders (after all hooks) ─────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
        <div className="w-9 h-9 border-[3px] border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
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

  const currentSidebarWidth = isCollapsed ? 76 : 250;

  // ── Sidebar nav item helper ────────────────────────────────────────────────
  const navItemCls = (active) =>
    `w-full px-3 py-[10px] rounded-lg border-none flex items-center gap-2.5 cursor-pointer mb-1 font-[inherit] text-md font-medium transition-all duration-150
     ${active ? "bg-slate-800 text-slate-50" : "bg-transparent text-slate-500 hover:bg-slate-800 hover:text-slate-200"}`;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-bg-page overflow-x-hidden" style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>

      {/* ── SIDEBAR ── */}
      <div className="fixed left-0 top-0 bottom-0 flex flex-col border-r z-[50] transition-[width] duration-200 ease-in-out"
        style={{ width: currentSidebarWidth, background: "#0f172a", borderColor: "#1e293b" }}>

        {/* Logo */}
        <div className="px-4 py-5 relative" style={{ borderBottom: "1px solid #1e293b" }}>
          <div className="rounded-[10px] flex items-center justify-center h-11 bg-white transition-[padding] duration-200"
            style={{ padding: isCollapsed ? "8px" : "8px 12px" }}>
            {isCollapsed
              ? <span className="font-extrabold text-xl text-blue-900">K</span>
              : <img src="/kermonix.png" alt="Kermonix" className="w-full max-h-10 object-contain" />
            }
          </div>
          {!isCollapsed && (
            <div className="text-center text-slate-500 text-[10px] tracking-[0.05em] mt-2 whitespace-nowrap">Security Compliance Platform</div>
          )}
          <button onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute top-8 -right-3 bg-blue-500 border-none text-white rounded-full w-6 h-6 flex items-center justify-center cursor-pointer z-[60]"
            style={{ boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}>
            {isCollapsed ? "›" : "‹"}
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-4 flex-1 overflow-y-auto overflow-x-hidden">
          {[
            { id: "dashboard", label: "Dashboard",       icon: "host"    },
            { id: "hosts",     label: "Linux Inventory", icon: "kernel"  },
            { id: "windows",   label: "Windows Hosts",   icon: "servers" },
            { id: "history",   label: "Scan History",    icon: "history" },
          ].map(item => (
            <button key={item.id} title={isCollapsed ? item.label : ""}
              onClick={() => changeTab(item.id)}
              className={`${navItemCls(tab === item.id)} ${isCollapsed ? "justify-center" : "justify-start"}`}>
              <Icon d={Icons[item.icon]} size={16} color={tab === item.id ? "#3b82f6" : "#475569"} />
              {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
            </button>
          ))}

          {/* CVE Advisories */}
          <button title={isCollapsed ? "CVE Advisories" : ""} onClick={() => changeTab("cves")}
            className={`${navItemCls(tab === "cves")} relative ${isCollapsed ? "justify-center" : "justify-between"}`}>
            <div className="flex items-center gap-2.5">
              <Icon d={Icons.warning} size={16} color={tab === "cves" ? "#3b82f6" : "#475569"} />
              {!isCollapsed && <span className="whitespace-nowrap">CVE Advisories</span>}
            </div>
            {(criticalCount + importantCount) > 0 && (
              isCollapsed
                ? <span className="absolute top-2 right-2 w-2 h-2 bg-red-600 rounded-full" />
                : <span className="bg-red-600 text-white text-[10px] font-bold px-[7px] py-px rounded-pill">{criticalCount + importantCount}</span>
            )}
          </button>

          {/* Settings */}
          <button title={isCollapsed ? "Settings" : ""} onClick={() => changeTab("settings")}
            className={`${navItemCls(tab === "settings")} ${isCollapsed ? "justify-center" : "justify-start"}`}>
            <Icon d={Icons.key} size={16} color={tab === "settings" ? "#3b82f6" : "#475569"} />
            {!isCollapsed && <span className="whitespace-nowrap">Settings</span>}
          </button>

          {/* User Management — admin only */}
          {user?.role === "admin" && (
            <button title={isCollapsed ? "User Management" : ""} onClick={() => changeTab("users")}
              className={`${navItemCls(tab === "users")} relative ${isCollapsed ? "justify-center" : "justify-between"}`}>
              <div className="flex items-center gap-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tab === "users" ? "#3b82f6" : "#475569"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                {!isCollapsed && <span className="whitespace-nowrap">User Management</span>}
              </div>
              {pendingCount > 0 && (
                isCollapsed
                  ? <span className="absolute top-2 right-2 w-2 h-2 bg-amber-400 rounded-full" />
                  : <span className="bg-amber-400 text-white text-[10px] font-bold px-[7px] py-px rounded-pill">{pendingCount}</span>
              )}
            </button>
          )}

          <div className="my-3" style={{ borderTop: "1px solid #1e293b" }} />

          {/* Inventories + Manage Hosts */}
          {[
            { label: "Inventories",  icon: "file",    badge: (activeInventoryName || activeWindowsInv) ? "active" : null, onClick: () => setShowInventoryManager(true) },
            { label: "Manage Hosts", icon: "servers", badge: inventoryCount > 0 ? String(inventoryCount) : null,          onClick: () => setShowHostsManager(true) },
          ].map(item => (
            <button key={item.label} title={isCollapsed ? item.label : ""} onClick={item.onClick}
              className={`w-full px-3 py-[10px] rounded-lg border-none flex items-center gap-2.5 cursor-pointer mb-1 font-[inherit] text-md font-medium transition-all duration-150 bg-transparent text-slate-500 hover:bg-slate-800 hover:text-slate-200 relative
                ${isCollapsed ? "justify-center" : "justify-between"}`}>
              <div className="flex items-center gap-2.5">
                <Icon d={Icons[item.icon]} size={16} color="#475569" />
                {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
              </div>
              {item.badge && !isCollapsed && (
                <span className="text-[10px] font-bold px-[7px] py-px rounded-pill"
                  style={{ background: "#1e3a5f", color: "#93c5fd" }}>{item.badge}</span>
              )}
              {item.badge && isCollapsed && (
                <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-blue-500 rounded-full" />
              )}
            </button>
          ))}

          {/* Active inventory cards */}
          {!isCollapsed && (activeInventoryName || activeWindowsInv) && (
            <div className="mt-2 mx-1 flex flex-col gap-1.5">
              {activeInventoryName && (
                <div className="px-3 py-[10px] rounded-lg border" style={{ background: "#0f2d1f", borderColor: "#1a5c32" }}>
                  <div className="flex justify-between items-center mb-0.5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.05em]" style={{ color: "#4ade80" }}>🐧 Linux</div>
                    <span className="text-[9px] font-semibold px-1.5 py-px rounded-pill" style={{ background: "#14532d", color: "#4ade80" }}>ACTIVE</span>
                  </div>
                  <div className="text-sm font-medium overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: "#f0fdf4" }}>{activeInventoryName}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "#86efac" }}>{inventoryCount} host{inventoryCount !== 1 ? "s" : ""}</div>
                  <div className="mt-1 flex items-center gap-1">
                    {activeHasCredentials
                      ? <><Icon d={Icons.check} size={11} color="#4ade80" /><span className="text-[10px]" style={{ color: "#4ade80" }}>SSH credentials set</span></>
                      : <><Icon d={Icons.warning} size={11} color="#fb923c" /><button onClick={() => setShowInventoryManager(true)} className="bg-transparent border-none cursor-pointer text-[10px] underline font-[inherit] whitespace-nowrap" style={{ color: "#fb923c" }}>Set SSH credentials</button></>}
                  </div>
                </div>
              )}
              {activeWindowsInv && (
                <div className="px-3 py-[10px] rounded-lg border" style={{ background: "#0f1f3d", borderColor: "#1e3a5f" }}>
                  <div className="flex justify-between items-center mb-0.5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.05em]" style={{ color: "#93c5fd" }}>🪟 Windows</div>
                    <span className="text-[9px] font-semibold px-1.5 py-px rounded-pill" style={{ background: "#172554", color: "#bfdbfe" }}>ACTIVE</span>
                  </div>
                  <div className="text-sm font-medium overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: "#eff6ff" }}>{activeWindowsInv.name}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "#93c5fd" }}>{activeWindowsInv.host_count} host{activeWindowsInv.host_count !== 1 ? "s" : ""}</div>
                  <div className="mt-1 flex items-center gap-1">
                    {winCredsReady
                      ? <><Icon d={Icons.check} size={11} color="#4ade80" /><span className="text-[10px]" style={{ color: "#4ade80" }}>WinRM credentials set</span></>
                      : <><Icon d={Icons.warning} size={11} color="#fbbf24" /><button onClick={() => changeTab("settings")} className="bg-transparent border-none cursor-pointer text-[10px] underline font-[inherit] whitespace-nowrap" style={{ color: "#fbbf24" }}>Set WinRM credentials</button></>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom: user + dark mode + sign out */}
          <div className="mt-4 pt-3" style={{ borderTop: "1px solid #1e293b" }}>
            {isCollapsed ? (
              <div className="flex justify-center mb-3">
                <div className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }} title={user?.username}>
                  {user?.username?.[0]?.toUpperCase() || "?"}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
                <div className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                  {user?.username?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold overflow-hidden text-ellipsis whitespace-nowrap text-slate-100">{user?.username}</div>
                  <div className="text-[10px] capitalize text-slate-500">{user?.role}</div>
                </div>
              </div>
            )}

            {/* Dark mode toggle */}
            <button title={darkMode ? "Switch to light mode" : "Switch to dark mode"} onClick={toggleDark}
              className={`w-full px-3 py-[9px] rounded-lg border border-slate-800 bg-transparent cursor-pointer text-sm text-slate-500 font-[inherit] gap-2 transition-all duration-150 mb-1 hover:bg-slate-800 hover:text-slate-100
                ${isCollapsed ? "flex items-center justify-center" : "flex items-center justify-between"}`}>
              <div className="flex items-center gap-2">
                {darkMode ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                )}
                {!isCollapsed && <span className="whitespace-nowrap">{darkMode ? "Light mode" : "Dark mode"}</span>}
              </div>
              {!isCollapsed && (
                <div className="w-8 h-[18px] rounded-[9px] border border-slate-700 relative transition-colors duration-200 shrink-0"
                  style={{ background: darkMode ? "#3b82f6" : "#1e293b" }}>
                  <div className="absolute top-[2px] w-3 h-3 rounded-full bg-white transition-all duration-200"
                    style={{ left: darkMode ? 15 : 2 }} />
                </div>
              )}
            </button>

            {/* Sign out */}
            <button title={isCollapsed ? "Sign out" : ""} onClick={handleLogout}
              className={`w-full px-3 py-[9px] rounded-lg border border-slate-800 bg-transparent cursor-pointer text-sm text-slate-500 font-[inherit] gap-2 transition-all duration-150 hover:bg-slate-800 hover:text-red-400
                ${isCollapsed ? "flex items-center justify-center" : "flex items-center"}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              {!isCollapsed && <span className="whitespace-nowrap">Sign out</span>}
            </button>
          </div>
        </nav>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="p-8 min-h-screen transition-[margin-left,width] duration-200 ease-in-out"
        style={{ marginLeft: currentSidebarWidth, width: `calc(100vw - ${currentSidebarWidth}px)` }}>

        {/* Topbar */}
        <div className="flex justify-between items-start mb-7">
          <div>
            <h1 className="text-3xl font-extrabold text-text-primary">{tabTitle}</h1>
            {latestScan && <div className="text-sm text-slate-400 mt-0.5">Last scan: {fmtDate(latestScan.scanned_at)}</div>}
            <div className="inline-flex items-center gap-1.5 mt-2.5">
              <span className="text-sm text-slate-400 font-medium">Auto-scan every</span>
              <input type="number" min={1} max={999} value={intervalValue}
                onChange={e => setIntervalValue(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-[52px] py-[5px] border-[1.5px] border-border-base rounded-base text-base font-bold text-text-primary font-[inherit] text-center bg-bg-card outline-none" />
              <div className="flex bg-bg-subtle rounded-base p-[3px] gap-0.5">
                {["minutes", "hours", "days"].map(u => (
                  <button key={u} onClick={() => setIntervalUnit(u)}
                    className={`px-2.5 py-1 rounded-md border-none text-sm font-[inherit] cursor-pointer transition-all duration-150
                      ${intervalUnit === u ? "bg-bg-card text-text-primary font-bold" : "bg-transparent text-text-ghost font-medium"}`}>{u}</button>
                ))}
              </div>
              <button onClick={saveInterval} disabled={intervalSaving}
                className={`px-3.5 py-[5px] rounded-base border-none text-white text-sm font-bold font-[inherit] whitespace-nowrap transition-opacity ${intervalSaving ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
                style={{ background: intervalSaved ? "linear-gradient(135deg,#22c55e,#16a34a)" : "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
                {intervalSaving ? "Saving…" : intervalSaved ? "✓ Saved" : "Save"}
              </button>
              {!intervalSaved && <span className="text-xs text-slate-300">· now: {minutesToUnitValue(intervalMinutes).value} {minutesToUnitValue(intervalMinutes).unit}</span>}
            </div>
          </div>

          <div className="flex gap-2 items-center flex-wrap justify-end">
            {/* Greeting */}
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-bg-subtle border border-border-base rounded-base text-md text-text-primary">
              <span>👋</span>
              <span>Hi, <strong className="capitalize">{user?.username}</strong></span>
              <span className="text-[10px] text-text-muted-c bg-bg-hover border border-border-base px-[7px] py-px rounded-pill capitalize ml-0.5">{user?.role}</span>
            </div>

            <button onClick={handleRefresh} disabled={refreshing}
              className={`px-3.5 py-2 border border-border-base rounded-base bg-bg-card flex items-center gap-1.5 text-sm font-[inherit] transition-colors
                ${refreshing ? "cursor-not-allowed text-text-ghost" : "cursor-pointer text-text-muted-c hover:bg-bg-subtle"}`}>
              <div className={refreshing ? "animate-spin" : ""}>
                <Icon d={Icons.refresh} size={13} color={refreshing ? "var(--text-ghost)" : "#475569"} />
              </div>
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            {latestScan && (
              <button onClick={() => exportToCSV(latestScan)}
                className="px-3.5 py-2 border border-blue-border rounded-base bg-blue-tint cursor-pointer flex items-center gap-1.5 text-sm text-blue-dark font-semibold font-[inherit]">
                <Icon d={Icons.export} size={13} color="var(--blue-dark)" /> Export CSV
              </button>
            )}

            {/* Windows Scan button */}
            <button onClick={triggerWindowsScan} disabled={winScanDisabled} title={winScanTooltip}
              className="px-0 py-2 rounded-base border-none font-bold text-sm font-[inherit] flex items-center justify-center gap-1.5 w-[130px]"
              style={{
                background: winScanDisabled ? "#e2e8f0" : "linear-gradient(135deg,#0ea5e9,#6366f1)",
                color: winScanDisabled ? "#94a3b8" : "#fff",
                cursor: winScanDisabled ? "not-allowed" : "pointer",
                boxShadow: winScanDisabled ? "none" : "0 2px 8px rgba(14,165,233,0.35)",
              }}>
              {winScanning
                ? <><div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />Scanning...</>
                : <>🪟 Win Scan</>}
            </button>

            {/* Linux Scan button */}
            <button onClick={triggerScan} disabled={scanDisabled} title={scanTooltip}
              className="px-0 py-2 rounded-base border-none font-bold text-sm font-[inherit] flex items-center justify-center gap-1.5 w-[130px]"
              style={{
                background: scanDisabled ? "#e2e8f0" : "linear-gradient(135deg,#3b82f6,#6366f1)",
                color: scanDisabled ? "#94a3b8" : "#fff",
                cursor: scanDisabled ? "not-allowed" : "pointer",
                boxShadow: scanDisabled ? "none" : "0 2px 8px rgba(59,130,246,0.35)",
              }}>
              {scanning
                ? <><div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />Scanning...</>
                : <><Icon d={Icons.scan} size={13} color={scanDisabled ? "#94a3b8" : "#fff"} />Linux Scan</>}
            </button>
          </div>
        </div>

        {/* Status hints */}
        {scanning    && <div className="text-xs text-slate-500 text-right -mt-5 mb-4 animate-pulse">{scanStatus === "enriching" ? "⚡ Enriching CVE data..." : "🐧 Linux Ansible playbook running..."}</div>}
        {winScanning && <div className="text-xs text-cyan text-right -mt-5 mb-4 animate-pulse">🪟 Windows Ansible playbook running...</div>}

        {/* Banners */}
        {activeInventoryName && !activeHasCredentials && !error && (
          <div className="bg-orange-tint border border-orange-border rounded-[10px] px-4 py-3 mb-5 text-md text-orange flex items-center justify-between">
            <div className="flex items-center gap-2"><Icon d={Icons.key} size={16} color="var(--orange)" /><span>SSH credentials not set for <strong>{activeInventoryName}</strong>.</span></div>
            <button onClick={() => setShowInventoryManager(true)} className="bg-orange text-white border-none rounded-md px-3.5 py-1.5 cursor-pointer text-sm font-bold font-[inherit] ml-3 whitespace-nowrap">Set Credentials</button>
          </div>
        )}
        {error && (
          <div className="bg-red-tint border border-red-border rounded-[10px] px-4 py-3 mb-5 text-md text-red flex items-center justify-between">
            <div className="flex items-center gap-2"><Icon d={Icons.warning} size={16} color="var(--red)" />{error}</div>
            <button onClick={() => setError(null)} className="bg-transparent border-none cursor-pointer"><Icon d={Icons.close} size={14} color="var(--red)" /></button>
          </div>
        )}

        {/* Tab content */}
        {tab === "cves"     && <CveTab cves={cves} loading={cvesLoading} />}
        {tab === "windows"  && <div style={{ animation: "fadeIn 0.3s ease" }}><WindowsTab /></div>}
        {tab === "settings" && <div style={{ animation: "fadeIn 0.3s ease" }}><SettingsTab key={winCredsVersion} onWinCredsSaved={fetchWinCredsStatus} onShowWinCreds={() => setShowWinCredsModal(true)} /></div>}
        {tab === "users"    && user?.role === "admin" && <UsersTab currentUser={user} />}

        {tab !== "cves" && tab !== "settings" && tab !== "windows" && tab !== "users" && (
          loading ? (
            <div className="flex items-center justify-center h-[300px]">
              <div className="w-8 h-8 border-[3px] border-border-base border-t-blue rounded-full animate-spin" />
            </div>
          ) : !latestScan && winRecords.length === 0 ? (
            <div className="text-center py-20 px-8 bg-bg-card rounded-2xl border border-border-base">
              <Icon d={Icons.scan} size={48} color="var(--text-disabled)" />
              <div className="mt-4 text-2xl font-bold text-text-secondary">No scan data yet</div>
              <div className="text-base text-text-muted-c mt-1.5 mb-5">
                {inventoryCount === 0 ? "Upload an inventory file, set credentials and run a scan"
                  : !activeHasCredentials ? `${inventoryCount} hosts ready — set SSH credentials first`
                  : `${inventoryCount} hosts ready — click Linux Scan to start`}
              </div>
              {inventoryCount === 0
                ? <button onClick={() => setShowInventoryManager(true)} className="px-5 py-[10px] bg-bg-sidebar text-bg-card border-none rounded-base cursor-pointer text-md font-semibold font-[inherit] inline-flex items-center gap-2">
                    <Icon d={Icons.upload} size={14} color="var(--bg-card)" /> Upload Inventory
                  </button>
                : !activeHasCredentials
                  ? <button onClick={() => setShowInventoryManager(true)} className="px-5 py-[10px] bg-red-dark text-white border-none rounded-base cursor-pointer text-md font-semibold font-[inherit] inline-flex items-center gap-2">
                      <Icon d={Icons.key} size={14} color="#fff" /> Set SSH Credentials
                    </button>
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
        <div className="fixed bottom-6 right-6 z-[999] bg-[#0f172a] text-green-400 px-4 py-[10px] rounded-base text-sm font-semibold flex items-center gap-2"
          style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.2)", animation: "fadeIn 0.2s ease" }}>
          <Icon d={Icons.check} size={13} color="#4ade80" />
          Refreshed at {refreshedAt.toLocaleTimeString()}
        </div>
      )}

      <ChatWidget />
    </div>
  );
}
