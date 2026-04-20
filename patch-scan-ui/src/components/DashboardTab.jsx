import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { StatCard } from "./StatCard.jsx";
import { HostRow } from "./HostRow.jsx";
import { FilterBar } from "./FilterBar.jsx";
import { fmtDate } from "../utils/helpers.jsx";
import { osFamily } from "../utils/filters.jsx";

const CVE_CFG = {
  Critical:  { cardCls: "bg-red-tint border-red-border text-red-dark",         dotCls: "bg-red" },
  Important: { cardCls: "bg-orange-tint border-orange-border text-orange-dark", dotCls: "bg-orange" },
  Moderate:  { cardCls: "bg-amber-tint border-yellow-border text-amber",        dotCls: "bg-amber" },
  Low:       { cardCls: "bg-green-tint border-green-border text-green-dark",    dotCls: "bg-green-bright" },
};
const CVE_INACTIVE = { cardCls: "bg-bg-subtle border-border-muted text-text-ghost", dotCls: "bg-border-muted" };

export function DashboardTab({
  hosts, totalHosts, compliantHosts,
  complianceData, topPackages,
  filteredHosts, activeFilterCount, clearFilters,
  filterOS, setFilterOS, filterKernelStatus, setFilterKernelStatus,
  filterPatchStatus, setFilterPatchStatus, filterTag, setFilterTag,
  search, setSearch, sortCol, sortDir, sortBy,
  winRecords,
  cves, changeTab,
}) {
  const osOptions = ["all", ...Array.from(new Set(hosts.map(h => osFamily(h.os_version)).filter(f => f !== "Unknown"))).sort()];
  const allTags   = ["all", ...Array.from(new Set(hosts.flatMap(h => h.tags || []))).sort()];

  const thCls = (col) => [
    "px-4 py-3 text-left text-xs font-bold tracking-[0.06em] uppercase whitespace-nowrap select-none text-text-muted-c",
    col ? "cursor-pointer" : "cursor-default",
    sortCol === col ? "bg-bg-subtle" : "bg-transparent",
  ].join(" ");

  // ── Windows derived data ───────────────────────────────────────────────────
  const winHostMap = {};
  winRecords.forEach(r => {
    if (!winHostMap[r.hostname]) winHostMap[r.hostname] = { hostname: r.hostname, osName: r.osName, updates: [] };
    winHostMap[r.hostname].updates.push(r);
  });
  const winHosts       = Object.values(winHostMap);
  const winTotalHosts  = winHosts.length;
  const winTotalKBs    = winRecords.length;
  const winSecHosts    = winHosts.filter(h => h.updates.some(u => u.classification === "Security Updates" || u.classification === "Critical Updates")).length;
  const winRebootHosts = winHosts.filter(h => h.updates.some(u => u.rebootRequired === "AlwaysRequiresReboot" || u.rebootRequired === "CanRequestReboot")).length;
  const hasWinData     = winTotalHosts > 0;
  const hasLinuxData   = totalHosts > 0;

  return (
    <>
      {/* ── Top stat cards ── */}
      {(hasLinuxData || hasWinData) && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard icon="host"    label="Linux Hosts"     value={totalHosts}    sub="in latest scan"    accent="#3b82f6" />
          <StatCard icon="check"   label="Linux Compliant" value={compliantHosts} sub="kernel up to date" accent="#10b981" />
          <StatCard icon="host"    label="Windows Hosts"   value={winTotalHosts}  sub="in latest scan"    accent="#0ea5e9" />
          <StatCard icon="warning" label="Windows Pending" value={winTotalKBs}    sub="total pending KBs" accent="#f59e0b" />
        </div>
      )}

      {/* ── CVE severity cards ── */}
      {(() => {
        const cveCounts = (cves || []).reduce((acc, c) => {
          const sev = c.severity || "Unknown"; acc[sev] = (acc[sev] || 0) + 1; return acc;
        }, {});
        return (
          <div className="grid grid-cols-4 gap-4 mb-6">
            {["Critical", "Important", "Moderate", "Low"].map(sev => {
              const count = cveCounts[sev] || 0;
              const cfg   = count > 0 ? CVE_CFG[sev] : CVE_INACTIVE;
              return (
                <div key={sev} onClick={() => changeTab("cves")}
                  className={`border rounded-xl px-5 py-4 cursor-pointer transition-transform hover:-translate-y-px ${cfg.cardCls}`}
                  style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className={`w-2 h-2 rounded-full ${cfg.dotCls}`} />
                    <span className="text-xs font-bold tracking-[0.05em] uppercase">{sev}</span>
                  </div>
                  <div className="text-[28px] font-extrabold leading-none">{count}</div>
                  <div className="text-xs mt-1 opacity-70">CVE{count !== 1 ? "s" : ""}</div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── Charts row ── */}
      <div className="grid grid-cols-[1fr_2fr] gap-4 mb-6">
        <div className="bg-bg-card border border-border-base rounded-2xl p-6 shadow-card">
          <div className="font-bold text-base text-text-primary mb-1">Kernel Compliance</div>
          <div className="text-sm text-text-muted-c mb-4">{(complianceData.find(d => d.name === "Compliant")?.value ?? 0)} of {totalHosts} hosts up to date</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={complianceData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                {complianceData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip /><Legend iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-bg-card border border-border-base rounded-2xl p-6 shadow-card">
          <div className="font-bold text-base text-text-primary mb-1">Top Packages Pending</div>
          <div className="text-sm text-text-muted-c mb-4">Most common security updates across all hosts</div>
          {topPackages.length === 0
            ? <div className="flex items-center justify-center h-[180px] text-text-muted-c text-md">No pending packages</div>
            : <ResponsiveContainer width="100%" height={180}>
                <BarChart data={topPackages} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "#f1f5f9" }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {topPackages.map((_, i) => <Cell key={i} fill={`hsl(${220 + i * 12},70%,${55 + i * 3}%)`} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
          }
        </div>
      </div>

      {/* ── Linux Host Summary ── */}
      <div className={`bg-bg-card border border-border-base rounded-2xl overflow-hidden shadow-card ${hasWinData ? "mb-6" : ""}`}>
        <div className="px-5 py-4 border-b border-border-subtle">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-blue" />
              <div className="font-bold text-base text-text-primary">
                🐧 Linux Host Summary — {filteredHosts.length} of {totalHosts} hosts
                {activeFilterCount > 0 && (
                  <span className="ml-2 text-xs font-medium text-blue">
                    {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active
                  </span>
                )}
              </div>
            </div>
            {(activeFilterCount > 0 || search) && (
              <button onClick={clearFilters}
                className="px-3 py-[5px] rounded-md border border-red-border bg-red-tint cursor-pointer text-sm text-red font-[inherit]">
                Clear all ×
              </button>
            )}
          </div>
          <FilterBar
            osOptions={osOptions} allTags={allTags}
            filterOS={filterOS} setFilterOS={setFilterOS}
            filterKernelStatus={filterKernelStatus} setFilterKernelStatus={setFilterKernelStatus}
            filterPatchStatus={filterPatchStatus} setFilterPatchStatus={setFilterPatchStatus}
            filterTag={filterTag} setFilterTag={setFilterTag}
            search={search} setSearch={setSearch}
          />
        </div>
        {hasLinuxData ? (
          <table className="w-full border-collapse">
            <thead className="bg-bg-subtle border-b border-border-subtle">
              <tr>
                <th className={thCls("host")} onClick={() => sortBy("host")}>
                  Host {sortCol === "host" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </th>
                <th className={`${thCls("os_version")} w-[100px]`} onClick={() => sortBy("os_version")}>
                  OS {sortCol === "os_version" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </th>
                <th className={`${thCls("last_reboot_time")} w-[120px]`} onClick={() => sortBy("last_reboot_time")}>
                  Last Reboot
                </th>
                <th className={`${thCls("current_kernel_version")} w-[160px]`} onClick={() => sortBy("current_kernel_version")}>
                  Current Kernel {sortCol === "current_kernel_version" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </th>
                <th className={`${thCls(null)} w-[160px]`}>Latest Kernel</th>
                <th className={`${thCls(null)} w-[110px]`}>Kernel Status</th>
                <th className={`${thCls("package_count")} w-[130px]`} onClick={() => sortBy("package_count")}>
                  Pending Patches {sortCol === "package_count" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </th>
                <th className={`${thCls(null)} w-[180px]`}>Open Ports</th>
                <th className={`${thCls(null)} w-[75px]`}></th>
              </tr>
            </thead>
            <tbody>
              {filteredHosts.length === 0
                ? <tr><td colSpan={9} className="p-8 text-center text-text-muted-c text-md">No hosts match your filters</td></tr>
                : filteredHosts.map(h => <HostRow key={h.host} host={h} />)
              }
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-text-muted-c text-md">
            No Linux scan data — click <strong>Run Scan</strong> with a Linux inventory active.
          </div>
        )}
      </div>

      {/* ── Windows Host Summary ── */}
      {hasWinData && (
        <div className="bg-bg-card border border-border-base rounded-2xl overflow-hidden shadow-card">
          <div className="px-5 py-4 border-b border-border-subtle flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-cyan" />
              <div>
                <div className="font-bold text-base text-text-primary">
                  🪟 Windows Host Summary — {winTotalHosts} hosts · {winTotalKBs} pending KBs
                </div>
                {winRecords[0]?.scanned_at && (
                  <div className="text-xs text-text-muted-c mt-0.5">Last scan: {fmtDate(winRecords[0].scanned_at)}</div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {winSecHosts > 0 && (
                <span className="text-xs font-bold bg-red-tint text-red border border-red-border px-2.5 py-[3px] rounded-pill">
                  ⚠ {winSecHosts} with security updates
                </span>
              )}
              {winRebootHosts > 0 && (
                <span className="text-xs font-bold bg-purple-tint text-purple border border-purple-border px-2.5 py-[3px] rounded-pill">
                  🔄 {winRebootHosts} may reboot
                </span>
              )}
            </div>
          </div>

          <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
            <thead className="bg-bg-subtle border-b border-border-subtle">
              <tr>
                {[
                  { label: "Host",           w: undefined },
                  { label: "OS",             w: 120 },
                  { label: "Patch Status",   w: 110 },
                  { label: "Pending By Type",w: 190 },
                  { label: "Reboot",         w: 110 },
                  { label: "Last Scan",      w: 150 },
                ].map(({ label, w }) => (
                  <th key={label}
                    className="px-4 py-3 text-left text-xs font-bold tracking-[0.06em] uppercase text-text-muted-c cursor-default select-none whitespace-nowrap"
                    style={w ? { width: w } : undefined}
                  >{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {winHosts.map(h => {
                const secCount    = h.updates.filter(u => u.classification === "Security Updates" || u.classification === "Critical Updates").length;
                const defCount    = h.updates.filter(u => u.classification === "Definition Updates").length;
                const ruCount     = h.updates.filter(u => u.classification === "Update Rollups").length;
                const needsReboot = h.updates.some(u => u.rebootRequired === "AlwaysRequiresReboot" || u.rebootRequired === "CanRequestReboot");
                const isClean     = h.updates.length === 0;
                const osBadge = (() => {
                  const n = h.osName || "";
                  if (n.includes("2022")) return { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", label: "WS 2022" };
                  if (n.includes("2019")) return { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0", label: "WS 2019" };
                  if (n.includes("2016")) return { bg: "#fdf4ff", color: "#7e22ce", border: "#e9d5ff", label: "WS 2016" };
                  if (n.includes("2012")) return { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa", label: "WS 2012" };
                  if (n.includes("10"))   return { bg: "#fefce8", color: "#a16207", border: "#fef08a", label: "Win 10"  };
                  if (n.includes("11"))   return { bg: "#f0fdfa", color: "#0f766e", border: "#99f6e4", label: "Win 11"  };
                  return { bg: "#f1f5f9", color: "#475569", border: "#cbd5e1", label: "Windows" };
                })();
                const isIP = /^\d+\.\d+\.\d+\.\d+$/.test(h.hostname);

                return (
                  <tr key={h.hostname} className="border-b border-border-subtle hover:bg-bg-hover transition-colors">
                    <td className="px-4 py-[13px]">
                      <button onClick={() => changeTab("windows")}
                        className="bg-transparent border-none p-0 cursor-pointer font-semibold text-md text-text-primary font-[inherit] text-left block hover:text-cyan transition-colors">
                        {isIP ? h.hostname : h.hostname.split(".")[0]}
                      </button>
                      {!isIP && (
                        <div className="text-xs text-text-muted-c font-mono mt-0.5">
                          .{h.hostname.split(".").slice(1).join(".")}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-[13px]">
                      <span className="text-xs font-bold px-[9px] py-[3px] rounded-pill whitespace-nowrap border"
                        style={{ background: osBadge.bg, color: osBadge.color, borderColor: osBadge.border }}>
                        {osBadge.label}
                      </span>
                    </td>
                    <td className="px-4 py-[13px]">
                      {isClean
                        ? <span className="inline-flex items-center gap-1 bg-green-tint text-green-dark border border-green-border px-2.5 py-[3px] rounded-pill text-xs font-bold">✓ Up to date</span>
                        : <span className="inline-flex items-center gap-1 bg-red-tint text-red border border-red-border px-2.5 py-[3px] rounded-pill text-xs font-bold">{h.updates.length} pending</span>
                      }
                    </td>
                    <td className="px-4 py-[13px]">
                      <div className="flex gap-1 flex-wrap">
                        {secCount > 0 && <span className="text-xs font-bold bg-red-tint text-red border border-red-border px-[7px] py-[2px] rounded-pill">🔒 {secCount} Security Updates</span>}
                        {ruCount  > 0 && <span className="text-xs font-bold bg-orange-tint text-orange-dark border border-orange-border px-[7px] py-[2px] rounded-pill">📦 {ruCount} Rollout Updates</span>}
                        {defCount > 0 && <span className="text-xs font-semibold bg-bg-subtle text-text-faint border border-border-base px-[7px] py-[2px] rounded-pill">🛡 {defCount} Definition Updates</span>}
                        {isClean  && <span className="text-xs text-text-ghost">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-[13px]">
                      {needsReboot
                        ? <span className="inline-flex items-center gap-1 bg-amber-tint text-amber border border-yellow-border px-2.5 py-[3px] rounded-pill text-xs font-bold">🔄 May Reboot</span>
                        : <span className="inline-flex items-center gap-1 bg-green-tint text-green-dark border border-green-border px-2.5 py-[3px] rounded-pill text-xs font-bold">✓ No Reboot</span>
                      }
                    </td>
                    <td className="px-4 py-[13px] text-sm text-text-muted-c">
                      {h.updates[0]?.scanned_at ? fmtDate(h.updates[0].scanned_at) : <span className="text-text-disabled">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-5 py-2.5 border-t border-border-subtle flex justify-end">
            <button onClick={() => changeTab("windows")}
              className="bg-transparent border-none cursor-pointer text-sm text-cyan font-semibold font-[inherit]">
              View full Windows report →
            </button>
          </div>
        </div>
      )}

      {/* ── No data at all ── */}
      {!hasLinuxData && !hasWinData && (
        <div className="text-center py-10 px-8 bg-bg-card rounded-2xl border border-border-base">
          <div className="text-md text-text-ghost">Run a Linux scan or Windows scan to see host summaries here.</div>
        </div>
      )}
    </>
  );
}
