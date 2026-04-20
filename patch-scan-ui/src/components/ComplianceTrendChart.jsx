import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function pctColor(pct) {
  return pct >= 80 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626";
}

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
    <div className="py-10 text-center text-text-ghost text-md">
      Not enough scan history to show a trend. Run at least 2 scans.
    </div>
  );

  const latest   = data[data.length - 1];
  const prev     = data[data.length - 2];
  const pctDelta = latest.pct - prev.pct;
  const improving = pctDelta > 0;
  const same      = pctDelta === 0;

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div className="bg-bg-card border border-border-base rounded-lg px-4 py-3 text-sm shadow-dropdown min-w-[180px]">
        <div className="font-bold text-text-primary mb-2 text-md">{d.label}</div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-[#22c55e]" />
              <span className="text-text-faint">Compliant</span>
            </div>
            <span className="font-bold text-green-dark">{d.compliant}</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-[#f97316]" />
              <span className="text-text-faint">Outdated</span>
            </div>
            <span className="font-bold text-orange">{d.outdated}</span>
          </div>
          <div className="border-t border-border-subtle mt-1 pt-1.5 flex justify-between">
            <span className="text-text-faint">Compliance</span>
            <span className="font-bold" style={{ color: pctColor(d.pct) }}>{d.pct}%</span>
          </div>
        </div>
      </div>
    );
  };

  const kpis = [
    {
      label: "Current Compliance", value: latest.pct + "%",
      color: pctColor(latest.pct),
      cls: latest.pct >= 80 ? "bg-green-tint border-green-border" : latest.pct >= 50 ? "bg-amber-tint border-yellow-border" : "bg-red-tint border-red-border",
    },
    { label: "Compliant Hosts",    value: latest.compliant, color: "#16a34a", cls: "bg-green-tint border-green-border" },
    { label: "Outdated Hosts",     value: latest.outdated,  color: "#ea580c", cls: "bg-orange-tint border-orange-border" },
    {
      label: "Trend vs prev scan",
      value: same ? "—" : (improving ? "▲ " : "▼ ") + Math.abs(pctDelta) + "%",
      color: same ? "var(--text-faint)" : improving ? "#16a34a" : "#dc2626",
      cls:   same ? "bg-bg-page border-border-base" : improving ? "bg-green-tint border-green-border" : "bg-red-tint border-red-border",
    },
  ];

  return (
    <div className="px-6 pt-6 pb-4">
      {/* Header */}
      <div className="flex justify-between items-start mb-5">
        <div>
          <div className="font-bold text-lg text-text-primary">Compliance Trend</div>
          <div className="text-sm text-text-faint mt-0.5">Kernel compliance across recent scans</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-ghost">Last</span>
          {[10, 20, 50].map(n => (
            <button key={n} onClick={() => setNScans(n)}
              className={`px-3 py-1 rounded-md text-sm font-semibold cursor-pointer font-[inherit] transition-all duration-150
                ${nScans === n ? "bg-indigo border-indigo text-white" : "bg-bg-card border-border-base text-text-faint"}
                border`}
            >{n}</button>
          ))}
          <span className="text-sm text-text-ghost">scans</span>
        </div>
      </div>

      {/* KPI strip */}
      <div className="flex gap-3 mb-5">
        {kpis.map(k => (
          <div key={k.label} className={`flex-1 ${k.cls} border rounded-lg px-4 py-3`}>
            <div className="text-xs text-text-faint font-semibold uppercase tracking-wide mb-1">{k.label}</div>
            <div className="text-3xl font-extrabold" style={{ color: k.color }}>{k.value}</div>
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
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
          <XAxis dataKey="shortLabel" tick={{ fontSize: 11, fill: "var(--text-ghost)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: "var(--text-ghost)" }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="compliant" stroke="#22c55e" strokeWidth={2.5} fill="url(#gradCompliant)" dot={data.length <= 10 ? { r: 4, fill: "#22c55e", strokeWidth: 0 } : false} activeDot={{ r: 5, fill: "#22c55e" }} />
          <Area type="monotone" dataKey="outdated"  stroke="#f97316" strokeWidth={2.5} fill="url(#gradOutdated)" dot={data.length <= 10 ? { r: 4, fill: "#f97316", strokeWidth: 0 } : false} activeDot={{ r: 5, fill: "#f97316" }} />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-3">
        {[["#22c55e", "Compliant — kernel up to date"], ["#f97316", "Outdated — kernel needs update"]].map(([color, label]) => (
          <div key={label} className="flex items-center gap-1.5 text-sm text-text-muted-c">
            <div className="w-6 h-[3px] rounded-sm" style={{ background: color }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
