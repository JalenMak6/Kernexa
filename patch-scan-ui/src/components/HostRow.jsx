import { useState, useRef, useEffect } from "react";
import { Icon, Icons } from "../utils/icons.jsx";
import { kernelOutdated, badge } from "../utils/helpers.jsx";
import { apiFetch, apiDelete } from "../utils/api";

const SUGGESTED_TAGS = ["production", "staging", "dmz", "web", "db", "infra"];

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
      className="inline-flex items-center gap-[3px] px-[7px] py-[1px] rounded-pill text-sm font-semibold whitespace-nowrap transition-all"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      {tag}
      {onRemove && hovered && (
        <button
          onClick={e => { e.stopPropagation(); onRemove(tag); }}
          className="bg-transparent border-none cursor-pointer p-0 text-xs leading-none flex items-center"
          style={{ color: cfg.color }}
        >×</button>
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
      const res = await apiFetch(`/api/hosts/${encodeURIComponent(hostname)}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag }),
      });
      onTagsChanged(res.tags);
    } catch {}
    setSaving(false);
    setInput("");
    setOpen(false);
  };

  const suggestions = SUGGESTED_TAGS.filter(s => !tags.includes(s) && s.includes(input.toLowerCase()));

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="border border-dashed border-border-muted rounded-pill px-[7px] py-[1px] text-sm text-text-ghost cursor-pointer inline-flex items-center gap-[3px] font-[inherit] bg-transparent transition-all duration-150 hover:border-blue hover:text-blue"
      >
        + tag
      </button>

      {open && (
        <div
          className="fixed z-[9999] bg-bg-card border border-border-base rounded-lg shadow-dropdown p-3 w-[220px]"
          style={{
            ...(dropUp
              ? { bottom: window.innerHeight - (buttonRef.current?.getBoundingClientRect().top || 0) + 4 }
              : { top: (buttonRef.current?.getBoundingClientRect().bottom || 0) + 4 }),
            left: buttonRef.current?.getBoundingClientRect().left || 0,
          }}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-bold text-text-faint">Add tag to {hostname}</span>
            <button onClick={() => setOpen(false)} className="bg-transparent border-none cursor-pointer text-base text-text-ghost leading-none p-0">×</button>
          </div>
          <input
            autoFocus value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addTag(input); if (e.key === "Escape") setOpen(false); }}
            placeholder="Type a tag..."
            className="w-full px-[10px] py-[6px] border border-border-base rounded-md text-base outline-none font-[inherit] bg-bg-card text-text-primary"
          />
          {suggestions.length > 0 && (
            <div className="mt-2">
              <div className="text-xs text-text-ghost font-semibold uppercase tracking-[0.05em] mb-[5px]">Suggestions</div>
              <div className="flex flex-wrap gap-1">
                {suggestions.map(s => (
                  <button key={s} onClick={() => addTag(s)}
                    className="bg-bg-hover border border-border-base rounded-pill px-2 py-[2px] text-sm cursor-pointer text-text-muted-c font-[inherit] transition-all hover:bg-blue-tint hover:border-blue-border hover:text-blue-deep"
                  >{s}</button>
                ))}
              </div>
            </div>
          )}
          {input.trim() && (
            <button onClick={() => addTag(input)} disabled={saving}
              className="mt-2 w-full py-[6px] bg-bg-sidebar text-bg-card border-none rounded-md text-base cursor-pointer font-[inherit] font-semibold"
            >
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
  if (score === null || score === undefined) return <span className="text-text-ghost text-sm">-</span>;
  const scoreCls = score >= 9
    ? "bg-red-tint text-red-dark border-red-border"
    : score >= 7
    ? "bg-orange-tint text-orange border-orange-border"
    : score >= 4
    ? "bg-amber-tint text-amber border-yellow-border"
    : "bg-green-tint text-green-dark border-green-border";
  const srcCls = source === "redhat"
    ? "bg-red-tint text-red-text border-red-border"
    : "bg-blue-tint text-blue-deep border-blue-border";
  return (
    <span className="inline-flex items-center gap-[5px]">
      <span className={`${scoreCls} border rounded-md px-2 py-[2px] text-sm font-bold`}>
        {score.toFixed(1)}
      </span>
      {source && (
        <span className={`${srcCls} border text-xs font-bold px-[5px] py-[1px] rounded-sm`}>
          {source === "redhat" ? "RH" : "NVD"}
        </span>
      )}
    </span>
  );
}

function SeverityBadge({ severity }) {
  const cls = {
    Critical:  "bg-red-tint text-red-dark border-red-border",
    Important: "bg-orange-tint text-orange border-orange-border",
    Moderate:  "bg-amber-tint text-amber border-yellow-border",
    Low:       "bg-green-tint text-green-dark border-green-border",
  }[severity] || "bg-bg-subtle text-text-faint border-border-muted";
  return (
    <span className={`${cls} border rounded-md px-2 py-[2px] text-sm font-bold`}>
      {severity || "Unknown"}
    </span>
  );
}

function ExposureBadge({ exposure, bindAddress }) {
  const { cls, label } = {
    external:  { cls: "bg-blue-tint text-blue-deep border-blue-border",    label: "External"  },
    internal:  { cls: "bg-green-tint text-green-dark border-green-border",  label: "Internal"  },
    interface: { cls: "bg-amber-tint text-amber border-yellow-border",      label: "Interface" },
  }[exposure] || { cls: "bg-bg-subtle text-text-faint border-border-muted", label: exposure };
  return (
    <span title={bindAddress} className={`${cls} border rounded-md px-2 py-[2px] text-sm font-bold whitespace-nowrap`}>
      {label}
    </span>
  );
}

// ── Host Detail Panel ─────────────────────────────────────────────────────────

function HostDetailPanel({ host, tags, onTagsChanged, onClose }) {
  const [activeTab,      setActiveTab]      = useState("overview");
  const [cves,           setCves]           = useState([]);
  const [history,        setHistory]        = useState([]);
  const [ports,          setPorts]          = useState([]);
  const [loadingCves,    setLoadingCves]    = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingPorts,   setLoadingPorts]   = useState(false);
  const [cveSearch,      setCveSearch]      = useState("");
  const [portSearch,     setPortSearch]     = useState("");
  const [portFilter,     setPortFilter]     = useState("all");

  const outdated = kernelOutdated(host.current_kernel_version, host.latest_available_kernel_version);
  const pkgCount = host.pending_security_packages?.length || 0;

  useEffect(() => {
    if (activeTab === "cves" && cves.length === 0) {
      setLoadingCves(true);
      apiFetch(`/api/hosts/${encodeURIComponent(host.host)}/cves`)
        .then(d => { setCves(d); setLoadingCves(false); })
        .catch(() => setLoadingCves(false));
    }
    if (activeTab === "history" && history.length === 0) {
      setLoadingHistory(true);
      apiFetch(`/api/hosts/${encodeURIComponent(host.host)}/history`)
        .then(d => { setHistory(d); setLoadingHistory(false); })
        .catch(() => setLoadingHistory(false));
    }
    if (activeTab === "ports" && ports.length === 0) {
      setLoadingPorts(true);
      apiFetch(`/api/hosts/${encodeURIComponent(host.host)}/ports`)
        .then(d => { setPorts(d.ports || []); setLoadingPorts(false); })
        .catch(() => setLoadingPorts(false));
    }
  }, [activeTab]);

  const filteredCves = cves.filter(c =>
    !cveSearch ||
    c.advisory_id?.toLowerCase().includes(cveSearch.toLowerCase()) ||
    c.synopsis?.toLowerCase().includes(cveSearch.toLowerCase()) ||
    c.cve_ids?.some(id => id.toLowerCase().includes(cveSearch.toLowerCase()))
  );

  const filteredPorts = ports.filter(p => {
    const matchExposure = portFilter === "all" || p.exposure === portFilter;
    const matchSearch   = !portSearch ||
      String(p.port).includes(portSearch) ||
      p.service?.toLowerCase().includes(portSearch.toLowerCase()) ||
      p.bind_address?.includes(portSearch);
    return matchExposure && matchSearch;
  });

  const portCounts = ports.reduce((acc, p) => { acc[p.exposure] = (acc[p.exposure] || 0) + 1; return acc; }, {});
  const cveCounts = { Critical: 0, Important: 0, Moderate: 0, Low: 0 };
  cves.forEach(c => { if (cveCounts[c.severity] !== undefined) cveCounts[c.severity]++; });

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "ports",    label: `Open Ports${ports.length > 0 ? ` (${ports.length})` : ""}` },
    { id: "cves",     label: `CVE Advisories${cves.length > 0 ? ` (${cves.length})` : ""}` },
    { id: "history",  label: "Kernel History" },
  ];

  const thCls = "px-3 py-[10px] text-left text-xs font-bold tracking-[0.06em] uppercase text-text-ghost bg-bg-subtle border-b border-border-base";

  const InfoRow = ({ label, value }) => (
    <div className="flex justify-between items-start py-[9px] border-b border-border-subtle">
      <span className="text-base text-text-ghost font-semibold min-w-[160px]">{label}</span>
      <span className="text-base text-text-secondary font-mono text-right break-all">{value || "-"}</span>
    </div>
  );

  const portCardDefs = [
    { key: "external",  label: "External",  baseCls: "bg-blue-tint border-blue-border",    textCls: "text-blue-deep",  outlineColor: "var(--blue-deep)",  desc: "0.0.0.0"    },
    { key: "internal",  label: "Internal",  baseCls: "bg-green-tint border-green-border",  textCls: "text-green-dark", outlineColor: "var(--green-dark)", desc: "127.0.0.1"  },
    { key: "interface", label: "Interface", baseCls: "bg-amber-tint border-yellow-border", textCls: "text-amber",      outlineColor: "var(--amber)",      desc: "Specific IP" },
  ];

  const sevCardCls = {
    Critical:  "bg-red-tint border-red-border text-red-dark",
    Important: "bg-orange-tint border-orange-border text-orange",
    Moderate:  "bg-amber-tint border-yellow-border text-amber",
    Low:       "bg-green-tint border-green-border text-green-dark",
  };

  return (
    <div className="fixed inset-0 bg-[var(--backdrop-dark)] z-[1000] flex items-center justify-center p-6 backdrop-blur-sm">
      <div className="bg-bg-card border border-border-base rounded-3xl w-full max-w-[760px] max-h-[90vh] flex flex-col shadow-modal-lg overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-5 border-b border-border-base">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="font-extrabold text-xl text-text-primary font-mono">{host.host}</div>
              <div className="text-base text-text-faint mt-0.5">{host.os_version || "Unknown OS"}</div>
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map(t => (
                  <TagChip key={t} tag={t} onRemove={async (tag) => {
                    try {
                      const res = await apiDelete(`/api/hosts/${encodeURIComponent(host.host)}/tags/${encodeURIComponent(tag)}`);
                      onTagsChanged(res.tags);
                    } catch {}
                  }} />
                ))}
                <TagEditor hostname={host.host} tags={tags} onTagsChanged={onTagsChanged} />
              </div>
            </div>
            <button onClick={onClose}
              className="bg-bg-subtle border border-border-muted rounded-base w-8 h-8 cursor-pointer flex items-center justify-center text-lg text-text-secondary shrink-0 ml-3 hover:bg-border-base transition-colors"
            >×</button>
          </div>

          {/* Status strip */}
          <div className="flex gap-2 mb-4">
            {[
              { label: "Kernel",         value: outdated ? "Outdated" : "Up to date", ok: !outdated },
              { label: "Packages",       value: pkgCount > 0 ? `${pkgCount} pending` : "Clean",     ok: pkgCount === 0 },
              { label: "Critical CVEs",  value: cveCounts.Critical  || "-", ok: cveCounts.Critical  === 0 },
              { label: "Important CVEs", value: cveCounts.Important || "-", ok: cveCounts.Important === 0 },
            ].map(s => (
              <div key={s.label} className={`flex-1 rounded-base px-3 py-2 text-center border ${s.ok ? "bg-green-tint border-green-border" : "bg-red-tint border-red-border"}`}>
                <div className={`text-xs font-bold uppercase tracking-[0.05em] ${s.ok ? "text-green-dark" : "text-red-dark"}`}>{s.label}</div>
                <div className={`text-lg font-extrabold mt-0.5 ${s.ok ? "text-green-dark" : "text-red-dark"}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-0.5">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2 text-md font-semibold cursor-pointer border-none bg-transparent font-[inherit] border-b-2 transition-all duration-150
                  ${activeTab === t.id ? "text-indigo border-indigo" : "text-text-faint border-transparent"}`}
              >{t.label}</button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Overview */}
          {activeTab === "overview" && (
            <div>
              <InfoRow label="OS Version"     value={host.os_version} />
              <InfoRow label="Current Kernel" value={host.current_kernel_version} />
              <InfoRow label="Latest Kernel"  value={host.latest_available_kernel_version} />
              <InfoRow label="Last Reboot"    value={host.last_reboot_time} />
              {pkgCount > 0 && (
                <div className="mt-5">
                  <div className="text-xs font-bold text-text-faint uppercase tracking-[0.05em] mb-2.5">
                    Pending Security Packages ({pkgCount})
                  </div>
                  <div className="flex flex-wrap gap-[5px]">
                    {host.pending_security_packages.map((pkg, i) => (
                      <span key={i} className="text-sm font-mono bg-bg-subtle border border-border-base px-2 py-[3px] rounded-sm text-text-secondary">{pkg}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Open Ports */}
          {activeTab === "ports" && (
            <div>
              {loadingPorts ? (
                <div className="text-center py-10 text-text-ghost text-md">Loading port data...</div>
              ) : ports.length === 0 ? (
                <div className="text-center py-10 text-text-ghost text-md">No port data available. Run a scan to collect port information.</div>
              ) : (
                <div>
                  <div className="flex gap-2 mb-4">
                    {portCardDefs.map(s => (
                      <div key={s.key}
                        className={`flex-1 ${s.baseCls} border rounded-base px-[14px] py-[10px] text-center cursor-pointer transition-all duration-150`}
                        style={{ outline: portFilter === s.key ? `2px solid ${s.outlineColor}` : "none" }}
                        onClick={() => setPortFilter(portFilter === s.key ? "all" : s.key)}
                      >
                        <div className={`text-xs font-bold ${s.textCls} uppercase tracking-[0.05em]`}>{s.label}</div>
                        <div className={`text-3xl font-extrabold ${s.textCls} mt-0.5`}>{portCounts[s.key] || 0}</div>
                        <div className={`text-xs ${s.textCls} opacity-70`}>{s.desc}</div>
                      </div>
                    ))}
                  </div>

                  <input
                    value={portSearch}
                    onChange={e => setPortSearch(e.target.value)}
                    placeholder="Search port, service, or bind address..."
                    className="w-full px-3 py-2 border border-border-base rounded-base text-md mb-3 font-[inherit] outline-none bg-bg-page text-text-primary"
                  />

                  <div className="border border-border-base rounded-lg overflow-hidden">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          {["Port", "Protocol", "Bind Address", "Service", "Exposure"].map(h => (
                            <th key={h} className={thCls}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPorts.length === 0 ? (
                          <tr><td colSpan={5} className="p-6 text-center text-text-ghost text-md">No ports match your filter</td></tr>
                        ) : filteredPorts.map((p, i) => (
                          <tr key={i} className="border-b border-border-subtle hover:bg-bg-hover transition-colors">
                            <td className="px-3 py-[10px] font-mono font-bold text-md text-text-primary">{p.port}</td>
                            <td className="px-3 py-[10px] text-base text-text-muted-c uppercase font-semibold">{p.protocol}</td>
                            <td className="px-3 py-[10px] font-mono text-base text-text-secondary">{p.bind_address}</td>
                            <td className="px-3 py-[10px] text-base text-text-secondary font-mono">{p.service || "-"}</td>
                            <td className="px-3 py-[10px]"><ExposureBadge exposure={p.exposure} bindAddress={p.bind_address} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 text-sm text-text-ghost">
                    {filteredPorts.length} of {ports.length} ports shown
                    {portFilter !== "all" && (
                      <button onClick={() => setPortFilter("all")} className="ml-2 bg-transparent border-none text-blue-deep cursor-pointer text-sm p-0 font-[inherit]">
                        clear filter ×
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CVE Advisories */}
          {activeTab === "cves" && (
            <div>
              {loadingCves ? (
                <div className="text-center py-10 text-text-ghost text-md">Loading CVE data...</div>
              ) : cves.length === 0 ? (
                <div className="text-center py-10 text-text-ghost text-md">No CVE advisories found for this host.</div>
              ) : (
                <div>
                  <div className="flex gap-2 mb-4">
                    {Object.entries(cveCounts).map(([sev, count]) => {
                      const cls = sevCardCls[sev] || "bg-bg-subtle border-border-muted text-text-faint";
                      return (
                        <div key={sev} className={`flex-1 ${cls} border rounded-base px-3 py-2 text-center`}>
                          <div className="text-xs font-bold uppercase tracking-[0.05em]">{sev}</div>
                          <div className="text-[20px] font-extrabold mt-0.5">{count}</div>
                        </div>
                      );
                    })}
                  </div>
                  <input value={cveSearch} onChange={e => setCveSearch(e.target.value)}
                    placeholder="Search advisory ID, CVE ID, or synopsis..."
                    className="w-full px-3 py-2 border border-border-base rounded-base text-md mb-3 font-[inherit] outline-none bg-bg-card text-text-primary"
                  />
                  <div className="flex flex-col gap-2">
                    {filteredCves.map(c => (
                      <div key={c.advisory_id} className="border border-border-base rounded-lg px-[14px] py-3 bg-bg-row">
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-base font-bold text-indigo">{c.advisory_id}</span>
                            <SeverityBadge severity={c.severity} />
                          </div>
                          <CvssBadge score={c.cvss_score} version={c.cvss_version} source={c.cvss_source} />
                        </div>
                        <div className="text-base text-text-secondary mb-1 leading-relaxed">{c.synopsis}</div>
                        <div className="flex flex-wrap gap-1">
                          {(c.cve_ids || []).slice(0, 5).map(id => (
                            <span key={id} className="text-xs font-mono bg-blue-tint text-blue-deep border border-blue-border px-[6px] py-[1px] rounded-sm">{id}</span>
                          ))}
                          {(c.cve_ids || []).length > 5 && <span className="text-xs text-text-ghost">+{c.cve_ids.length - 5} more</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Kernel History */}
          {activeTab === "history" && (
            <div>
              {loadingHistory ? (
                <div className="text-center py-10 text-text-ghost text-md">Loading history...</div>
              ) : history.length === 0 ? (
                <div className="text-center py-10 text-text-ghost text-md">No scan history found for this host.</div>
              ) : (
                <div className="flex flex-col">
                  {history.map((h, i) => {
                    const compliant     = h.compliant;
                    const prevKernel    = i < history.length - 1 ? history[i + 1].current_kernel_version : null;
                    const kernelChanged = prevKernel && prevKernel !== h.current_kernel_version;
                    return (
                      <div key={h.scan_id} className="flex gap-4 pb-4 relative">
                        <div className="flex flex-col items-center shrink-0">
                          <div
                            className={`w-3 h-3 rounded-full border-2 border-bg-card shrink-0 mt-0.5 ${compliant ? "bg-green-bright" : "bg-orange"}`}
                            style={{ boxShadow: `0 0 0 2px ${compliant ? "var(--green-bright)" : "var(--orange)"}` }}
                          />
                          {i < history.length - 1 && <div className="w-0.5 flex-1 bg-border-subtle min-h-5 mt-1" />}
                        </div>
                        <div className="flex-1 pb-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-base text-text-faint">{new Date(h.scanned_at).toLocaleString()}</span>
                            <span className={`text-sm font-bold rounded-md px-[7px] py-[1px] border ${compliant ? "text-green-dark bg-green-tint border-green-border" : "text-orange bg-orange-tint border-orange-border"}`}>
                              {compliant ? "Compliant" : "Outdated"}
                            </span>
                          </div>
                          <div className="text-base font-mono text-text-secondary mb-0.5">
                            {h.current_kernel_version || "-"}
                            {kernelChanged && (
                              <span className="ml-2 text-xs font-bold text-indigo bg-blue-tint border border-blue-border rounded-sm px-[5px] py-[1px]">
                                CHANGED
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-text-ghost">
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

// ── OS version badge ──────────────────────────────────────────────────────────

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
  let cls;
  if      (lower.includes("ubuntu"))
    cls = "bg-amber-tint-lt text-orange-text border-yellow-border";
  else if (lower.includes("rocky"))
    cls = "bg-blue-tint text-blue-deep border-blue-light";
  else if (lower.includes("alma"))
    cls = "bg-green-tint text-green-text border-green-border";
  else if (lower.includes("redhat") || lower.includes("rhel") || lower.includes("red hat"))
    cls = "bg-red-tint-mid text-red-text border-red-border-lt";
  else
    cls = "bg-bg-subtle text-text-muted-c border-border-muted";
  return (
    <span className={`${cls} border px-2 py-[2px] rounded-pill text-sm font-bold whitespace-nowrap font-[inherit]`}>
      {shortOsLabel(osVersion)}
    </span>
  );
}

function shortKernel(v) {
  if (!v) return "-";
  return v.replace(/\.(el|generic|x86_64|aarch64|noarch).*$/, "");
}

// ── HostRow ───────────────────────────────────────────────────────────────────

export function HostRow({ host }) {
  const [expanded,     setExpanded]     = useState(false);
  const [showDetail,   setShowDetail]   = useState(false);
  const [tags,         setTags]         = useState(host.tags || []);
  const [ports,        setPorts]        = useState(null);
  const [loadingPorts, setLoadingPorts] = useState(false);

  const outdated = kernelOutdated(host.current_kernel_version, host.latest_available_kernel_version);
  const pkgCount = host.pending_security_packages?.length || 0;

  useEffect(() => {
    setLoadingPorts(true);
    apiFetch(`/api/hosts/${encodeURIComponent(host.host)}/ports`)
      .then(d => { setPorts(d.ports || []); setLoadingPorts(false); })
      .catch(() => { setPorts([]); setLoadingPorts(false); });
  }, [host.host]);

  const externalPorts  = (ports || []).filter(p => p.exposure === "external");
  const internalPorts  = (ports || []).filter(p => p.exposure === "internal");
  const interfacePorts = (ports || []).filter(p => p.exposure === "interface");
  const portCount      = (ports || []).length;

  const portChipCls = {
    external:  "bg-blue-tint text-blue-deep border-blue-border",
    internal:  "bg-green-tint text-green-dark border-green-border",
    interface: "bg-amber-tint text-amber border-yellow-border",
  };

  return (
    <>
      <tr className="border-b border-border-subtle hover:bg-bg-hover transition-colors">

        {/* Hostname + tags */}
        <td className="px-4 py-3 overflow-hidden">
          <div className={`font-semibold text-md text-text-primary ${tags.length > 0 ? "mb-[5px]" : ""}`}>
            <button
              onClick={() => setShowDetail(true)}
              className="bg-transparent border-none p-0 cursor-pointer font-semibold text-md text-text-primary font-[inherit] text-left hover:text-blue transition-colors"
            >{host.host}</button>
          </div>
          <div className="flex flex-wrap gap-1 items-center">
            {tags.map(t => <TagChip key={t} tag={t} onRemove={async (tag) => {
              try {
                const res = await apiDelete(`/api/hosts/${encodeURIComponent(host.host)}/tags/${encodeURIComponent(tag)}`);
                setTags(res.tags);
              } catch {}
            }} />)}
            <TagEditor hostname={host.host} tags={tags} onTagsChanged={setTags} />
          </div>
        </td>

        <td className="px-4 py-[14px]" style={{ width: 100 }}>{osVersionBadge(host.os_version)}</td>
        <td className="px-4 py-[14px] text-base text-text-muted-c" style={{ width: 120 }}>
          {host.last_reboot_time || <span className="text-text-disabled">-</span>}
        </td>
        <td
          title={host.current_kernel_version}
          className="px-4 py-[14px] text-base font-mono text-text-muted-c whitespace-nowrap overflow-hidden text-ellipsis"
          style={{ width: 160 }}
        >
          {shortKernel(host.current_kernel_version)}
        </td>
        <td
          title={host.latest_available_kernel_version}
          className="px-4 py-[14px] text-base font-mono text-text-muted-c whitespace-nowrap overflow-hidden text-ellipsis"
          style={{ width: 160 }}
        >
          {shortKernel(host.latest_available_kernel_version)}
        </td>
        <td className="px-4 py-[14px]" style={{ width: 110 }}>
          {outdated ? badge("Outdated", "red") : badge("Up to date", "green")}
        </td>
        <td className="px-4 py-[14px]" style={{ width: 130 }}>
          {pkgCount > 0 ? badge(`${pkgCount} packages`, "yellow") : badge("Clean", "green")}
        </td>

        {/* Open Ports column */}
        <td className="px-4 py-[10px]" style={{ width: 150 }}>
          {loadingPorts ? (
            <span className="text-text-ghost text-sm">...</span>
          ) : ports === null || portCount === 0 ? (
            <span className="text-text-disabled text-sm">—</span>
          ) : (
            <div className="flex flex-wrap gap-[3px]">
              {(() => {
                const allChips = [
                  ...externalPorts.map(p => ({ ...p, type: "external" })),
                  ...internalPorts.map(p => ({ ...p, type: "internal" })),
                  ...interfacePorts.map(p => ({ ...p, type: "interface" })),
                ];
                const MAX      = 5;
                const shown    = allChips.slice(0, MAX);
                const overflow = allChips.length - MAX;
                return (
                  <>
                    {shown.map((p, i) => (
                      <span key={i}
                        title={`${p.protocol?.toUpperCase()} ${p.bind_address}:${p.port} — ${p.service}`}
                        className={`${portChipCls[p.type]} border rounded-sm px-[6px] py-[1px] text-xs font-mono font-bold whitespace-nowrap`}
                      >
                        {p.port}{p.service && p.service !== "unknown" ? ` ${p.service}` : ""}
                      </span>
                    ))}
                    {overflow > 0 && (
                      <span
                        title={allChips.slice(MAX).map(p => `${p.port} ${p.service}`).join(", ")}
                        className="bg-bg-subtle text-text-ghost border border-border-base rounded-sm px-[6px] py-[1px] text-xs font-semibold whitespace-nowrap cursor-default"
                      >
                        +{overflow}
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </td>

        <td className="px-4 py-[14px]" style={{ width: 75 }}>
          <button onClick={() => setExpanded(!expanded)}
            className="bg-transparent border border-border-base rounded-md px-[10px] py-1 cursor-pointer text-base text-text-muted-c flex items-center gap-1 font-[inherit] hover:bg-bg-hover transition-colors"
          >
            {expanded ? "Hide" : "View"}
            <div className={`transition-transform duration-200 ${expanded ? "rotate-180" : "rotate-0"}`}>
              <Icon d={Icons.chevron} size={12} />
            </div>
          </button>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-bg-hover">
          <td colSpan={9} className="px-4 pb-4 pt-0">
            <div className="flex flex-col gap-2">

              {pkgCount > 0 && (
                <div className="bg-bg-card border border-border-base rounded-base p-3">
                  <div className="text-xs font-bold text-text-ghost uppercase tracking-[0.05em] mb-2">
                    Pending Security Packages ({pkgCount})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {host.pending_security_packages.map((pkg, i) => (
                      <span key={i} className="bg-bg-subtle border border-border-base rounded-sm px-2 py-[3px] text-sm font-mono text-text-secondary">
                        {pkg}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-bg-card border border-border-base rounded-base p-3">
                <div className="text-xs font-bold text-text-ghost uppercase tracking-[0.05em] mb-2">
                  Open Ports {loadingPorts ? "..." : ports !== null ? `(${portCount})` : ""}
                </div>

                {loadingPorts ? (
                  <div className="text-sm text-text-ghost">Loading...</div>
                ) : ports === null || portCount === 0 ? (
                  <div className="text-sm text-text-ghost">No port data — run a scan to collect.</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {externalPorts.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-blue-deep mb-[5px]">
                          External (0.0.0.0) — {externalPorts.length} port{externalPorts.length > 1 ? "s" : ""}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {externalPorts.map((p, i) => (
                            <span key={i} title={`${p.protocol.toUpperCase()} ${p.bind_address}:${p.port} — ${p.service}`}
                              className="bg-blue-tint border border-blue-border rounded-sm px-2 py-[3px] text-sm font-mono text-blue-deep font-semibold">
                              {p.port} <span className="font-normal opacity-80">{p.service !== "unknown" ? p.service : p.protocol}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {internalPorts.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-green-dark mb-[5px]">
                          Internal (127.0.0.1) — {internalPorts.length} port{internalPorts.length > 1 ? "s" : ""}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {internalPorts.map((p, i) => (
                            <span key={i} title={`${p.protocol.toUpperCase()} ${p.bind_address}:${p.port} — ${p.service}`}
                              className="bg-green-tint border border-green-border rounded-sm px-2 py-[3px] text-sm font-mono text-green-dark">
                              {p.port} <span className="font-normal opacity-80">{p.service !== "unknown" ? p.service : p.protocol}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {interfacePorts.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-amber mb-[5px]">
                          Interface-bound — {interfacePorts.length} port{interfacePorts.length > 1 ? "s" : ""}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {interfacePorts.map((p, i) => (
                            <span key={i} title={`${p.protocol.toUpperCase()} ${p.bind_address}:${p.port} — ${p.service}`}
                              className="bg-amber-tint border border-yellow-border rounded-sm px-2 py-[3px] text-sm font-mono text-amber">
                              {p.port} <span className="font-normal opacity-80">{p.bind_address}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

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
