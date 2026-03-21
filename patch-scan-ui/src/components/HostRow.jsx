import { useState, useRef, useEffect } from "react";
import { Icon, Icons } from "../utils/icons.jsx";
import { kernelOutdated, badge } from "../utils/helpers.jsx";

const SUGGESTED_TAGS = ["production", "staging", "dmz", "web", "db", "infra"];

const TAG_COLORS = [
  { bg: "var(--blue-tint)",    color: "var(--blue-deep)",    border: "var(--blue-border)"    },
  { bg: "var(--green-tint)",   color: "var(--green-deeper)", border: "var(--green-border)"   },
  { bg: "var(--purple-tint)",  color: "var(--purple-dark)",  border: "var(--purple-border)"  },
  { bg: "var(--orange-tint)",  color: "var(--orange-dark)",  border: "var(--orange-border)"  },
  { bg: "var(--red-tint)",     color: "var(--red-darker)",   border: "var(--red-border)"     },
  { bg: "var(--teal-tint)",    color: "var(--teal)",         border: "var(--teal-border)"    },
  { bg: "var(--yellow-tint)",  color: "var(--yellow-dark)",  border: "var(--yellow-border)"  },
];

// Raw hex needed for hash lookup — keep parallel array
const TAG_COLORS_RAW = [
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
  return TAG_COLORS_RAW[Math.abs(hash) % TAG_COLORS_RAW.length];
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
        padding: "1px 7px", borderRadius: "var(--radius-pill)",
        fontSize: "var(--text-sm)", fontWeight: 600,
        whiteSpace: "nowrap", transition: "all 0.1s",
      }}>
      {tag}
      {onRemove && hovered && (
        <button onClick={e => { e.stopPropagation(); onRemove(tag); }} style={{
          background: "none", border: "none", cursor: "pointer", padding: 0,
          color: cfg.color, fontSize: 12, lineHeight: 1, display: "flex", alignItems: "center",
        }}>×</button>
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
        body: JSON.stringify({ tag }),
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
        background: "none", border: "1px dashed var(--border-muted)",
        borderRadius: "var(--radius-pill)", padding: "1px 7px",
        fontSize: "var(--text-sm)", color: "var(--text-ghost)", cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 3, fontFamily: "inherit",
        transition: "all 0.15s",
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--blue)"; e.currentTarget.style.color = "var(--blue)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-muted)"; e.currentTarget.style.color = "var(--text-ghost)"; }}
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
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-dropdown)",
          padding: "var(--space-3)", width: 220,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-faint)" }}>Add tag to {hostname}</span>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--text-ghost)", lineHeight: 1, padding: 0 }}>×</button>
          </div>
          <input
            autoFocus value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addTag(input); if (e.key === "Escape") setOpen(false); }}
            placeholder="Type a tag..."
            style={{
              width: "100%", padding: "6px 10px",
              border: "1px solid var(--border)", borderRadius: "var(--radius-md)",
              fontSize: "var(--text-base)", outline: "none", fontFamily: "inherit", boxSizing: "border-box",
            }}
          />
          {suggestions.length > 0 && (
            <div style={{ marginTop: "var(--space-2)" }}>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-ghost)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>Suggestions</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)" }}>
                {suggestions.map(s => (
                  <button key={s} onClick={() => addTag(s)} style={{
                    background: "var(--bg-hover)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius-pill)", padding: "2px 8px",
                    fontSize: "var(--text-sm)", cursor: "pointer", color: "var(--text-muted)",
                    fontFamily: "inherit", transition: "all 0.1s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--blue-tint)"; e.currentTarget.style.borderColor = "var(--blue-border)"; e.currentTarget.style.color = "var(--blue-deep)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
                  >{s}</button>
                ))}
              </div>
            </div>
          )}
          {input.trim() && (
            <button onClick={() => addTag(input)} disabled={saving} style={{
              marginTop: "var(--space-2)", width: "100%", padding: "6px",
              background: "var(--bg-sidebar)", color: "var(--bg-card)",
              border: "none", borderRadius: "var(--radius-md)",
              fontSize: "var(--text-base)", cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
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
  if (score === null || score === undefined) return <span style={{ color: "var(--text-ghost)", fontSize: 12 }}>-</span>;
  const color  = score >= 9 ? "var(--red-dark)"    : score >= 7 ? "var(--orange)"      : score >= 4 ? "var(--amber)"      : "var(--green-dark)";
  const bg     = score >= 9 ? "var(--red-tint)"    : score >= 7 ? "var(--orange-tint)" : score >= 4 ? "var(--amber-tint)" : "var(--green-tint)";
  const border = score >= 9 ? "var(--red-border)"  : score >= 7 ? "var(--orange-border)" : score >= 4 ? "var(--yellow-border)" : "var(--green-border)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ background: bg, color, border: `1px solid ${border}`, borderRadius: "var(--radius-md)", padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>
        {score.toFixed(1)}
      </span>
      {source && (
        <span style={{
          fontSize: "var(--text-xs)", fontWeight: 700, padding: "1px 5px",
          borderRadius: "var(--radius-sm)",
          background: source === "redhat" ? "var(--red-tint)"  : "var(--blue-tint)",
          color:      source === "redhat" ? "var(--red-text)"  : "var(--blue-deep)",
          border:     `1px solid ${source === "redhat" ? "var(--red-border)" : "var(--blue-border)"}`,
        }}>
          {source === "redhat" ? "RH" : "NVD"}
        </span>
      )}
    </span>
  );
}

function SeverityBadge({ severity }) {
  const map = {
    Critical:  ["var(--red-tint)",    "var(--red-dark)",    "var(--red-border)"   ],
    Important: ["var(--orange-tint)", "var(--orange)",      "var(--orange-border)"],
    Moderate:  ["var(--amber-tint)",  "var(--amber)",       "var(--yellow-border)"],
    Low:       ["var(--green-tint)",  "var(--green-dark)",  "var(--green-border)" ],
  };
  const [bg, color, border] = map[severity] || ["var(--bg-subtle)", "var(--text-faint)", "var(--border)"];
  return (
    <span style={{ background: bg, color, border: `1px solid ${border}`, borderRadius: "var(--radius-md)", padding: "2px 8px", fontSize: "var(--text-sm)", fontWeight: 700 }}>
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

  const SEV_COLORS = {
    Critical:  ["var(--red-tint)",    "var(--red-dark)",    "var(--red-border)"   ],
    Important: ["var(--orange-tint)", "var(--orange)",      "var(--orange-border)"],
    Moderate:  ["var(--amber-tint)",  "var(--amber)",       "var(--yellow-border)"],
    Low:       ["var(--green-tint)",  "var(--green-dark)",  "var(--green-border)" ],
  };

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "cves",     label: `CVE Advisories${cves.length > 0 ? ` (${cves.length})` : ""}` },
    { id: "history",  label: "Kernel History" },
  ];

  const InfoRow = ({ label, value }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "9px 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <span style={{ fontSize: "var(--text-base)", color: "var(--text-ghost)", fontWeight: 600, minWidth: 160 }}>{label}</span>
      <span style={{ fontSize: "var(--text-base)", color: "var(--text-secondary)", fontFamily: "monospace", textAlign: "right", wordBreak: "break-all" }}>{value || "-"}</span>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--backdrop-dark)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-6)", backdropFilter: "blur(2px)" }}>
      <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius-3xl)", width: "100%", maxWidth: 760, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "var(--shadow-modal-lg)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "var(--space-5) var(--space-6) 0", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: "var(--text-xl)", color: "var(--text-primary)", fontFamily: "monospace" }}>{host.host}</div>
              <div style={{ fontSize: "var(--text-base)", color: "var(--text-faint)", marginTop: 2 }}>{host.os_version || "Unknown OS"}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)", marginTop: "var(--space-2)" }}>
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
            <button onClick={onClose}
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-muted)", borderRadius: "var(--radius-base)", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "var(--text-secondary)", flexShrink: 0, marginLeft: "var(--space-3)" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--border)"}
              onMouseLeave={e => e.currentTarget.style.background = "var(--bg-subtle)"}
            >×</button>
          </div>

          {/* Status strip */}
          <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
            {[
              { label: "Kernel",         value: outdated ? "Outdated" : "Up to date", ok: !outdated },
              { label: "Packages",       value: pkgCount > 0 ? `${pkgCount} pending` : "Clean",     ok: pkgCount === 0 },
              { label: "Critical CVEs",  value: cveCounts.Critical  || "-", ok: cveCounts.Critical  === 0 },
              { label: "Important CVEs", value: cveCounts.Important || "-", ok: cveCounts.Important === 0 },
            ].map(s => (
              <div key={s.label} style={{
                flex: 1,
                background: s.ok ? "var(--green-tint)" : "var(--red-tint)",
                border: `1px solid ${s.ok ? "var(--green-border)" : "var(--red-border)"}`,
                borderRadius: "var(--radius-base)", padding: "8px 12px", textAlign: "center",
              }}>
                <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: s.ok ? "var(--green-dark)" : "var(--red-dark)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
                <div style={{ fontSize: "var(--text-lg)", fontWeight: 800, color: s.ok ? "var(--green-dark)" : "var(--red-dark)", marginTop: 2 }}>{s.value}</div>
              </div>
            ))}
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
        <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-5) var(--space-6)" }}>

          {activeTab === "overview" && (
            <div>
              <InfoRow label="OS Version"     value={host.os_version} />
              <InfoRow label="Current Kernel" value={host.current_kernel_version} />
              <InfoRow label="Latest Kernel"  value={host.latest_available_kernel_version} />
              <InfoRow label="Last Reboot"    value={host.last_reboot_time} />
              {pkgCount > 0 && (
                <div style={{ marginTop: "var(--space-5)" }}>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                    Pending Security Packages ({pkgCount})
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {host.pending_security_packages.map((pkg, i) => (
                      <span key={i} style={{ fontSize: "var(--text-sm)", fontFamily: "monospace", background: "var(--bg-subtle)", border: "1px solid var(--border)", padding: "3px 8px", borderRadius: "var(--radius-sm)", color: "var(--text-secondary)" }}>{pkg}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "cves" && (
            <div>
              {loadingCves ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-ghost)", fontSize: "var(--text-md)" }}>Loading CVE data...</div>
              ) : cves.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-ghost)", fontSize: "var(--text-md)" }}>No CVE advisories found for this host.</div>
              ) : (
                <div>
                  <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
                    {Object.entries(cveCounts).map(([sev, count]) => {
                      const [bg, color, border] = SEV_COLORS[sev];
                      return (
                        <div key={sev} style={{ flex: 1, background: bg, border: `1px solid ${border}`, borderRadius: "var(--radius-base)", padding: "8px 12px", textAlign: "center" }}>
                          <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{sev}</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color, marginTop: 2 }}>{count}</div>
                        </div>
                      );
                    })}
                  </div>
                  <input value={cveSearch} onChange={e => setCveSearch(e.target.value)}
                    placeholder="Search advisory ID, CVE ID, or synopsis..."
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-base)", fontSize: "var(--text-md)", marginBottom: "var(--space-3)", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    {filteredCves.map(c => (
                      <div key={c.advisory_id} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "12px 14px", background: "var(--bg-row)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                            <span style={{ fontFamily: "monospace", fontSize: "var(--text-base)", fontWeight: 700, color: "var(--indigo)" }}>{c.advisory_id}</span>
                            <SeverityBadge severity={c.severity} />
                          </div>
                          <CvssBadge score={c.cvss_score} version={c.cvss_version} source={c.cvss_source} />
                        </div>
                        <div style={{ fontSize: "var(--text-base)", color: "var(--text-secondary)", marginBottom: "var(--space-1)", lineHeight: 1.5 }}>{c.synopsis}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)" }}>
                          {(c.cve_ids || []).slice(0, 5).map(id => (
                            <span key={id} style={{ fontSize: "var(--text-xs)", fontFamily: "monospace", background: "var(--blue-tint)", color: "var(--blue-deep)", border: "1px solid var(--blue-border)", padding: "1px 6px", borderRadius: "var(--radius-sm)" }}>{id}</span>
                          ))}
                          {(c.cve_ids || []).length > 5 && <span style={{ fontSize: "var(--text-xs)", color: "var(--text-ghost)" }}>+{c.cve_ids.length - 5} more</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "history" && (
            <div>
              {loadingHistory ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-ghost)", fontSize: "var(--text-md)" }}>Loading history...</div>
              ) : history.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-ghost)", fontSize: "var(--text-md)" }}>No scan history found for this host.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {history.map((h, i) => {
                    const compliant     = h.compliant;
                    const prevKernel    = i < history.length - 1 ? history[i + 1].current_kernel_version : null;
                    const kernelChanged = prevKernel && prevKernel !== h.current_kernel_version;
                    return (
                      <div key={h.scan_id} style={{ display: "flex", gap: "var(--space-4)", paddingBottom: "var(--space-4)", position: "relative" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                          <div style={{ width: 12, height: 12, borderRadius: "50%", background: compliant ? "var(--green-bright)" : "var(--orange)", border: "2px solid var(--bg-card)", boxShadow: `0 0 0 2px ${compliant ? "var(--green-bright)" : "var(--orange)"}`, flexShrink: 0, marginTop: 2 }} />
                          {i < history.length - 1 && <div style={{ width: 2, flex: 1, background: "var(--border)", minHeight: 20, marginTop: 4 }} />}
                        </div>
                        <div style={{ flex: 1, paddingBottom: 4 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-1)" }}>
                            <span style={{ fontSize: "var(--text-base)", color: "var(--text-faint)" }}>{new Date(h.scanned_at).toLocaleString()}</span>
                            <span style={{
                              fontSize: "var(--text-sm)", fontWeight: 700,
                              color:       compliant ? "var(--green-dark)"   : "var(--orange)",
                              background:  compliant ? "var(--green-tint)"   : "var(--orange-tint)",
                              border: `1px solid ${compliant ? "var(--green-border)" : "var(--orange-border)"}`,
                              borderRadius: "var(--radius-md)", padding: "1px 7px",
                            }}>
                              {compliant ? "Compliant" : "Outdated"}
                            </span>
                          </div>
                          <div style={{ fontSize: "var(--text-base)", fontFamily: "monospace", color: "var(--text-secondary)", marginBottom: 2 }}>
                            {h.current_kernel_version || "-"}
                            {kernelChanged && (
                              <span style={{ marginLeft: "var(--space-2)", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--indigo)", background: "var(--blue-tint)", border: "1px solid var(--blue-border)", borderRadius: "var(--radius-sm)", padding: "1px 5px" }}>
                                CHANGED
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-ghost)" }}>
                            {h.package_count} pending packages · {h.advisory_ids?.length || 0} advisories
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

function shortOsLabel(osVersion) {
  if (!osVersion) return osVersion;
  return osVersion
    .replace(/Red Hat Enterprise Linux\s*/i, "RHEL ")
    .replace(/Rocky Linux\s*/i, "Rocky ")
    .replace(/AlmaLinux\s*/i, "Alma ")
    .trim();
}

function osVersionBadge(osVersion) {
  if (!osVersion) return null;
  const lower = osVersion.toLowerCase();
  let bg, color, border;
  if      (lower.includes("ubuntu"))                                                              { bg = "var(--amber-tint-lt)"; color = "var(--orange-text)"; border = "var(--yellow-border)"; }
  else if (lower.includes("rocky"))                                                               { bg = "var(--blue-tint)";     color = "var(--blue-deep)";    border = "var(--blue-light)";   }
  else if (lower.includes("alma"))                                                                { bg = "var(--green-tint)";    color = "var(--green-text)";   border = "var(--green-border)"; }
  else if (lower.includes("redhat") || lower.includes("rhel") || lower.includes("red hat"))      { bg = "var(--red-tint-mid)";  color = "var(--red-text)";     border = "var(--red-border-lt)";}
  else                                                                                            { bg = "var(--bg-subtle)";     color = "var(--text-muted)";   border = "var(--border-muted)"; }
  return (
    <span style={{ background: bg, color, border: `1px solid ${border}`, padding: "2px 8px", borderRadius: "var(--radius-pill)", fontSize: "var(--text-sm)", fontWeight: 700, whiteSpace: "nowrap", fontFamily: "inherit" }}>
      {shortOsLabel(osVersion)}
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
      <tr style={{ borderBottom: "1px solid var(--border-subtle)", transition: "background 0.15s" }}
        onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
        onMouseLeave={e => e.currentTarget.style.background = ""}>

        {/* hostname + tags */}
        <td style={{ padding: "12px 16px", overflow: "hidden" }}>
          <div style={{ fontWeight: 600, fontSize: "var(--text-md)", color: "var(--text-primary)", marginBottom: tags.length > 0 ? 5 : 0 }}>
            <button onClick={() => setShowDetail(true)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 600, fontSize: "var(--text-md)", color: "var(--text-primary)", fontFamily: "inherit", textAlign: "left" }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--blue)"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--text-primary)"}
            >{host.host}</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)", alignItems: "center" }}>
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
        <td style={{ padding: "14px 16px", width: 140, fontSize: "var(--text-base)", color: "var(--text-muted)" }}>
          {host.last_reboot_time || <span style={{ color: "var(--text-disabled)" }}>-</span>}
        </td>
        <td title={host.current_kernel_version} style={{ padding: "14px 16px", fontSize: "var(--text-base)", fontFamily: "monospace", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          {shortKernel(host.current_kernel_version)}
        </td>
        <td title={host.latest_available_kernel_version} style={{ padding: "14px 16px", fontSize: "var(--text-base)", fontFamily: "monospace", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
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
              background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius-md)",
              padding: "4px 10px", cursor: "pointer", fontSize: "var(--text-base)", color: "var(--text-muted)",
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
        <tr style={{ background: "var(--bg-hover)" }}>
          <td colSpan={8} style={{ padding: "0 16px 16px 16px" }}>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-base)", padding: "var(--space-3)", display: "flex", flexWrap: "wrap", gap: "var(--space-1)" }}>
              {host.pending_security_packages.map((pkg, i) => (
                <span key={i} style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "3px 8px", fontSize: "var(--text-sm)", fontFamily: "monospace", color: "var(--text-secondary)" }}>
                  {pkg}
                </span>
              ))}
            </div>
          </td>
        </tr>
      )}

      {showDetail && (
        <HostDetailPanel host={host} tags={tags} onTagsChanged={setTags} onClose={() => setShowDetail(false)} />
      )}
    </>
  );
}