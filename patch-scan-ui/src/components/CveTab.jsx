import { useState } from "react";
import { Icon, Icons } from "../utils/icons.jsx";
import { fmtDate } from "../utils/helpers.jsx";

const SEVERITY_CONFIG = {
  Critical:  { bg: "#fef2f2", color: "#991b1b", border: "#fca5a5", dot: "#ef4444" },
  Important: { bg: "#fff7ed", color: "#9a3412", border: "#fdba74", dot: "#f97316" },
  Moderate:  { bg: "#fefce8", color: "#854d0e", border: "#fde047", dot: "#eab308" },
  Low:       { bg: "#f0fdf4", color: "#166534", border: "#86efac", dot: "#22c55e" },
};

function severityBadge(severity) {
  const cfg = SEVERITY_CONFIG[severity] || { bg: "#f1f5f9", color: "#475569", border: "#cbd5e1", dot: "#94a3b8" };
  return (
    <span style={{
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
      display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap"
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, display: "inline-block" }} />
      {severity || "Unknown"}
    </span>
  );
}

function RemediationBlock({ remediation }) {
  if (!remediation) return null;

  // split into command line and patched versions
  const lines = remediation.split("\n");
  const commandLine = lines[0]; // "Run: yum update <pkg>"
  const patchedLines = lines.slice(2).filter(l => l.trim()); // "  • pkg-version"

  return (
    <div style={{ marginTop: 16, borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
        Remediation
      </div>

      {/* command */}
      <div style={{ background: "#0f172a", borderRadius: 8, padding: "10px 14px", marginBottom: patchedLines.length > 0 ? 10 : 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <code style={{ fontSize: 12, color: "#4ade80", fontFamily: "monospace" }}>{commandLine}</code>
        <button
          onClick={() => navigator.clipboard.writeText(commandLine.replace('Run: ', ''))}
          title="Copy command"
          style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 10, color: "#94a3b8", fontFamily: "inherit", whiteSpace: "nowrap" }}>
          Copy
        </button>
      </div>

      {/* patched versions */}
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
          <td colSpan={6} style={{ padding: "0 16px 16px 16px" }}>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16 }}>

              {/* top section — description + CVE refs + affected hosts */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Description</div>
                  <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.6 }}>{cve.description || "No description available."}</div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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

              {/* remediation block — full width below */}
              <RemediationBlock remediation={cve.remediation} />

            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function CveTab({ cves, loading }) {
  const [search, setSearch] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("all");

  const filtered = (cves || []).filter(c => {
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

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
        <div style={{ width: 32, height: 32, border: "3px solid #e2e8f0", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {["Critical", "Important", "Moderate", "Low"].map(sev => {
          const cfg = SEVERITY_CONFIG[sev];
          const count = counts[sev] || 0;
          return (
            <button key={sev} onClick={() => setFilterSeverity(filterSeverity === sev ? "all" : sev)}
              style={{
                padding: "6px 14px", borderRadius: 8, border: `1px solid ${filterSeverity === sev ? cfg.dot : "#e2e8f0"}`,
                background: filterSeverity === sev ? cfg.bg : "#fff",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                fontSize: 12, fontWeight: 600, color: filterSeverity === sev ? cfg.color : "#475569",
                fontFamily: "inherit", transition: "all 0.15s"
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
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
            {filtered.length} advisor{filtered.length !== 1 ? "ies" : "y"}
            {filterSeverity !== "all" && <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: 12 }}> — {filterSeverity} only</span>}
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
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b", whiteSpace: "nowrap", width: 160 }}>Advisory</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b" }}>Synopsis</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b", width: 120 }}>Severity</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b", width: 180 }}>CVE IDs</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b", width: 130 }}>Affected Hosts</th>
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