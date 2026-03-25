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

// ── Shared badge helpers ──────────────────────────────────────────────────────

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

function osVersionBadge(osName) {
  if (!osName) return null;
  const lower = osName.toLowerCase();
  let bg, color, border;
  if      (lower.includes("2022")) { bg = "var(--blue-tint)";   color = "var(--blue-deep)";    border = "var(--blue-border)";   }
  else if (lower.includes("2019")) { bg = "var(--green-tint)";  color = "var(--green-deeper)"; border = "var(--green-border)";  }
  else if (lower.includes("2016")) { bg = "var(--purple-tint)"; color = "var(--purple-dark)";  border = "var(--purple-border)"; }
  else if (lower.includes("2012")) { bg = "var(--orange-tint)"; color = "var(--orange-dark)";  border = "var(--orange-border)"; }
  else if (lower.includes("10"))   { bg = "var(--yellow-tint)"; color = "var(--yellow-dark)";  border = "var(--yellow-border)"; }
  else if (lower.includes("11"))   { bg = "var(--teal-tint)";   color = "var(--teal)";         border = "var(--teal-border)";   }
  else                              { bg = "var(--bg-subtle)";   color = "var(--text-muted)";   border = "var(--border-muted)";  }
  return (
    <span style={{ background: bg, color, border: `1px solid ${border}`, padding: "2px 8px", borderRadius: "var(--radius-pill)", fontSize: "var(--text-sm)", fontWeight: 700, whiteSpace: "nowrap" }}>
      {shortOsLabel(osName)}
    </span>
  );
}

function severityBadge(sev) {
  if (!sev || sev === "NotAvailable") return <span style={{ color: "var(--text-ghost)", fontSize: "var(--text-sm)" }}>—</span>;
  const map = {
    Critical:  ["var(--red-tint)",    "var(--red-dark)",   "var(--red-border)"   ],
    Important: ["var(--orange-tint)", "var(--orange)",     "var(--orange-border)"],
    Moderate:  ["var(--amber-tint)",  "var(--amber)",      "var(--yellow-border)"],
    Low:       ["var(--green-tint)",  "var(--green-dark)", "var(--green-border)" ],
  };
  const [bg, color, border] = map[sev] || ["var(--bg-subtle)", "var(--text-muted)", "var(--border)"];
  return <span style={{ background: bg, color, border: `1px solid ${border}`, padding: "2px 8px", borderRadius: "var(--radius-pill)", fontSize: "var(--text-sm)", fontWeight: 700 }}>{sev}</span>;
}

// ── Exposure badge ────────────────────────────────────────────────────────────

function ExposureBadge({ exposure, bindAddress }) {
  const cfg = {
    external:  { bg: "var(--blue-tint)",  color: "var(--blue-deep)",  border: "var(--blue-border)",   label: "External"  },
    internal:  { bg: "var(--green-tint)", color: "var(--green-dark)", border: "var(--green-border)",  label: "Internal"  },
    interface: { bg: "var(--amber-tint)", color: "var(--amber)",      border: "var(--yellow-border)", label: "Interface" },
  }[exposure] || { bg: "var(--bg-subtle)", color: "var(--text-faint)", border: "var(--border)", label: exposure };
  return (
    <span title={bindAddress} style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: "var(--radius-md)", padding: "2px 8px", fontSize: "var(--text-sm)", fontWeight: 700, whiteSpace: "nowrap" }}>
      {cfg.label}
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

  const thStyle = { padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-ghost)",
    background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)" };

  const tabs = [
    { id: "patches", label: `Patches (${updates.length})` },
    { id: "ports",   label: `Open Ports${ports.length > 0 ? ` (${ports.length})` : ""}` },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--backdrop-dark)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-6)", backdropFilter: "blur(2px)" }}>
      <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius-3xl)", width: "100%", maxWidth: 760, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "var(--shadow-modal-lg)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "var(--space-5) var(--space-6) 0", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-3)" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: "var(--text-xl)", color: "var(--text-primary)", fontFamily: "monospace" }}>🪟 {hostname}</div>
              <div style={{ fontSize: "var(--text-base)", color: "var(--text-faint)", marginTop: 2 }}>{osName} · {osVersion}</div>
              <div style={{ marginTop: "var(--space-2)", display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                {sortedCls.map(cls => (
                  <span key={cls} style={{ fontSize: "var(--text-base)", color: "var(--text-secondary)" }}>
                    <strong>{byClass[cls].length}</strong> {cls}
                  </span>
                ))}
              </div>
            </div>
            <button onClick={onClose}
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-muted)", borderRadius: "var(--radius-base)", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "var(--text-secondary)", flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--border)"}
              onMouseLeave={e => e.currentTarget.style.background = "var(--bg-subtle)"}
            >×</button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 2 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                padding: "8px 16px", fontSize: "var(--text-md)", fontWeight: 600, cursor: "pointer",
                border: "none", background: "none", fontFamily: "inherit",
                color: activeTab === t.id ? "var(--indigo)" : "var(--text-faint)",
                borderBottom: `2px solid ${activeTab === t.id ? "var(--indigo)" : "transparent"}`,
                transition: "all 0.15s",
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-4) var(--space-6)" }}>

          {/* ── Patches tab ── */}
          {activeTab === "patches" && sortedCls.map(cls => (
            <div key={cls} style={{ marginBottom: "var(--space-5)" }}>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-2)" }}>
                {cls} ({byClass[cls].length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {byClass[cls].map((u, i) => (
                  <div key={i} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "12px 14px", background: "var(--bg-row)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "monospace", fontSize: "var(--text-base)", fontWeight: 700, color: "var(--indigo)" }}>KB{u.KBID}</span>
                        {severityBadge(u.msrcSeverity)}
                        {badge(u.rebootRequired === "NeverReboots" ? "No Reboot" : u.rebootRequired === "AlwaysRequiresReboot" ? "Reboot Required" : "May Reboot",
                          u.rebootRequired === "NeverReboots" ? "green" : u.rebootRequired === "AlwaysRequiresReboot" ? "red" : "yellow")}
                      </div>
                      {u.version && <span style={{ fontSize: "var(--text-sm)", color: "var(--text-ghost)", fontFamily: "monospace" }}>v{u.version}</span>}
                    </div>
                    <div style={{ fontSize: "var(--text-base)", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 4 }}>{u.patchName}</div>
                    {u.publishedDateTime && fmtWinDate(u.publishedDateTime) && (
                      <div style={{ fontSize: "var(--text-sm)", color: "var(--text-ghost)" }}>Published: {fmtWinDate(u.publishedDateTime)}</div>
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
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-ghost)" }}>Loading port data...</div>
              ) : ports.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-ghost)" }}>No port data available. Run a Windows scan to collect port information.</div>
              ) : (
                <div>
                  {/* Exposure summary cards */}
                  <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
                    {[
                      { key: "external",  label: "External",  bg: "var(--blue-tint)",  color: "var(--blue-deep)",  border: "var(--blue-border)",   desc: "0.0.0.0"    },
                      { key: "internal",  label: "Internal",  bg: "var(--green-tint)", color: "var(--green-dark)", border: "var(--green-border)",  desc: "127.0.0.1"  },
                      { key: "interface", label: "Interface", bg: "var(--amber-tint)", color: "var(--amber)",      border: "var(--yellow-border)", desc: "Specific IP" },
                    ].map(s => (
                      <div key={s.key} style={{
                        flex: 1, background: s.bg, border: `1px solid ${s.border}`,
                        borderRadius: "var(--radius-base)", padding: "10px 14px", textAlign: "center",
                        cursor: "pointer", outline: portFilter === s.key ? `2px solid ${s.color}` : "none",
                        transition: "all 0.15s",
                      }} onClick={() => setPortFilter(portFilter === s.key ? "all" : s.key)}>
                        <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: s.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: s.color, marginTop: 2 }}>{portCounts[s.key] || 0}</div>
                        <div style={{ fontSize: "var(--text-xs)", color: s.color, opacity: 0.7 }}>{s.desc}</div>
                      </div>
                    ))}
                  </div>

                  {/* Search */}
                  <input value={portSearch} onChange={e => setPortSearch(e.target.value)}
                    placeholder="Search port, service, or bind address..."
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-base)", fontSize: "var(--text-md)", marginBottom: "var(--space-3)", fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: "var(--bg-page)", color: "var(--text-primary)" }}
                  />

                  {/* Ports table */}
                  <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {["Port", "Protocol", "Bind Address", "Service", "Exposure"].map(h => (
                            <th key={h} style={thStyle}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPorts.length === 0 ? (
                          <tr><td colSpan={5} style={{ padding: "24px", textAlign: "center", color: "var(--text-ghost)" }}>No ports match your filter</td></tr>
                        ) : filteredPorts.map((p, i) => (
                          <tr key={i}
                            style={{ borderBottom: "1px solid var(--border-subtle)", transition: "background 0.1s" }}
                            onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                            onMouseLeave={e => e.currentTarget.style.background = ""}
                          >
                            <td style={{ padding: "10px 12px", fontFamily: "monospace", fontWeight: 700, fontSize: "var(--text-md)", color: "var(--text-primary)" }}>{p.port}</td>
                            <td style={{ padding: "10px 12px", fontSize: "var(--text-base)", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>{p.protocol}</td>
                            <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: "var(--text-base)", color: "var(--text-secondary)" }}>{p.bind_address}</td>
                            <td style={{ padding: "10px 12px", fontSize: "var(--text-base)", color: "var(--text-secondary)", fontFamily: "monospace" }}>{p.service || "—"}</td>
                            <td style={{ padding: "10px 12px" }}><ExposureBadge exposure={p.exposure} bindAddress={p.bind_address} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: "var(--space-3)", fontSize: "var(--text-sm)", color: "var(--text-ghost)" }}>
                    {filteredPorts.length} of {ports.length} ports shown
                    {portFilter !== "all" && (
                      <button onClick={() => setPortFilter("all")} style={{ marginLeft: 8, background: "none", border: "none", color: "var(--blue-deep)", cursor: "pointer", fontSize: "var(--text-sm)", padding: 0, fontFamily: "inherit" }}>
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

function WinHostRow({ hostname, osName, osVersion, updates }) {
  const [showDetail,   setShowDetail]   = useState(false);
  const [ports,        setPorts]        = useState(null);
  const [loadingPorts, setLoadingPorts] = useState(false);

  const securityCount   = updates.filter(u => u.classification === "Security Updates").length;
  const criticalCount   = updates.filter(u => u.classification === "Critical Updates").length;
  const rollupCount     = updates.filter(u => u.classification === "Update Rollups").length;
  const definitionCount = updates.filter(u => u.classification === "Definition Updates").length;
  const needsReboot     = updates.some(u => u.rebootRequired === "AlwaysRequiresReboot" || u.rebootRequired === "CanRequestReboot");

  // Fetch ports eagerly on mount
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

  const colorMap = {
    external:  { bg: "var(--blue-tint)",  color: "var(--blue-deep)",  border: "var(--blue-border)"   },
    internal:  { bg: "var(--green-tint)", color: "var(--green-dark)", border: "var(--green-border)"  },
    interface: { bg: "var(--amber-tint)", color: "var(--amber)",      border: "var(--yellow-border)" },
  };

  return (
    <>
      <tr style={{ borderBottom: "1px solid var(--border-subtle)", transition: "background 0.15s" }}
        onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
        onMouseLeave={e => e.currentTarget.style.background = ""}>

        <td style={{ padding: "12px 16px", overflow: "hidden" }}>
          <button onClick={() => setShowDetail(true)}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 600, fontSize: "var(--text-md)", color: "var(--text-primary)", fontFamily: "monospace", textAlign: "left", display: "block", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--blue)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--text-primary)"}
            title={hostname}
          >
            {hostname.includes(".") && !/^\d+\.\d+\.\d+\.\d+$/.test(hostname)
              ? <>{hostname.split(".")[0]}<span style={{ color: "var(--text-ghost)", fontWeight: 400, fontSize: "var(--text-sm)" }}>.{hostname.split(".").slice(1).join(".")}</span></>
              : hostname
            }
          </button>
        </td>

        <td style={{ padding: "14px 16px", width: 140 }}>{osVersionBadge(osName)}</td>
        <td style={{ padding: "14px 16px", fontSize: "var(--text-base)", color: "var(--text-muted)", fontFamily: "monospace", width: 110 }}>{osVersion || "—"}</td>
        <td style={{ padding: "14px 16px", width: 90 }}>
          {updates.length > 0
            ? <span style={{ fontWeight: 700, fontSize: "var(--text-lg)", color: "var(--red-dark)" }}>{updates.length}</span>
            : <span style={{ color: "var(--green)", fontWeight: 700 }}>✓ Clean</span>}
        </td>
        <td style={{ padding: "14px 16px", width: 190 }}>
          <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap" }}>
            {securityCount   > 0 && <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, background: "var(--red-tint-mid)",  color: "var(--red-text)",    border: "1px solid var(--red-border-lt)",  padding: "1px 7px", borderRadius: "var(--radius-pill)" }}>🔒 {securityCount}</span>}
            {criticalCount   > 0 && <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, background: "var(--red-tint)",     color: "var(--red-dark)",    border: "1px solid var(--red-border)",     padding: "1px 7px", borderRadius: "var(--radius-pill)" }}>⚠ {criticalCount}</span>}
            {rollupCount     > 0 && <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, background: "var(--orange-tint)",  color: "var(--orange-dark)", border: "1px solid var(--orange-border)",  padding: "1px 7px", borderRadius: "var(--radius-pill)" }}>📦 {rollupCount}</span>}
            {definitionCount > 0 && <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, background: "var(--blue-tint)",    color: "var(--blue-deep)",   border: "1px solid var(--blue-border)",    padding: "1px 7px", borderRadius: "var(--radius-pill)" }}>🛡 {definitionCount}</span>}
            {updates.length === 0 && <span style={{ fontSize: "var(--text-sm)", color: "var(--text-ghost)" }}>—</span>}
          </div>
        </td>
        <td style={{ padding: "14px 16px", width: 110 }}>
          {needsReboot ? badge("May Reboot", "yellow") : badge("No Reboot", "green")}
        </td>

        {/* Open Ports column */}
        <td style={{ padding: "10px 16px", width: 160 }}>
          {loadingPorts ? (
            <span style={{ color: "var(--text-ghost)", fontSize: "var(--text-sm)" }}>...</span>
          ) : ports === null || allChips.length === 0 ? (
            <span style={{ color: "var(--text-disabled)", fontSize: "var(--text-sm)" }}>—</span>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
              {shown.map((p, i) => {
                const c = colorMap[p.exposure] || colorMap.external;
                return (
                  <span key={i}
                    title={`${p.protocol?.toUpperCase()} ${p.bind_address}:${p.port} — ${p.service}`}
                    style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, borderRadius: "var(--radius-sm)", padding: "1px 6px", fontSize: "var(--text-xs)", fontFamily: "monospace", fontWeight: 700, whiteSpace: "nowrap" }}>
                    {p.port}{p.service && p.service !== "unknown" ? ` ${p.service}` : ""}
                  </span>
                );
              })}
              {overflow > 0 && (
                <span title={allChips.slice(MAX).map(p => `${p.port} ${p.service}`).join(", ")}
                  style={{ background: "var(--bg-subtle)", color: "var(--text-ghost)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "1px 6px", fontSize: "var(--text-xs)", fontWeight: 600, whiteSpace: "nowrap", cursor: "default" }}>
                  +{overflow}
                </span>
              )}
            </div>
          )}
        </td>

        <td style={{ padding: "14px 16px", width: 75 }}>
          <button onClick={() => setShowDetail(true)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "4px 10px", cursor: "pointer", fontSize: "var(--text-base)", color: "var(--text-muted)", fontFamily: "inherit" }}>
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

  const thStyle      = { padding: "12px 16px", textAlign: "left", fontSize: "var(--text-sm)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-faint)", whiteSpace: "nowrap", background: "transparent" };
  const selectStyle  = { padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-base)", fontSize: "var(--text-base)", fontFamily: "inherit", background: "var(--bg-card)", color: "var(--text-secondary)", outline: "none", cursor: "pointer" };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <div style={{ width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "var(--cyan)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    </div>
  );

  if (error === "no_data") return (
    <div style={{ textAlign: "center", padding: "80px 32px", background: "var(--bg-card)", borderRadius: "var(--radius-3xl)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 48, marginBottom: "var(--space-4)" }}>🪟</div>
      <div style={{ fontSize: "var(--text-3xl)", fontWeight: 700, color: "var(--text-secondary)" }}>No Windows scan data yet</div>
      <div style={{ fontSize: "var(--text-lg)", color: "var(--text-ghost)", marginTop: 6 }}>Click <strong>Win Scan</strong> in the top bar to run your first Windows patch compliance scan.</div>
    </div>
  );

  if (error) return (
    <div style={{ background: "var(--red-tint)", border: "1px solid var(--red-border)", borderRadius: "var(--radius-lg)", padding: "16px 20px", color: "var(--red-dark)", fontSize: "var(--text-md)" }}>
      Error loading Windows scan data: {error}
      <button onClick={load} style={{ marginLeft: "var(--space-3)", padding: "4px 12px", border: "1px solid var(--red-border-lt)", borderRadius: "var(--radius-md)", background: "var(--bg-card)", color: "var(--red-dark)", cursor: "pointer", fontSize: "var(--text-base)", fontFamily: "inherit" }}>Retry</button>
    </div>
  );

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <StatCard icon="host"    label="Windows Hosts"   value={totalHosts}      sub={scannedAt ? `Last scan: ${scannedAt}` : "in latest scan"} accent="var(--cyan)"   />
        <StatCard icon="warning" label="Pending KBs"     value={totalKBs}        sub="total across all hosts"                                    accent="var(--amber)"  />
        <StatCard icon="scan"    label="Security / Crit" value={hostsWithSec}    sub="hosts with sec updates"                                    accent="var(--red)"    />
        <StatCard icon="refresh" label="Reboot Pending"  value={hostsNeedReboot} sub="hosts may need reboot"                                     accent="var(--purple)" />
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-2xl)", overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
        <div style={{ padding: "var(--space-4) var(--space-5)", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: "var(--text-lg)", color: "var(--text-primary)" }}>
            {filteredHosts.length} of {totalHosts} Windows hosts
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
            <select value={filterOS}  onChange={e => setFilterOS(e.target.value)}  style={selectStyle}>{osOptions.map(o  => <option key={o} value={o}>{o  === "all" ? "All OS versions"    : o}</option>)}</select>
            <select value={filterCls} onChange={e => setFilterCls(e.target.value)} style={selectStyle}>{clsOptions.map(o => <option key={o} value={o}>{o  === "all" ? "All classifications" : o}</option>)}</select>
            <div style={{ position: "relative" }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search hostname or KB..."
                style={{ padding: "6px 10px 6px 30px", border: "1px solid var(--border)", borderRadius: "var(--radius-base)", fontSize: "var(--text-base)", outline: "none", width: 200, fontFamily: "inherit" }} />
              <div style={{ position: "absolute", top: "50%", left: 9, transform: "translateY(-50%)" }}>
                <Icon d={Icons.search} size={13} color="var(--text-ghost)" />
              </div>
            </div>
            <button onClick={() => exportWindowsCSV(records)} style={{ padding: "6px 14px", border: "1px solid var(--blue-border)", borderRadius: "var(--radius-base)", background: "var(--blue-tint)", cursor: "pointer", fontSize: "var(--text-base)", color: "var(--blue-dark)", fontWeight: 600, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
              <Icon d={Icons.export} size={13} color="var(--blue-dark)" /> Export CSV
            </button>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "var(--bg-hover)", borderBottom: "1px solid var(--border-subtle)" }}>
            <tr>
              <th style={thStyle}>Host</th>
              <th style={{ ...thStyle, width: 140 }}>OS</th>
              <th style={{ ...thStyle, width: 110 }}>Version</th>
              <th style={{ ...thStyle, width: 90  }}>Pending KBs</th>
              <th style={{ ...thStyle, width: 190 }}>By Type</th>
              <th style={{ ...thStyle, width: 110 }}>Reboot</th>
              <th style={{ ...thStyle, width: 160 }}>Open Ports</th>
              <th style={{ ...thStyle, width: 75  }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredHosts.length === 0
              ? <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "var(--text-ghost)", fontSize: "var(--text-md)" }}>No hosts match your filters</td></tr>
              : filteredHosts.map(h => <WinHostRow key={h.hostname} hostname={h.hostname} osName={h.osName} osVersion={h.osVersion} updates={h.updates} />)
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}