import { Icon, Icons } from "../utils/icons.jsx";

export function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-2xl)",
      padding: "var(--space-5) var(--space-6)",
      display: "flex", flexDirection: "column", gap: "var(--space-1)",
      boxShadow: "var(--shadow-card)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <Icon d={Icons[icon]} size={18} color={accent || "var(--text-faint)"} />
        <span style={{
          fontSize: "var(--text-base)", fontWeight: 600,
          letterSpacing: "0.06em", textTransform: "uppercase",
          color: "var(--text-faint)",
        }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: "var(--text-5xl)", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: "var(--text-base)", color: "var(--text-ghost)" }}>{sub}</div>}
    </div>
  );
}