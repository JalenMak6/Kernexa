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
  const Divider = () => (
    <div className="w-px h-5 bg-border-base mx-1 shrink-0" />
  );

  return (
    <div className="flex gap-1.5 flex-wrap items-center">
      <span className="text-xs text-text-ghost font-semibold mr-0.5">OS:</span>
      {osOptions.map(os => (
        <FilterChip key={os} label={os === "all" ? "All" : os} active={filterOS === os}
          onClick={() => setFilterOS(os)} color="#6366f1" />
      ))}

      <Divider />
      <span className="text-xs text-text-ghost font-semibold mr-0.5">Kernel:</span>
      <FilterChip label="All"        active={filterKernelStatus === "all"}      onClick={() => setFilterKernelStatus("all")}      color="#64748b" />
      <FilterChip label="Outdated"   active={filterKernelStatus === "outdated"} onClick={() => setFilterKernelStatus("outdated")} color="#ef4444" />
      <FilterChip label="Up to date" active={filterKernelStatus === "uptodate"} onClick={() => setFilterKernelStatus("uptodate")} color="#10b981" />

      <Divider />
      <span className="text-xs text-text-ghost font-semibold mr-0.5">Patches:</span>
      <FilterChip label="All"     active={filterPatchStatus === "all"}   onClick={() => setFilterPatchStatus("all")}   color="#64748b" />
      <FilterChip label="Pending" active={filterPatchStatus === "dirty"} onClick={() => setFilterPatchStatus("dirty")} color="#f59e0b" />
      <FilterChip label="Clean"   active={filterPatchStatus === "clean"} onClick={() => setFilterPatchStatus("clean")} color="#10b981" />

      {allTags.length > 1 && (<>
        <Divider />
        <span className="text-xs text-text-ghost font-semibold mr-0.5">Tag:</span>
        {allTags.map(t => (
          <FilterChip key={t} label={t === "all" ? "All" : t} active={filterTag === t}
            onClick={() => setFilterTag(t)} color="#8b5cf6" />
        ))}
      </>)}

      {showSearch && (
        <div className="relative ml-auto">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by hostname..."
            className="pl-[34px] pr-3 py-2 border border-border-base rounded-base text-md outline-none w-60 font-[inherit] bg-bg-card text-text-primary placeholder:text-text-ghost"
          />
          <div className="absolute top-1/2 left-2.5 -translate-y-1/2 pointer-events-none">
            <Icon d={Icons.search} size={14} color="var(--text-ghost)" />
          </div>
        </div>
      )}
    </div>
  );
}
