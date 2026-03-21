import { Icon, Icons } from "../utils/icons.jsx";
import { FilterChip } from "../utils/filters.jsx";

export function FilterBar({
  osOptions, allTags,
  filterOS, setFilterOS,
  filterKernelStatus, setFilterKernelStatus,
  filterPatchStatus, setFilterPatchStatus,
  filterTag, setFilterTag,
  search, setSearch,
  showSearch = false,
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginRight: 2 }}>OS:</span>
      {osOptions.map(os => (
        <FilterChip key={os} label={os === "all" ? "All" : os} active={filterOS === os}
          onClick={() => setFilterOS(os)} color="#6366f1" />
      ))}

      <div style={{ width: 1, height: 20, background: "#e2e8f0", margin: "0 4px" }} />
      <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginRight: 2 }}>Kernel:</span>
      <FilterChip label="All"        active={filterKernelStatus === "all"}      onClick={() => setFilterKernelStatus("all")}      color="#64748b" />
      <FilterChip label="Outdated"   active={filterKernelStatus === "outdated"} onClick={() => setFilterKernelStatus("outdated")} color="#ef4444" />
      <FilterChip label="Up to date" active={filterKernelStatus === "uptodate"} onClick={() => setFilterKernelStatus("uptodate")} color="#10b981" />

      <div style={{ width: 1, height: 20, background: "#e2e8f0", margin: "0 4px" }} />
      <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginRight: 2 }}>Patches:</span>
      <FilterChip label="All"     active={filterPatchStatus === "all"}   onClick={() => setFilterPatchStatus("all")}   color="#64748b" />
      <FilterChip label="Pending" active={filterPatchStatus === "dirty"} onClick={() => setFilterPatchStatus("dirty")} color="#f59e0b" />
      <FilterChip label="Clean"   active={filterPatchStatus === "clean"} onClick={() => setFilterPatchStatus("clean")} color="#10b981" />

      {allTags.length > 1 && (<>
        <div style={{ width: 1, height: 20, background: "#e2e8f0", margin: "0 4px" }} />
        <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginRight: 2 }}>Tag:</span>
        {allTags.map(t => (
          <FilterChip key={t} label={t === "all" ? "All" : t} active={filterTag === t}
            onClick={() => setFilterTag(t)} color="#8b5cf6" />
        ))}
      </>)}

      {showSearch && (
        <div style={{ position: "relative", marginLeft: "auto" }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by hostname..."
            style={{ padding: "8px 12px 8px 34px", border: "1px solid #e2e8f0", borderRadius: 8,
              fontSize: 13, outline: "none", width: 240, fontFamily: "inherit" }} />
          <div style={{ position: "absolute", top: "50%", left: 10, transform: "translateY(-50%)" }}>
            <Icon d={Icons.search} size={14} color="#94a3b8" />
          </div>
        </div>
      )}
    </div>
  );
}