export function kernelOutdated(current, latest) {
  return current && latest && current !== latest;
}

export function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-CA", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

export function badge(text, color) {
  const colors = {
    green:  "background:#d1fae5;color:#065f46;border:1px solid #6ee7b7",
    red:    "background:#fee2e2;color:#991b1b;border:1px solid #fca5a5",
    yellow: "background:#fef9c3;color:#854d0e;border:1px solid #fde047",
    blue:   "background:#dbeafe;color:#1e40af;border:1px solid #93c5fd",
    gray:   "background:#f1f5f9;color:#475569;border:1px solid #cbd5e1",
  };
  return (
    <span style={{
      ...Object.fromEntries((colors[color] || colors.gray).split(";").map(s => {
        const [k, v] = s.split(":");
        return [k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v?.trim()];
      })),
      padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
      letterSpacing: "0.04em", whiteSpace: "nowrap", fontFamily: "inherit"
    }}>
      {text}
    </span>
  );
}
