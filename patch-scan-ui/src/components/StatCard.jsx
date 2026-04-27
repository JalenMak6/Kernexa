import { Icon, Icons } from "../utils/icons.jsx";

export function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div className="bg-bg-card border border-border-base rounded-2xl p-5 flex flex-col gap-1 shadow-card">
      <div className="flex items-center gap-2">
        <Icon d={Icons[icon]} size={18} color={accent || "var(--text-faint)"} />
        <span className="text-sm font-semibold tracking-widest uppercase text-text-faint">
          {label}
        </span>
      </div>
      <div className="text-4xl font-extrabold text-text-primary leading-tight">
        {value}
      </div>
      {sub && <div className="text-sm text-text-ghost">{sub}</div>}
    </div>
  );
}
