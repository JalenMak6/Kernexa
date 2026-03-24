import { useState, useEffect, useCallback } from "react";

import { apiFetch, apiPost } from "./utils/api";
import { kernelOutdated, fmtDate, badge } from "./utils/helpers.jsx";
import { osFamily, FilterChip } from "./utils/filters.jsx";
import { Icon, Icons } from "./utils/icons.jsx";
import { exportToCSV } from "./utils/csv.js";

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

// ── Tab ↔ URL mapping ─────────────────────────────────────────────────────────

const TAB_TO_PATH = {
  dashboard: "/",
  hosts:     "/linux-inventory",
  windows:   "/windows-hosts",
  history:   "/scan-history",
  cves:      "/cve-advisories",
  settings:  "/settings",
};
const PATH_TO_TAB = Object.fromEntries(Object.entries(TAB_TO_PATH).map(([k, v]) => [v, k]));

function tabFromUrl() {
  return PATH_TO_TAB[window.location.pathname] || "dashboard";
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState(() => tabFromUrl());

  const changeTab = (t) => {
    setTab(t);
    localStorage.setItem("kernexa_tab", t);
    window.history.pushState({ tab: t }, "", TAB_TO_PATH[t] || "/");
  };

  // Handle browser back/forward
  useEffect(() => {
    const onPop = () => setTab(tabFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // ── Data state ──────────────────────────────────────────────────────────────
  const [latestScan,  setLatestScan]  = useState(null);
  const [history,     setHistory]     = useState([]);
  const [cves,        setCves]        = useState([]);
  const [cvesLoading, setCvesLoading] = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  // ── Scan state ───────────────────────────────────────────────────────────────
  const [scanning,    setScanning]    = useState(false);
  const [scanId,      setScanId]      = useState(null);
  const [scanStatus,  setScanStatus]  = useState(null);
  const [winScanning, setWinScanning] = useState(false);
  const [winScanId,   setWinScanId]   = useState(null);
  const [winRecords,  setWinRecords]  = useState([]);

  // ── Inventory state ──────────────────────────────────────────────────────────
  const [inventoryCount,       setInventoryCount]       = useState(0);
  const [activeInventoryName,  setActiveInventoryName]  = useState(null);
  const [activeInventoryId,    setActiveInventoryId]    = useState(null);
  const [activeHasCredentials, setActiveHasCredentials] = useState(false);
  const [activeWindowsInv,     setActiveWindowsInv]     = useState(null);
  const [winCredsReady,        setWinCredsReady]        = useState(false);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [winCredsVersion,      setWinCredsVersion]      = useState(0);
  const [showWinCredsModal,    setShowWinCredsModal]    = useState(false);
  const [showHostsManager,     setShowHostsManager]     = useState(false);
  const [showInventoryManager, setShowInventoryManager] = useState(false);
  const [selectedScanId,       setSelectedScanId]       = useState(null);
  const [refreshing,           setRefreshing]           = useState(false);
  const [refreshedAt,          setRefreshedAt]          = useState(null);

  // ── Filter state ──────────────────────────────────────────────────────────────
  const [search,             setSearch]             = useState("");
  const [sortCol,            setSortCol]            = useState("host");
  const [sortDir,            setSortDir]            = useState("asc");
  const [filterOS,           setFilterOS]           = useState("all");
  const [filterKernelStatus, setFilterKernelStatus] = useState("all");
  const [filterPatchStatus,  setFilterPatchStatus]  = useState("all");
  const [filterTag,          setFilterTag]          = useState("all");

  // ── Auto-scan interval state ─────────────────────────────────────────────────
  const [intervalMinutes, setIntervalMinutes] = useState(180);
  const [intervalValue,   setIntervalValue]   = useState(3);
  const [intervalUnit,    setIntervalUnit]     = useState("hours");
  const [intervalSaving,  setIntervalSaving]   = useState(false);
  const [intervalSaved,   setIntervalSaved]    = useState(false);

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

  // ── Data fetching ─────────────────────────────────────────────────────────────

  const fetchLatest = useCallback(async () => {
    try { const data = await apiFetch("/api/scans/latest"); setLatestScan(data); setError(null); }
    catch (e) { if (!e.message.includes("404")) setError(e.message); }
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

  // ── Initial load ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchLatest(); fetchHistory(); fetchInventoryInfo();
    fetchCves(); fetchWinCredsStatus(); fetchWinLatest();
    try {
      const s = apiFetch("/api/scans/current");
      s.then(d => { if (d.scanning) { setScanning(true); setScanId(d.scan_id); } }).catch(() => {});
    } catch {}
    apiFetch("/api/scheduler/interval").then(d => {
      const mins = d.interval_minutes || 180;
      const { value, unit } = minutesToUnitValue(mins);
      setIntervalMinutes(mins); setIntervalValue(value); setIntervalUnit(unit);
    }).catch(() => {});
  }, []);

  useEffect(() => { if (tab === "cves") fetchCves(); }, [tab]);

  // ── Poll Linux scan ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!scanning || !scanId) return;
    const iv = setInterval(async () => {
      try {
        const s = await apiFetch(`/api/scans/${scanId}/status`);
        setScanStatus(s.status);
        if (s.status === "enriching") {
          await fetchLatest(); await fetchHistory();
        } else if (s.status === "complete") {
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

  // ── Poll Windows scan ─────────────────────────────────────────────────────────
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

  // ── Actions ───────────────────────────────────────────────────────────────────

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
    if (inventoryCount === 0) { setError("No hosts in inventory. Upload or add hosts first."); return; }
    if (!activeHasCredentials) { setError("No SSH credentials set. Open Inventories and click 'Set Creds'."); return; }
    try {
      setScanning(true); setError(null);
      const res = await apiPost("/api/scans/trigger");
      setScanId(res.scan_id);
    } catch (e) { setScanning(false); setError(e.message); }
  };

  const triggerWindowsScan = async () => {
    if (!winCredsReady) { setError("No Windows credentials set. Go to Settings → Windows WinRM Credentials."); return; }
    try {
      setWinScanning(true); setError(null);
      const res = await apiPost("/api/scans/trigger-windows");
      if (!res?.scan_id) throw new Error(res?.detail || "No scan_id returned");
      setWinScanId(res.scan_id);
    } catch (e) { setWinScanning(false); setError("Windows scan failed to start: " + (e.message || "Unknown error")); }
  };

  // ── Derived data ──────────────────────────────────────────────────────────────

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

  const filteredHosts = hosts
    .filter(h => {
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
    })
    .sort((a, b) => {
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
  const winScanTooltip  = !winCredsReady ? "Set Windows credentials in Settings first" : (scanning || winScanning) ? "A scan is already in progress" : "";
  const criticalCount   = cves.filter(c => c.severity === "Critical").length;
  const importantCount  = cves.filter(c => c.severity === "Important").length;
  const tabTitle = {
    dashboard: "Overview",
    hosts:     "Linux Inventory",
    windows:   "Windows Hosts",
    history:   "Scan History",
    cves:      "CVE Advisories",
    settings:  "Settings",
  }[tab] || "Overview";

  const filterProps = {
    hosts, filteredHosts, totalHosts, activeFilterCount, clearFilters,
    filterOS, setFilterOS, filterKernelStatus, setFilterKernelStatus,
    filterPatchStatus, setFilterPatchStatus, filterTag, setFilterTag,
    search, setSearch, sortCol, sortDir, sortBy,
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)", fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      {/* styles are in index.css → styles/theme.css */}

      {/* ── SIDEBAR ── */}
      <div style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 220, background: "#0f172a", display: "flex", flexDirection: "column", borderRight: "1px solid #1e293b", zIndex: 50 }}>
        <div style={{ padding: "20px 16px", borderBottom: "1px solid #1e293b" }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src="/kernexa.png" alt="Kernexa" style={{ width: "100%", maxHeight: 40, objectFit: "contain" }} />
          </div>
          <div style={{ textAlign: "center", color: "#475569", fontSize: 10, letterSpacing: "0.05em", marginTop: 8 }}>Security Compliance Platform</div>
        </div>

        <nav style={{ padding: "16px 12px", flex: 1, overflowY: "auto" }}>
          {/* Main nav tabs */}
          {[
            { id: "dashboard", label: "Dashboard",        icon: "host"    },
            { id: "hosts",     label: "Linux Inventory",  icon: "kernel"  },
            { id: "windows",   label: "Windows Hosts",    icon: "servers" },
            { id: "history",   label: "Scan History",     icon: "history" },
          ].map(item => (
            <button key={item.id} onClick={() => changeTab(item.id)} style={{
              width: "100%", padding: "10px 12px", borderRadius: 8, border: "none",
              display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
              marginBottom: 4, fontFamily: "inherit", fontSize: 13, fontWeight: 500,
              background: tab === item.id ? "#1e293b" : "transparent",
              color: tab === item.id ? "#f8fafc" : "#64748b", transition: "all 0.15s",
            }}>
              <Icon d={Icons[item.icon]} size={15} color={tab === item.id ? "#3b82f6" : "#475569"} />
              {item.label}
            </button>
          ))}

          {/* CVE Advisories — with badge */}
          <button onClick={() => changeTab("cves")} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "none", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: 4, fontFamily: "inherit", fontSize: 13, fontWeight: 500, background: tab === "cves" ? "#1e293b" : "transparent", color: tab === "cves" ? "#f8fafc" : "#64748b", transition: "all 0.15s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon d={Icons.warning} size={15} color={tab === "cves" ? "#3b82f6" : "#475569"} />
              CVE Advisories
            </div>
            {(criticalCount + importantCount) > 0 && (
              <span style={{ background: "#dc2626", color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999 }}>{criticalCount + importantCount}</span>
            )}
          </button>

          {/* Settings — below CVE */}
          <button onClick={() => changeTab("settings")} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "none", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 4, fontFamily: "inherit", fontSize: 13, fontWeight: 500, background: tab === "settings" ? "#1e293b" : "transparent", color: tab === "settings" ? "#f8fafc" : "#64748b", transition: "all 0.15s" }}>
            <Icon d={Icons.key} size={15} color={tab === "settings" ? "#3b82f6" : "#475569"} />
            Settings
          </button>

          <div style={{ borderTop: "1px solid #1e293b", margin: "12px 0" }} />

          {/* Utility buttons */}
          {[
            { label: "Inventories",    icon: "file",    badge: (activeInventoryName || activeWindowsInv) ? "active" : null, onClick: () => setShowInventoryManager(true) },
            { label: "Manage Hosts",   icon: "servers", badge: inventoryCount > 0 ? String(inventoryCount) : null,          onClick: () => setShowHostsManager(true) },
          ].map(item => (
            <button key={item.label} onClick={item.onClick} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "none", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: 4, fontFamily: "inherit", fontSize: 13, fontWeight: 500, background: "transparent", color: "#64748b", transition: "all 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background = "#1e293b"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon d={Icons[item.icon]} size={15} color="#475569" />
                {item.label}
              </div>
              {item.badge && <span style={{ background: "#1e3a5f", color: "#93c5fd", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999 }}>{item.badge}</span>}
            </button>
          ))}

          {/* Active inventory boxes */}
          {(activeInventoryName || activeWindowsInv) && (
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
                      : <><Icon d={Icons.warning} size={11} color="#fb923c" /><button onClick={() => setShowInventoryManager(true)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#fb923c", textDecoration: "underline", padding: 0, fontFamily: "inherit" }}>Set SSH credentials</button></>
                    }
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
                      : <><Icon d={Icons.warning} size={11} color="#fbbf24" /><button onClick={() => changeTab("settings")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#fbbf24", textDecoration: "underline", padding: 0, fontFamily: "inherit" }}>Set WinRM credentials</button></>
                    }
                  </div>
                </div>
              )}
            </div>
          )}
        </nav>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ marginLeft: 220, padding: "32px", minHeight: "100vh", width: "calc(100vw - 220px)", overflowX: "hidden" }}>

        {/* Topbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{tabTitle}</h1>
            {latestScan && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Last scan: {fmtDate(latestScan.scanned_at)}</div>}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10 }}>
              <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>Auto-scan every</span>
              <input type="number" min={1} max={999} value={intervalValue}
                onChange={e => setIntervalValue(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: 52, padding: "5px 0", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontWeight: 700, color: "#0f172a", fontFamily: "inherit", textAlign: "center", background: "#fff", outline: "none" }} />
              <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 8, padding: 3, gap: 2 }}>
                {["minutes", "hours", "days"].map(u => (
                  <button key={u} onClick={() => setIntervalUnit(u)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: intervalUnit === u ? "#fff" : "transparent", color: intervalUnit === u ? "#0f172a" : "#94a3b8", fontSize: 12, fontWeight: intervalUnit === u ? 700 : 500, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>{u}</button>
                ))}
              </div>
              <button onClick={saveInterval} disabled={intervalSaving} style={{ padding: "5px 14px", borderRadius: 8, border: "none", background: intervalSaved ? "linear-gradient(135deg,#22c55e,#16a34a)" : "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: intervalSaving ? "not-allowed" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap", opacity: intervalSaving ? 0.7 : 1 }}>
                {intervalSaving ? "Saving…" : intervalSaved ? "✓ Saved" : "Save"}
              </button>
              {!intervalSaved && <span style={{ fontSize: 11, color: "#cbd5e1" }}>· now: {minutesToUnitValue(intervalMinutes).value} {minutesToUnitValue(intervalMinutes).unit}</span>}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={handleRefresh} disabled={refreshing} style={{ padding: "8px 14px", border: "1px solid #e2e8f0", borderRadius: 8, background: refreshing ? "#f8fafc" : "#fff", cursor: refreshing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: refreshing ? "#94a3b8" : "#475569", fontFamily: "inherit" }}>
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

        {/* Scan status hints */}
        {scanning    && <div style={{ fontSize: 11, color: "#64748b", textAlign: "right", marginTop: -20, marginBottom: 16, animation: "pulse 2s infinite" }}>{scanStatus === "enriching" ? "⚡ Enriching CVE data..." : "🐧 Linux Ansible playbook running..."}</div>}
        {winScanning && <div style={{ fontSize: 11, color: "#0ea5e9", textAlign: "right", marginTop: -20, marginBottom: 16, animation: "pulse 2s infinite" }}>🪟 Windows Ansible playbook running...</div>}

        {/* Banners */}
        {activeInventoryName && !activeHasCredentials && !error && (
          <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#c2410c", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon d={Icons.key} size={16} color="#c2410c" /><span>SSH credentials are not set for <strong>{activeInventoryName}</strong>.</span></div>
            <button onClick={() => setShowInventoryManager(true)} style={{ background: "#c2410c", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", marginLeft: 12 }}>Set Credentials</button>
          </div>
        )}
        {!winCredsReady && !error && (
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#1d4ed8", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span>🪟</span><span>Windows WinRM credentials are not set.</span></div>
            <button onClick={() => changeTab("settings")} style={{ background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", marginLeft: 12 }}>Go to Settings</button>
          </div>
        )}
        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#dc2626", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon d={Icons.warning} size={16} color="#dc2626" />{error}</div>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer" }}><Icon d={Icons.close} size={14} color="#dc2626" /></button>
          </div>
        )}

        {/* ── Tab content ── */}
        {tab === "cves"     && <CveTab cves={cves} loading={cvesLoading} />}
        {tab === "windows"  && <div style={{ animation: "fadeIn 0.3s ease" }}><WindowsTab /></div>}
        {tab === "settings" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <SettingsTab key={winCredsVersion} onWinCredsSaved={fetchWinCredsStatus} onShowWinCreds={() => setShowWinCredsModal(true)} />
          </div>
        )}

        {tab !== "cves" && tab !== "settings" && tab !== "windows" && (
          loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
              <div style={{ width: 32, height: 32, border: "3px solid #e2e8f0", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            </div>
          ) : !latestScan && winRecords.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 32px", background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0" }}>
              <Icon d={Icons.scan} size={48} color="#cbd5e1" />
              <div style={{ marginTop: 16, fontSize: 18, fontWeight: 700, color: "#334155" }}>No scan data yet</div>
              <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 6, marginBottom: 20 }}>
                {inventoryCount === 0 ? "Start by uploading an inventory file, then set credentials and run a scan"
                  : !activeHasCredentials ? `${inventoryCount} hosts ready — set SSH credentials, then click Linux Scan`
                  : `${inventoryCount} hosts ready — click Linux Scan to start`}
              </div>
              {inventoryCount === 0
                ? <button onClick={() => setShowInventoryManager(true)} style={{ padding: "10px 20px", background: "#0f172a", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8 }}><Icon d={Icons.upload} size={14} color="#fff" /> Upload Inventory</button>
                : !activeHasCredentials
                  ? <button onClick={() => setShowInventoryManager(true)} style={{ padding: "10px 20px", background: "#c2410c", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8 }}><Icon d={Icons.key} size={14} color="#fff" /> Set SSH Credentials</button>
                  : null}
            </div>
          ) : (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              {tab === "dashboard" && (
                <DashboardTab
                  {...filterProps}
                  compliantHosts={compliantHosts} outdatedHosts={outdatedHosts}
                  compliancePct={compliancePct} complianceData={complianceData}
                  topPackages={topPackages} winRecords={winRecords}
                  cves={cves} changeTab={changeTab}
                  showInventoryManager={showInventoryManager}
                  setShowInventoryManager={setShowInventoryManager}
                />
              )}
              {tab === "hosts" && <HostsTab {...filterProps} />}
              {tab === "history" && <ScanHistoryTab history={history} onSelectScan={setSelectedScanId} />}
            </div>
          )
        )}
      </div>

      {/* ── Modals ── */}
      {showHostsManager     && <HostsManager     onClose={() => setShowHostsManager(false)} onSaved={fetchInventoryInfo} />}
      {showInventoryManager && <InventoryManager onClose={() => { setShowInventoryManager(false); fetchInventoryInfo(); }} onActivated={fetchInventoryInfo} />}
      {selectedScanId       && <ScanFailuresModal scanId={selectedScanId} onClose={() => setSelectedScanId(null)} />}
      {showWinCredsModal    && <WindowsCredentialsForm onClose={() => { setShowWinCredsModal(false); fetchWinCredsStatus(); setWinCredsVersion(v => v + 1); }} />}

      {/* ── Refresh toast ── */}
      {refreshedAt && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 999, background: "#0f172a", color: "#4ade80", padding: "10px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.2)", animation: "fadeIn 0.2s ease" }}>
          <Icon d={Icons.check} size={13} color="#4ade80" />
          Refreshed at {refreshedAt.toLocaleTimeString()}
        </div>
      )}

      {/* ── AI Chat Widget ── */}
      <ChatWidget />
    </div>
  );
}