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

const BADGE_CLASSES = {
  green:  "bg-[#d1fae5] text-[#065f46] border border-[#6ee7b7]",
  red:    "bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5]",
  yellow: "bg-[#fef9c3] text-[#854d0e] border border-[#fde047]",
  blue:   "bg-[#dbeafe] text-[#1e40af] border border-[#93c5fd]",
  gray:   "bg-bg-subtle text-text-muted border border-border-muted",
};

export function badge(text, color) {
  return (
    <span className={`${BADGE_CLASSES[color] ?? BADGE_CLASSES.gray} px-2.5 py-0.5 rounded-pill text-xs font-bold tracking-wide whitespace-nowrap`}>
      {text}
    </span>
  );
}
