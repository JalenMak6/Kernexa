import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { StatCard } from "./StatCard.jsx";
import { HostRow } from "./HostRow.jsx";
import { FilterBar } from "./FilterBar.jsx";
import { fmtDate, kernelOutdated } from "../utils/helpers.jsx";
import { osFamily, FilterChip } from "../utils/filters.jsx";
import { Icon, Icons } from "../utils/icons.jsx";

export function DashboardTab({
  // Linux data
  hosts, totalHosts, compliantHosts, outdatedHosts, compliancePct,
  complianceData, topPackages,
  filteredHosts, activeFilterCount, clearFilters,
  filterOS, setFilterOS, filterKernelStatus, setFilterKernelStatus,
  filterPatchStatus, setFilterPatchStatus, filterTag, setFilterTag,
  search, setSearch, sortCol, sortDir, sortBy,
  // Windows data
  winRecords,
  // CVEs
  cves, changeTab,
  // inventory state
  showInventoryManager, setShowInventoryManager,
}) {
  const osOptions = ["all", ...Array.from(new Set(hosts.map(h => osFamily(h.os_version)).filter(f => f !== "Unknown"))).sort()];
  const allTags   = ["all", ...Array.from(new Set(hosts.flatMap(h => h.tags || []))).sort()];

  const thStyle = (col) => ({
    padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)",
    cursor: col ? "pointer" : "default", userSelect: "none", whiteSpace: "nowrap",
    background: sortCol === col ? "var(--bg-subtle)" : "transparent",
  });

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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 16, marginBottom: 24 }}>
          <StatCard icon="host"    label="Linux Hosts"     value={totalHosts}     sub="in latest scan"    accent="#3b82f6" />
          <StatCard icon="check"   label="Linux Compliant" value={compliantHosts} sub="kernel up to date" accent="#10b981" />
          <StatCard icon="host"    label="Windows Hosts"   value={winTotalHosts}  sub="in latest scan"    accent="#0ea5e9" />
          <StatCard icon="warning" label="Windows Pending" value={winTotalKBs}    sub="total pending KBs" accent="#f59e0b" />
        </div>
      )}

      {/* ── CVE severity cards ── */}
      {(() => {
        const cveCounts = (cves || []).reduce((acc, c) => { const sev = c.severity || "Unknown"; acc[sev] = (acc[sev] || 0) + 1; return acc; }, {});
        const CFG = {
          Critical:  { bg: "#fef2f2", color: "#991b1b", border: "#fca5a5", dot: "#ef4444" },
          Important: { bg: "#fff7ed", color: "#9a3412", border: "#fdba74", dot: "#f97316" },
          Moderate:  { bg: "#fefce8", color: "#854d0e", border: "#fde047", dot: "#eab308" },
          Low:       { bg: "#f0fdf4", color: "#166534", border: "#86efac", dot: "#22c55e" },
        };
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 16, marginBottom: 24 }}>
            {["Critical", "Important", "Moderate", "Low"].map(sev => {
              const count = cveCounts[sev] || 0;
              const cfg   = count > 0 ? CFG[sev] : { bg: "#f8fafc", color: "#94a3b8", border: "#e2e8f0", dot: "#cbd5e1" };
              return (
                <div key={sev} onClick={() => changeTab("cves")}
                  style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 12, padding: "16px 20px", cursor: "pointer", transition: "all 0.15s", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                  onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.dot }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, letterSpacing: "0.05em", textTransform: "uppercase" }}>{sev}</span>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: cfg.color, lineHeight: 1 }}>{count}</div>
                  <div style={{ fontSize: 11, color: cfg.color, marginTop: 4, opacity: 0.7 }}>CVE{count !== 1 ? "s" : ""}</div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── Charts row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, boxShadow: "var(--shadow-card)" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", marginBottom: 4 }}>Kernel Compliance</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>{compliancePct}% of hosts up to date</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={complianceData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                {complianceData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip /><Legend iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, boxShadow: "var(--shadow-card)" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", marginBottom: 4 }}>Top Packages Pending</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>Most common security updates across all hosts</div>
          {topPackages.length === 0
            ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 180, color: "var(--text-muted)", fontSize: 13 }}>No pending packages</div>
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
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", boxShadow: "var(--shadow-card)", marginBottom: hasWinData ? 24 : 0 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} />
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
                🐧 Linux Host Summary — {filteredHosts.length} of {totalHosts} hosts
                {activeFilterCount > 0 && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: "#3b82f6" }}>{activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active</span>}
              </div>
            </div>
            {(activeFilterCount > 0 || search) && (
              <button onClick={clearFilters} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--red-border)", background: "var(--red-tint)", cursor: "pointer", fontSize: 12, color: "var(--red)", fontFamily: "inherit" }}>Clear all ×</button>
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
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
              <tr>
                <th style={thStyle("host")} onClick={() => sortBy("host")}>Host {sortCol === "host" ? (sortDir === "asc" ? "↑" : "↓") : ""}</th>
                <th style={{ ...thStyle("os_version"), width: 100 }} onClick={() => sortBy("os_version")}>OS</th>
                <th style={{ ...thStyle("last_reboot_time"), width: 120 }} onClick={() => sortBy("last_reboot_time")}>Last Reboot</th>
                <th style={{ ...thStyle("current_kernel_version"), width: 160 }} onClick={() => sortBy("current_kernel_version")}>Current Kernel</th>
                <th style={{ ...thStyle(null), width: 160 }}>Latest Kernel</th>
                <th style={{ ...thStyle(null), width: 110 }}>Kernel Status</th>
                <th style={{ ...thStyle("package_count"), width: 130 }} onClick={() => sortBy("package_count")}>Pending Patches</th>
                <th style={{ ...thStyle(null), width: 180 }}>Open Ports</th>
                <th style={{ ...thStyle(null), width: 75 }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredHosts.length === 0
                ? <tr><td colSpan={9} style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No hosts match your filters</td></tr>
                : filteredHosts.map(h => <HostRow key={h.host} host={h} />)
              }
            </tbody>
          </table>
        ) : (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            No Linux scan data — click <strong>Run Scan</strong> with a Linux inventory active.
          </div>
        )}
      </div>

      {/* ── Windows Host Summary ── */}
      {hasWinData && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0ea5e9" }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
                  🪟 Windows Host Summary — {winTotalHosts} hosts · {winTotalKBs} pending KBs
                </div>
                {winRecords[0]?.scanned_at && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Last scan: {fmtDate(winRecords[0].scanned_at)}</div>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {winSecHosts > 0 && <span style={{ fontSize: 11, fontWeight: 700, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "3px 10px", borderRadius: 999 }}>⚠ {winSecHosts} with security updates</span>}
              {winRebootHosts > 0 && <span style={{ fontSize: 11, fontWeight: 700, background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", padding: "3px 10px", borderRadius: 999 }}>🔄 {winRebootHosts} may reboot</span>}
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
              <tr>
                {["Host", "OS", "Patch Status", "Pending By Type", "Reboot", "Last Scan"].map((h, i) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)",
                    width: i === 1 ? 120 : i === 2 ? 110 : i === 3 ? 190 : i === 4 ? 110 : i === 5 ? 150 : undefined }}>{h}</th>
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
                  <tr key={h.hostname} style={{ borderBottom: "1px solid var(--border-subtle)", transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                    onMouseLeave={e => e.currentTarget.style.background = ""}>
                    <td style={{ padding: "13px 16px" }}>
                      <button onClick={() => changeTab("windows")}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 600, fontSize: 13, color: "var(--text-primary)", fontFamily: "inherit", textAlign: "left", display: "block" }}
                        onMouseEnter={e => e.currentTarget.style.color = "#0ea5e9"}
                        onMouseLeave={e => e.currentTarget.style.color = "var(--text-primary)"}
                      >
                        {isIP ? h.hostname : h.hostname.split(".")[0]}
                      </button>
                      {!isIP && <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace", marginTop: 2 }}>.{h.hostname.split(".").slice(1).join(".")}</div>}
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, background: osBadge.bg, color: osBadge.color, border: `1px solid ${osBadge.border}`, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{osBadge.label}</span>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      {isClean
                        ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>✓ Up to date</span>
                        : <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{h.updates.length} pending</span>
                      }
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {secCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "2px 7px", borderRadius: 999 }}>🔒 {secCount} Security Updates</span>}
                        {ruCount  > 0 && <span style={{ fontSize: 11, fontWeight: 700, background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa", padding: "2px 7px", borderRadius: 999 }}>📦 {ruCount} Rollout Updates</span>}
                        {defCount > 0 && <span style={{ fontSize: 11, fontWeight: 600, background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0", padding: "2px 7px", borderRadius: 999 }}>🛡 {defCount} Definition Updates</span>}
                        {isClean && <span style={{ fontSize: 11, color: "#94a3b8" }}>—</span>}
                      </div>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      {needsReboot
                        ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#fefce8", color: "#a16207", border: "1px solid #fef08a", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>🔄 May Reboot</span>
                        : <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>✓ No Reboot</span>
                      }
                    </td>
                    <td style={{ padding: "13px 16px", fontSize: 12, color: "var(--text-muted)" }}>
                      {h.updates[0]?.scanned_at ? fmtDate(h.updates[0].scanned_at) : <span style={{ color: "var(--text-disabled)" }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: "10px 20px", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => changeTab("windows")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#0ea5e9", fontWeight: 600, fontFamily: "inherit" }}>
              View full Windows report →
            </button>
          </div>
        </div>
      )}

      {/* ── No data at all ── */}
      {!hasLinuxData && !hasWinData && (
        <div style={{ textAlign: "center", padding: "40px 32px", background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>Run a Linux scan or Windows scan to see host summaries here.</div>
        </div>
      )}
    </>
  );
}