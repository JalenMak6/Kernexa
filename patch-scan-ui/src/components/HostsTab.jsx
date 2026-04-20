import { FilterBar } from "./FilterBar.jsx";
import { HostRow } from "./HostRow.jsx";
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

  const thCls = (col) => [
    "px-4 py-3 text-left text-xs font-bold tracking-[0.06em] uppercase whitespace-nowrap select-none text-text-muted-c",
    col ? "cursor-pointer" : "cursor-default",
    sortCol === col ? "bg-bg-subtle" : "bg-transparent",
  ].join(" ");

  return (
    <div className="bg-bg-card border border-border-base rounded-2xl overflow-hidden shadow-card">
      <div className="px-5 py-4 border-b border-border-subtle">
        <div className="flex justify-between items-center mb-3">
          <div className="font-bold text-base text-text-primary">
            {filteredHosts.length} of {totalHosts} hosts
            {activeFilterCount > 0 && (
              <span className="ml-2 text-xs font-medium text-blue">
                {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active
              </span>
            )}
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
          showSearch
        />
      </div>

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
    </div>
  );
}
