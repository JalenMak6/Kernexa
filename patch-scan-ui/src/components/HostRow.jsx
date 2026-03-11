import { useState, useRef, useEffect } from "react";
import { Icon, Icons } from "../utils/icons.jsx";
import { kernelOutdated, badge } from "../utils/helpers.jsx";

const SUGGESTED_TAGS = ["production", "staging", "dmz", "web", "db", "infra"];

const TAG_COLORS = [
  { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  { bg: "#fdf4ff", color: "#7e22ce", border: "#e9d5ff" },
  { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
  { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" },
  { bg: "#f0fdfa", color: "#0f766e", border: "#99f6e4" },
  { bg: "#fefce8", color: "#a16207", border: "#fef08a" },
];

function tagColor(tag) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

function TagChip({ tag, onRemove }) {
  const [hovered, setHovered] = useState(false);
  const cfg = tagColor(tag);
  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
        padding: "1px 7px", borderRadius: 999, fontSize: 11, fontWeight: 600,
        whiteSpace: "nowrap", transition: "all 0.1s",
      }}>
      {tag}
      {onRemove && hovered && (
        <button onClick={e => { e.stopPropagation(); onRemove(tag); }} style={{
          background: "none", border: "none", cursor: "pointer", padding: 0,
          color: cfg.color, fontSize: 12, lineHeight: 1, display: "flex", alignItems: "center",
        }}>x</button>
      )}
    </span>
  );
}

function TagEditor({ hostname, tags, onTagsChanged }) {
  const [input, setInput]   = useState("");
  const [open, setOpen]     = useState(false);
  const [saving, setSaving] = useState(false);
  const containerRef        = useRef(null);
  const buttonRef           = useRef(null);
  const [dropUp, setDropUp] = useState(false);

  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleOpen = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropUp(window.innerHeight - rect.bottom < 280);
    }
    setOpen(o => !o);
  };

  const addTag = async (tag) => {
    tag = tag.trim().toLowerCase();
    if (!tag || tags.includes(tag)) { setInput(""); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/hosts/${encodeURIComponent(hostname)}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag })
      }).then(r => r.json());
      onTagsChanged(res.tags);
    } catch {}
    setSaving(false);
    setInput("");
    setOpen(false);
  };

  const suggestions = SUGGESTED_TAGS.filter(s => !tags.includes(s) && s.includes(input.toLowerCase()));

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      <button ref={buttonRef} onClick={handleOpen} style={{
        background: "none", border: "1px dashed #cbd5e1", borderRadius: 999,
        padding: "1px 7px", fontSize: 11, color: "#94a3b8", cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 3, fontFamily: "inherit",
        transition: "all 0.15s",
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.color = "#3b82f6"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.color = "#94a3b8"; }}
      >
        + tag
      </button>

      {open && (
        <div style={{
          position: "fixed",
          ...(dropUp
            ? { bottom: window.innerHeight - (buttonRef.current?.getBoundingClientRect().top || 0) + 4 }
            : { top: (buttonRef.current?.getBoundingClientRect().bottom || 0) + 4 }),
          left: buttonRef.current?.getBoundingClientRect().left || 0,
          zIndex: 9999,
          background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.15)", padding: 12, width: 220,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Add tag to {hostname}</span>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#94a3b8", lineHeight: 1, padding: 0 }}>x</button>
          </div>
          <input
            autoFocus
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addTag(input); if (e.key === "Escape") setOpen(false); }}
            placeholder="Type a tag..."
            style={{
              width: "100%", padding: "6px 10px", border: "1px solid #e2e8f0",
              borderRadius: 6, fontSize: 12, outline: "none", fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
          {suggestions.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>Suggestions</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {suggestions.map(s => (
                  <button key={s} onClick={() => addTag(s)} style={{
                    background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 999,
                    padding: "2px 8px", fontSize: 11, cursor: "pointer", color: "#475569",
                    fontFamily: "inherit", transition: "all 0.1s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#eff6ff"; e.currentTarget.style.borderColor = "#bfdbfe"; e.currentTarget.style.color = "#1d4ed8"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#475569"; }}
                  >{s}</button>
                ))}
              </div>
            </div>
          )}
          {input.trim() && (
            <button onClick={() => addTag(input)} disabled={saving} style={{
              marginTop: 8, width: "100%", padding: "6px", background: "#0f172a",
              color: "#fff", border: "none", borderRadius: 6, fontSize: 12,
              cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
            }}>
              {saving ? "Adding..." : `Add "${input.trim().toLowerCase()}"`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helper badges ─────────────────────────────────────────────────────────────

function CvssBadge({ score, version, source }) {
  if (score === null || score === undefined) return <span style={{ color: "#94a3b8", fontSize: 12 }}>-</span>;
  const color  = score >= 9 ? "#dc2626" : score >= 7 ? "#ea580c" : score >= 4 ? "#d97706" : "#16a34a";
  const bg     = score >= 9 ? "#fef2f2" : score >= 7 ? "#fff7ed" : score >= 4 ? "#fffbeb" : "#f0fdf4";
  const border = score >= 9 ? "#fecaca" : score >= 7 ? "#fed7aa" : score >= 4 ? "#fde68a" : "#bbf7d0";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ background: bg, color, border: `1px solid ${border}`, borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>
        {score.toFixed(1)}
      </span>
      {source && (
        <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: source === "redhat" ? "#fef2f2" : "#eff6ff", color: source === "redhat" ? "#991b1b" : "#1d4ed8", border: `1px solid ${source === "redhat" ? "#fecaca" : "#bfdbfe"}` }}>
          {source === "redhat" ? "RH" : "NVD"}
        </span>
      )}
    </span>
  );
}

function SeverityBadge({ severity }) {
  const map = {
    Critical:  ["#fef2f2", "#dc2626", "#fecaca"],
    Important: ["#fff7ed", "#ea580c", "#fed7aa"],
    Moderate:  ["#fffbeb", "#d97706", "#fde68a"],
    Low:       ["#f0fdf4", "#16a34a", "#bbf7d0"],
  };
  const [bg, color, border] = map[severity] || ["#f8fafc", "#64748b", "#e2e8f0"];
  return (
    <span style={{ background: bg, color, border: `1px solid ${border}`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
      {severity || "Unknown"}
    </span>
  );
}

// ── Host Detail Panel ─────────────────────────────────────────────────────────

function HostDetailPanel({ host, tags, onTagsChanged, onClose }) {
  const [activeTab, setActiveTab]           = useState("overview");
  const [cves, setCves]                     = useState([]);
  const [history, setHistory]               = useState([]);
  const [loadingCves, setLoadingCves]       = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [cveSearch, setCveSearch]           = useState("");

  const outdated = kernelOutdated(host.current_kernel_version, host.latest_available_kernel_version);
  const pkgCount = host.pending_security_packages?.length || 0;

  useEffect(() => {
    if (activeTab === "cves" && cves.length === 0) {
      setLoadingCves(true);
      fetch(`/api/hosts/${encodeURIComponent(host.host)}/cves`)
        .then(r => r.json()).then(d => { setCves(d); setLoadingCves(false); })
        .catch(() => setLoadingCves(false));
    }
    if (activeTab === "history" && history.length === 0) {
      setLoadingHistory(true);
      fetch(`/api/hosts/${encodeURIComponent(host.host)}/history`)
        .then(r => r.json()).then(d => { setHistory(d); setLoadingHistory(false); })
        .catch(() => setLoadingHistory(false));
    }
  }, [activeTab]);

  const filteredCves = cves.filter(c =>
    !cveSearch ||
    c.advisory_id?.toLowerCase().includes(cveSearch.toLowerCase()) ||
    c.synopsis?.toLowerCase().includes(cveSearch.toLowerCase()) ||
    c.cve_ids?.some(id => id.toLowerCase().includes(cveSearch.toLowerCase()))
  );

  const cveCounts = { Critical: 0, Important: 0, Moderate: 0, Low: 0 };
  cves.forEach(c => { if (cveCounts[c.severity] !== undefined) cveCounts[c.severity]++; });

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "cves",     label: `CVE Advisories${cves.length > 0 ? ` (${cves.length})` : ""}` },
    { id: "history",  label: "Kernel History" },
  ];

  const InfoRow = ({ label, value }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "9px 0", borderBottom: "1px solid #f1f5f9" }}>
      <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, minWidth: 160 }}>{label}</span>
      <span style={{ fontSize: 12, color: "#334155", fontFamily: "monospace", textAlign: "right", wordBreak: "break-all" }}>{value || "-"}</span>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backdropFilter: "blur(2px)" }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 760, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.2)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "20px 24px 0", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", fontFamily: "monospace" }}>{host.host}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{host.os_version || "Unknown OS"}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                {tags.map(t => (
                  <TagChip key={t} tag={t} onRemove={async (tag) => {
                    try {
                      const res = await fetch(`/api/hosts/${encodeURIComponent(host.host)}/tags/${encodeURIComponent(tag)}`, { method: "DELETE" }).then(r => r.json());
                      onTagsChanged(res.tags);
                    } catch {}
                  }} />
                ))}
                <TagEditor hostname={host.host} tags={tags} onTagsChanged={onTagsChanged} />
              </div>
            </div>
            <button onClick={onClose} style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#334155", flexShrink: 0, marginLeft: 12 }}
              onMouseEnter={e => e.currentTarget.style.background = "#e2e8f0"}
              onMouseLeave={e => e.currentTarget.style.background = "#f1f5f9"}
            >x</button>
          </div>

          {/* Status strip */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[
              { label: "Kernel",         value: outdated ? "Outdated" : "Up to date", ok: !outdated },
              { label: "Packages",       value: pkgCount > 0 ? `${pkgCount} pending` : "Clean", ok: pkgCount === 0 },
              { label: "Critical CVEs",  value: cveCounts.Critical  || "-", ok: cveCounts.Critical  === 0 },
              { label: "Important CVEs", value: cveCounts.Important || "-", ok: cveCounts.Important === 0 },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: s.ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${s.ok ? "#bbf7d0" : "#fecaca"}`, borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: s.ok ? "#16a34a" : "#dc2626", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: s.ok ? "#16a34a" : "#dc2626", marginTop: 2 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 2 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                border: "none", background: "none", fontFamily: "inherit",
                color: activeTab === t.id ? "#6366f1" : "#64748b",
                borderBottom: `2px solid ${activeTab === t.id ? "#6366f1" : "transparent"}`,
                transition: "all 0.15s",
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div>
              <InfoRow label="OS Version"     value={host.os_version} />
              <InfoRow label="Current Kernel" value={host.current_kernel_version} />
              <InfoRow label="Latest Kernel"  value={host.latest_available_kernel_version} />
              <InfoRow label="Last Reboot"    value={host.last_reboot_time} />
              {pkgCount > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                    Pending Security Packages ({pkgCount})
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {host.pending_security_packages.map((pkg, i) => (
                      <span key={i} style={{ fontSize: 11, fontFamily: "monospace", background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "3px 8px", borderRadius: 4, color: "#334155" }}>{pkg}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CVE TAB */}
          {activeTab === "cves" && (
            <div>
              {loadingCves ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8", fontSize: 13 }}>Loading CVE data...</div>
              ) : cves.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8", fontSize: 13 }}>No CVE advisories found for this host.</div>
              ) : (
                <div>
                  {/* severity summary */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    {Object.entries(cveCounts).map(([sev, count]) => {
                      const colors = {
                        Critical:  ["#fef2f2", "#dc2626", "#fecaca"],
                        Important: ["#fff7ed", "#ea580c", "#fed7aa"],
                        Moderate:  ["#fffbeb", "#d97706", "#fde68a"],
                        Low:       ["#f0fdf4", "#16a34a", "#bbf7d0"],
                      };
                      const [bg, color, border] = colors[sev];
                      return (
                        <div key={sev} style={{ flex: 1, background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{sev}</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color, marginTop: 2 }}>{count}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* search */}
                  <input
                    value={cveSearch}
                    onChange={e => setCveSearch(e.target.value)}
                    placeholder="Search advisory ID, CVE ID, or synopsis..."
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, marginBottom: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                  />

                  {/* cve list */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {filteredCves.map(c => (
                      <div key={c.advisory_id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", background: "#fafafa" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#6366f1" }}>{c.advisory_id}</span>
                            <SeverityBadge severity={c.severity} />
                          </div>
                          <CvssBadge score={c.cvss_score} version={c.cvss_version} source={c.cvss_source} />
                        </div>
                        <div style={{ fontSize: 12, color: "#334155", marginBottom: 6, lineHeight: 1.5 }}>{c.synopsis}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {(c.cve_ids || []).slice(0, 5).map(id => (
                            <span key={id} style={{ fontSize: 10, fontFamily: "monospace", background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", padding: "1px 6px", borderRadius: 4 }}>{id}</span>
                          ))}
                          {(c.cve_ids || []).length > 5 && (
                            <span style={{ fontSize: 10, color: "#94a3b8" }}>+{c.cve_ids.length - 5} more</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === "history" && (
            <div>
              {loadingHistory ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8", fontSize: 13 }}>Loading history...</div>
              ) : history.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8", fontSize: 13 }}>No scan history found for this host.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {history.map((h, i) => {
                    const compliant     = h.compliant;
                    const prevKernel    = i < history.length - 1 ? history[i + 1].current_kernel_version : null;
                    const kernelChanged = prevKernel && prevKernel !== h.current_kernel_version;
                    return (
                      <div key={h.scan_id} style={{ display: "flex", gap: 16, paddingBottom: 16, position: "relative" }}>
                        {/* timeline dot + line */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                          <div style={{ width: 12, height: 12, borderRadius: "50%", background: compliant ? "#22c55e" : "#f97316", border: "2px solid #fff", boxShadow: "0 0 0 2px " + (compliant ? "#22c55e" : "#f97316"), flexShrink: 0, marginTop: 2 }} />
                          {i < history.length - 1 && (
                            <div style={{ width: 2, flex: 1, background: "#e2e8f0", minHeight: 20, marginTop: 4 }} />
                          )}
                        </div>
                        {/* content */}
                        <div style={{ flex: 1, paddingBottom: 4 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: "#64748b" }}>{new Date(h.scanned_at).toLocaleString()}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: compliant ? "#16a34a" : "#ea580c", background: compliant ? "#f0fdf4" : "#fff7ed", border: `1px solid ${compliant ? "#bbf7d0" : "#fed7aa"}`, borderRadius: 5, padding: "1px 7px" }}>
                              {compliant ? "Compliant" : "Outdated"}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, fontFamily: "monospace", color: "#334155", marginBottom: 2 }}>
                            {h.current_kernel_version || "-"}
                            {kernelChanged && (
                              <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: "#6366f1", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 4, padding: "1px 5px" }}>
                                CHANGED
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>
                            {h.package_count} pending packages · {h.advisory_ids.length} advisories
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── osVersionBadge ────────────────────────────────────────────────────────────

function osVersionBadge(osVersion) {
  if (!osVersion) return null;
  const lower = osVersion.toLowerCase();
  let bg, color, border;
  if (lower.includes("ubuntu"))                                                          { bg = "#fef3c7"; color = "#92400e"; border = "#fde68a"; }
  else if (lower.includes("rocky"))                                                      { bg = "#dbeafe"; color = "#1e40af"; border = "#93c5fd"; }
  else if (lower.includes("redhat") || lower.includes("rhel") || lower.includes("red hat")) { bg = "#fee2e2"; color = "#991b1b"; border = "#fca5a5"; }
  else                                                                                   { bg = "#f1f5f9"; color = "#475569"; border = "#cbd5e1"; }
  return (
    <span style={{ background: bg, color, border: `1px solid ${border}`, padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", fontFamily: "inherit" }}>
      {osVersion}
    </span>
  );
}

function shortKernel(v) {
  if (!v) return "-";
  return v.replace(/\.(el|generic|x86_64|aarch64|noarch).*$/, '');
}

// ── HostRow ───────────────────────────────────────────────────────────────────

export function HostRow({ host }) {
  const [expanded,   setExpanded]   = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [tags,       setTags]       = useState(host.tags || []);

  const outdated = kernelOutdated(host.current_kernel_version, host.latest_available_kernel_version);
  const pkgCount = host.pending_security_packages?.length || 0;

  return (
    <>
      <tr style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.15s" }}
        onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
        onMouseLeave={e => e.currentTarget.style.background = ""}>

        {/* hostname + tags */}
        <td style={{ padding: "12px 16px", overflow: "hidden" }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a", marginBottom: tags.length > 0 ? 5 : 0 }}>
            <button onClick={() => setShowDetail(true)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 600, fontSize: 13, color: "#0f172a", fontFamily: "inherit", textAlign: "left" }}
              onMouseEnter={e => e.currentTarget.style.color = "#3b82f6"}
              onMouseLeave={e => e.currentTarget.style.color = "#0f172a"}
            >{host.host}</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
            {tags.map(t => <TagChip key={t} tag={t} onRemove={async (tag) => {
              try {
                const res = await fetch(`/api/hosts/${encodeURIComponent(host.host)}/tags/${encodeURIComponent(tag)}`, { method: "DELETE" }).then(r => r.json());
                setTags(res.tags);
              } catch {}
            }} />)}
            <TagEditor hostname={host.host} tags={tags} onTagsChanged={setTags} />
          </div>
        </td>

        <td style={{ padding: "14px 16px", width: 120 }}>{osVersionBadge(host.os_version)}</td>
        <td style={{ padding: "14px 16px", width: 140, fontSize: 12, color: "#475569" }}>
          {host.last_reboot_time || <span style={{ color: "#cbd5e1" }}>-</span>}
        </td>
        <td title={host.current_kernel_version} style={{ padding: "14px 16px", fontSize: 12, fontFamily: "monospace", color: "#475569", whiteSpace: "nowrap" }}>
          {shortKernel(host.current_kernel_version)}
        </td>
        <td title={host.latest_available_kernel_version} style={{ padding: "14px 16px", fontSize: 12, fontFamily: "monospace", color: "#475569", whiteSpace: "nowrap" }}>
          {shortKernel(host.latest_available_kernel_version)}
        </td>
        <td style={{ padding: "14px 16px", width: 130 }}>
          {outdated ? badge("Outdated", "red") : badge("Up to date", "green")}
        </td>
        <td style={{ padding: "14px 16px", width: 140 }}>
          {pkgCount > 0 ? badge(`${pkgCount} packages`, "yellow") : badge("Clean", "green")}
        </td>
        <td style={{ padding: "14px 16px", width: 80 }}>
          {pkgCount > 0 && (
            <button onClick={() => setExpanded(!expanded)} style={{
              background: "none", border: "1px solid #e2e8f0", borderRadius: 6,
              padding: "4px 10px", cursor: "pointer", fontSize: 12, color: "#475569",
              display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit",
            }}>
              {expanded ? "Hide" : "View"}
              <div style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                <Icon d={Icons.chevron} size={12} />
              </div>
            </button>
          )}
        </td>
      </tr>

      {expanded && pkgCount > 0 && (
        <tr style={{ background: "#f8fafc" }}>
          <td colSpan={8} style={{ padding: "0 16px 16px 16px" }}>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {host.pending_security_packages.map((pkg, i) => (
                <span key={i} style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 4, padding: "3px 8px", fontSize: 11, fontFamily: "monospace", color: "#334155" }}>
                  {pkg}
                </span>
              ))}
            </div>
          </td>
        </tr>
      )}

      {showDetail && (
        <HostDetailPanel
          host={host}
          tags={tags}
          onTagsChanged={setTags}
          onClose={() => setShowDetail(false)}
        />
      )}
    </>
  );
}