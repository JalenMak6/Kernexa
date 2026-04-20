import { useState, useEffect } from "react";
import { Icon, Icons } from "../utils/icons.jsx";
import { fmtDate } from "../utils/helpers.jsx";
import { apiPost, apiFetch } from "../utils/api";

// ── Severity class lookups ────────────────────────────────────────────────────

const SEV_CLS = {
  Critical:  { badge: "bg-red-tint text-red-text border-red-border-lt",           dot: "bg-red",         btnActive: "bg-red-tint border-red text-red-text"           },
  Important: { badge: "bg-orange-tint text-orange-darker border-orange-border-lt", dot: "bg-orange",      btnActive: "bg-orange-tint border-orange text-orange-darker" },
  Moderate:  { badge: "bg-yellow-tint text-yellow-darker border-yellow-border",    dot: "bg-amber",       btnActive: "bg-yellow-tint border-amber text-yellow-darker"  },
  Low:       { badge: "bg-green-tint text-green-text border-green-border",         dot: "bg-green-bright",btnActive: "bg-green-tint border-green text-green-text"      },
};
const SEV_DEFAULT = { badge: "bg-bg-subtle text-text-muted-c border-border-base", dot: "bg-text-ghost", btnActive: "" };

// Returns CSS variable strings — used for SVG stroke colors and dynamic inline use
function cvssConfig(score) {
  if (score === null || score === undefined) return null;
  if (score >= 9.0) return { bg: "var(--red-tint)",    color: "var(--red-text)",      border: "var(--red-border-lt)",    label: "Critical", cls: "bg-red-tint text-red-text border-red-border-lt"         };
  if (score >= 7.0) return { bg: "var(--orange-tint)", color: "var(--orange-darker)", border: "var(--orange-border-lt)", label: "High",     cls: "bg-orange-tint text-orange-darker border-orange-border-lt" };
  if (score >= 4.0) return { bg: "var(--yellow-tint)", color: "var(--yellow-darker)", border: "var(--yellow-border)",    label: "Medium",   cls: "bg-yellow-tint text-yellow-darker border-yellow-border"    };
  if (score >  0.0) return { bg: "var(--green-tint)",  color: "var(--green-text)",    border: "var(--green-border)",     label: "Low",      cls: "bg-green-tint text-green-text border-green-border"         };
  return               { bg: "var(--bg-subtle)",    color: "var(--text-faint)",    border: "var(--border)",           label: "None",     cls: "bg-bg-subtle text-text-faint border-border-base"           };
}

function CvssBadge({ score, vector, version, source }) {
  const [hovered, setHovered] = useState(false);
  if (score === null || score === undefined) return <span className="text-text-disabled text-base">—</span>;
  const cfg         = cvssConfig(score);
  const sourceLabel = source === "redhat" ? "RH" : source === "nvd" ? "NVD" : null;
  const sourceCls   = source === "redhat" ? "bg-red-tint-mid text-red-dark" : "bg-blue-tint text-blue-dark";

  return (
    <div className="relative inline-block" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <span className={`border rounded-md px-2 py-[2px] text-base font-bold font-mono inline-flex items-center gap-1 whitespace-nowrap ${cfg.cls} ${vector ? "cursor-help" : "cursor-default"}`}>
        {score.toFixed(1)}
        <span className="inline-flex items-center gap-[3px]">
          {version && <span className="text-xs font-medium opacity-60">v{version}</span>}
          {sourceLabel && <span className={`text-xs font-bold px-1 rounded-sm ${sourceCls}`}>{sourceLabel}</span>}
        </span>
      </span>
      {hovered && (
        <div className="absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 bg-bg-sidebar text-slate-300 px-[14px] py-[10px] rounded-base text-sm font-mono whitespace-nowrap shadow-tooltip z-[100] pointer-events-none min-w-[200px] border border-[#1e293b]">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-slate-400">CVSS v{version} Score</span>
            <span className={`text-xs font-bold ${source === "redhat" ? "text-[#f87171]" : "text-[#60a5fa]"}`}>
              {source === "redhat" ? "Red Hat" : "NVD"}
            </span>
          </div>
          {vector && <div className="text-slate-400 text-xs mb-1">{vector}</div>}
          {source === "nvd" && (
            <div className="text-slate-300 text-xs mt-1.5 border-t border-[#1e293b] pt-1.5">
              ⚠ No Red Hat score — NVD generic score shown
            </div>
          )}
          <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-bg-sidebar rotate-45" />
        </div>
      )}
    </div>
  );
}

function severityBadge(severity) {
  const cfg = SEV_CLS[severity] || SEV_DEFAULT;
  return (
    <span className={`border rounded-pill px-2.5 py-[2px] text-sm font-bold inline-flex items-center gap-1 whitespace-nowrap ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${cfg.dot}`} />
      {severity || "Unknown"}
    </span>
  );
}

function RemediationBlock({ remediation, resolvedAptCmd, binaryPackages, sourcePackage }) {
  if (!remediation) return null;
  const lines        = remediation.split("\n");
  const commandLine  = lines[0];
  const patchedLines = lines.slice(2).filter(l => l.trim());

  const isUbuntuCve  = !!sourcePackage;
  const displayCmd   = (isUbuntuCve && resolvedAptCmd)
    ? `Run: apt-get update && ${resolvedAptCmd}`
    : commandLine;
  const copyCmd      = displayCmd.replace(/^Run:\s*/, '');
  const isResolved   = isUbuntuCve && binaryPackages && binaryPackages.length > 0 &&
                       !(binaryPackages.length === 1 && binaryPackages[0] === sourcePackage);

  return (
    <div className="mt-4 border-t border-border-base pt-4">
      <div className="text-sm font-bold text-text-faint uppercase tracking-[0.05em] mb-2 flex items-center gap-1.5">
        <span className="w-[7px] h-[7px] rounded-full bg-green inline-block" />
        Remediation
      </div>
      <div className="bg-bg-sidebar rounded-base px-[14px] py-2.5 mb-2.5 flex items-center justify-between gap-3">
        <code className="text-base text-green-light font-mono break-all">{displayCmd}</code>
        <button onClick={() => navigator.clipboard.writeText(copyCmd)} title="Copy command"
          className="bg-bg-sidebar-item border border-border-dark rounded-md px-2 py-[3px] cursor-pointer text-xs text-text-faint font-[inherit] whitespace-nowrap shrink-0">
          Copy
        </button>
      </div>
      {isResolved && (
        <div className="mb-2.5">
          <div className="text-sm text-text-ghost mb-1">
            Binary packages that will be upgraded (resolved from source: <code className="font-mono text-text-faint">{sourcePackage}</code>):
          </div>
          <div className="flex flex-wrap gap-1">
            {binaryPackages.map((pkg, i) => (
              <span key={i} className="text-sm font-mono bg-green-tint border border-green-border text-green-text px-2 py-[2px] rounded-sm">{pkg}</span>
            ))}
          </div>
        </div>
      )}
      {patchedLines.length > 0 && (
        <div>
          <div className="text-sm text-text-ghost mb-1">Patched versions available:</div>
          <div className="flex flex-wrap gap-1">
            {patchedLines.map((line, i) => (
              <span key={i} className="text-sm font-mono bg-green-tint border border-green-border text-green-text px-2 py-[2px] rounded-sm">
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
  const [expanded,     setExpanded]     = useState(false);
  const [resolvedPkgs, setResolvedPkgs] = useState(null);
  const isUbuntuCve = !!cve.source_package && /^CVE-/.test(cve.advisory_id || '');

  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && isUbuntuCve && resolvedPkgs === null) {
      apiFetch(`/api/cve/${encodeURIComponent(cve.advisory_id)}/resolved-packages`)
        .then(data => setResolvedPkgs(data))
        .catch(() => setResolvedPkgs({}));
    }
  };

  const canPatch   = (cve.affected_hosts?.length || 0) > 0;
  const hasPackage = /^(RHSA|ALSA|RLSA|RHBA|RHEA)-/.test(cve.advisory_id || '') ||
    !!(cve.source_package) ||
    !!(cve.remediation?.match(/(?:yum\s+update|apt-get\s+(?:upgrade|install)(?:\s+--only-upgrade)?)\s+([\w][\w.\-+]+)/i));
  const patchTitle = !hasPackage
    ? "No package name found in remediation — patch manually"
    : `Patch ${cve.affected_hosts?.length} affected host${cve.affected_hosts?.length > 1 ? "s" : ""}`;

  const cvssColor = cvssConfig(cve.cvss_score)?.color;

  return (
    <>
      <tr className="border-b border-border-subtle hover:bg-bg-hover transition-colors cursor-pointer" onClick={handleExpand}>
        <td className="px-4 py-[14px] whitespace-nowrap">
          <span className="text-base font-mono font-bold text-blue">{cve.advisory_id}</span>
        </td>
        <td className="px-4 py-[14px] text-md text-text-secondary overflow-hidden text-ellipsis whitespace-nowrap">{cve.synopsis}</td>
        <td className="px-4 py-[14px] w-[120px]">{severityBadge(cve.severity)}</td>
        <td className="px-4 py-[14px] w-[110px]"><CvssBadge score={cve.cvss_score} vector={cve.cvss_vector} version={cve.cvss_version} source={cve.cvss_source} /></td>
        <td className="px-4 py-[14px] w-[180px]">
          <div className="flex flex-wrap gap-1">
            {(cve.cve_ids || []).slice(0, 2).map(id => (
              <a key={id} href={`https://nvd.nist.gov/vuln/detail/${id}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                className="text-sm font-mono text-indigo bg-indigo-tint border border-indigo-border px-1.5 py-px rounded-sm no-underline whitespace-nowrap">
                {id}
              </a>
            ))}
            {cve.cve_ids?.length > 2 && <span className="text-sm text-text-ghost">+{cve.cve_ids.length - 2}</span>}
          </div>
        </td>
        <td className="px-4 py-[14px] w-[130px]">
          {cve.affected_hosts?.length > 0
            ? <span className="bg-red-tint text-red-dark border border-red-border px-2.5 py-[2px] rounded-pill text-sm font-bold">{cve.affected_hosts.length} host{cve.affected_hosts.length !== 1 ? "s" : ""}</span>
            : <span className="text-text-ghost text-base">—</span>
          }
        </td>
        <td className="px-[10px] py-[14px] w-[80px] text-right" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1.5 justify-end">
            {canPatch && (
              <button onClick={() => onPatch(cve)} disabled={!hasPackage}
                className={`px-2.5 py-1 border-none rounded-md text-xs font-bold font-[inherit] whitespace-nowrap
                  ${hasPackage ? "cursor-pointer text-white" : "cursor-not-allowed bg-bg-subtle text-text-ghost"}`}
                style={{ background: hasPackage ? "linear-gradient(135deg,#16a34a,#15803d)" : undefined }}
                title={patchTitle}>
                🛠 Patch
              </button>
            )}
            <div onClick={handleExpand} className={`cursor-pointer inline-flex transition-transform duration-200 ${expanded ? "rotate-180" : "rotate-0"}`}>
              <Icon d={Icons.chevron} size={13} color="var(--text-ghost)" />
            </div>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-bg-hover">
          <td colSpan={7} className="px-4 pb-4">
            <div className="bg-bg-card border border-border-base rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-bold text-text-faint uppercase tracking-[0.05em] mb-1">Description</div>
                  <div className="text-base text-text-secondary leading-relaxed">{cve.description || "No description available."}</div>
                </div>
                <div className="flex flex-col gap-3">
                  {cve.cvss_score != null && (
                    <div>
                      <div className="text-sm font-bold text-text-faint uppercase tracking-[0.05em] mb-1">CVSS Score</div>
                      <div className="flex items-center gap-2.5">
                        <div className="relative w-14 h-14">
                          <svg width="56" height="56" viewBox="0 0 56 56">
                            <circle cx="28" cy="28" r="22" fill="none" stroke="var(--bg-subtle)" strokeWidth="6" />
                            <circle cx="28" cy="28" r="22" fill="none"
                              stroke={cvssColor || "var(--text-ghost)"}
                              strokeWidth="6"
                              strokeDasharray={`${(cve.cvss_score / 10) * 138.2} 138.2`}
                              strokeLinecap="round" transform="rotate(-90 28 28)"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center text-md font-extrabold"
                            style={{ color: cvssColor }}>
                            {cve.cvss_score.toFixed(1)}
                          </div>
                        </div>
                        <div>
                          <div className="text-md font-bold" style={{ color: cvssColor }}>
                            {cvssConfig(cve.cvss_score)?.label}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-text-ghost">CVSSv{cve.cvss_version}</span>
                            {cve.cvss_source && (
                              <span className={`text-xs font-bold px-1.5 py-px rounded-sm ${cve.cvss_source === "redhat" ? "bg-red-tint-mid text-red-dark" : "bg-blue-tint text-blue-dark"}`}>
                                {cve.cvss_source === "redhat" ? "Red Hat" : "NVD"}
                              </span>
                            )}
                          </div>
                          {cve.cvss_vector && <div className="text-xs font-mono text-text-faint mt-1 break-all">{cve.cvss_vector}</div>}
                        </div>
                      </div>
                    </div>
                  )}
                  {cve.cve_ids?.length > 0 && (
                    <div>
                      <div className="text-sm font-bold text-text-faint uppercase tracking-[0.05em] mb-1">CVE References</div>
                      <div className="flex flex-wrap gap-1">
                        {cve.cve_ids.map(id => (
                          <a key={id} href={`https://nvd.nist.gov/vuln/detail/${id}`} target="_blank" rel="noreferrer"
                            className="text-base font-mono text-indigo bg-indigo-tint border border-indigo-border px-2 py-[3px] rounded-sm no-underline">
                            {id} ↗
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {cve.affected_hosts?.length > 0 && (
                    <div>
                      <div className="text-sm font-bold text-text-faint uppercase tracking-[0.05em] mb-1">Affected Hosts</div>
                      <div className="flex flex-wrap gap-1">
                        {cve.affected_hosts.map(host => (
                          <span key={host} className="text-base font-mono bg-bg-subtle border border-border-base px-2 py-[3px] rounded-sm text-text-secondary">{host}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="text-sm text-text-ghost">Fetched {fmtDate(cve.fetched_at)}</div>
                </div>
              </div>
              <RemediationBlock
                remediation={cve.remediation}
                resolvedAptCmd={resolvedPkgs?.apt_cmd}
                binaryPackages={resolvedPkgs?.binary_packages}
                sourcePackage={cve.source_package}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Patch Modal ───────────────────────────────────────────────────────────────

function PatchModal({ cve, onClose }) {
  const allHosts      = cve.affected_hosts || [];
  const [selected,    setSelected]    = useState(new Set(allHosts));
  const [jobId,       setJobId]       = useState(null);
  const [phase,       setPhase]       = useState("select");
  const [dryResult,   setDryResult]   = useState(null);
  const [applyResult, setApplyResult] = useState(null);
  const [error,       setError]       = useState(null);
  const [expandedOut, setExpandedOut] = useState({});

  const sourcePackage  = cve.source_package || '';
  const remediationCmd = (() => {
    if (!cve.remediation) return '';
    const firstLine = cve.remediation.split('\n')[0].trim();
    if (firstLine.startsWith('Run: ')) return firstLine.slice(5);
    const viaMatch = firstLine.match(/via:\s+(.+)$/);
    if (viaMatch) return viaMatch[1].trim();
    return '';
  })();

  const remediationPkgs = (() => {
    if (!cve.remediation) return [];
    const text = cve.remediation;
    const patterns = [
      /apt-get upgrade\s+([\w][\w.\-+]+(?:\s+[\w][\w.\-+]+)*)/i,
      /apt-get install(?:\s+--only-upgrade)?\s+([\w][\w.\-+]+(?:\s+[\w][\w.\-+]+)*)/i,
      /yum update\s+([\w][\w.\-+]+(?:\s+[\w][\w.\-+]+)*)/i,
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (m) {
        const pkgs = m[1].trim().split(/\s+/).filter(p => p.length > 1 && !p.startsWith('-'));
        if (pkgs.length) return pkgs;
      }
    }
    return [];
  })();
  const patchPackages = remediationPkgs.length ? remediationPkgs : sourcePackage ? [sourcePackage] : [];

  const isAdvisory = /^(RHSA|ALSA|RLSA|RHBA|RHEA)-/.test(cve.advisory_id || '');
  const isCveId    = patchPackages.length > 0 && /^CVE-/.test(patchPackages[0] || '');

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
    if (!isAdvisory && patchPackages.length === 0) {
      setError("No package name could be extracted from the remediation text. Please patch manually using the remediation command shown in the CVE details.");
      return;
    }
    setError(null); setPhase("dry_running");
    try {
      const res = await apiPost("/api/patch/trigger", {
        advisory_id: cve.advisory_id, hosts: [...selected],
        packages: isAdvisory ? [cve.advisory_id] : patchPackages,
        dry_run: true, remediation_cmd: remediationCmd,
      });
      setJobId(res.job_id);
      pollJob(res.job_id, (job) => { setDryResult(job); setPhase("dry_done"); });
    } catch (e) { setError(e.message); setPhase("select"); }
  };

  const applyPatch = async () => {
    if (!isAdvisory && patchPackages.length === 0) { setError("No package name could be extracted. Please patch manually."); return; }
    setError(null); setPhase("applying");
    try {
      const res = await apiPost("/api/patch/trigger", {
        advisory_id: cve.advisory_id, hosts: [...selected],
        packages: isAdvisory ? [cve.advisory_id] : patchPackages,
        dry_run: false, remediation_cmd: remediationCmd,
      });
      setJobId(res.job_id);
      pollJob(res.job_id, (job) => { setApplyResult(job); setPhase("done"); });
    } catch (e) { setError(e.message); setPhase("dry_done"); }
  };

  const hostResults  = (result) => result?.results?.hosts    || {};
  const hostFailures = (result) => result?.results?.failures || {};

  const isBlocked = (h, result) => hostResults(result)[h]?.stdout?.startsWith("Cannot patch by CVE ID");

  const statusColor = (h, result) => {
    if (hostFailures(result)[h]) return "var(--red)";
    if (isBlocked(h, result)) return "var(--amber)";
    const hr = hostResults(result)[h];
    if (!hr) return "var(--text-ghost)";
    if (hr.failed) return "var(--red)";
    return hr.changed ? "var(--green)" : "var(--text-ghost)";
  };

  const statusLabel = (h, result) => {
    if (hostFailures(result)[h]) return "Unreachable";
    if (isBlocked(h, result)) return "Cannot patch by CVE ID";
    const hr = hostResults(result)[h];
    if (!hr) return "No result";
    if (hr.failed) return "Error";
    return hr.changed ? (phase === "done" ? "Patched ✓" : "Would change") : "Already up to date";
  };

  const HostResultCard = ({ h, result, prefix }) => {
    const hr      = hostResults(result)[h];
    const failure = hostFailures(result)[h];
    const isError = hr?.failed || !!failure;
    const pkgs    = hr?.packages || {};
    const pkgList = Object.entries(pkgs);
    const outKey  = `${prefix}-${h}`;
    const showOut = expandedOut[outKey];
    const rawOut  = (hr?.stdout || '').trim();
    const isDryRun = prefix === "dry";
    return (
      <div className={`px-[14px] py-2.5 bg-bg-subtle border rounded-base ${isError ? "border-red-border-lt" : "border-border-base"}`}>
        <div className="flex justify-between items-center">
          <span className="font-mono text-md text-text-primary">{h}</span>
          <span className="text-sm font-bold" style={{ color: statusColor(h, result) }}>{statusLabel(h, result)}</span>
        </div>
        {pkgList.length > 0 && (
          <div className={`rounded-md px-2.5 py-2 mt-2 ${isDryRun ? "bg-bg-hover" : "bg-green-tint"}`}>
            <div className={`text-xs font-bold mb-1 ${isDryRun ? "text-text-secondary" : "text-green-dark"}`}>
              {pkgList.length} package{pkgList.length > 1 ? "s" : ""} {isDryRun ? "would be upgraded" : "upgraded"}:
            </div>
            {pkgList.map(([pkg, info]) => (
              <div key={pkg} className="text-xs font-mono text-text-secondary mb-0.5">
                <span className="text-text-primary font-semibold">{pkg}</span>
                {info.from && <span className="text-text-ghost"> {info.from}</span>}
                <span className="text-green font-semibold"> → {info.to}</span>
              </div>
            ))}
          </div>
        )}
        {!pkgList.length && !isError && isDryRun && hr?.stdout?.startsWith("Cannot patch") && (
          <div className="bg-amber-tint border border-yellow-border rounded-md px-2.5 py-2 text-xs text-amber mt-2">⚠ {hr.stdout}</div>
        )}
        {!pkgList.length && !isError && !(isDryRun && hr?.stdout?.startsWith("Cannot patch")) && (
          <div className="text-sm text-text-muted-c mt-1.5">
            {isDryRun ? "Advisory already satisfied — all covered packages are at the required version." : "Advisory already satisfied — no packages were updated."}
          </div>
        )}
        {failure && <div className="text-sm text-red mt-1.5">{failure.msg || failure.reason}</div>}
        {rawOut && (
          <div className="mt-2">
            <button onClick={() => setExpandedOut(o => ({ ...o, [outKey]: !o[outKey] }))}
              className="text-xs text-indigo bg-transparent border-none cursor-pointer p-0 font-[inherit]">
              {showOut ? "▾ Hide output" : "▸ Show command output"}
            </button>
            {showOut && (
              <pre className="mt-1.5 rounded-md px-3 py-2.5 text-xs font-mono overflow-x-auto max-h-[220px] overflow-y-auto whitespace-pre-wrap break-words"
                style={{ background: "#0f172a", color: "#e2e8f0" }}>
                {rawOut}
              </pre>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-[var(--backdrop-dark)] z-[2000] flex items-center justify-center p-6 backdrop-blur-sm">
      <div className="bg-bg-card border border-border-base rounded-2xl w-full max-w-[680px] max-h-[90vh] flex flex-col overflow-hidden shadow-modal">

        {/* Header */}
        <div className="px-6 py-5 border-b border-border-base flex justify-between items-start">
          <div>
            <div className="font-extrabold text-xl text-text-primary flex items-center gap-2">
              🛠 Patch Advisory
              <span className="font-mono text-md font-semibold text-indigo bg-indigo-tint px-2 py-[2px] rounded-md">{cve.advisory_id}</span>
            </div>
            <div className="text-md text-text-muted-c mt-1">{cve.synopsis}</div>
          </div>
          <button onClick={onClose} className="bg-bg-subtle border border-border-base rounded-base w-8 h-8 cursor-pointer text-lg text-text-secondary flex items-center justify-center hover:bg-bg-hover transition-colors">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Packages */}
          {patchPackages.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-bold text-text-muted-c uppercase tracking-[0.06em] mb-1.5">Packages</div>
              <div className="flex flex-wrap gap-1">
                {patchPackages.map(p => (
                  <span key={p} className="font-mono text-sm bg-bg-subtle border border-border-base px-2 py-[2px] rounded-md text-text-primary">{p}</span>
                ))}
              </div>
            </div>
          )}
          {patchPackages.length === 0 && isAdvisory && (
            <div className="mb-4">
              <div className="text-xs font-bold text-text-muted-c uppercase tracking-[0.06em] mb-1.5">Advisory</div>
              <span className="font-mono text-sm bg-indigo-tint border border-indigo-border px-2 py-[2px] rounded-md text-indigo-dark">{cve.advisory_id}</span>
            </div>
          )}

          {/* Host selection */}
          {phase === "select" && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <div className="text-xs font-bold text-text-muted-c uppercase tracking-[0.06em]">
                  Select Hosts ({selected.size}/{allHosts.length})
                </div>
                <button onClick={() => setSelected(selected.size === allHosts.length ? new Set() : new Set(allHosts))}
                  className="text-sm text-indigo bg-transparent border-none cursor-pointer font-[inherit]">
                  {selected.size === allHosts.length ? "Deselect all" : "Select all"}
                </button>
              </div>
              {isCveId && (
                <div className="bg-amber-tint border border-yellow-border rounded-base px-[14px] py-2.5 text-sm text-amber mb-2">
                  ⚠ <strong>Ubuntu/Debian hosts:</strong> CVE IDs cannot be used directly with apt. These hosts will be skipped unless a package name is available.
                  {sourcePackage && <span> Detected package: <code className="bg-amber-tint-lt px-1 rounded">{sourcePackage}</code></span>}
                </div>
              )}
              <div className="flex flex-col gap-1">
                {allHosts.map(h => (
                  <label key={h} className={`flex items-center gap-2.5 px-3 py-2 border rounded-base cursor-pointer transition-all duration-100
                    ${selected.has(h) ? "bg-indigo-tint border-indigo-border" : "bg-bg-subtle border-border-base"}`}>
                    <input type="checkbox" checked={selected.has(h)} onChange={() => toggleHost(h)} className="cursor-pointer" />
                    <span className="font-mono text-md text-text-primary">{h}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Dry run running */}
          {phase === "dry_running" && (
            <div className="text-center py-8">
              <div className="w-9 h-9 border-[3px] border-border-base border-t-indigo rounded-full animate-spin mx-auto mb-4" />
              <div className="font-semibold text-text-primary">Running dry run...</div>
              <div className="text-md text-text-muted-c mt-1">Simulating patch on {selected.size} host{selected.size > 1 ? "s" : ""}. Nothing will change.</div>
            </div>
          )}

          {/* Dry run results */}
          {phase === "dry_done" && dryResult && (
            <div>
              <div className="text-xs font-bold text-text-muted-c uppercase tracking-[0.06em] mb-2">Dry Run Results</div>
              <div className="flex flex-col gap-1.5 mb-4">
                {[...selected].map(h => <HostResultCard key={h} h={h} result={dryResult} prefix="dry" />)}
              </div>
              <div className="bg-amber-tint border border-yellow-border rounded-base px-4 py-3 text-md text-amber">
                ⚠ This was a dry run — nothing was changed. Review the packages above and click <strong>Apply Patch</strong> to proceed.
              </div>
            </div>
          )}

          {/* Applying */}
          {phase === "applying" && (
            <div className="text-center py-8">
              <div className="w-9 h-9 border-[3px] border-border-base border-t-green rounded-full animate-spin mx-auto mb-4" />
              <div className="font-semibold text-text-primary">Applying patches...</div>
              <div className="text-md text-text-muted-c mt-1">Running on {selected.size} host{selected.size > 1 ? "s" : ""}.</div>
            </div>
          )}

          {/* Done */}
          {phase === "done" && applyResult && (
            <div>
              <div className="text-xs font-bold text-text-muted-c uppercase tracking-[0.06em] mb-2">Patch Results</div>
              <div className="flex flex-col gap-1.5">
                {[...selected].map(h => <HostResultCard key={h} h={h} result={applyResult} prefix="apply" />)}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-3 bg-red-tint border border-red-border rounded-base px-[14px] py-2.5 text-red-dark text-md">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-base flex justify-end gap-2">
          {phase === "select" && (
            <>
              <button onClick={onClose} className="px-[18px] py-2 border border-border-base rounded-base bg-bg-card cursor-pointer text-md text-text-muted-c font-[inherit]">Cancel</button>
              <button onClick={runDryRun} disabled={selected.size === 0}
                className={`px-[18px] py-2 border-none rounded-base text-md font-bold font-[inherit] text-white transition-colors
                  ${selected.size === 0 ? "bg-bg-subtle text-text-ghost cursor-not-allowed" : "cursor-pointer"}`}
                style={{ background: selected.size > 0 ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : undefined }}>
                🔍 Run Dry Run
              </button>
            </>
          )}
          {phase === "dry_done" && (
            <>
              <button onClick={() => setPhase("select")} className="px-[18px] py-2 border border-border-base rounded-base bg-bg-card cursor-pointer text-md text-text-muted-c font-[inherit]">← Back</button>
              <button onClick={applyPatch}
                className="px-[18px] py-2 border-none rounded-base text-md font-bold font-[inherit] text-white cursor-pointer"
                style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}>
                ✓ Apply Patch
              </button>
            </>
          )}
          {phase === "done" && (
            <button onClick={onClose} className="px-[18px] py-2 border-none rounded-base bg-green text-white cursor-pointer text-md font-bold font-[inherit]">
              Done ✓
            </button>
          )}
          {(phase === "dry_running" || phase === "applying") && (
            <button disabled className="px-[18px] py-2 border-none rounded-base bg-bg-subtle text-text-ghost cursor-not-allowed text-md font-[inherit]">
              Please wait...
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main CveTab ───────────────────────────────────────────────────────────────

const thCls = "px-4 py-3 text-left text-sm font-bold tracking-[0.06em] uppercase text-text-faint whitespace-nowrap bg-transparent cursor-default select-none";

export function CveTab({ cves, loading }) {
  const [search,         setSearch]         = useState("");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [sortByCvss,     setSortByCvss]     = useState(false);
  const [patchTarget,    setPatchTarget]    = useState(null);

  const sorted   = sortByCvss ? [...(cves || [])].sort((a, b) => (b.cvss_score ?? -1) - (a.cvss_score ?? -1)) : (cves || []);
  const filtered = sorted.filter(c => {
    const matchSearch   = c.advisory_id.toLowerCase().includes(search.toLowerCase()) || c.synopsis.toLowerCase().includes(search.toLowerCase()) || (c.cve_ids || []).some(id => id.toLowerCase().includes(search.toLowerCase()));
    const matchSeverity = filterSeverity === "all" || c.severity === filterSeverity;
    return matchSearch && matchSeverity;
  });

  const counts      = (cves || []).reduce((acc, c) => { acc[c.severity] = (acc[c.severity] || 0) + 1; return acc; }, {});
  const scoredCount = (cves || []).filter(c => c.cvss_score != null).length;

  if (loading) return (
    <div className="flex items-center justify-center h-[300px]">
      <div className="w-8 h-8 border-[3px] border-border-base border-t-blue rounded-full animate-spin" />
    </div>
  );

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <div className="flex gap-2.5 mb-5 flex-wrap items-center">
        {["Critical", "Important", "Moderate", "Low"].map(sev => {
          const cfg    = SEV_CLS[sev];
          const count  = counts[sev] || 0;
          const active = filterSeverity === sev;
          return (
            <button key={sev} onClick={() => setFilterSeverity(active ? "all" : sev)}
              className={`px-3.5 py-1.5 rounded-base border flex items-center gap-1.5 text-base font-semibold font-[inherit] cursor-pointer transition-all duration-150
                ${active ? cfg.btnActive : "border-border-base bg-bg-card text-text-muted-c"}`}>
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              {sev} <span className="font-normal opacity-70">({count})</span>
            </button>
          );
        })}
        {filterSeverity !== "all" && (
          <button onClick={() => setFilterSeverity("all")}
            className="px-3.5 py-1.5 rounded-base border border-border-base bg-bg-card cursor-pointer text-base text-text-muted-c font-[inherit]">
            Clear filter ×
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {scoredCount > 0 && <span className="text-sm text-text-ghost">{scoredCount}/{(cves || []).length} scored by NVD</span>}
          <button onClick={() => setSortByCvss(s => !s)}
            className={`px-3.5 py-1.5 rounded-base border text-base font-semibold font-[inherit] cursor-pointer transition-all duration-150 flex items-center gap-1.5
              ${sortByCvss ? "bg-indigo-tint border-indigo text-indigo-dark" : "bg-bg-card border-border-base text-text-muted-c"}`}>
            ↓ Sort by CVSS
          </button>
        </div>
      </div>

      <div className="bg-bg-card border border-border-base rounded-2xl overflow-hidden shadow-card">
        <div className="px-5 py-4 border-b border-border-subtle flex justify-between items-center">
          <div className="font-bold text-lg text-text-primary">
            {filtered.length} advisor{filtered.length !== 1 ? "ies" : "y"}
            {filterSeverity !== "all" && <span className="font-normal text-text-ghost text-base"> — {filterSeverity} only</span>}
            {sortByCvss && <span className="font-normal text-indigo text-base"> — sorted by CVSS</span>}
          </div>
          <div className="relative">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search advisory, CVE ID..."
              className="pl-[34px] pr-3 py-2 border border-border-base rounded-base text-md outline-none w-[260px] font-[inherit] bg-bg-card text-text-primary" />
            <div className="absolute top-1/2 left-[10px] -translate-y-1/2">
              <Icon d={Icons.search} size={14} color="var(--text-ghost)" />
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center text-text-ghost text-md">
            {cves?.length === 0 ? "No advisories found — run a scan on a Rocky Linux host first" : "No advisories match your search"}
          </div>
        ) : (
          <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
            <thead className="bg-bg-hover border-b border-border-subtle">
              <tr>
                <th className={`${thCls} w-[160px]`}>Advisory</th>
                <th className={thCls}>Synopsis</th>
                <th className={`${thCls} w-[120px]`}>Severity</th>
                <th className={`${thCls} w-[110px] cursor-pointer`} onClick={() => setSortByCvss(s => !s)}>CVSS {sortByCvss ? "↓" : ""}</th>
                <th className={`${thCls} w-[180px]`}>CVE IDs</th>
                <th className={`${thCls} w-[130px]`}>Affected Hosts</th>
                <th className="w-[80px]"></th>
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
