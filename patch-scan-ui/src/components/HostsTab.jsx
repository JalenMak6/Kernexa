import { FilterBar } from "./FilterBar.jsx";
import { HostRow } from "./HostRow.jsx";
import { kernelOutdated } from "../utils/helpers.jsx";
import { osFamily } from "../utils/filters.jsx";

export function HostsTab({
  hosts, totalHosts,
  filteredHosts, activeFilterCount,
  filterOS, setFilterOS,
  filterKernelStatus, setFilterKernelStatus,
  filterPatchStatus, setFilterPatchStatus,
  filterTag, setFilterTag,
  search, setSearch,
  sortCol, sortDir, sortBy,
  clearFilters,
}) {
  const osOptions = ["all", ...Array.from(new Set(hosts.map(h => osFamily(h.os_version)).filter(f => f !== "Unknown"))).sort()];
  const allTags   = ["all", ...Array.from(new Set(hosts.flatMap(h => h.tags || []))).sort()];

  const thStyle = (col) => ({
    padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b",
    cursor: col ? "pointer" : "default", userSelect: "none", whiteSpace: "nowrap",
    background: sortCol === col ? "#f1f5f9" : "transparent",
  });

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
            {filteredHosts.length} of {totalHosts} hosts
            {activeFilterCount > 0 && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: "#3b82f6" }}>{activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active</span>}
          </div>
          {(activeFilterCount > 0 || search) && (
            <button onClick={clearFilters} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fef2f2", cursor: "pointer", fontSize: 12, color: "#dc2626", fontFamily: "inherit" }}>
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
          showSearch
        />
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead style={{ background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
          <tr>
            <th style={thStyle("host")} onClick={() => sortBy("host")}>Host {sortCol === "host" ? (sortDir === "asc" ? "↑" : "↓") : ""}</th>
            <th style={{ ...thStyle("os_version"), width: 100 }} onClick={() => sortBy("os_version")}>OS {sortCol === "os_version" ? (sortDir === "asc" ? "↑" : "↓") : ""}</th>
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
            ? <tr><td colSpan={9} style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No hosts match your filters</td></tr>
            : filteredHosts.map(h => <HostRow key={h.host} host={h} />)
          }
        </tbody>
      </table>
    </div>
  );
}