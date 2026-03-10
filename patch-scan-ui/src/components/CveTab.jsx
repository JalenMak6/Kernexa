import { useState } from "react";
import { Icon, Icons } from "../utils/icons.jsx";
import { fmtDate } from "../utils/helpers.jsx";

const SEVERITY_CONFIG = {
  Critical:  { bg: "#fef2f2", color: "#991b1b", border: "#fca5a5", dot: "#ef4444" },
  Important: { bg: "#fff7ed", color: "#9a3412", border: "#fdba74", dot: "#f97316" },
  Moderate:  { bg: "#fefce8", color: "#854d0e", border: "#fde047", dot: "#eab308" },
  Low:       { bg: "#f0fdf4", color: "#166534", border: "#86efac", dot: "#22c55e" },
};

// CVSS score → colour band
function cvssConfig(score) {
  if (score === null || score === undefined) return null;
  if (score >= 9.0) return { bg: "#fef2f2", color: "#991b1b", border: "#fca5a5", label: "Critical" };
  if (score >= 7.0) return { bg: "#fff7ed", color: "#9a3412", border: "#fdba74", label: "High"     };
  if (score >= 4.0) return { bg: "#fefce8", color: "#854d0e", border: "#fde047", label: "Medium"   };
  if (score >  0.0) return { bg: "#f0fdf4", color: "#166534", border: "#86efac", label: "Low"      };
  return               { bg: "#f8fafc", color: "#64748b", border: "#e2e8f0", label: "None"     };
}

function CvssBadge({ score, vector, version, source }) {
  const [hovered, setHovered] = useState(false);
  if (score === null || score === undefined) {
    return <span style={{ color: "#cbd5e1", fontSize: 12 }}>—</span>;
  }
  const cfg = cvssConfig(score);
  const sourceLabel = source === "redhat" ? "RH" : source === "nvd" ? "NVD" : null;
  const sourceBg    = source === "redhat" ? "#fee2e2" : "#eff6ff";
  const sourceColor = source === "redhat" ? "#dc2626"  : "#2563eb";
  return (
    <div style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{
        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
        padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700,
        fontFamily: "monospace", cursor: vector ? "help" : "default",
        display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
      }}>
        {score.toFixed(1)}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
          {version && <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.6 }}>v{version}</span>}
          {sourceLabel && (
            <span style={{ fontSize: 9, fontWeight: 700, background: sourceBg, color: sourceColor, padding: "0px 4px", borderRadius: 3 }}>
              {sourceLabel}
            </span>
          )}
        </span>
      </span>

      {/* tooltip */}
      {hovered && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
          transform: "translateX(-50%)",
          background: "#0f172a", color: "#e2e8f0",
          padding: "10px 14px", borderRadius: 8, fontSize: 11,
          fontFamily: "monospace", whiteSpace: "nowrap",
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          zIndex: 100, pointerEvents: "none", minWidth: 200,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: "#64748b" }}>CVSS v{version} Score</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: source === "redhat" ? "#f87171" : "#60a5fa" }}>
              {source === "redhat" ? "Red Hat" : "NVD"}
            </span>
          </div>
          {vector && <div style={{ color: "#94a3b8", fontSize: 10, marginBottom: 4 }}>{vector}</div>}
          {source === "nvd" && (
            <div style={{ color: "#475569", fontSize: 10, marginTop: 6, borderTop: "1px solid #1e293b", paddingTop: 6 }}>
              ⚠ No Red Hat score — NVD generic score shown
            </div>
          )}
          <div style={{
            position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)",
            width: 10, height: 10, background: "#0f172a", rotate: "45deg",
          }} />
        </div>
      )}
    </div>
  );
}

function severityBadge(severity) {
  const cfg = SEVERITY_CONFIG[severity] || { bg: "#f1f5f9", color: "#475569", border: "#cbd5e1", dot: "#94a3b8" };
  return (
    <span style={{
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
      display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, display: "inline-block" }} />
      {severity || "Unknown"}
    </span>
  );
}

function RemediationBlock({ remediation }) {
  if (!remediation) return null;

  const lines        = remediation.split("\n");
  const commandLine  = lines[0];
  const patchedLines = lines.slice(2).filter(l => l.trim());

  return (
    <div style={{ marginTop: 16, borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
        Remediation
      </div>
      <div style={{ background: "#0f172a", borderRadius: 8, padding: "10px 14px", marginBottom: patchedLines.length > 0 ? 10 : 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <code style={{ fontSize: 12, color: "#4ade80", fontFamily: "monospace" }}>{commandLine}</code>
        <button
          onClick={() => navigator.clipboard.writeText(commandLine.replace('Run: ', ''))}
          title="Copy command"
          style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 10, color: "#94a3b8", fontFamily: "inherit", whiteSpace: "nowrap" }}>
          Copy
        </button>
      </div>
      {patchedLines.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 5 }}>Patched versions available:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {patchedLines.map((line, i) => (
              <span key={i} style={{ fontSize: 11, fontFamily: "monospace", background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", padding: "2px 8px", borderRadius: 4 }}>
                {line.replace('  • ', '')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CveRow({ cve }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.15s", cursor: "pointer" }}
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
        onMouseLeave={e => e.currentTarget.style.background = ""}
      >
        <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
          <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: "#3b82f6" }}>
            {cve.advisory_id}
          </span>
        </td>
        <td style={{ padding: "14px 16px", fontSize: 13, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {cve.synopsis}
        </td>
        <td style={{ padding: "14px 16px", width: 120 }}>
          {severityBadge(cve.severity)}
        </td>
        {/* CVSS score column */}
        <td style={{ padding: "14px 16px", width: 110 }}>
          <CvssBadge score={cve.cvss_score} vector={cve.cvss_vector} version={cve.cvss_version} source={cve.cvss_source} />
        </td>
        <td style={{ padding: "14px 16px", width: 180 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {(cve.cve_ids || []).slice(0, 2).map(id => (
              <a key={id} href={`https://nvd.nist.gov/vuln/detail/${id}`} target="_blank" rel="noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ fontSize: 11, fontFamily: "monospace", color: "#6366f1", background: "#eef2ff", border: "1px solid #c7d2fe", padding: "1px 6px", borderRadius: 4, textDecoration: "none", whiteSpace: "nowrap" }}>
                {id}
              </a>
            ))}
            {cve.cve_ids?.length > 2 && (
              <span style={{ fontSize: 11, color: "#94a3b8" }}>+{cve.cve_ids.length - 2}</span>
            )}
          </div>
        </td>
        <td style={{ padding: "14px 16px", width: 130 }}>
          {cve.affected_hosts?.length > 0 ? (
            <span style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
              {cve.affected_hosts.length} host{cve.affected_hosts.length !== 1 ? "s" : ""}
            </span>
          ) : (
            <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>
          )}
        </td>
        <td style={{ padding: "14px 16px", width: 60, textAlign: "center" }}>
          <div style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-flex" }}>
            <Icon d={Icons.chevron} size={13} color="#94a3b8" />
          </div>
        </td>
      </tr>

      {expanded && (
        <tr style={{ background: "#f8fafc" }}>
          <td colSpan={7} style={{ padding: "0 16px 16px 16px" }}>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16 }}>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Description</div>
                  <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.6 }}>{cve.description || "No description available."}</div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                  {/* CVSS detail block */}
                  {cve.cvss_score != null && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>CVSS Score</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {/* score gauge */}
                        <div style={{ position: "relative", width: 56, height: 56 }}>
                          <svg width="56" height="56" viewBox="0 0 56 56">
                            <circle cx="28" cy="28" r="22" fill="none" stroke="#f1f5f9" strokeWidth="6" />
                            <circle cx="28" cy="28" r="22" fill="none"
                              stroke={cvssConfig(cve.cvss_score)?.color || "#94a3b8"}
                              strokeWidth="6"
                              strokeDasharray={`${(cve.cvss_score / 10) * 138.2} 138.2`}
                              strokeLinecap="round"
                              transform="rotate(-90 28 28)"
                            />
                          </svg>
                          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: cvssConfig(cve.cvss_score)?.color }}>
                            {cve.cvss_score.toFixed(1)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: cvssConfig(cve.cvss_score)?.color }}>
                            {cvssConfig(cve.cvss_score)?.label}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>CVSSv{cve.cvss_version}</span>
                            {cve.cvss_source && (
                              <span style={{
                                fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                                background: cve.cvss_source === "redhat" ? "#fee2e2" : "#eff6ff",
                                color:      cve.cvss_source === "redhat" ? "#dc2626"  : "#2563eb",
                              }}>
                                {cve.cvss_source === "redhat" ? "Red Hat" : "NVD"}
                              </span>
                            )}
                          </div>
                          {cve.cvss_vector && (
                            <div style={{ fontSize: 10, fontFamily: "monospace", color: "#64748b", marginTop: 4, wordBreak: "break-all" }}>
                              {cve.cvss_vector}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {cve.cve_ids?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>CVE References</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {cve.cve_ids.map(id => (
                          <a key={id} href={`https://nvd.nist.gov/vuln/detail/${id}`} target="_blank" rel="noreferrer"
                            style={{ fontSize: 12, fontFamily: "monospace", color: "#6366f1", background: "#eef2ff", border: "1px solid #c7d2fe", padding: "3px 8px", borderRadius: 4, textDecoration: "none" }}>
                            {id} ↗
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {cve.affected_hosts?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Affected Hosts</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {cve.affected_hosts.map(host => (
                          <span key={host} style={{ fontSize: 12, fontFamily: "monospace", background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "3px 8px", borderRadius: 4, color: "#334155" }}>
                            {host}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: 11, color: "#94a3b8" }}>Fetched {fmtDate(cve.fetched_at)}</div>
                </div>
              </div>

              <RemediationBlock remediation={cve.remediation} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function CveTab({ cves, loading }) {
  const [search, setSearch]               = useState("");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [sortByCvss, setSortByCvss]       = useState(false);

  const sorted = sortByCvss
    ? [...(cves || [])].sort((a, b) => (b.cvss_score ?? -1) - (a.cvss_score ?? -1))
    : (cves || []);

  const filtered = sorted.filter(c => {
    const matchSearch =
      c.advisory_id.toLowerCase().includes(search.toLowerCase()) ||
      c.synopsis.toLowerCase().includes(search.toLowerCase()) ||
      (c.cve_ids || []).some(id => id.toLowerCase().includes(search.toLowerCase()));
    const matchSeverity = filterSeverity === "all" || c.severity === filterSeverity;
    return matchSearch && matchSeverity;
  });

  const counts = (cves || []).reduce((acc, c) => {
    acc[c.severity] = (acc[c.severity] || 0) + 1;
    return acc;
  }, {});

  const scoredCount = (cves || []).filter(c => c.cvss_score != null).length;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
        <div style={{ width: 32, height: 32, border: "3px solid #e2e8f0", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  const thStyle = { padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b", whiteSpace: "nowrap" };

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {["Critical", "Important", "Moderate", "Low"].map(sev => {
          const cfg   = SEVERITY_CONFIG[sev];
          const count = counts[sev] || 0;
          return (
            <button key={sev} onClick={() => setFilterSeverity(filterSeverity === sev ? "all" : sev)}
              style={{
                padding: "6px 14px", borderRadius: 8, border: `1px solid ${filterSeverity === sev ? cfg.dot : "#e2e8f0"}`,
                background: filterSeverity === sev ? cfg.bg : "#fff",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                fontSize: 12, fontWeight: 600, color: filterSeverity === sev ? cfg.color : "#475569",
                fontFamily: "inherit", transition: "all 0.15s",
              }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.dot }} />
              {sev} <span style={{ fontWeight: 400, opacity: 0.7 }}>({count})</span>
            </button>
          );
        })}
        {filterSeverity !== "all" && (
          <button onClick={() => setFilterSeverity("all")}
            style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 12, color: "#475569", fontFamily: "inherit" }}>
            Clear filter ×
          </button>
        )}

        {/* CVSS sort toggle */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {scoredCount > 0 && (
            <span style={{ fontSize: 11, color: "#94a3b8" }}>
              {scoredCount}/{(cves || []).length} scored by NVD
            </span>
          )}
          <button onClick={() => setSortByCvss(s => !s)}
            style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: `1px solid ${sortByCvss ? "#6366f1" : "#e2e8f0"}`,
              background: sortByCvss ? "#eef2ff" : "#fff",
              color: sortByCvss ? "#4f46e5" : "#475569",
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: 6,
            }}>
            ↓ Sort by CVSS
          </button>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
            {filtered.length} advisor{filtered.length !== 1 ? "ies" : "y"}
            {filterSeverity !== "all" && <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: 12 }}> — {filterSeverity} only</span>}
            {sortByCvss && <span style={{ fontWeight: 400, color: "#6366f1", fontSize: 12 }}> — sorted by CVSS</span>}
          </div>
          <div style={{ position: "relative" }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search advisory, CVE ID..."
              style={{ padding: "8px 12px 8px 34px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", width: 260, fontFamily: "inherit" }} />
            <div style={{ position: "absolute", top: "50%", left: 10, transform: "translateY(-50%)" }}>
              <Icon d={Icons.search} size={14} color="#94a3b8" />
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
            {cves?.length === 0 ? "No advisories found — run a scan on a Rocky Linux host first" : "No advisories match your search"}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead style={{ background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
              <tr>
                <th style={{ ...thStyle, width: 160 }}>Advisory</th>
                <th style={thStyle}>Synopsis</th>
                <th style={{ ...thStyle, width: 120 }}>Severity</th>
                <th style={{ ...thStyle, width: 110, cursor: "pointer" }} onClick={() => setSortByCvss(s => !s)}>
                  CVSS {sortByCvss ? "↓" : ""}
                </th>
                <th style={{ ...thStyle, width: 180 }}>CVE IDs</th>
                <th style={{ ...thStyle, width: 130 }}>Affected Hosts</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(cve => <CveRow key={cve.advisory_id} cve={cve} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}