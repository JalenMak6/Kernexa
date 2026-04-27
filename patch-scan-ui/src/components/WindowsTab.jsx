import { useState, useEffect } from "react";
import { StatCard } from "./StatCard.jsx";
import { badge, fmtDate } from "../utils/helpers.jsx";
import { Icon, Icons } from "../utils/icons.jsx";
import { apiFetch } from "../utils/api";

function fmtWinDate(iso) {
  if (!iso) return null;
  try {
    const clean = iso.replace(/([+-]\d{2}:\d{2})Z$/, '$1').replace(/Z$/, '');
    const d = new Date(clean + (clean.includes('+') || clean.includes('-', 8) ? '' : 'Z'));
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString("en-CA", { year: "numeric", month: "short", day: "numeric" });
  } catch { return null; }
}

function shortOsLabel(osName) {
  if (!osName) return "Unknown";
  const year     = osName.match(/\b(2008|2012|2016|2019|2022|2025|10|11)\b/)?.[1] || "";
  const isServer = /server/i.test(osName);
  const isEval   = /evaluation/i.test(osName);
  const isDC     = /datacenter/i.test(osName);
  const isStd    = /standard/i.test(osName);
  const edition  = isDC ? "DC" : isStd ? "Std" : "";
  const evalTag  = isEval ? " Eval" : "";
  if (isServer) return `WS ${year}${edition ? " " + edition : ""}${evalTag}`.trim();
  return `Win ${year}${evalTag}`.trim() || osName.slice(0, 20);
}

const OS_BADGE_CLS = {
  "2022": "bg-blue-tint text-blue-deep border-blue-border",
  "2019": "bg-green-tint text-green-deeper border-green-border",
  "2016": "bg-purple-tint text-purple-dark border-purple-border",
  "2012": "bg-orange-tint text-orange-dark border-orange-border",
  "10":   "bg-yellow-tint text-yellow-dark border-yellow-border",
  "11":   "bg-teal-tint text-teal border-teal-border",
};

function osVersionBadge(osName) {
  if (!osName) return null;
  const lower = osName.toLowerCase();
  const key   = ["2022","2019","2016","2012","10","11"].find(k => lower.includes(k));
  const cls   = key ? OS_BADGE_CLS[key] : "bg-bg-subtle text-text-muted-c border-border-muted";
  return (
    <span className={`border px-2 py-[2px] rounded-pill text-sm font-bold whitespace-nowrap ${cls}`}>
      {shortOsLabel(osName)}
    </span>
  );
}

const SEV_CLS = {
  Critical:  "bg-red-tint text-red-dark border-red-border",
  Important: "bg-orange-tint text-orange border-orange-border",
  Moderate:  "bg-amber-tint text-amber border-yellow-border",
  Low:       "bg-green-tint text-green-dark border-green-border",
};

function severityBadge(sev) {
  if (!sev || sev === "NotAvailable") return <span className="text-text-ghost text-sm">—</span>;
  const cls = SEV_CLS[sev] || "bg-bg-subtle text-text-muted-c border-border-base";
  return <span className={`border px-2 py-[2px] rounded-pill text-sm font-bold ${cls}`}>{sev}</span>;
}

const EXPOSURE_CLS = {
  external:  { card: "bg-blue-tint text-blue-deep border-blue-border",     outline: "var(--blue-deep)"  },
  internal:  { card: "bg-green-tint text-green-dark border-green-border",  outline: "var(--green-dark)" },
  interface: { card: "bg-amber-tint text-amber border-yellow-border",      outline: "var(--amber)"      },
};
const EXPOSURE_LABELS = { external: "External", internal: "Internal", interface: "Interface" };

function ExposureBadge({ exposure, bindAddress }) {
  const cls = EXPOSURE_CLS[exposure]?.card || "bg-bg-subtle text-text-faint border-border-base";
  return (
    <span title={bindAddress} className={`border rounded-md px-2 py-[2px] text-sm font-bold whitespace-nowrap ${cls}`}>
      {EXPOSURE_LABELS[exposure] || exposure}
    </span>
  );
}

// ── Host detail panel ─────────────────────────────────────────────────────────

function WinHostDetailPanel({ hostname, osName, osVersion, updates, onClose }) {
  const [activeTab,    setActiveTab]    = useState("patches");
  const [ports,        setPorts]        = useState([]);
  const [loadingPorts, setLoadingPorts] = useState(false);
  const [portSearch,   setPortSearch]   = useState("");
  const [portFilter,   setPortFilter]   = useState("all");

  const byClass   = {};
  updates.forEach(u => { const cls = u.classification || "Other"; if (!byClass[cls]) byClass[cls] = []; byClass[cls].push(u); });
  const clsOrder  = ["Security Updates", "Critical Updates", "Update Rollups", "Definition Updates"];
  const sortedCls = [...clsOrder.filter(c => byClass[c]), ...Object.keys(byClass).filter(c => !clsOrder.includes(c))];

  useEffect(() => {
    if (activeTab === "ports" && ports.length === 0) {
      setLoadingPorts(true);
      fetch(`/api/hosts/${encodeURIComponent(hostname)}/ports`)
        .then(r => r.json())
        .then(d => { setPorts(d.ports || []); setLoadingPorts(false); })
        .catch(() => setLoadingPorts(false));
    }
  }, [activeTab]);

  const filteredPorts = ports.filter(p => {
    const matchExposure = portFilter === "all" || p.exposure === portFilter;
    const matchSearch   = !portSearch ||
      String(p.port).includes(portSearch) ||
      p.service?.toLowerCase().includes(portSearch.toLowerCase()) ||
      p.bind_address?.includes(portSearch);
    return matchExposure && matchSearch;
  });

  const portCounts = ports.reduce((acc, p) => { acc[p.exposure] = (acc[p.exposure] || 0) + 1; return acc; }, {});

  const tabs = [
    { id: "patches", label: `Patches (${updates.length})` },
    { id: "ports",   label: `Open Ports${ports.length > 0 ? ` (${ports.length})` : ""}` },
  ];

  return (
    <div className="fixed inset-0 bg-[var(--backdrop-dark)] z-[1000] flex items-center justify-center p-6 backdrop-blur-sm">
      <div className="bg-bg-card border border-border-base rounded-3xl w-full max-w-[760px] max-h-[90vh] flex flex-col shadow-modal-lg overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-5 border-b border-border-base">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="font-extrabold text-xl text-text-primary font-mono">🪟 {hostname}</div>
              <div className="text-base text-text-faint mt-0.5">{osName} · {osVersion}</div>
              <div className="mt-2 flex gap-2 flex-wrap">
                {sortedCls.map(cls => (
                  <span key={cls} className="text-base text-text-secondary">
                    <strong>{byClass[cls].length}</strong> {cls}
                  </span>
                ))}
              </div>
            </div>
            <button onClick={onClose}
              className="bg-bg-subtle border border-border-muted rounded-base w-8 h-8 cursor-pointer flex items-center justify-center text-base text-text-secondary shrink-0 hover:bg-border-base transition-colors">
              ×
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-0.5">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className="px-4 py-2 text-md font-semibold cursor-pointer border-none bg-transparent font-[inherit] transition-colors"
                style={{
                  color: activeTab === t.id ? "var(--indigo)" : "var(--text-faint)",
                  borderBottom: `2px solid ${activeTab === t.id ? "var(--indigo)" : "transparent"}`,
                }}
              >{t.label}</button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ── Patches tab ── */}
          {activeTab === "patches" && sortedCls.map(cls => (
            <div key={cls} className="mb-5">
              <div className="text-sm font-bold text-text-faint uppercase tracking-[0.05em] mb-2">
                {cls} ({byClass[cls].length})
              </div>
              <div className="flex flex-col gap-2">
                {byClass[cls].map((u, i) => (
                  <div key={i} className="border border-border-base rounded-lg px-[14px] py-3 bg-bg-row">
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-base font-bold text-indigo">KB{u.KBID}</span>
                        {severityBadge(u.msrcSeverity)}
                        {badge(u.rebootRequired === "NeverReboots" ? "No Reboot" : u.rebootRequired === "AlwaysRequiresReboot" ? "Reboot Required" : "May Reboot",
                          u.rebootRequired === "NeverReboots" ? "green" : u.rebootRequired === "AlwaysRequiresReboot" ? "red" : "yellow")}
                      </div>
                      {u.version && <span className="text-sm text-text-ghost font-mono">v{u.version}</span>}
                    </div>
                    <div className="text-base text-text-secondary leading-relaxed mb-1">{u.patchName}</div>
                    {u.publishedDateTime && fmtWinDate(u.publishedDateTime) && (
                      <div className="text-sm text-text-ghost">Published: {fmtWinDate(u.publishedDateTime)}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* ── Open Ports tab ── */}
          {activeTab === "ports" && (
            <div>
              {loadingPorts ? (
                <div className="text-center py-10 text-text-ghost">Loading port data...</div>
              ) : ports.length === 0 ? (
                <div className="text-center py-10 text-text-ghost">No port data available. Run a Windows scan to collect port information.</div>
              ) : (
                <div>
                  {/* Exposure summary cards */}
                  <div className="flex gap-2 mb-4">
                    {[
                      { key: "external",  label: "External",  cls: "bg-blue-tint text-blue-deep border-blue-border",    desc: "0.0.0.0"     },
                      { key: "internal",  label: "Internal",  cls: "bg-green-tint text-green-dark border-green-border", desc: "127.0.0.1"   },
                      { key: "interface", label: "Interface", cls: "bg-amber-tint text-amber border-yellow-border",     desc: "Specific IP" },
                    ].map(s => (
                      <div key={s.key}
                        className={`flex-1 border rounded-base px-[14px] py-2.5 text-center cursor-pointer transition-all ${s.cls}`}
                        style={{ outline: portFilter === s.key ? `2px solid ${EXPOSURE_CLS[s.key]?.outline}` : "none" }}
                        onClick={() => setPortFilter(portFilter === s.key ? "all" : s.key)}
                      >
                        <div className="text-xs font-bold uppercase tracking-[0.05em]">{s.label}</div>
                        <div className="text-[22px] font-extrabold mt-0.5">{portCounts[s.key] || 0}</div>
                        <div className="text-xs opacity-70">{s.desc}</div>
                      </div>
                    ))}
                  </div>

                  {/* Search */}
                  <input value={portSearch} onChange={e => setPortSearch(e.target.value)}
                    placeholder="Search port, service, or bind address..."
                    className="w-full px-3 py-2 border border-border-base rounded-base text-md mb-3 font-[inherit] outline-none bg-bg-page text-text-primary box-border"
                  />

                  {/* Ports table */}
                  <div className="border border-border-base rounded-lg overflow-hidden">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          {["Port", "Protocol", "Bind Address", "Service", "Exposure"].map(h => (
                            <th key={h} className="px-3 py-[10px] text-left text-xs font-bold tracking-[0.06em] uppercase text-text-ghost bg-bg-subtle border-b border-border-base">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPorts.length === 0 ? (
                          <tr><td colSpan={5} className="p-6 text-center text-text-ghost">No ports match your filter</td></tr>
                        ) : filteredPorts.map((p, i) => (
                          <tr key={i} className="border-b border-border-subtle hover:bg-bg-hover transition-colors">
                            <td className="px-3 py-[10px] font-mono font-bold text-md text-text-primary">{p.port}</td>
                            <td className="px-3 py-[10px] text-base text-text-muted-c uppercase font-semibold">{p.protocol}</td>
                            <td className="px-3 py-[10px] font-mono text-base text-text-secondary">{p.bind_address}</td>
                            <td className="px-3 py-[10px] text-base text-text-secondary font-mono">{p.service || "—"}</td>
                            <td className="px-3 py-[10px]"><ExposureBadge exposure={p.exposure} bindAddress={p.bind_address} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 text-sm text-text-ghost">
                    {filteredPorts.length} of {ports.length} ports shown
                    {portFilter !== "all" && (
                      <button onClick={() => setPortFilter("all")}
                        className="ml-2 bg-transparent border-none text-blue-deep cursor-pointer text-sm p-0 font-[inherit]">
                        clear filter ×
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Windows host row ──────────────────────────────────────────────────────────

const portChipCls = {
  external:  "bg-blue-tint text-blue-deep border-blue-border",
  internal:  "bg-green-tint text-green-dark border-green-border",
  interface: "bg-amber-tint text-amber border-yellow-border",
};

function WinHostRow({ hostname, osName, osVersion, updates }) {
  const [showDetail,   setShowDetail]   = useState(false);
  const [ports,        setPorts]        = useState(null);
  const [loadingPorts, setLoadingPorts] = useState(false);

  const securityCount   = updates.filter(u => u.classification === "Security Updates").length;
  const criticalCount   = updates.filter(u => u.classification === "Critical Updates").length;
  const rollupCount     = updates.filter(u => u.classification === "Update Rollups").length;
  const definitionCount = updates.filter(u => u.classification === "Definition Updates").length;
  const needsReboot     = updates.some(u => u.rebootRequired === "AlwaysRequiresReboot" || u.rebootRequired === "CanRequestReboot");

  useEffect(() => {
    setLoadingPorts(true);
    fetch(`/api/hosts/${encodeURIComponent(hostname)}/ports`)
      .then(r => r.json())
      .then(d => { setPorts(d.ports || []); setLoadingPorts(false); })
      .catch(() => { setPorts([]); setLoadingPorts(false); });
  }, [hostname]);

  const externalPorts  = (ports || []).filter(p => p.exposure === "external");
  const internalPorts  = (ports || []).filter(p => p.exposure === "internal");
  const interfacePorts = (ports || []).filter(p => p.exposure === "interface");
  const allChips       = [...externalPorts, ...internalPorts, ...interfacePorts];
  const MAX            = 5;
  const shown          = allChips.slice(0, MAX);
  const overflow       = allChips.length - MAX;

  return (
    <>
      <tr className="border-b border-border-subtle hover:bg-bg-hover transition-colors">

        <td className="px-4 py-3 overflow-hidden">
          <button onClick={() => setShowDetail(true)}
            className="bg-transparent border-none p-0 cursor-pointer font-semibold text-md text-text-primary font-mono text-left block max-w-full overflow-hidden text-ellipsis whitespace-nowrap hover:text-blue transition-colors"
            title={hostname}
          >
            {hostname.includes(".") && !/^\d+\.\d+\.\d+\.\d+$/.test(hostname)
              ? <>{hostname.split(".")[0]}<span className="text-text-ghost font-normal text-sm">.{hostname.split(".").slice(1).join(".")}</span></>
              : hostname
            }
          </button>
        </td>

        <td className="px-4 py-[14px] w-[140px]">{osVersionBadge(osName)}</td>
        <td className="px-4 py-[14px] text-base text-text-muted-c font-mono w-[110px]">{osVersion || "—"}</td>
        <td className="px-4 py-[14px] w-[90px]">
          {updates.length > 0
            ? <span className="font-bold text-lg text-red-dark">{updates.length}</span>
            : <span className="text-green font-bold">✓ Clean</span>}
        </td>
        <td className="px-4 py-[14px] w-[190px]">
          <div className="flex gap-1 flex-wrap">
            {securityCount   > 0 && <span className="text-sm font-bold bg-red-tint-mid text-red-text border border-red-border-lt px-[7px] py-px rounded-pill">🔒 {securityCount}</span>}
            {criticalCount   > 0 && <span className="text-sm font-bold bg-red-tint text-red-dark border border-red-border px-[7px] py-px rounded-pill">⚠ {criticalCount}</span>}
            {rollupCount     > 0 && <span className="text-sm font-bold bg-orange-tint text-orange-dark border border-orange-border px-[7px] py-px rounded-pill">📦 {rollupCount}</span>}
            {definitionCount > 0 && <span className="text-sm font-bold bg-blue-tint text-blue-deep border border-blue-border px-[7px] py-px rounded-pill">🛡 {definitionCount}</span>}
            {updates.length === 0 && <span className="text-sm text-text-ghost">—</span>}
          </div>
        </td>
        <td className="px-4 py-[14px] w-[110px]">
          {needsReboot ? badge("May Reboot", "yellow") : badge("No Reboot", "green")}
        </td>

        {/* Open Ports column */}
        <td className="px-4 py-[10px] w-[160px]">
          {loadingPorts ? (
            <span className="text-text-ghost text-sm">...</span>
          ) : ports === null || allChips.length === 0 ? (
            <span className="text-text-disabled text-sm">—</span>
          ) : (
            <div className="flex flex-wrap gap-[3px]">
              {shown.map((p, i) => {
                const cls = portChipCls[p.exposure] || portChipCls.external;
                return (
                  <span key={i}
                    title={`${p.protocol?.toUpperCase()} ${p.bind_address}:${p.port} — ${p.service}`}
                    className={`border rounded-sm px-1.5 py-px text-xs font-mono font-bold whitespace-nowrap ${cls}`}>
                    {p.port}{p.service && p.service !== "unknown" ? ` ${p.service}` : ""}
                  </span>
                );
              })}
              {overflow > 0 && (
                <span title={allChips.slice(MAX).map(p => `${p.port} ${p.service}`).join(", ")}
                  className="bg-bg-subtle text-text-ghost border border-border-base rounded-sm px-1.5 py-px text-xs font-semibold whitespace-nowrap cursor-default">
                  +{overflow}
                </span>
              )}
            </div>
          )}
        </td>

        <td className="px-4 py-[14px] w-[75px]">
          <button onClick={() => setShowDetail(true)}
            className="bg-transparent border border-border-base rounded-md px-2.5 py-1 cursor-pointer text-base text-text-muted-c font-[inherit] hover:bg-bg-subtle transition-colors">
            View
          </button>
        </td>
      </tr>

      {showDetail && <WinHostDetailPanel hostname={hostname} osName={osName} osVersion={osVersion} updates={updates} onClose={() => setShowDetail(false)} />}
    </>
  );
}

// ── CSV export ────────────────────────────────────────────────────────────────

function exportWindowsCSV(records) {
  if (!records?.length) return;
  const headers = ["Hostname","OS Name","OS Version","KBID","Patch Name","Version","Classification","MSRC Severity","Reboot Required","Published Date"];
  const rows    = records.map(r => [r.hostname, r.osName, r.osVersion, r.KBID, r.patchName, r.version || "", r.classification, r.msrcSeverity, r.rebootRequired, r.publishedDateTime ? fmtWinDate(r.publishedDateTime) || "" : ""]);
  const csv     = [headers.join(","), ...rows.map(r => r.map(v => `"${(v||"").toString().replace(/"/g,'""')}"`).join(","))].join("\n");
  const blob    = new Blob([csv], { type: "text/csv" });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement("a");
  a.href = url; a.download = `windows-patch-scan-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── Main WindowsTab ───────────────────────────────────────────────────────────

const thCls = "px-4 py-3 text-left text-sm font-bold tracking-[0.06em] uppercase text-text-faint whitespace-nowrap bg-transparent cursor-default select-none";

export function WindowsTab() {
  const [records,   setRecords]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [search,    setSearch]    = useState("");
  const [filterOS,  setFilterOS]  = useState("all");
  const [filterCls, setFilterCls] = useState("all");

  const load = async () => {
    setLoading(true); setError(null);
    try { setRecords(await apiFetch("/api/scans/windows/latest")); }
    catch (e) { if (e.message.includes("404")) setError("no_data"); else setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const hostMap = {};
  records.forEach(r => {
    if (!hostMap[r.hostname]) hostMap[r.hostname] = { hostname: r.hostname, osName: r.osName, osVersion: r.osVersion, updates: [] };
    hostMap[r.hostname].updates.push(r);
  });
  const hosts = Object.values(hostMap);

  const totalHosts      = hosts.length;
  const totalKBs        = records.length;
  const hostsWithSec    = hosts.filter(h => h.updates.some(u => u.classification === "Security Updates" || u.classification === "Critical Updates")).length;
  const hostsNeedReboot = hosts.filter(h => h.updates.some(u => u.rebootRequired === "AlwaysRequiresReboot" || u.rebootRequired === "CanRequestReboot")).length;
  const scannedAt       = records[0]?.scanned_at ? fmtDate(records[0].scanned_at) : null;

  const osOptions  = ["all", ...Array.from(new Set(hosts.map(h => {
    if (h.osName?.includes("2022")) return "Windows Server 2022";
    if (h.osName?.includes("2019")) return "Windows Server 2019";
    if (h.osName?.includes("2016")) return "Windows Server 2016";
    if (h.osName?.includes("2012")) return "Windows Server 2012";
    if (h.osName?.includes("10"))   return "Windows 10";
    if (h.osName?.includes("11"))   return "Windows 11";
    return "Other";
  }))).sort()];
  const clsOptions = ["all", "Security Updates", "Critical Updates", "Update Rollups", "Definition Updates"];

  const filteredHosts = hosts.filter(h => {
    const matchSearch = !search || h.hostname.toLowerCase().includes(search.toLowerCase()) || h.updates.some(u => u.KBID?.includes(search) || u.patchName?.toLowerCase().includes(search.toLowerCase()));
    const matchOS  = filterOS  === "all" || (filterOS === "Windows Server 2022" && h.osName?.includes("2022")) || (filterOS === "Windows Server 2019" && h.osName?.includes("2019")) || (filterOS === "Windows Server 2016" && h.osName?.includes("2016")) || (filterOS === "Windows Server 2012" && h.osName?.includes("2012")) || (filterOS === "Windows 10" && h.osName?.includes("10")) || (filterOS === "Windows 11" && h.osName?.includes("11"));
    const matchCls = filterCls === "all" || h.updates.some(u => u.classification === filterCls);
    return matchSearch && matchOS && matchCls;
  });

  const selectCls = "px-2.5 py-1.5 border border-border-base rounded-base text-base font-[inherit] bg-bg-card text-text-secondary outline-none cursor-pointer";

  if (loading) return (
    <div className="flex items-center justify-center h-[300px]">
      <div className="w-8 h-8 border-[3px] border-border-base border-t-cyan rounded-full animate-spin" />
    </div>
  );

  if (error === "no_data") return (
    <div className="text-center py-20 px-8 bg-bg-card rounded-3xl border border-border-base">
      <div className="text-5xl mb-4">🪟</div>
      <div className="text-3xl font-bold text-text-secondary">No Windows scan data yet</div>
      <div className="text-lg text-text-ghost mt-1.5">Click <strong>Win Scan</strong> in the top bar to run your first Windows patch compliance scan.</div>
    </div>
  );

  if (error) return (
    <div className="bg-red-tint border border-red-border rounded-lg px-5 py-4 text-red-dark text-md">
      Error loading Windows scan data: {error}
      <button onClick={load} className="ml-3 px-3 py-1 border border-red-border-lt rounded-md bg-bg-card text-red-dark cursor-pointer text-base font-[inherit]">Retry</button>
    </div>
  );

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard icon="host"    label="Windows Hosts"   value={totalHosts}      sub={scannedAt ? `Last scan: ${scannedAt}` : "in latest scan"} accent="var(--cyan)"   />
        <StatCard icon="warning" label="Pending KBs"     value={totalKBs}        sub="total across all hosts"                                    accent="var(--amber)"  />
        <StatCard icon="scan"    label="Security / Crit" value={hostsWithSec}    sub="hosts with sec updates"                                    accent="var(--red)"    />
        <StatCard icon="refresh" label="Reboot Pending"  value={hostsNeedReboot} sub="hosts may need reboot"                                     accent="var(--purple)" />
      </div>

      <div className="bg-bg-card border border-border-base rounded-2xl overflow-hidden shadow-card">
        <div className="px-5 py-4 border-b border-border-subtle flex justify-between items-center flex-wrap gap-2.5">
          <div className="font-bold text-lg text-text-primary">
            {filteredHosts.length} of {totalHosts} Windows hosts
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <select value={filterOS}  onChange={e => setFilterOS(e.target.value)}  className={selectCls}>
              {osOptions.map(o  => <option key={o} value={o}>{o  === "all" ? "All OS versions"    : o}</option>)}
            </select>
            <select value={filterCls} onChange={e => setFilterCls(e.target.value)} className={selectCls}>
              {clsOptions.map(o => <option key={o} value={o}>{o  === "all" ? "All classifications" : o}</option>)}
            </select>
            <div className="relative">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search hostname or KB..."
                className="pl-[30px] pr-2.5 py-1.5 border border-border-base rounded-base text-base outline-none w-[200px] font-[inherit] bg-bg-card text-text-primary" />
              <div className="absolute top-1/2 left-[9px] -translate-y-1/2">
                <Icon d={Icons.search} size={13} color="var(--text-ghost)" />
              </div>
            </div>
            <button onClick={() => exportWindowsCSV(records)}
              className="px-3.5 py-1.5 border border-blue-border rounded-base bg-blue-tint cursor-pointer text-base text-blue-dark font-semibold font-[inherit] flex items-center gap-1.5">
              <Icon d={Icons.export} size={13} color="var(--blue-dark)" /> Export CSV
            </button>
          </div>
        </div>

        <table className="w-full border-collapse">
          <thead className="bg-bg-hover border-b border-border-subtle">
            <tr>
              <th className={thCls}>Host</th>
              <th className={`${thCls} w-[140px]`}>OS</th>
              <th className={`${thCls} w-[110px]`}>Version</th>
              <th className={`${thCls} w-[90px]`}>Pending KBs</th>
              <th className={`${thCls} w-[190px]`}>By Type</th>
              <th className={`${thCls} w-[110px]`}>Reboot</th>
              <th className={`${thCls} w-[160px]`}>Open Ports</th>
              <th className={`${thCls} w-[75px]`}></th>
            </tr>
          </thead>
          <tbody>
            {filteredHosts.length === 0
              ? <tr><td colSpan={8} className="p-8 text-center text-text-ghost text-md">No hosts match your filters</td></tr>
              : filteredHosts.map(h => <WinHostRow key={h.hostname} hostname={h.hostname} osName={h.osName} osVersion={h.osVersion} updates={h.updates} />)
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}
