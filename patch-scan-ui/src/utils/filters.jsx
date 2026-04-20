// ── Shared filter utilities ───────────────────────────────────────────────────

export function osFamily(osVersion) {
  if (!osVersion) return "Unknown";
  const lower = osVersion.toLowerCase();
  if (lower.includes("ubuntu"))  { const m = osVersion.match(/(\d+\.\d+)/); return m ? `Ubuntu ${m[1]}` : "Ubuntu"; }
  if (lower.includes("rocky"))   { const m = osVersion.match(/(\d+)/);      return m ? `Rocky ${m[1]}`  : "Rocky";  }
  if (lower.includes("red hat") || lower.includes("redhat") || lower.includes("rhel")) {
    const m = osVersion.match(/(\d+)/); return m ? `RHEL ${m[1]}` : "RHEL";
  }
  return osVersion;
}

export function FilterChip({ label, active, onClick, color = "#3b82f6" }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: `1px solid ${active ? color : "var(--border)"}`,
        background: active ? `${color}18` : "var(--bg-card)",
        color: active ? color : "var(--text-muted)",
      }}
      className="px-3 py-1 rounded-md text-sm font-medium cursor-pointer transition-all duration-150 whitespace-nowrap font-[inherit]"
    >
      {label}
    </button>
  );
}
