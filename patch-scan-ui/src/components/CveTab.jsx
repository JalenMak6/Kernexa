import { useState, useEffect } from "react";
import { Icon, Icons } from "../utils/icons.jsx";
import { fmtDate } from "../utils/helpers.jsx";
import { apiPost, apiFetch } from "../utils/api";

const SEVERITY_CONFIG = {
  Critical:  { bg: "var(--red-tint)",    color: "var(--red-text)",      border: "var(--red-border-lt)", dot: "var(--red)"    },
  Important: { bg: "var(--orange-tint)", color: "var(--orange-darker)", border: "var(--orange-border-lt)", dot: "var(--orange)" },
  Moderate:  { bg: "var(--yellow-tint)", color: "var(--yellow-darker)", border: "var(--yellow-border)", dot: "var(--amber)"  },
  Low:       { bg: "var(--green-tint)",  color: "var(--green-text)",    border: "var(--green-border)",  dot: "var(--green-bright)" },
};

function cvssConfig(score) {
  if (score === null || score === undefined) return null;
  if (score >= 9.0) return { bg: "var(--red-tint)",    color: "var(--red-text)",      border: "var(--red-border-lt)", label: "Critical" };
  if (score >= 7.0) return { bg: "var(--orange-tint)", color: "var(--orange-darker)", border: "var(--orange-border-lt)", label: "High"  };
  if (score >= 4.0) return { bg: "var(--yellow-tint)", color: "var(--yellow-darker)", border: "var(--yellow-border)", label: "Medium"   };
  if (score >  0.0) return { bg: "var(--green-tint)",  color: "var(--green-text)",    border: "var(--green-border)",  label: "Low"      };
  return               { bg: "var(--bg-subtle)",     color: "var(--text-faint)",    border: "var(--border)",        label: "None"     };
}

function CvssBadge({ score, vector, version, source }) {
  const [hovered, setHovered] = useState(false);
  if (score === null || score === undefined) return <span style={{ color: "var(--text-disabled)", fontSize: "var(--text-base)" }}>—</span>;
  const cfg         = cvssConfig(score);
  const sourceLabel = source === "redhat" ? "RH" : source === "nvd" ? "NVD" : null;
  const sourceBg    = source === "redhat" ? "var(--red-tint-mid)" : "var(--blue-tint)";
  const sourceColor = source === "redhat" ? "var(--red-dark)"     : "var(--blue-dark)";

  return (
    <div style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    >
      <span style={{
        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
        padding: "2px 8px", borderRadius: "var(--radius-md)",
        fontSize: "var(--text-base)", fontWeight: 700, fontFamily: "monospace",
        cursor: vector ? "help" : "default",
        display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
      }}>
        {score.toFixed(1)}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
          {version && <span style={{ fontSize: "var(--text-xs)", fontWeight: 500, opacity: 0.6 }}>v{version}</span>}
          {sourceLabel && <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, background: sourceBg, color: sourceColor, padding: "0px 4px", borderRadius: "var(--radius-sm)" }}>{sourceLabel}</span>}
        </span>
      </span>
      {hovered && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
          background: "var(--bg-sidebar)", color: "var(--border)",
          padding: "10px 14px", borderRadius: "var(--radius-base)",
          fontSize: "var(--text-sm)", fontFamily: "monospace", whiteSpace: "nowrap",
          boxShadow: "var(--shadow-tooltip)", zIndex: 100, pointerEvents: "none", minWidth: 200,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>CVSS v{version} Score</span>
            <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: source === "redhat" ? "#f87171" : "#60a5fa" }}>
              {source === "redhat" ? "Red Hat" : "NVD"}
            </span>
          </div>
          {vector && <div style={{ color: "var(--text-ghost)", fontSize: "var(--text-xs)", marginBottom: 4 }}>{vector}</div>}
          {source === "nvd" && (
            <div style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)", marginTop: 6, borderTop: "1px solid var(--border-dark)", paddingTop: 6 }}>
              ⚠ No Red Hat score — NVD generic score shown
            </div>
          )}
          <div style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)", width: 10, height: 10, background: "var(--bg-sidebar)", rotate: "45deg" }} />
        </div>
      )}
    </div>
  );
}

function severityBadge(severity) {
  const cfg = SEVERITY_CONFIG[severity] || { bg: "var(--bg-subtle)", color: "var(--text-muted)", border: "var(--border)", dot: "var(--text-ghost)" };
  return (
    <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, padding: "2px 10px", borderRadius: "var(--radius-pill)", fontSize: "var(--text-sm)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
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
    <div style={{ marginTop: "var(--space-4)", borderTop: "1px solid var(--border)", paddingTop: "var(--space-4)" }}>
      <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-2)", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />
        Remediation
      </div>
      <div style={{ background: "var(--bg-sidebar)", borderRadius: "var(--radius-base)", padding: "10px 14px", marginBottom: patchedLines.length > 0 ? 10 : 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <code style={{ fontSize: "var(--text-base)", color: "var(--green-light)", fontFamily: "monospace" }}>{commandLine}</code>
        <button onClick={() => navigator.clipboard.writeText(commandLine.replace('Run: ', ''))} title="Copy command"
          style={{ background: "var(--bg-sidebar-item)", border: "1px solid var(--border-dark)", borderRadius: "var(--radius-md)", padding: "3px 8px", cursor: "pointer", fontSize: "var(--text-xs)", color: "var(--text-faint)", fontFamily: "inherit", whiteSpace: "nowrap" }}>
          Copy
        </button>
      </div>
      {patchedLines.length > 0 && (
        <div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-ghost)", marginBottom: 5 }}>Patched versions available:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {patchedLines.map((line, i) => (
              <span key={i} style={{ fontSize: "var(--text-sm)", fontFamily: "monospace", background: "var(--green-tint)", border: "1px solid var(--green-border)", color: "var(--green-text)", padding: "2px 8px", borderRadius: "var(--radius-sm)" }}>
                {line.replace('  • ', '')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CveRow({ cve, onPatch }) {
  const [expanded, setExpanded] = useState(false);
  const canPatch = (cve.affected_hosts?.length || 0) > 0;
  return (
    <>
      <tr style={{ borderBottom: "1px solid var(--border-subtle)", transition: "background 0.15s", cursor: "pointer" }}
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
        onMouseLeave={e => e.currentTarget.style.background = ""}>
        <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
          <span style={{ fontSize: "var(--text-base)", fontFamily: "monospace", fontWeight: 700, color: "var(--blue)" }}>{cve.advisory_id}</span>
        </td>
        <td style={{ padding: "14px 16px", fontSize: "var(--text-md)", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cve.synopsis}</td>
        <td style={{ padding: "14px 16px", width: 120 }}>{severityBadge(cve.severity)}</td>
        <td style={{ padding: "14px 16px", width: 110 }}><CvssBadge score={cve.cvss_score} vector={cve.cvss_vector} version={cve.cvss_version} source={cve.cvss_source} /></td>
        <td style={{ padding: "14px 16px", width: 180 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)" }}>
            {(cve.cve_ids || []).slice(0, 2).map(id => (
              <a key={id} href={`https://nvd.nist.gov/vuln/detail/${id}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                style={{ fontSize: "var(--text-sm)", fontFamily: "monospace", color: "var(--indigo)", background: "var(--indigo-tint)", border: "1px solid var(--indigo-border)", padding: "1px 6px", borderRadius: "var(--radius-sm)", textDecoration: "none", whiteSpace: "nowrap" }}>
                {id}
              </a>
            ))}
            {cve.cve_ids?.length > 2 && <span style={{ fontSize: "var(--text-sm)", color: "var(--text-ghost)" }}>+{cve.cve_ids.length - 2}</span>}
          </div>
        </td>
        <td style={{ padding: "14px 16px", width: 130 }}>
          {cve.affected_hosts?.length > 0
            ? <span style={{ background: "var(--red-tint)", color: "var(--red-dark)", border: "1px solid var(--red-border)", padding: "2px 10px", borderRadius: "var(--radius-pill)", fontSize: "var(--text-sm)", fontWeight: 700 }}>{cve.affected_hosts.length} host{cve.affected_hosts.length !== 1 ? "s" : ""}</span>
            : <span style={{ color: "var(--text-ghost)", fontSize: "var(--text-base)" }}>—</span>
          }
        </td>
        <td style={{ padding: "10px 16px", width: 80, textAlign: "right" }} onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
            {canPatch && (
              <button onClick={() => onPatch(cve)}
                style={{ padding: "4px 10px", border: "none", borderRadius: 6, background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap" }}
                title={`Patch ${cve.affected_hosts.length} affected host${cve.affected_hosts.length > 1 ? "s" : ""}`}>
                🛠 Patch
              </button>
            )}
            <div onClick={() => setExpanded(!expanded)} style={{ cursor: "pointer", display: "inline-flex", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
              <Icon d={Icons.chevron} size={13} color="var(--text-ghost)" />
            </div>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr style={{ background: "var(--bg-hover)" }}>
          <td colSpan={7} style={{ padding: "0 16px 16px 16px" }}>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
                <div>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-1)" }}>Description</div>
                  <div style={{ fontSize: "var(--text-base)", color: "var(--text-secondary)", lineHeight: 1.6 }}>{cve.description || "No description available."}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  {cve.cvss_score != null && (
                    <div>
                      <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-1)" }}>CVSS Score</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ position: "relative", width: 56, height: 56 }}>
                          <svg width="56" height="56" viewBox="0 0 56 56">
                            <circle cx="28" cy="28" r="22" fill="none" stroke="var(--bg-subtle)" strokeWidth="6" />
                            <circle cx="28" cy="28" r="22" fill="none"
                              stroke={cvssConfig(cve.cvss_score)?.color || "var(--text-ghost)"}
                              strokeWidth="6"
                              strokeDasharray={`${(cve.cvss_score / 10) * 138.2} 138.2`}
                              strokeLinecap="round" transform="rotate(-90 28 28)"
                            />
                          </svg>
                          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "var(--text-md)", fontWeight: 800, color: cvssConfig(cve.cvss_score)?.color }}>
                            {cve.cvss_score.toFixed(1)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: "var(--text-md)", fontWeight: 700, color: cvssConfig(cve.cvss_score)?.color }}>{cvssConfig(cve.cvss_score)?.label}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-ghost)" }}>CVSSv{cve.cvss_version}</span>
                            {cve.cvss_source && (
                              <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, padding: "1px 6px", borderRadius: "var(--radius-sm)", background: cve.cvss_source === "redhat" ? "var(--red-tint-mid)" : "var(--blue-tint)", color: cve.cvss_source === "redhat" ? "var(--red-dark)" : "var(--blue-dark)" }}>
                                {cve.cvss_source === "redhat" ? "Red Hat" : "NVD"}
                              </span>
                            )}
                          </div>
                          {cve.cvss_vector && <div style={{ fontSize: "var(--text-xs)", fontFamily: "monospace", color: "var(--text-faint)", marginTop: 4, wordBreak: "break-all" }}>{cve.cvss_vector}</div>}
                        </div>
                      </div>
                    </div>
                  )}
                  {cve.cve_ids?.length > 0 && (
                    <div>
                      <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-1)" }}>CVE References</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)" }}>
                        {cve.cve_ids.map(id => (
                          <a key={id} href={`https://nvd.nist.gov/vuln/detail/${id}`} target="_blank" rel="noreferrer"
                            style={{ fontSize: "var(--text-base)", fontFamily: "monospace", color: "var(--indigo)", background: "var(--indigo-tint)", border: "1px solid var(--indigo-border)", padding: "3px 8px", borderRadius: "var(--radius-sm)", textDecoration: "none" }}>
                            {id} ↗
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {cve.affected_hosts?.length > 0 && (
                    <div>
                      <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-1)" }}>Affected Hosts</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)" }}>
                        {cve.affected_hosts.map(host => (
                          <span key={host} style={{ fontSize: "var(--text-base)", fontFamily: "monospace", background: "var(--bg-subtle)", border: "1px solid var(--border)", padding: "3px 8px", borderRadius: "var(--radius-sm)", color: "var(--text-secondary)" }}>{host}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize: "var(--text-sm)", color: "var(--text-ghost)" }}>Fetched {fmtDate(cve.fetched_at)}</div>
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

// ── Patch Modal ───────────────────────────────────────────────────────────────

function PatchModal({ cve, onClose }) {
  const allHosts     = cve.affected_hosts || [];
  const [selected,   setSelected]   = useState(new Set(allHosts));
  const [jobId,      setJobId]      = useState(null);
  const [jobStatus,  setJobStatus]  = useState(null); // null | 'running' | result obj
  const [phase,      setPhase]      = useState("select"); // select | dry_running | dry_done | applying | done
  const [dryResult,  setDryResult]  = useState(null);
  const [applyResult,setApplyResult]= useState(null);
  const [error,      setError]      = useState(null);

  const packages = cve.remediation
    ? cve.remediation.match(/yum update ([^\n]+)/)?.[1]?.trim().split(/\s+/) || []
    : [];

  const toggleHost = (h) => {
    const next = new Set(selected);
    next.has(h) ? next.delete(h) : next.add(h);
    setSelected(next);
  };

  const pollJob = async (id, onComplete) => {
    const iv = setInterval(async () => {
      try {
        const job = await apiFetch(`/api/patch/${id}/status`);
        if (job.status === 'running') return;
        clearInterval(iv);
        onComplete(job);
      } catch { clearInterval(iv); }
    }, 3000);
  };

  const runDryRun = async () => {
    if (selected.size === 0) { setError("Select at least one host"); return; }
    setError(null); setPhase("dry_running");
    try {
      const res = await apiPost("/api/patch/trigger", {
        advisory_id: cve.advisory_id,
        hosts:    [...selected],
        packages: packages.length ? packages : [cve.advisory_id],
        dry_run:  true,
      });
      setJobId(res.job_id);
      pollJob(res.job_id, (job) => {
        setDryResult(job);
        setPhase("dry_done");
      });
    } catch (e) { setError(e.message); setPhase("select"); }
  };

  const applyPatch = async () => {
    setError(null); setPhase("applying");
    try {
      const res = await apiPost("/api/patch/trigger", {
        advisory_id: cve.advisory_id,
        hosts:    [...selected],
        packages: packages.length ? packages : [cve.advisory_id],
        dry_run:  false,
      });
      setJobId(res.job_id);
      pollJob(res.job_id, (job) => {
        setApplyResult(job);
        setPhase("done");
      });
    } catch (e) { setError(e.message); setPhase("dry_done"); }
  };

  const hostResults = (result) => result?.results?.hosts || {};
  const hostFailures = (result) => result?.results?.failures || {};

  const statusColor = (h, result) => {
    if (hostFailures(result)[h]) return "#dc2626";
    const hr = hostResults(result)[h];
    if (!hr) return "#94a3b8";
    if (hr.failed) return "#dc2626";
    return hr.changed ? "#16a34a" : "#94a3b8";
  };

  const statusLabel = (h, result) => {
    if (hostFailures(result)[h]) return "Unreachable";
    const hr = hostResults(result)[h];
    if (!hr) return "No result";
    if (hr.failed) return "Error";
    return hr.changed ? (phase === "done" ? "Patched ✓" : "Would change") : "Already up to date";
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backdropFilter: "blur(2px)" }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
              🛠 Patch Advisory
              <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 600, color: "#6366f1", background: "#eef2ff", padding: "2px 8px", borderRadius: 6 }}>{cve.advisory_id}</span>
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{cve.synopsis}</div>
          </div>
          <button onClick={onClose} style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 18, color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

          {/* Packages to be updated */}
          {packages.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Packages</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {packages.map(p => (
                  <span key={p} style={{ fontFamily: "monospace", fontSize: 12, background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "2px 8px", borderRadius: 6, color: "#0f172a" }}>{p}</span>
                ))}
              </div>
            </div>
          )}

          {/* Host selection — only show in select phase */}
          {phase === "select" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Select Hosts ({selected.size}/{allHosts.length})
                </div>
                <button onClick={() => setSelected(selected.size === allHosts.length ? new Set() : new Set(allHosts))}
                  style={{ fontSize: 12, color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                  {selected.size === allHosts.length ? "Deselect all" : "Select all"}
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {allHosts.map(h => (
                  <label key={h} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: selected.has(h) ? "#eef2ff" : "#f8fafc", border: `1px solid ${selected.has(h) ? "#c7d2fe" : "#e2e8f0"}`, borderRadius: 8, cursor: "pointer", transition: "all 0.1s" }}>
                    <input type="checkbox" checked={selected.has(h)} onChange={() => toggleHost(h)} style={{ cursor: "pointer" }} />
                    <span style={{ fontFamily: "monospace", fontSize: 13, color: "#0f172a" }}>{h}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Dry run running */}
          {phase === "dry_running" && (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
              <div style={{ fontWeight: 600, color: "#0f172a" }}>Running dry run...</div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Simulating patch on {selected.size} host{selected.size > 1 ? "s" : ""}. Nothing will change.</div>
            </div>
          )}

          {/* Dry run results */}
          {phase === "dry_done" && dryResult && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Dry Run Results</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                {[...selected].map(h => {
                  const hr      = hostResults(dryResult)[h];
                  const isError = hr?.failed || !!hostFailures(dryResult)[h];
                  const pkgs    = hr?.packages || {};
                  const pkgList = Object.entries(pkgs);
                  return (
                    <div key={h} style={{ padding: "10px 14px", background: "#f8fafc", border: `1px solid ${isError ? "#fecaca" : "#e2e8f0"}`, borderRadius: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: pkgList.length ? 8 : 0 }}>
                        <span style={{ fontFamily: "monospace", fontSize: 13, color: "#0f172a" }}>{h}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: statusColor(h, dryResult) }}>{statusLabel(h, dryResult)}</span>
                      </div>
                      {pkgList.length > 0 && (
                        <div style={{ background: "#f1f5f9", borderRadius: 6, padding: "8px 10px" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 5 }}>
                            {pkgList.length} package{pkgList.length > 1 ? "s" : ""} would be upgraded:
                          </div>
                          {pkgList.map(([pkg, info]) => (
                            <div key={pkg} style={{ fontSize: 11, fontFamily: "monospace", color: "#334155", marginBottom: 2 }}>
                              <span style={{ color: "#0f172a", fontWeight: 600 }}>{pkg}</span>
                              {info.from && <span style={{ color: "#94a3b8" }}> {info.from}</span>}
                              <span style={{ color: "#16a34a", fontWeight: 600 }}> → {info.to}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {!pkgList.length && !isError && (
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>No packages need updating — already up to date.</div>
                      )}
                      {isError && hr?.stdout && !pkgList.length && (
                        <pre style={{ margin: 0, fontSize: 11, fontFamily: "monospace", color: "#94a3b8", whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#1e293b", padding: "8px 10px", borderRadius: 6 }}>
                          {hr.stdout.slice(0, 600)}
                        </pre>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#92400e" }}>
                ⚠ This was a dry run — nothing was changed. Review the packages above and click <strong>Apply Patch</strong> to proceed.
              </div>
            </div>
          )}

          {/* Applying */}
          {phase === "applying" && (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTopColor: "#16a34a", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
              <div style={{ fontWeight: 600, color: "#0f172a" }}>Applying patches...</div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Running yum update on {selected.size} host{selected.size > 1 ? "s" : ""}.</div>
            </div>
          )}

          {/* Done */}
          {phase === "done" && applyResult && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Patch Results</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[...selected].map(h => {
                  const hr      = hostResults(applyResult)[h];
                  const pkgs    = hr?.packages || {};
                  const pkgList = Object.entries(pkgs);
                  return (
                    <div key={h} style={{ padding: "10px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: pkgList.length ? 8 : 0 }}>
                        <span style={{ fontFamily: "monospace", fontSize: 13, color: "#0f172a" }}>{h}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: statusColor(h, applyResult) }}>{statusLabel(h, applyResult)}</span>
                      </div>
                      {pkgList.length > 0 && (
                        <div style={{ background: "#f0fdf4", borderRadius: 6, padding: "8px 10px" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#15803d", marginBottom: 5 }}>
                            {pkgList.length} package{pkgList.length > 1 ? "s" : ""} upgraded:
                          </div>
                          {pkgList.map(([pkg, info]) => (
                            <div key={pkg} style={{ fontSize: 11, fontFamily: "monospace", color: "#334155", marginBottom: 2 }}>
                              <span style={{ color: "#0f172a", fontWeight: 600 }}>{pkg}</span>
                              {info.from && <span style={{ color: "#94a3b8" }}> {info.from}</span>}
                              <span style={{ color: "#16a34a", fontWeight: 600 }}> → {info.to}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {!pkgList.length && (
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>Already up to date — no changes made.</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 12, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {phase === "select" && (
            <>
              <button onClick={onClose} style={{ padding: "8px 18px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 13, color: "#64748b", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={runDryRun} disabled={selected.size === 0}
                style={{ padding: "8px 18px", border: "none", borderRadius: 8, background: selected.size === 0 ? "#e2e8f0" : "linear-gradient(135deg,#6366f1,#8b5cf6)", color: selected.size === 0 ? "#94a3b8" : "#fff", cursor: selected.size === 0 ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
                🔍 Run Dry Run
              </button>
            </>
          )}
          {phase === "dry_done" && (
            <>
              <button onClick={() => setPhase("select")} style={{ padding: "8px 18px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 13, color: "#64748b", fontFamily: "inherit" }}>← Back</button>
              <button onClick={applyPatch}
                style={{ padding: "8px 18px", border: "none", borderRadius: 8, background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
                ✓ Apply Patch
              </button>
            </>
          )}
          {phase === "done" && (
            <button onClick={onClose} style={{ padding: "8px 18px", border: "none", borderRadius: 8, background: "#16a34a", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
              Done ✓
            </button>
          )}
          {(phase === "dry_running" || phase === "applying") && (
            <button disabled style={{ padding: "8px 18px", border: "none", borderRadius: 8, background: "#e2e8f0", color: "#94a3b8", cursor: "not-allowed", fontSize: 13, fontFamily: "inherit" }}>
              Please wait...
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function CveTab({ cves, loading }) {
  const [search,         setSearch]         = useState("");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [sortByCvss,     setSortByCvss]     = useState(false);
  const [patchTarget,    setPatchTarget]    = useState(null); // cve to patch

  const sorted   = sortByCvss ? [...(cves || [])].sort((a, b) => (b.cvss_score ?? -1) - (a.cvss_score ?? -1)) : (cves || []);
  const filtered = sorted.filter(c => {
    const matchSearch   = c.advisory_id.toLowerCase().includes(search.toLowerCase()) || c.synopsis.toLowerCase().includes(search.toLowerCase()) || (c.cve_ids || []).some(id => id.toLowerCase().includes(search.toLowerCase()));
    const matchSeverity = filterSeverity === "all" || c.severity === filterSeverity;
    return matchSearch && matchSeverity;
  });

  const counts      = (cves || []).reduce((acc, c) => { acc[c.severity] = (acc[c.severity] || 0) + 1; return acc; }, {});
  const scoredCount = (cves || []).filter(c => c.cvss_score != null).length;

  const thStyle = { padding: "12px 16px", textAlign: "left", fontSize: "var(--text-sm)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-faint)", whiteSpace: "nowrap" };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <div style={{ width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "var(--blue)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    </div>
  );

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <div style={{ display: "flex", gap: 10, marginBottom: "var(--space-5)", flexWrap: "wrap", alignItems: "center" }}>
        {["Critical", "Important", "Moderate", "Low"].map(sev => {
          const cfg   = SEVERITY_CONFIG[sev];
          const count = counts[sev] || 0;
          return (
            <button key={sev} onClick={() => setFilterSeverity(filterSeverity === sev ? "all" : sev)}
              style={{
                padding: "6px 14px", borderRadius: "var(--radius-base)",
                border: `1px solid ${filterSeverity === sev ? cfg.dot : "var(--border)"}`,
                background: filterSeverity === sev ? cfg.bg : "var(--bg-card)",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                fontSize: "var(--text-base)", fontWeight: 600,
                color: filterSeverity === sev ? cfg.color : "var(--text-muted)",
                fontFamily: "inherit", transition: "all 0.15s",
              }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.dot }} />
              {sev} <span style={{ fontWeight: 400, opacity: 0.7 }}>({count})</span>
            </button>
          );
        })}
        {filterSeverity !== "all" && (
          <button onClick={() => setFilterSeverity("all")} style={{ padding: "6px 14px", borderRadius: "var(--radius-base)", border: "1px solid var(--border)", background: "var(--bg-card)", cursor: "pointer", fontSize: "var(--text-base)", color: "var(--text-muted)", fontFamily: "inherit" }}>
            Clear filter ×
          </button>
        )}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          {scoredCount > 0 && <span style={{ fontSize: "var(--text-sm)", color: "var(--text-ghost)" }}>{scoredCount}/{(cves || []).length} scored by NVD</span>}
          <button onClick={() => setSortByCvss(s => !s)}
            style={{
              padding: "6px 14px", borderRadius: "var(--radius-base)", fontSize: "var(--text-base)", fontWeight: 600,
              border: `1px solid ${sortByCvss ? "var(--indigo)" : "var(--border)"}`,
              background: sortByCvss ? "var(--indigo-tint)" : "var(--bg-card)",
              color: sortByCvss ? "var(--indigo-dark)" : "var(--text-muted)",
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: 6,
            }}>
            ↓ Sort by CVSS
          </button>
        </div>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-2xl)", overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
        <div style={{ padding: "var(--space-4) var(--space-5)", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: "var(--text-lg)", color: "var(--text-primary)" }}>
            {filtered.length} advisor{filtered.length !== 1 ? "ies" : "y"}
            {filterSeverity !== "all" && <span style={{ fontWeight: 400, color: "var(--text-ghost)", fontSize: "var(--text-base)" }}> — {filterSeverity} only</span>}
            {sortByCvss && <span style={{ fontWeight: 400, color: "var(--indigo)", fontSize: "var(--text-base)" }}> — sorted by CVSS</span>}
          </div>
          <div style={{ position: "relative" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search advisory, CVE ID..."
              style={{ padding: "8px 12px 8px 34px", border: "1px solid var(--border)", borderRadius: "var(--radius-base)", fontSize: "var(--text-md)", outline: "none", width: 260, fontFamily: "inherit" }} />
            <div style={{ position: "absolute", top: "50%", left: 10, transform: "translateY(-50%)" }}>
              <Icon d={Icons.search} size={14} color="var(--text-ghost)" />
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--text-ghost)", fontSize: "var(--text-md)" }}>
            {cves?.length === 0 ? "No advisories found — run a scan on a Rocky Linux host first" : "No advisories match your search"}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead style={{ background: "var(--bg-hover)", borderBottom: "1px solid var(--border-subtle)" }}>
              <tr>
                <th style={{ ...thStyle, width: 160 }}>Advisory</th>
                <th style={thStyle}>Synopsis</th>
                <th style={{ ...thStyle, width: 120 }}>Severity</th>
                <th style={{ ...thStyle, width: 110, cursor: "pointer" }} onClick={() => setSortByCvss(s => !s)}>CVSS {sortByCvss ? "↓" : ""}</th>
                <th style={{ ...thStyle, width: 180 }}>CVE IDs</th>
                <th style={{ ...thStyle, width: 130 }}>Affected Hosts</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(cve => <CveRow key={cve.advisory_id} cve={cve} onPatch={() => setPatchTarget(cve)} />)}
            </tbody>
          </table>
        )}
      </div>

      {patchTarget && <PatchModal cve={patchTarget} onClose={() => setPatchTarget(null)} />}
    </div>
  );
}