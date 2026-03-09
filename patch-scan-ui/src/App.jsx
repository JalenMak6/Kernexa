import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from "recharts";

import { apiFetch, apiPost } from "./utils/api";
import { kernelOutdated, fmtDate, badge } from "./utils/helpers.jsx";
import { Icon, Icons } from "./utils/icons.jsx";
import { exportToCSV } from "./utils/csv.js";
import { StatCard } from "./components/StatCard.jsx";
import { HostRow } from "./components/HostRow.jsx";
import { HostsManager } from "./components/HostsManager.jsx";
import { InventoryManager } from "./components/InventoryManager.jsx";
import { CveTab } from "./components/CveTab.jsx";

// Normalize os_version to family group: "Rocky9.7" → "Rocky 9", "RedHat8.10" → "RHEL 8", "Ubuntu22.04" → "Ubuntu 22.04"
function osFamily(osVersion) {
  if (!osVersion) return "Unknown";
  const lower = osVersion.toLowerCase();
  if (lower.includes("ubuntu")) {
    const m = osVersion.match(/(\d+\.\d+)/);
    return m ? `Ubuntu ${m[1]}` : "Ubuntu";
  }
  if (lower.includes("rocky")) {
    const m = osVersion.match(/(\d+)/);
    return m ? `Rocky ${m[1]}` : "Rocky";
  }
  if (lower.includes("redhat")) {
    const m = osVersion.match(/(\d+)/);
    return m ? `RHEL ${m[1]}` : "RHEL";
  }
  return osVersion;
}

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [latestScan, setLatestScan] = useState(null);
  const [history, setHistory] = useState([]);
  const [cves, setCves] = useState([]);
  const [cvesLoading, setCvesLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanId, setScanId] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("host");
  const [sortDir, setSortDir] = useState("asc");
  const [loading, setLoading] = useState(true);
  const [showHostsManager, setShowHostsManager] = useState(false);
  const [showInventoryManager, setShowInventoryManager] = useState(false);
  const [inventoryCount, setInventoryCount] = useState(0);
  const [activeInventoryName, setActiveInventoryName] = useState(null);
  const [activeInventoryId, setActiveInventoryId] = useState(null);
  const [activeHasCredentials, setActiveHasCredentials] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState(null);

  // ── column filters ────────────────────────────────────────────────────────
  const [filterOS, setFilterOS] = useState("all");
  const [filterKernelStatus, setFilterKernelStatus] = useState("all");
  const [filterPatchStatus, setFilterPatchStatus] = useState("all");

  const fetchLatest = useCallback(async () => {
    try {
      const data = await apiFetch("/api/scans/latest");
      setLatestScan(data); setError(null);
    } catch (e) {
      if (!e.message.includes("404")) setError(e.message);
    } finally { setLoading(false); }
  }, []);

  const fetchHistory = useCallback(async () => {
    try { setHistory(await apiFetch("/api/scans/history")); } catch {}
  }, []);

  const fetchCves = useCallback(async () => {
    setCvesLoading(true);
    try { setCves(prev => prev); const data = await apiFetch("/api/cves"); setCves(data); } catch {}
    finally { setCvesLoading(false); }
  }, []);

  const fetchInventoryInfo = useCallback(async () => {
    try {
      const data = await apiFetch("/api/hosts");
      setInventoryCount(data.hosts?.length || 0);
    } catch {}
    try {
      const invs = await apiFetch("/api/inventories");
      const active = invs.find(i => i.is_active);
      setActiveInventoryName(active?.name || null);
      setActiveInventoryId(active?.id || null);
      setActiveHasCredentials(active?.has_credentials || false);
    } catch {}
  }, []);

  const fetchCurrentScan = useCallback(async () => {
    try {
      const s = await apiFetch("/api/scans/current");
      if (s.scanning) { setScanning(true); setScanId(s.scan_id); }
    } catch {}
  }, []);

  useEffect(() => {
    fetchLatest();
    fetchHistory();
    fetchInventoryInfo();
    fetchCurrentScan();
    fetchCves();
  }, []);

  useEffect(() => {
    if (tab === "cves") fetchCves();
  }, [tab]);

  useEffect(() => {
    if (!scanning || !scanId) return;
    const iv = setInterval(async () => {
      try {
        const s = await apiFetch(`/api/scans/${scanId}/status`);
        if (s.status === "complete") {
          setScanning(false); setScanId(null);
          await fetchLatest(); await fetchHistory(); await fetchCves();
        } else if (s.status?.startsWith("failed")) {
          setScanning(false); setScanId(null);
          setError(`Scan failed: ${s.status}`);
        }
      } catch {}
    }, 4000);
    return () => clearInterval(iv);
  }, [scanning, scanId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchLatest(), fetchHistory(), fetchInventoryInfo(), fetchCves()]);
    setRefreshing(false);
    setRefreshedAt(new Date());
    setTimeout(() => setRefreshedAt(null), 2500);
  };

  const triggerScan = async () => {
    if (inventoryCount === 0) { setError("No hosts in inventory. Upload or add hosts first."); return; }
    if (!activeHasCredentials) { setError("No SSH credentials set for the active inventory. Open Inventories and click 'Set Creds'."); return; }
    try {
      setScanning(true); setError(null);
      const res = await apiPost("/api/scans/trigger");
      setScanId(res.scan_id);
    } catch (e) {
      setScanning(false);
      setError(e.message.includes("400") ? "No credentials set for the active inventory. Open Inventories and click 'Set Creds'." : e.message);
    }
  };

  const hosts = latestScan?.hosts || [];
  const totalHosts = hosts.length;
  const outdatedHosts = hosts.filter(h => kernelOutdated(h.current_kernel_version, h.latest_available_kernel_version)).length;
  const compliantHosts = totalHosts - outdatedHosts;
  const totalPackages = hosts.reduce((s, h) => s + (h.pending_security_packages?.length || 0), 0);
  const compliancePct = totalHosts ? Math.round((compliantHosts / totalHosts) * 100) : 0;

  const complianceData = [
    { name: "Compliant", value: compliantHosts, color: "#10b981" },
    { name: "Outdated",  value: outdatedHosts,  color: "#ef4444" },
  ];

  const topPackages = (() => {
    const counts = {};
    hosts.forEach(h => (h.pending_security_packages || []).forEach(p => {
      const name = p.split("-")[0];
      counts[name] = (counts[name] || 0) + 1;
    }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));
  })();

  // derive unique OS family groups for filter chips (e.g. "Rocky 9", "RHEL 8", "Ubuntu 22.04")
  const osOptions = ["all", ...Array.from(new Set(hosts.map(h => osFamily(h.os_version)).filter(f => f !== "Unknown"))).sort()];

  const filteredHosts = hosts
    .filter(h => {
      const matchSearch = h.host.toLowerCase().includes(search.toLowerCase()) ||
        (h.current_kernel_version || "").toLowerCase().includes(search.toLowerCase()) ||
        (h.os_version || "").toLowerCase().includes(search.toLowerCase());

      const matchOS = filterOS === "all" || osFamily(h.os_version) === filterOS;

      const isOutdated = kernelOutdated(h.current_kernel_version, h.latest_available_kernel_version);
      const matchKernel =
        filterKernelStatus === "all" ||
        (filterKernelStatus === "outdated" && isOutdated) ||
        (filterKernelStatus === "uptodate" && !isOutdated);

      const pkgCount = h.pending_security_packages?.length || 0;
      const matchPatch =
        filterPatchStatus === "all" ||
        (filterPatchStatus === "dirty" && pkgCount > 0) ||
        (filterPatchStatus === "clean" && pkgCount === 0);

      return matchSearch && matchOS && matchKernel && matchPatch;
    })
    .sort((a, b) => {
      let av = a[sortCol] || "", bv = b[sortCol] || "";
      if (sortCol === "package_count") { av = a.pending_security_packages?.length || 0; bv = b.pending_security_packages?.length || 0; }
      if (typeof av === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  const activeFilterCount = [filterOS !== "all", filterKernelStatus !== "all", filterPatchStatus !== "all"].filter(Boolean).length;

  const clearFilters = () => {
    setFilterOS("all");
    setFilterKernelStatus("all");
    setFilterPatchStatus("all");
    setSearch("");
  };

  const thStyle = (col) => ({
    padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b",
    cursor: col ? "pointer" : "default", userSelect: "none", whiteSpace: "nowrap",
    background: sortCol === col ? "#f1f5f9" : "transparent"
  });

  const sortBy = (col) => {
    if (!col) return;
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const scanDisabled = scanning || inventoryCount === 0 || !activeHasCredentials;
  const scanTooltip = inventoryCount === 0
    ? "No hosts — upload an inventory first"
    : !activeHasCredentials ? "Set SSH credentials before scanning" : "";

  const criticalCount = cves.filter(c => c.severity === "Critical").length;
  const importantCount = cves.filter(c => c.severity === "Important").length;

  const cveCounts = (cves || []).reduce((acc, c) => {
    const sev = c.severity || "Unknown";
    acc[sev] = (acc[sev] || 0) + 1;
    return acc;
  }, {});

  const CVE_SEVERITY_CONFIG = {
    Critical:  { bg: "#fef2f2", color: "#991b1b", border: "#fca5a5", dot: "#ef4444" },
    Important: { bg: "#fff7ed", color: "#9a3412", border: "#fdba74", dot: "#f97316" },
    Moderate:  { bg: "#fefce8", color: "#854d0e", border: "#fde047", dot: "#eab308" },
    Low:       { bg: "#f0fdf4", color: "#166534", border: "#86efac", dot: "#22c55e" },
  };

  const tabTitle = {
    dashboard: "Overview",
    hosts:     "VM Inventory",
    history:   "Scan History",
    cves:      "CVE Advisories",
  }[tab] || "Overview";

  const FilterChip = ({ label, active, onClick, color = "#3b82f6" }) => (
    <button onClick={onClick} style={{
      padding: "5px 12px", borderRadius: 6,
      border: `1px solid ${active ? color : "#e2e8f0"}`,
      background: active ? `${color}18` : "#fff",
      cursor: "pointer", fontSize: 12,
      fontWeight: active ? 700 : 500,
      color: active ? color : "#475569",
      fontFamily: "inherit", transition: "all 0.15s", whiteSpace: "nowrap"
    }}>
      {label}
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeOut { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(8px)} }
      `}</style>

      {/* ── SIDEBAR ── */}
      <div style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 220, background: "#0f172a", display: "flex", flexDirection: "column", borderRight: "1px solid #1e293b", zIndex: 50 }}>
        <div style={{ padding: "20px 16px", borderBottom: "1px solid #1e293b" }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src="/kernexa.png" alt="Kernexa" style={{ width: "100%", maxHeight: 40, objectFit: "contain" }} />
          </div>
          <div style={{ textAlign: "center", color: "#475569", fontSize: 10, letterSpacing: "0.05em", marginTop: 8 }}>Security Compliance Platform</div>
        </div>

        <nav style={{ padding: "16px 12px", flex: 1, overflowY: "auto" }}>
          {[
            { id: "dashboard", label: "Dashboard",    icon: "host"    },
            { id: "hosts",     label: "VM Inventory", icon: "kernel"  },
            { id: "history",   label: "Scan History", icon: "history" },
          ].map(item => (
            <button key={item.id} onClick={() => setTab(item.id)} style={{
              width: "100%", padding: "10px 12px", borderRadius: 8, border: "none",
              display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
              marginBottom: 4, fontFamily: "inherit", fontSize: 13, fontWeight: 500,
              background: tab === item.id ? "#1e293b" : "transparent",
              color: tab === item.id ? "#f8fafc" : "#64748b", transition: "all 0.15s"
            }}>
              <Icon d={Icons[item.icon]} size={15} color={tab === item.id ? "#3b82f6" : "#475569"} />
              {item.label}
            </button>
          ))}

          <button onClick={() => setTab("cves")} style={{
            width: "100%", padding: "10px 12px", borderRadius: 8, border: "none",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            cursor: "pointer", marginBottom: 4, fontFamily: "inherit", fontSize: 13, fontWeight: 500,
            background: tab === "cves" ? "#1e293b" : "transparent",
            color: tab === "cves" ? "#f8fafc" : "#64748b", transition: "all 0.15s"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon d={Icons.warning} size={15} color={tab === "cves" ? "#3b82f6" : "#475569"} />
              CVE Advisories
            </div>
            {(criticalCount + importantCount) > 0 && (
              <span style={{ background: "#dc2626", color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999 }}>
                {criticalCount + importantCount}
              </span>
            )}
          </button>

          <div style={{ borderTop: "1px solid #1e293b", margin: "12px 0" }} />

          <button onClick={() => setShowInventoryManager(true)} style={{
            width: "100%", padding: "10px 12px", borderRadius: 8, border: "none",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            cursor: "pointer", marginBottom: 4, fontFamily: "inherit", fontSize: 13, fontWeight: 500,
            background: "transparent", color: "#64748b", transition: "all 0.15s"
          }}
            onMouseEnter={e => e.currentTarget.style.background = "#1e293b"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon d={Icons.file} size={15} color="#475569" />
              Inventories
            </div>
            {activeInventoryName && (
              <span style={{ background: "#1e3a5f", color: "#93c5fd", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999 }}>active</span>
            )}
          </button>

          <button onClick={() => setShowHostsManager(true)} style={{
            width: "100%", padding: "10px 12px", borderRadius: 8, border: "none",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            cursor: "pointer", marginBottom: 4, fontFamily: "inherit", fontSize: 13, fontWeight: 500,
            background: "transparent", color: "#64748b", transition: "all 0.15s"
          }}
            onMouseEnter={e => e.currentTarget.style.background = "#1e293b"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon d={Icons.servers} size={15} color="#475569" />
              Manage Hosts
            </div>
            {inventoryCount > 0 && (
              <span style={{ background: "#1e3a5f", color: "#93c5fd", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999 }}>{inventoryCount}</span>
            )}
          </button>

          {activeInventoryName && (
            <div style={{ margin: "8px 4px 0", padding: "10px 12px", background: "#0f2d1f", borderRadius: 8, border: "1px solid #166534" }}>
              <div style={{ fontSize: 10, color: "#4ade80", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>Active Inventory</div>
              <div style={{ fontSize: 12, color: "#86efac", marginTop: 2, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeInventoryName}</div>
              <div style={{ fontSize: 10, color: "#166534", marginTop: 1 }}>{inventoryCount} hosts</div>
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
                {activeHasCredentials ? (
                  <>
                    <Icon d={Icons.check} size={11} color="#4ade80" />
                    <span style={{ fontSize: 10, color: "#4ade80" }}>Credentials set</span>
                  </>
                ) : (
                  <>
                    <Icon d={Icons.warning} size={11} color="#fb923c" />
                    <span style={{ fontSize: 10, color: "#fb923c" }}>No credentials —</span>
                    <button onClick={() => setShowInventoryManager(true)}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#fb923c", textDecoration: "underline", padding: 0, fontFamily: "inherit" }}>
                      set now
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </nav>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ marginLeft: 220, padding: "32px", minHeight: "100vh", width: "calc(100vw - 220px)", overflowX: "hidden" }}>

        {/* topbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{tabTitle}</h1>
            {latestScan && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Last scan: {fmtDate(latestScan.scanned_at)}</div>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={handleRefresh} disabled={refreshing} style={{
              padding: "8px 14px", border: "1px solid #e2e8f0", borderRadius: 8,
              background: refreshing ? "#f8fafc" : "#fff", cursor: refreshing ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 6, fontSize: 12,
              color: refreshing ? "#94a3b8" : "#475569", fontFamily: "inherit", transition: "all 0.15s"
            }}>
              <div style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none", display: "flex", alignItems: "center" }}>
                <Icon d={Icons.refresh} size={13} color={refreshing ? "#94a3b8" : "#475569"} />
              </div>
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            {latestScan && (
              <button onClick={() => exportToCSV(latestScan)} style={{ padding: "8px 14px", border: "1px solid #3b82f6", borderRadius: 8, background: "#eff6ff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#2563eb", fontWeight: 600, fontFamily: "inherit" }}>
                <Icon d={Icons.export} size={13} color="#2563eb" /> Export CSV
              </button>
            )}
            <button onClick={triggerScan} disabled={scanDisabled} title={scanTooltip} style={{
              padding: "8px 16px", borderRadius: 8, border: "none",
              background: scanDisabled ? "#e2e8f0" : "linear-gradient(135deg,#3b82f6,#6366f1)",
              color: scanDisabled ? "#94a3b8" : "#fff", fontWeight: 700, fontSize: 12,
              cursor: scanDisabled ? "not-allowed" : "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 6,
              boxShadow: scanDisabled ? "none" : "0 2px 8px rgba(59,130,246,0.35)"
            }}>
              {scanning
                ? <><div style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Scanning...</>
                : <><Icon d={Icons.scan} size={13} color={scanDisabled ? "#94a3b8" : "#fff"} />Run Scan</>}
            </button>
          </div>
        </div>
        {scanning && <div style={{ fontSize: 11, color: "#64748b", textAlign: "right", marginTop: -20, marginBottom: 16, animation: "pulse 2s infinite" }}>Ansible playbook running...</div>}

        {activeInventoryName && !activeHasCredentials && !error && (
          <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#c2410c", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon d={Icons.key} size={16} color="#c2410c" />
              <span>SSH credentials are not set for <strong>{activeInventoryName}</strong>. You must set credentials before running a scan.</span>
            </div>
            <button onClick={() => setShowInventoryManager(true)}
              style={{ background: "#c2410c", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap", marginLeft: 12 }}>
              Set Credentials
            </button>
          </div>
        )}

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#dc2626", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon d={Icons.warning} size={16} color="#dc2626" />{error}</div>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer" }}><Icon d={Icons.close} size={14} color="#dc2626" /></button>
          </div>
        )}

        {tab === "cves" && <CveTab cves={cves} loading={cvesLoading} />}

        {tab !== "cves" && (
          loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
              <div style={{ width: 32, height: 32, border: "3px solid #e2e8f0", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            </div>
          ) : !latestScan ? (
            <div style={{ textAlign: "center", padding: "80px 32px", background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0" }}>
              <Icon d={Icons.scan} size={48} color="#cbd5e1" />
              <div style={{ marginTop: 16, fontSize: 18, fontWeight: 700, color: "#334155" }}>No scan data yet</div>
              <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 6, marginBottom: 20 }}>
                {inventoryCount === 0
                  ? "Start by uploading an inventory file, then set credentials and run a scan"
                  : !activeHasCredentials
                    ? `${inventoryCount} hosts ready — set SSH credentials, then click Run Scan`
                    : `${inventoryCount} hosts ready — click Run Scan to start`}
              </div>
              {inventoryCount === 0 ? (
                <button onClick={() => setShowInventoryManager(true)} style={{ padding: "10px 20px", background: "#0f172a", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Icon d={Icons.upload} size={14} color="#fff" /> Upload Inventory
                </button>
              ) : !activeHasCredentials ? (
                <button onClick={() => setShowInventoryManager(true)} style={{ padding: "10px 20px", background: "#c2410c", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Icon d={Icons.key} size={14} color="#fff" /> Set SSH Credentials
                </button>
              ) : null}
            </div>
          ) : (
            <div style={{ animation: "fadeIn 0.3s ease", width: "100%" }}>

              {/* ── DASHBOARD ── */}
              {tab === "dashboard" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 16, marginBottom: 24 }}>
                    <StatCard icon="host"    label="Total Hosts"      value={totalHosts}     sub="in latest scan"      accent="#3b82f6" />
                    <StatCard icon="check"   label="Compliant"        value={compliantHosts} sub="kernel up to date"   accent="#10b981" />
                    <StatCard icon="warning" label="Outdated"         value={outdatedHosts}  sub="kernel needs update" accent="#ef4444" />
                    <StatCard icon="package" label="Pending Packages" value={totalPackages}  sub="security updates"    accent="#f59e0b" />
                  </div>

                  {/* CVE severity summary */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 16, marginBottom: 24 }}>
                    {["Critical", "Important", "Moderate", "Low"].map(sev => {
                      const cfg = CVE_SEVERITY_CONFIG[sev] || { bg: "#f1f5f9", color: "#475569", border: "#cbd5e1", dot: "#94a3b8" };
                      const count = cveCounts[sev] || 0;
                      return (
                        <div key={sev} onClick={() => setTab("cves")} style={{
                          background: count > 0 ? cfg.bg : "#fff",
                          border: `1px solid ${count > 0 ? cfg.border : "#e2e8f0"}`,
                          borderRadius: 12, padding: "16px 20px",
                          cursor: "pointer", transition: "all 0.15s",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                          display: "flex", alignItems: "center", justifyContent: "space-between"
                        }}
                          onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                              <span style={{ width: 9, height: 9, borderRadius: "50%", background: cfg.dot, display: "inline-block" }} />
                              <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{sev}</span>
                            </div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: count > 0 ? cfg.color : "#94a3b8", lineHeight: 1 }}>{count}</div>
                            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>CVE advisor{count !== 1 ? "ies" : "y"}</div>
                          </div>
                          <div style={{ fontSize: 10, color: cfg.dot, opacity: count > 0 ? 1 : 0 }}>View →</div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 24 }}>
                    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 4 }}>Kernel Compliance</div>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>{compliancePct}% of hosts up to date</div>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={complianceData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                            {complianceData.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip />
                          <Legend iconType="circle" iconSize={8} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 4 }}>Top Packages Pending</div>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>Most common security updates across all hosts</div>
                      {topPackages.length === 0 ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 180, color: "#94a3b8", fontSize: 13 }}>No pending packages</div>
                      ) : (
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={topPackages} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
                            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                            <Tooltip cursor={{ fill: "#f1f5f9" }} />
                            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                              {topPackages.map((_, i) => <Cell key={i} fill={`hsl(${220 + i * 12},70%,${55 + i * 3}%)`} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                    <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
                          Host Summary — {filteredHosts.length} of {totalHosts} hosts
                          {activeFilterCount > 0 && (
                            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: "#3b82f6" }}>
                              {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active
                            </span>
                          )}
                        </div>
                        {(activeFilterCount > 0 || search) && (
                          <button onClick={clearFilters} style={{
                            padding: "5px 12px", borderRadius: 6, border: "1px solid #fca5a5",
                            background: "#fef2f2", cursor: "pointer", fontSize: 12,
                            color: "#dc2626", fontFamily: "inherit"
                          }}>Clear all ×</button>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginRight: 2 }}>OS:</span>
                        {osOptions.map(os => (
                          <FilterChip key={os} label={os === "all" ? "All" : os} active={filterOS === os}
                            onClick={() => setFilterOS(os)} color="#6366f1" />
                        ))}
                        <div style={{ width: 1, height: 20, background: "#e2e8f0", margin: "0 4px" }} />
                        <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginRight: 2 }}>Kernel:</span>
                        <FilterChip label="All"        active={filterKernelStatus === "all"}      onClick={() => setFilterKernelStatus("all")}      color="#64748b" />
                        <FilterChip label="Outdated"   active={filterKernelStatus === "outdated"} onClick={() => setFilterKernelStatus("outdated")} color="#ef4444" />
                        <FilterChip label="Up to date" active={filterKernelStatus === "uptodate"} onClick={() => setFilterKernelStatus("uptodate")} color="#10b981" />
                        <div style={{ width: 1, height: 20, background: "#e2e8f0", margin: "0 4px" }} />
                        <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginRight: 2 }}>Patches:</span>
                        <FilterChip label="All"     active={filterPatchStatus === "all"}   onClick={() => setFilterPatchStatus("all")}   color="#64748b" />
                        <FilterChip label="Pending" active={filterPatchStatus === "dirty"} onClick={() => setFilterPatchStatus("dirty")} color="#f59e0b" />
                        <FilterChip label="Clean"   active={filterPatchStatus === "clean"} onClick={() => setFilterPatchStatus("clean")} color="#10b981" />
                      </div>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                      <thead style={{ background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                        <tr>
                          <th style={thStyle("host")} onClick={() => sortBy("host")}>Host</th>
                          <th style={{ ...thStyle("os_version"), width: 120 }} onClick={() => sortBy("os_version")}>OS</th>
                          <th style={{ ...thStyle("last_reboot_time"), width: 140 }} onClick={() => sortBy("last_reboot_time")}>Last Reboot</th>
                          <th style={thStyle("current_kernel_version")} onClick={() => sortBy("current_kernel_version")}>Current Kernel</th>
                          <th style={thStyle(null)}>Latest Kernel</th>
                          <th style={{ ...thStyle(null), width: 130 }}>Kernel Status</th>
                          <th style={{ ...thStyle("package_count"), width: 140 }} onClick={() => sortBy("package_count")}>Pending Security Patches</th>
                          <th style={{ ...thStyle(null), width: 80 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHosts.length === 0
                          ? <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No hosts match your filters</td></tr>
                          : filteredHosts.map(h => <HostRow key={h.host} host={h} />)
                        }
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* ── VM INVENTORY ── */}
              {tab === "hosts" && (
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>

                  {/* search + filter bar */}
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
                        {filteredHosts.length} of {totalHosts} hosts
                        {activeFilterCount > 0 && (
                          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: "#3b82f6" }}>
                            {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {(activeFilterCount > 0 || search) && (
                          <button onClick={clearFilters} style={{
                            padding: "5px 12px", borderRadius: 6, border: "1px solid #fca5a5",
                            background: "#fef2f2", cursor: "pointer", fontSize: 12,
                            color: "#dc2626", fontFamily: "inherit"
                          }}>
                            Clear all ×
                          </button>
                        )}
                        <div style={{ position: "relative" }}>
                          <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search by hostname..."
                            style={{ padding: "8px 12px 8px 34px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", width: 240, fontFamily: "inherit" }} />
                          <div style={{ position: "absolute", top: "50%", left: 10, transform: "translateY(-50%)" }}>
                            <Icon d={Icons.search} size={14} color="#94a3b8" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* filter chips */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginRight: 2 }}>OS:</span>
                      {osOptions.map(os => (
                        <FilterChip key={os} label={os === "all" ? "All" : os} active={filterOS === os}
                          onClick={() => setFilterOS(os)} color="#6366f1" />
                      ))}

                      <div style={{ width: 1, height: 20, background: "#e2e8f0", margin: "0 4px" }} />

                      <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginRight: 2 }}>Kernel:</span>
                      <FilterChip label="All"        active={filterKernelStatus === "all"}      onClick={() => setFilterKernelStatus("all")}      color="#64748b" />
                      <FilterChip label="Outdated"   active={filterKernelStatus === "outdated"} onClick={() => setFilterKernelStatus("outdated")} color="#ef4444" />
                      <FilterChip label="Up to date" active={filterKernelStatus === "uptodate"} onClick={() => setFilterKernelStatus("uptodate")} color="#10b981" />

                      <div style={{ width: 1, height: 20, background: "#e2e8f0", margin: "0 4px" }} />

                      <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginRight: 2 }}>Patches:</span>
                      <FilterChip label="All"     active={filterPatchStatus === "all"}   onClick={() => setFilterPatchStatus("all")}   color="#64748b" />
                      <FilterChip label="Pending" active={filterPatchStatus === "dirty"} onClick={() => setFilterPatchStatus("dirty")} color="#f59e0b" />
                      <FilterChip label="Clean"   active={filterPatchStatus === "clean"} onClick={() => setFilterPatchStatus("clean")} color="#10b981" />
                    </div>
                  </div>

                  <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                    <thead style={{ background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                      <tr>
                        <th style={thStyle("host")} onClick={() => sortBy("host")}>Host {sortCol === "host" ? (sortDir === "asc" ? "↑" : "↓") : ""}</th>
                        <th style={{ ...thStyle("os_version"), width: 120 }} onClick={() => sortBy("os_version")}>OS {sortCol === "os_version" ? (sortDir === "asc" ? "↑" : "↓") : ""}</th>
                        <th style={{ ...thStyle("last_reboot_time"), width: 140 }} onClick={() => sortBy("last_reboot_time")}>Last Reboot {sortCol === "last_reboot_time" ? (sortDir === "asc" ? "↑" : "↓") : ""}</th>
                        <th style={thStyle("current_kernel_version")} onClick={() => sortBy("current_kernel_version")}>Current Kernel {sortCol === "current_kernel_version" ? (sortDir === "asc" ? "↑" : "↓") : ""}</th>
                        <th style={thStyle(null)}>Latest Kernel</th>
                        <th style={{ ...thStyle(null), width: 130 }}>Status</th>
                        <th style={{ ...thStyle("package_count"), width: 160 }} onClick={() => sortBy("package_count")}>Pending Packages {sortCol === "package_count" ? (sortDir === "asc" ? "↑" : "↓") : ""}</th>
                        <th style={{ ...thStyle(null), width: 80 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHosts.length === 0
                        ? <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No hosts match your filters</td></tr>
                        : filteredHosts.map(h => <HostRow key={h.host} host={h} />)
                      }
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── SCAN HISTORY ── */}
              {tab === "history" && (
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
                    {history.length} scan run{history.length !== 1 ? "s" : ""}
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                    <thead style={{ background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                      <tr>
                        <th style={{ ...thStyle(null), width: 140 }}>Scan ID</th>
                        <th style={thStyle(null)}>Triggered At</th>
                        <th style={{ ...thStyle(null), width: 160 }}>Hosts Scanned</th>
                        <th style={{ ...thStyle(null), width: 140 }}>Status</th>
                        <th style={{ ...thStyle(null), width: 130 }}>Return Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.length === 0
                        ? <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No scan history yet</td></tr>
                        : history.map(s => (
                          <tr key={s.scan_id} style={{ borderBottom: "1px solid #f1f5f9" }}
                            onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                            onMouseLeave={e => e.currentTarget.style.background = ""}>
                            <td style={{ padding: "14px 16px", fontSize: 11, fontFamily: "monospace", color: "#64748b" }}>{s.scan_id.slice(0, 8)}...</td>
                            <td style={{ padding: "14px 16px", fontSize: 13, color: "#334155" }}>{fmtDate(s.scanned_at)}</td>
                            <td style={{ padding: "14px 16px", fontSize: 13, color: "#334155" }}>{s.host_count} hosts</td>
                            <td style={{ padding: "14px 16px" }}>{s.status === "successful" ? badge("Successful", "green") : badge(s.status, "red")}</td>
                            <td style={{ padding: "14px 16px", fontSize: 12, fontFamily: "monospace", color: s.rc === 0 ? "#10b981" : "#ef4444" }}>{s.rc}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* ── MODALS ── */}
      {showHostsManager && <HostsManager onClose={() => setShowHostsManager(false)} onSaved={fetchInventoryInfo} />}
      {showInventoryManager && <InventoryManager onClose={() => { setShowInventoryManager(false); fetchInventoryInfo(); }} onActivated={fetchInventoryInfo} />}

      {/* ── REFRESH TOAST ── */}
      {refreshedAt && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 999,
          background: "#0f172a", color: "#4ade80", padding: "10px 16px", borderRadius: 8,
          fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)", animation: "fadeIn 0.2s ease"
        }}>
          <Icon d={Icons.check} size={13} color="#4ade80" />
          Refreshed at {refreshedAt.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}