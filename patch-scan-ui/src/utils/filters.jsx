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
    <button onClick={onClick} style={{
      padding: "5px 12px", borderRadius: 6,
      border: `1px solid ${active ? color : "#e2e8f0"}`,
      background: active ? `${color}18` : "#fff",
      cursor: "pointer", fontSize: 12, fontWeight: active ? 700 : 500,
      color: active ? color : "#475569", fontFamily: "inherit",
      transition: "all 0.15s", whiteSpace: "nowrap",
    }}>{label}</button>
  );
}