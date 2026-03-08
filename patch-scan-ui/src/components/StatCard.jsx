import { Icon, Icons } from "../utils/icons.jsx";

export function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14,
      padding: "20px 24px", display: "flex", flexDirection: "column", gap: 6,
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon d={Icons[icon]} size={18} color={accent || "#64748b"} />
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b" }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color: "#0f172a", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#94a3b8" }}>{sub}</div>}
    </div>
  );
}
