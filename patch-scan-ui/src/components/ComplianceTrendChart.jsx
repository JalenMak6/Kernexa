import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function ComplianceTrendChart({ history }) {
  const [nScans, setNScans] = useState(20);

  const data = [...history]
    .filter(s => s.host_count > 0)
    .slice(0, nScans)
    .reverse()
    .map(s => ({
      label:      new Date(s.scanned_at).toLocaleDateString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      shortLabel: new Date(s.scanned_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" }),
      compliant:  s.compliant_count || 0,
      outdated:   s.outdated_count  || 0,
      total:      s.host_count      || 0,
      scanned_at: s.scanned_at,
      pct: s.host_count > 0 ? Math.round(((s.compliant_count || 0) / s.host_count) * 100) : 0,
    }));

  if (data.length < 2) return (
    <div style={{ padding: "40px 0", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
      Not enough scan history to show a trend. Run at least 2 scans.
    </div>
  );

  const latest    = data[data.length - 1];
  const prev      = data[data.length - 2];
  const pctDelta  = latest.pct - prev.pct;
  const improving = pctDelta > 0;
  const same      = pctDelta === 0;

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 16px", fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", minWidth: 180 }}>
        <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8, fontSize: 13 }}>{d.label}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "#22c55e" }} />
              <span style={{ color: "#64748b" }}>Compliant</span>
            </div>
            <span style={{ fontWeight: 700, color: "#16a34a" }}>{d.compliant}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "#f97316" }} />
              <span style={{ color: "#64748b" }}>Outdated</span>
            </div>
            <span style={{ fontWeight: 700, color: "#ea580c" }}>{d.outdated}</span>
          </div>
          <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 4, paddingTop: 6, display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#64748b" }}>Compliance</span>
            <span style={{ fontWeight: 700, color: d.pct >= 80 ? "#16a34a" : d.pct >= 50 ? "#d97706" : "#dc2626" }}>{d.pct}%</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "24px 24px 16px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>Compliance Trend</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>Kernel compliance across recent scans</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>Last</span>
          {[10, 20, 50].map(n => (
            <button key={n} onClick={() => setNScans(n)} style={{
              padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: "1px solid " + (nScans === n ? "#6366f1" : "#e2e8f0"),
              background: nScans === n ? "#6366f1" : "#fff",
              color: nScans === n ? "#fff" : "#64748b",
              fontFamily: "inherit", transition: "all 0.15s",
            }}>{n}</button>
          ))}
          <span style={{ fontSize: 12, color: "#94a3b8" }}>scans</span>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Current Compliance", value: latest.pct + "%",  color: latest.pct >= 80 ? "#16a34a" : latest.pct >= 50 ? "#d97706" : "#dc2626", bg: latest.pct >= 80 ? "#f0fdf4" : latest.pct >= 50 ? "#fffbeb" : "#fef2f2", border: latest.pct >= 80 ? "#bbf7d0" : latest.pct >= 50 ? "#fde68a" : "#fecaca" },
          { label: "Compliant Hosts",    value: latest.compliant,  color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
          { label: "Outdated Hosts",     value: latest.outdated,   color: "#ea580c", bg: "#fff7ed", border: "#fed7aa" },
          { label: "Trend vs prev scan", value: same ? "—" : (improving ? "▲ " : "▼ ") + Math.abs(pctDelta) + "%", color: same ? "#64748b" : improving ? "#16a34a" : "#dc2626", bg: same ? "#f8fafc" : improving ? "#f0fdf4" : "#fef2f2", border: same ? "#e2e8f0" : improving ? "#bbf7d0" : "#fecaca" },
        ].map(k => (
          <div key={k.label} style={{ flex: 1, background: k.bg, border: "1px solid " + k.border, borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="gradCompliant" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradOutdated" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#f97316" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="shortLabel" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="compliant" stroke="#22c55e" strokeWidth={2.5} fill="url(#gradCompliant)" dot={data.length <= 10 ? { r: 4, fill: "#22c55e", strokeWidth: 0 } : false} activeDot={{ r: 5, fill: "#22c55e" }} />
          <Area type="monotone" dataKey="outdated"  stroke="#f97316" strokeWidth={2.5} fill="url(#gradOutdated)" dot={data.length <= 10 ? { r: 4, fill: "#f97316", strokeWidth: 0 } : false} activeDot={{ r: 5, fill: "#f97316" }} />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 12 }}>
        {[["#22c55e", "Compliant — kernel up to date"], ["#f97316", "Outdated — kernel needs update"]].map(([color, label]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#475569" }}>
            <div style={{ width: 24, height: 3, background: color, borderRadius: 2 }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}