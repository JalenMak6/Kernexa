import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
  LineChart, Line, CartesianGrid, ReferenceLine, AreaChart, Area
} from "recharts";

import { apiFetch, apiPost } from "./utils/api";
import { kernelOutdated, fmtDate, badge } from "./utils/helpers.jsx";
import { Icon, Icons } from "./utils/icons.jsx";
import { exportToCSV } from "./utils/csv.js";
import { StatCard } from "./components/StatCard.jsx";
import { HostRow } from "./components/HostRow.jsx";
import { HostsManager } from "./components/HostsManager.jsx";
import { InventoryManager } from "./components/InventoryManager.jsx";
import { CveTab } from "./components/CveTab.jsx";

function osFamily(osVersion) {
  if (!osVersion) return "Unknown";
  const lower = osVersion.toLowerCase();
  if (lower.includes("ubuntu")) {
    const m = osVersion.match(/(\d+\.\d+)/);
    return m ? `Ubuntu ${m[1]}` : "Ubuntu";
  }
  if (lower.includes("rocky")) {
    const m = osVersion.match(/(\d+)/);
    return m ? `Rocky ${m[1]}` : "Rocky";
  }
  if (lower.includes("red hat") || lower.includes("redhat") || lower.includes("rhel")) {
    const m = osVersion.match(/(\d+)/);
    return m ? `RHEL ${m[1]}` : "RHEL";
  }
  return osVersion;
}


// ── Compliance Trend Chart ────────────────────────────────────────────────────
function ComplianceTrendChart({ history }) {
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

  const latest = data[data.length - 1];
  const prev   = data[data.length - 2];
  const pctDelta = latest.pct - prev.pct;
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
      {/* Header row */}
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
              fontFamily: "inherit", transition: "all 0.15s"
            }}>{n}</button>
          ))}
          <span style={{ fontSize: 12, color: "#94a3b8" }}>scans</span>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Current Compliance", value: latest.pct + "%", color: latest.pct >= 80 ? "#16a34a" : latest.pct >= 50 ? "#d97706" : "#dc2626", bg: latest.pct >= 80 ? "#f0fdf4" : latest.pct >= 50 ? "#fffbeb" : "#fef2f2", border: latest.pct >= 80 ? "#bbf7d0" : latest.pct >= 50 ? "#fde68a" : "#fecaca" },
          { label: "Compliant Hosts",    value: latest.compliant, color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
          { label: "Outdated Hosts",     value: latest.outdated,  color: "#ea580c", bg: "#fff7ed", border: "#fed7aa" },
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

// ── Scan Failures Modal ───────────────────────────────────────────────────────
function ScanFailuresModal({ scanId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("failures");

  useEffect(() => {
    apiFetch(`/api/scans/${scanId}/failures`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [scanId]);

  const failures = data?.host_failures || {};
  const failureEntries = Object.entries(failures);

  const reasonColor = (reason) => ({
    unreachable:  { bg: "#fff7ed", border: "#fed7aa", text: "#c2410c", dot: "#f97316" },
    task_failed:  { bg: "#fef2f2", border: "#fecaca", text: "#dc2626", dot: "#ef4444" },
  }[reason] || { bg: "#f8fafc", border: "#e2e8f0", text: "#475569", dot: "#94a3b8" });

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
      zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, backdropFilter: "blur(2px)"
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, width: "100%", maxWidth: 860,
        maxHeight: "85vh", display: "flex", flexDirection: "column",
        boxShadow: "0 24px 64px rgba(0,0,0,0.2)", overflow: "hidden"
      }}>

        {/* header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>Scan Details</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, fontFamily: "monospace" }}>{scanId}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {data && (
              <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
                <span style={{ background: "#f1f5f9", padding: "4px 10px", borderRadius: 6, color: "#475569" }}>
                  {fmtDate(data.scanned_at)}
                </span>
                {data.status === "successful"
                  ? <span style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #86efac", padding: "4px 10px", borderRadius: 6, fontWeight: 600 }}>Successful</span>
                  : <span style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "4px 10px", borderRadius: 6, fontWeight: 600 }}>{data.status}</span>
                }
                <span style={{ background: "#f1f5f9", padding: "4px 10px", borderRadius: 6, color: "#475569", fontFamily: "monospace" }}>rc={data.rc}</span>
              </div>
            )}
            <button onClick={onClose} style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#334155", fontWeight: 400, lineHeight: 1 }} onMouseEnter={e => e.currentTarget.style.background="#e2e8f0"} onMouseLeave={e => e.currentTarget.style.background="#f1f5f9"}>×</button>
          </div>
        </div>

        {/* tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e2e8f0", padding: "0 24px" }}>
          {[
            { id: "failures", label: `Failed Hosts (${failureEntries.length})` },
            { id: "log",      label: "Ansible Log" },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: "12px 16px", border: "none", background: "none", cursor: "pointer",
              fontSize: 13, fontWeight: activeTab === t.id ? 700 : 500,
              color: activeTab === t.id ? "#3b82f6" : "#64748b",
              borderBottom: activeTab === t.id ? "2px solid #3b82f6" : "2px solid transparent",
              fontFamily: "inherit", marginBottom: -1
            }}>{t.label}</button>
          ))}
        </div>

        {/* body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
              <div style={{ width: 28, height: 28, border: "3px solid #e2e8f0", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            </div>
          ) : !data ? (
            <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Failed to load scan details</div>
          ) : activeTab === "failures" ? (
            failureEntries.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
                <div style={{ fontWeight: 700, color: "#16a34a", fontSize: 15 }}>All hosts completed successfully</div>
                <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>No failures recorded for this scan</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {failureEntries.map(([host, failure]) => {
                  const colors = reasonColor(failure.reason);
                  return (
                    <div key={host} style={{
                      background: colors.bg, border: `1px solid ${colors.border}`,
                      borderRadius: 10, padding: 16
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: colors.dot, flexShrink: 0 }} />
                          <span style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", fontFamily: "monospace" }}>{host}</span>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: colors.text, background: "#fff", border: `1px solid ${colors.border}`, padding: "2px 8px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            {failure.reason === "unreachable" ? "Unreachable" : "Task Failed"}
                          </span>
                          {failure.task && (
                            <span style={{ fontSize: 11, color: "#64748b", background: "#fff", border: "1px solid #e2e8f0", padding: "2px 8px", borderRadius: 4 }}>
                              {failure.task}
                            </span>
                          )}
                        </div>
                      </div>
                      {failure.msg && (
                        <div style={{
                          fontSize: 12, color: "#334155", background: "#fff",
                          border: `1px solid ${colors.border}`, borderRadius: 6,
                          padding: "10px 12px", fontFamily: "monospace",
                          whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.6
                        }}>
                          {failure.msg}
                        </div>
                      )}
                      {failure.stderr && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>stderr</div>
                          <div style={{
                            fontSize: 11, color: "#dc2626", background: "#fff",
                            border: "1px solid #fecaca", borderRadius: 6,
                            padding: "8px 12px", fontFamily: "monospace",
                            whiteSpace: "pre-wrap", wordBreak: "break-word"
                          }}>
                            {failure.stderr}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Ansible Log tab */
            <div>
              {data.ansible_log ? (
                <pre style={{
                  fontSize: 11, color: "#e2e8f0", background: "#0f172a",
                  borderRadius: 10, padding: 20, overflowX: "auto",
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                  lineHeight: 1.7, fontFamily: "JetBrains Mono, monospace",
                  margin: 0
                }}>
                  {data.ansible_log}
                </pre>
              ) : (
                <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>No log available for this scan</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ── Settings Tab ──────────────────────────────────────────────────────────────
function SettingsTab() {
  const [form, setForm] = useState({
    smtp_host: "", smtp_port: 587, smtp_user: "", smtp_password: "",
    smtp_from: "", tls_enabled: true, recipients: [],
  });
  const [newRecipient, setNewRecipient] = useState("");
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [testing, setTesting]   = useState(false);
  const [toast, setToast]       = useState(null);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    fetch("/api/notifications/settings").then(r => r.json()).then(d => {
      setForm(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/notifications/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      showToast("Settings saved successfully");
    } catch (e) {
      showToast("Failed to save: " + e.message, false);
    }
    setSaving(false);
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/notifications/test", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      showToast(data.message);
    } catch (e) {
      showToast("Test failed: " + e.message, false);
    }
    setTesting(false);
  };

  const addRecipient = () => {
    const email = newRecipient.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    if (form.recipients.includes(email)) return;
    setForm(f => ({ ...f, recipients: [...f.recipients, email] }));
    setNewRecipient("");
  };

  const removeRecipient = (email) => {
    setForm(f => ({ ...f, recipients: f.recipients.filter(r => r !== email) }));
  };

  const Field = ({ label, hint, children }) => (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>{label}</label>
      {hint && <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>{hint}</div>}
      {children}
    </div>
  );

  const inputStyle = {
    width: "100%", padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8,
    fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
    background: "#fff", color: "#0f172a",
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <div style={{ width: 28, height: 28, border: "3px solid #e2e8f0", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    </div>
  );

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      {toast && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, background: toast.ok ? "#f0fdf4" : "#fef2f2", color: toast.ok ? "#16a34a" : "#dc2626", border: `1px solid ${toast.ok ? "#bbf7d0" : "#fecaca"}` }}>
          {toast.ok ? "✓" : "✗"} {toast.msg}
        </div>
      )}

      {/* SMTP Config */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "24px", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 4 }}>SMTP Configuration</div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 20 }}>Configure the mail server used to send scan reports</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}>
          <Field label="SMTP Host">
            <input style={inputStyle} value={form.smtp_host} onChange={e => setForm(f => ({ ...f, smtp_host: e.target.value }))} placeholder="smtp.gmail.com" />
          </Field>
          <Field label="Port">
            <input style={{ ...inputStyle, width: 90 }} type="number" value={form.smtp_port} onChange={e => setForm(f => ({ ...f, smtp_port: parseInt(e.target.value) || 587 }))} />
          </Field>
        </div>

        <Field label="Username" hint="Leave blank if your relay doesn't require authentication">
          <input style={inputStyle} value={form.smtp_user} onChange={e => setForm(f => ({ ...f, smtp_user: e.target.value }))} placeholder="you@gmail.com" />
        </Field>

        <Field label="Password">
          <input style={inputStyle} type="password" value={form.smtp_password} onChange={e => setForm(f => ({ ...f, smtp_password: e.target.value }))} placeholder="App password or SMTP password" />
        </Field>

        <Field label="From Address" hint="Displayed as the sender — defaults to username if blank">
          <input style={inputStyle} value={form.smtp_from} onChange={e => setForm(f => ({ ...f, smtp_from: e.target.value }))} placeholder="kernexa@yourdomain.com" />
        </Field>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div onClick={() => setForm(f => ({ ...f, tls_enabled: !f.tls_enabled }))} style={{ width: 36, height: 20, borderRadius: 999, background: form.tls_enabled ? "#6366f1" : "#cbd5e1", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 2, left: form.tls_enabled ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
          </div>
          <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>Use STARTTLS (recommended — port 587)</span>
        </div>
      </div>

      {/* Recipients */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "24px", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 4 }}>Recipients</div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 20 }}>Scan reports will be sent to all addresses below after every scan completes</div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={newRecipient}
            onChange={e => setNewRecipient(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addRecipient(); }}
            placeholder="email@example.com"
          />
          <button onClick={addRecipient} style={{ padding: "9px 16px", background: "#0f172a", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            Add
          </button>
        </div>

        {form.recipients.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: "#94a3b8", fontSize: 13, border: "1px dashed #e2e8f0", borderRadius: 8 }}>
            No recipients added yet
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {form.recipients.map(email => (
              <div key={email} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                <span style={{ fontSize: 13, color: "#334155", fontFamily: "monospace" }}>{email}</span>
                <button onClick={() => removeRecipient(email)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, lineHeight: 1, padding: "0 4px" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#dc2626"}
                  onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}
                >×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={sendTest} disabled={testing || !form.smtp_host} style={{
          padding: "10px 20px", border: "1px solid #e2e8f0", background: "#f8fafc",
          color: "#475569", borderRadius: 8, fontSize: 13, fontWeight: 600,
          cursor: form.smtp_host ? "pointer" : "not-allowed", fontFamily: "inherit",
          opacity: form.smtp_host ? 1 : 0.5,
        }}>
          {testing ? "Sending..." : "Send Test Email"}
        </button>
        <button onClick={save} disabled={saving} style={{
          padding: "10px 20px", background: "#0f172a", color: "#fff",
          border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
          cursor: "pointer", fontFamily: "inherit",
        }}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState(() => localStorage.getItem("kernexa_tab") || "dashboard");
  const changeTab = (t) => { setTab(t); localStorage.setItem("kernexa_tab", t); };
  const [latestScan, setLatestScan] = useState(null);
  const [history, setHistory] = useState([]);
  const [cves, setCves] = useState([]);
  const [cvesLoading, setCvesLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanId, setScanId] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("host");
  const [sortDir, setSortDir] = useState("asc");
  const [loading, setLoading] = useState(true);
  const [showHostsManager, setShowHostsManager] = useState(false);
  const [showInventoryManager, setShowInventoryManager] = useState(false);
  const [inventoryCount, setInventoryCount] = useState(0);
  const [activeInventoryName, setActiveInventoryName] = useState(null);
  const [activeInventoryId, setActiveInventoryId] = useState(null);
  const [activeHasCredentials, setActiveHasCredentials] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState(null);
  const [selectedScanId, setSelectedScanId] = useState(null); // for failures modal

  const [filterOS, setFilterOS] = useState("all");
  const [filterKernelStatus, setFilterKernelStatus] = useState("all");
  const [filterPatchStatus, setFilterPatchStatus] = useState("all");
  const [filterTag, setFilterTag] = useState("all");

  const fetchLatest = useCallback(async () => {
    try {
      const data = await apiFetch("/api/scans/latest");
      setLatestScan(data); setError(null);
    } catch (e) {
      if (!e.message.includes("404")) setError(e.message);
    } finally { setLoading(false); }
  }, []);

  const fetchHistory = useCallback(async () => {
    try { setHistory(await apiFetch("/api/scans/history")); } catch {}
  }, []);

  const fetchCves = useCallback(async () => {
    setCvesLoading(true);
    try { setCves(await apiFetch("/api/cves")); } catch {}
    finally { setCvesLoading(false); }
  }, []);

  const fetchInventoryInfo = useCallback(async () => {
    try {
      const data = await apiFetch("/api/hosts");
      setInventoryCount(data.hosts?.length || 0);
    } catch {}
    try {
      const invs = await apiFetch("/api/inventories");
      const active = invs.find(i => i.is_active);
      setActiveInventoryName(active?.name || null);
      setActiveInventoryId(active?.id || null);
      setActiveHasCredentials(active?.has_credentials || false);
    } catch {}
  }, []);

  const fetchCurrentScan = useCallback(async () => {
    try {
      const s = await apiFetch("/api/scans/current");
      if (s.scanning) { setScanning(true); setScanId(s.scan_id); }
    } catch {}
  }, []);

  useEffect(() => {
    fetchLatest(); fetchHistory(); fetchInventoryInfo(); fetchCurrentScan(); fetchCves();
  }, []);

  useEffect(() => {
    if (tab === "cves") fetchCves();
  }, [tab]);

  useEffect(() => {
    if (!scanning || !scanId) return;
    const iv = setInterval(async () => {
      try {
        const s = await apiFetch(`/api/scans/${scanId}/status`);
        if (s.status === "complete") {
          setScanning(false); setScanId(null);
          await fetchLatest(); await fetchHistory(); await fetchCves();
        } else if (s.status?.startsWith("failed")) {
          setScanning(false); setScanId(null);
          setError(`Scan failed: ${s.status}`);
          await fetchHistory();
        }
      } catch {}
    }, 4000);
    return () => clearInterval(iv);
  }, [scanning, scanId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchLatest(), fetchHistory(), fetchInventoryInfo(), fetchCves()]);
    setRefreshing(false);
    setRefreshedAt(new Date());
    setTimeout(() => setRefreshedAt(null), 2500);
  };

  const triggerScan = async () => {
    if (inventoryCount === 0) { setError("No hosts in inventory. Upload or add hosts first."); return; }
    if (!activeHasCredentials) { setError("No SSH credentials set for the active inventory. Open Inventories and click 'Set Creds'."); return; }
    try {
      setScanning(true); setError(null);
      const res = await apiPost("/api/scans/trigger");
      setScanId(res.scan_id);
    } catch (e) {
      setScanning(false);
      setError(e.message.includes("400") ? "No credentials set for the active inventory. Open Inventories and click 'Set Creds'." : e.message);
    }
  };

  const hosts = latestScan?.hosts || [];
  const totalHosts = hosts.length;
  const outdatedHosts = hosts.filter(h => kernelOutdated(h.current_kernel_version, h.latest_available_kernel_version)).length;
  const compliantHosts = totalHosts - outdatedHosts;
  const totalPackages = hosts.reduce((s, h) => s + (h.pending_security_packages?.length || 0), 0);
  const compliancePct = totalHosts ? Math.round((compliantHosts / totalHosts) * 100) : 0;

  const complianceData = [
    { name: "Compliant", value: compliantHosts, color: "#10b981" },
    { name: "Outdated",  value: outdatedHosts,  color: "#ef4444" },
  ];

  const topPackages = (() => {
    const counts = {};
    hosts.forEach(h => (h.pending_security_packages || []).forEach(p => {
      const name = p.split("-")[0];
      counts[name] = (counts[name] || 0) + 1;
    }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));
  })();

  const osOptions = ["all", ...Array.from(new Set(hosts.map(h => osFamily(h.os_version)).filter(f => f !== "Unknown"))).sort()];
  const allTags   = ["all", ...Array.from(new Set(hosts.flatMap(h => h.tags || []))).sort()];

  const filteredHosts = hosts
    .filter(h => {
      const matchSearch = h.host.toLowerCase().includes(search.toLowerCase()) ||
        (h.current_kernel_version || "").toLowerCase().includes(search.toLowerCase()) ||
        (h.os_version || "").toLowerCase().includes(search.toLowerCase());
      const matchOS = filterOS === "all" || osFamily(h.os_version) === filterOS;
      const isOutdated = kernelOutdated(h.current_kernel_version, h.latest_available_kernel_version);
      const matchKernel = filterKernelStatus === "all" ||
        (filterKernelStatus === "outdated" && isOutdated) ||
        (filterKernelStatus === "uptodate" && !isOutdated);
      const pkgCount = h.pending_security_packages?.length || 0;
      const matchPatch = filterPatchStatus === "all" ||
        (filterPatchStatus === "dirty" && pkgCount > 0) ||
        (filterPatchStatus === "clean" && pkgCount === 0);
      const matchTag = filterTag === "all" || (h.tags || []).includes(filterTag);
      return matchSearch && matchOS && matchKernel && matchPatch && matchTag;
    })
    .sort((a, b) => {
      let av = a[sortCol] || "", bv = b[sortCol] || "";
      if (sortCol === "package_count") { av = a.pending_security_packages?.length || 0; bv = b.pending_security_packages?.length || 0; }
      if (typeof av === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  const activeFilterCount = [filterOS !== "all", filterKernelStatus !== "all", filterPatchStatus !== "all", filterTag !== "all"].filter(Boolean).length;

  const clearFilters = () => {
    setFilterOS("all"); setFilterKernelStatus("all"); setFilterPatchStatus("all"); setFilterTag("all"); setSearch("");
  };

  const thStyle = (col) => ({
    padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b",
    cursor: col ? "pointer" : "default", userSelect: "none", whiteSpace: "nowrap",
    background: sortCol === col ? "#f1f5f9" : "transparent"
  });

  const sortBy = (col) => {
    if (!col) return;
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const scanDisabled = scanning || inventoryCount === 0 || !activeHasCredentials;
  const scanTooltip = inventoryCount === 0
    ? "No hosts — upload an inventory first"
    : !activeHasCredentials ? "Set SSH credentials before scanning" : "";

  const criticalCount = cves.filter(c => c.severity === "Critical").length;
  const importantCount = cves.filter(c => c.severity === "Important").length;

  const tabTitle = { dashboard: "Overview", hosts: "VM Inventory", history: "Scan History", cves: "CVE Advisories" }[tab] || "Overview";

  const FilterChip = ({ label, active, onClick, color = "#3b82f6" }) => (
    <button onClick={onClick} style={{
      padding: "5px 12px", borderRadius: 6,
      border: `1px solid ${active ? color : "#e2e8f0"}`,
      background: active ? `${color}18` : "#fff",
      cursor: "pointer", fontSize: 12, fontWeight: active ? 700 : 500,
      color: active ? color : "#475569", fontFamily: "inherit",
      transition: "all 0.15s", whiteSpace: "nowrap"
    }}>{label}</button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeOut { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(8px)} }
      `}</style>

      {/* ── SIDEBAR ── */}
      <div style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 220, background: "#0f172a", display: "flex", flexDirection: "column", borderRight: "1px solid #1e293b", zIndex: 50 }}>
        <div style={{ padding: "20px 16px", borderBottom: "1px solid #1e293b" }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src="/kernexa.png" alt="Kernexa" style={{ width: "100%", maxHeight: 40, objectFit: "contain" }} />
          </div>
          <div style={{ textAlign: "center", color: "#475569", fontSize: 10, letterSpacing: "0.05em", marginTop: 8 }}>Security Compliance Platform</div>
        </div>

        <nav style={{ padding: "16px 12px", flex: 1, overflowY: "auto" }}>
          {[
            { id: "dashboard", label: "Dashboard",    icon: "host"    },
            { id: "hosts",     label: "VM Inventory", icon: "kernel"  },
            { id: "history",   label: "Scan History", icon: "history" },
            { id: "settings",  label: "Settings",     icon: "key"     },
          ].map(item => (
            <button key={item.id} onClick={() => changeTab(item.id)} style={{
              width: "100%", padding: "10px 12px", borderRadius: 8, border: "none",
              display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
              marginBottom: 4, fontFamily: "inherit", fontSize: 13, fontWeight: 500,
              background: tab === item.id ? "#1e293b" : "transparent",
              color: tab === item.id ? "#f8fafc" : "#64748b", transition: "all 0.15s"
            }}>
              <Icon d={Icons[item.icon]} size={15} color={tab === item.id ? "#3b82f6" : "#475569"} />
              {item.label}
            </button>
          ))}

          <button onClick={() => changeTab("cves")} style={{
            width: "100%", padding: "10px 12px", borderRadius: 8, border: "none",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            cursor: "pointer", marginBottom: 4, fontFamily: "inherit", fontSize: 13, fontWeight: 500,
            background: tab === "cves" ? "#1e293b" : "transparent",
            color: tab === "cves" ? "#f8fafc" : "#64748b", transition: "all 0.15s"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon d={Icons.warning} size={15} color={tab === "cves" ? "#3b82f6" : "#475569"} />
              CVE Advisories
            </div>
            {(criticalCount + importantCount) > 0 && (
              <span style={{ background: "#dc2626", color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999 }}>
                {criticalCount + importantCount}
              </span>
            )}
          </button>

          <div style={{ borderTop: "1px solid #1e293b", margin: "12px 0" }} />

          <button onClick={() => setShowInventoryManager(true)} style={{
            width: "100%", padding: "10px 12px", borderRadius: 8, border: "none",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            cursor: "pointer", marginBottom: 4, fontFamily: "inherit", fontSize: 13, fontWeight: 500,
            background: "transparent", color: "#64748b", transition: "all 0.15s"
          }}
            onMouseEnter={e => e.currentTarget.style.background = "#1e293b"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon d={Icons.file} size={15} color="#475569" />
              Inventories
            </div>
            {activeInventoryName && (
              <span style={{ background: "#1e3a5f", color: "#93c5fd", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999 }}>active</span>
            )}
          </button>

          <button onClick={() => setShowHostsManager(true)} style={{
            width: "100%", padding: "10px 12px", borderRadius: 8, border: "none",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            cursor: "pointer", marginBottom: 4, fontFamily: "inherit", fontSize: 13, fontWeight: 500,
            background: "transparent", color: "#64748b", transition: "all 0.15s"
          }}
            onMouseEnter={e => e.currentTarget.style.background = "#1e293b"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon d={Icons.servers} size={15} color="#475569" />
              Manage Hosts
            </div>
            {inventoryCount > 0 && (
              <span style={{ background: "#1e3a5f", color: "#93c5fd", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999 }}>{inventoryCount}</span>
            )}
          </button>

          {activeInventoryName && (
            <div style={{ margin: "8px 4px 0", padding: "10px 12px", background: "#0f2d1f", borderRadius: 8, border: "1px solid #166534" }}>
              <div style={{ fontSize: 10, color: "#4ade80", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>Active Inventory</div>
              <div style={{ fontSize: 12, color: "#86efac", marginTop: 2, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeInventoryName}</div>
              <div style={{ fontSize: 10, color: "#166534", marginTop: 1 }}>{inventoryCount} hosts</div>
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
                {activeHasCredentials ? (
                  <><Icon d={Icons.check} size={11} color="#4ade80" /><span style={{ fontSize: 10, color: "#4ade80" }}>Credentials set</span></>
                ) : (
                  <><Icon d={Icons.warning} size={11} color="#fb923c" />
                    <span style={{ fontSize: 10, color: "#fb923c" }}>No credentials —</span>
                    <button onClick={() => setShowInventoryManager(true)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#fb923c", textDecoration: "underline", padding: 0, fontFamily: "inherit" }}>set now</button>
                  </>
                )}
              </div>
            </div>
          )}
        </nav>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ marginLeft: 220, padding: "32px", minHeight: "100vh", width: "calc(100vw - 220px)", overflowX: "hidden" }}>

        {/* topbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{tabTitle}</h1>
            {latestScan && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Last scan: {fmtDate(latestScan.scanned_at)}</div>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={handleRefresh} disabled={refreshing} style={{
              padding: "8px 14px", border: "1px solid #e2e8f0", borderRadius: 8,
              background: refreshing ? "#f8fafc" : "#fff", cursor: refreshing ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 6, fontSize: 12,
              color: refreshing ? "#94a3b8" : "#475569", fontFamily: "inherit", transition: "all 0.15s"
            }}>
              <div style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none", display: "flex", alignItems: "center" }}>
                <Icon d={Icons.refresh} size={13} color={refreshing ? "#94a3b8" : "#475569"} />
              </div>
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            {latestScan && (
              <button onClick={() => exportToCSV(latestScan)} style={{ padding: "8px 14px", border: "1px solid #3b82f6", borderRadius: 8, background: "#eff6ff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#2563eb", fontWeight: 600, fontFamily: "inherit" }}>
                <Icon d={Icons.export} size={13} color="#2563eb" /> Export CSV
              </button>
            )}
            <button onClick={triggerScan} disabled={scanDisabled} title={scanTooltip} style={{
              padding: "8px 16px", borderRadius: 8, border: "none",
              background: scanDisabled ? "#e2e8f0" : "linear-gradient(135deg,#3b82f6,#6366f1)",
              color: scanDisabled ? "#94a3b8" : "#fff", fontWeight: 700, fontSize: 12,
              cursor: scanDisabled ? "not-allowed" : "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 6,
              boxShadow: scanDisabled ? "none" : "0 2px 8px rgba(59,130,246,0.35)"
            }}>
              {scanning
                ? <><div style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Scanning...</>
                : <><Icon d={Icons.scan} size={13} color={scanDisabled ? "#94a3b8" : "#fff"} />Run Scan</>}
            </button>
          </div>
        </div>
        {scanning && <div style={{ fontSize: 11, color: "#64748b", textAlign: "right", marginTop: -20, marginBottom: 16, animation: "pulse 2s infinite" }}>Ansible playbook running...</div>}

        {activeInventoryName && !activeHasCredentials && !error && (
          <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#c2410c", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon d={Icons.key} size={16} color="#c2410c" />
              <span>SSH credentials are not set for <strong>{activeInventoryName}</strong>. You must set credentials before running a scan.</span>
            </div>
            <button onClick={() => setShowInventoryManager(true)} style={{ background: "#c2410c", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap", marginLeft: 12 }}>
              Set Credentials
            </button>
          </div>
        )}

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#dc2626", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon d={Icons.warning} size={16} color="#dc2626" />{error}</div>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer" }}><Icon d={Icons.close} size={14} color="#dc2626" /></button>
          </div>
        )}

        {tab === "cves" && <CveTab cves={cves} loading={cvesLoading} />}

        {tab === "settings" && (
          <div style={{ animation: "fadeIn 0.3s ease", width: "100%" }}>
            <SettingsTab />
          </div>
        )}

        {tab !== "cves" && tab !== "settings" && (
          loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
              <div style={{ width: 32, height: 32, border: "3px solid #e2e8f0", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            </div>
          ) : !latestScan ? (
            <div style={{ textAlign: "center", padding: "80px 32px", background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0" }}>
              <Icon d={Icons.scan} size={48} color="#cbd5e1" />
              <div style={{ marginTop: 16, fontSize: 18, fontWeight: 700, color: "#334155" }}>No scan data yet</div>
              <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 6, marginBottom: 20 }}>
                {inventoryCount === 0 ? "Start by uploading an inventory file, then set credentials and run a scan"
                  : !activeHasCredentials ? `${inventoryCount} hosts ready — set SSH credentials, then click Run Scan`
                  : `${inventoryCount} hosts ready — click Run Scan to start`}
              </div>
              {inventoryCount === 0 ? (
                <button onClick={() => setShowInventoryManager(true)} style={{ padding: "10px 20px", background: "#0f172a", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Icon d={Icons.upload} size={14} color="#fff" /> Upload Inventory
                </button>
              ) : !activeHasCredentials ? (
                <button onClick={() => setShowInventoryManager(true)} style={{ padding: "10px 20px", background: "#c2410c", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Icon d={Icons.key} size={14} color="#fff" /> Set SSH Credentials
                </button>
              ) : null}
            </div>
          ) : (
            <div style={{ animation: "fadeIn 0.3s ease", width: "100%" }}>

              {/* ── DASHBOARD ── */}
              {tab === "dashboard" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 16, marginBottom: 24 }}>
                    <StatCard icon="host"    label="Total Hosts"      value={totalHosts}     sub="in latest scan"      accent="#3b82f6" />
                    <StatCard icon="check"   label="Compliant"        value={compliantHosts} sub="kernel up to date"   accent="#10b981" />
                    <StatCard icon="warning" label="Outdated"         value={outdatedHosts}  sub="kernel needs update" accent="#ef4444" />
                    <StatCard icon="package" label="Pending Packages" value={totalPackages}  sub="security updates"    accent="#f59e0b" />
                  </div>


                  {/* ── CVE Severity Summary Cards ── */}
                  {(() => {
                    const cveCounts = (cves || []).reduce((acc, c) => { const sev = c.severity || "Unknown"; acc[sev] = (acc[sev] || 0) + 1; return acc; }, {});
                    const CVE_SEVERITY_CONFIG = {
                      Critical:  { bg: "#fef2f2", color: "#991b1b", border: "#fca5a5", dot: "#ef4444" },
                      Important: { bg: "#fff7ed", color: "#9a3412", border: "#fdba74", dot: "#f97316" },
                      Moderate:  { bg: "#fefce8", color: "#854d0e", border: "#fde047", dot: "#eab308" },
                      Low:       { bg: "#f0fdf4", color: "#166534", border: "#86efac", dot: "#22c55e" },
                    };
                    return (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 16, marginBottom: 24 }}>
                        {["Critical", "Important", "Moderate", "Low"].map(sev => {
                          const count = cveCounts[sev] || 0;
                          const cfg = count > 0 ? CVE_SEVERITY_CONFIG[sev] : { bg: "#f8fafc", color: "#94a3b8", border: "#e2e8f0", dot: "#cbd5e1" };
                          return (
                            <div key={sev} onClick={() => changeTab("cves")} style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 12, padding: "16px 20px", cursor: "pointer", transition: "all 0.15s", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }} onMouseEnter={e => e.currentTarget.style.transform="translateY(-1px)"} onMouseLeave={e => e.currentTarget.style.transform="translateY(0)"}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.dot }} />
                                <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, letterSpacing: "0.05em", textTransform: "uppercase" }}>{sev}</span>
                              </div>
                              <div style={{ fontSize: 28, fontWeight: 800, color: cfg.color, lineHeight: 1 }}>{count}</div>
                              <div style={{ fontSize: 11, color: cfg.color, marginTop: 4, opacity: 0.7 }}>CVE{count !== 1 ? "s" : ""}</div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 24 }}>
                    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 4 }}>Kernel Compliance</div>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>{compliancePct}% of hosts up to date</div>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={complianceData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                            {complianceData.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip /><Legend iconType="circle" iconSize={8} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 4 }}>Top Packages Pending</div>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>Most common security updates across all hosts</div>
                      {topPackages.length === 0 ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 180, color: "#94a3b8", fontSize: 13 }}>No pending packages</div>
                      ) : (
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={topPackages} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
                            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                            <Tooltip cursor={{ fill: "#f1f5f9" }} />
                            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                              {topPackages.map((_, i) => <Cell key={i} fill={`hsl(${220 + i * 12},70%,${55 + i * 3}%)`} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                    <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
                          Host Summary — {filteredHosts.length} of {totalHosts} hosts
                          {activeFilterCount > 0 && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: "#3b82f6" }}>{activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active</span>}
                        </div>
                        {(activeFilterCount > 0 || search) && (
                          <button onClick={clearFilters} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fef2f2", cursor: "pointer", fontSize: 12, color: "#dc2626", fontFamily: "inherit" }}>Clear all ×</button>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginRight: 2 }}>OS:</span>
                        {osOptions.map(os => <FilterChip key={os} label={os === "all" ? "All" : os} active={filterOS === os} onClick={() => setFilterOS(os)} color="#6366f1" />)}
                        <div style={{ width: 1, height: 20, background: "#e2e8f0", margin: "0 4px" }} />
                        <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginRight: 2 }}>Kernel:</span>
                        <FilterChip label="All"        active={filterKernelStatus === "all"}      onClick={() => setFilterKernelStatus("all")}      color="#64748b" />
                        <FilterChip label="Outdated"   active={filterKernelStatus === "outdated"} onClick={() => setFilterKernelStatus("outdated")} color="#ef4444" />
                        <FilterChip label="Up to date" active={filterKernelStatus === "uptodate"} onClick={() => setFilterKernelStatus("uptodate")} color="#10b981" />
                        <div style={{ width: 1, height: 20, background: "#e2e8f0", margin: "0 4px" }} />
                        <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginRight: 2 }}>Patches:</span>
                        <FilterChip label="All"     active={filterPatchStatus === "all"}   onClick={() => setFilterPatchStatus("all")}   color="#64748b" />
                        <FilterChip label="Pending" active={filterPatchStatus === "dirty"} onClick={() => setFilterPatchStatus("dirty")} color="#f59e0b" />
                        <FilterChip label="Clean"   active={filterPatchStatus === "clean"} onClick={() => setFilterPatchStatus("clean")} color="#10b981" />
                        {allTags.length > 1 && (<>
                          <div style={{ width: 1, height: 20, background: "#e2e8f0", margin: "0 4px" }} />
                          <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginRight: 2 }}>Tag:</span>
                          {allTags.map(t => <FilterChip key={t} label={t === "all" ? "All" : t} active={filterTag === t} onClick={() => setFilterTag(t)} color="#8b5cf6" />)}
                        </>)}
                      </div>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                      <thead style={{ background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                        <tr>
                          <th style={thStyle("host")} onClick={() => sortBy("host")}>Host</th>
                          <th style={{ ...thStyle("os_version"), width: 120 }} onClick={() => sortBy("os_version")}>OS</th>
                          <th style={{ ...thStyle("last_reboot_time"), width: 140 }} onClick={() => sortBy("last_reboot_time")}>Last Reboot</th>
                          <th style={thStyle("current_kernel_version")} onClick={() => sortBy("current_kernel_version")}>Current Kernel</th>
                          <th style={thStyle(null)}>Latest Kernel</th>
                          <th style={{ ...thStyle(null), width: 130 }}>Kernel Status</th>
                          <th style={{ ...thStyle("package_count"), width: 140 }} onClick={() => sortBy("package_count")}>Pending Security Patches</th>
                          <th style={{ ...thStyle(null), width: 80 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHosts.length === 0
                          ? <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No hosts match your filters</td></tr>
                          : filteredHosts.map(h => <HostRow key={h.host} host={h} />)}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* ── VM INVENTORY ── */}
              {tab === "hosts" && (
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
                        {filteredHosts.length} of {totalHosts} hosts
                        {activeFilterCount > 0 && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: "#3b82f6" }}>{activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active</span>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {(activeFilterCount > 0 || search) && (
                          <button onClick={clearFilters} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fef2f2", cursor: "pointer", fontSize: 12, color: "#dc2626", fontFamily: "inherit" }}>Clear all ×</button>
                        )}
                        <div style={{ position: "relative" }}>
                          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by hostname..."
                            style={{ padding: "8px 12px 8px 34px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", width: 240, fontFamily: "inherit" }} />
                          <div style={{ position: "absolute", top: "50%", left: 10, transform: "translateY(-50%)" }}>
                            <Icon d={Icons.search} size={14} color="#94a3b8" />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginRight: 2 }}>OS:</span>
                      {osOptions.map(os => <FilterChip key={os} label={os === "all" ? "All" : os} active={filterOS === os} onClick={() => setFilterOS(os)} color="#6366f1" />)}
                      <div style={{ width: 1, height: 20, background: "#e2e8f0", margin: "0 4px" }} />
                      <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginRight: 2 }}>Kernel:</span>
                      <FilterChip label="All"        active={filterKernelStatus === "all"}      onClick={() => setFilterKernelStatus("all")}      color="#64748b" />
                      <FilterChip label="Outdated"   active={filterKernelStatus === "outdated"} onClick={() => setFilterKernelStatus("outdated")} color="#ef4444" />
                      <FilterChip label="Up to date" active={filterKernelStatus === "uptodate"} onClick={() => setFilterKernelStatus("uptodate")} color="#10b981" />
                      <div style={{ width: 1, height: 20, background: "#e2e8f0", margin: "0 4px" }} />
                      <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginRight: 2 }}>Patches:</span>
                      <FilterChip label="All"     active={filterPatchStatus === "all"}   onClick={() => setFilterPatchStatus("all")}   color="#64748b" />
                      <FilterChip label="Pending" active={filterPatchStatus === "dirty"} onClick={() => setFilterPatchStatus("dirty")} color="#f59e0b" />
                      <FilterChip label="Clean"   active={filterPatchStatus === "clean"} onClick={() => setFilterPatchStatus("clean")} color="#10b981" />
                      {allTags.length > 1 && (<>
                        <div style={{ width: 1, height: 20, background: "#e2e8f0", margin: "0 4px" }} />
                        <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginRight: 2 }}>Tag:</span>
                        {allTags.map(t => <FilterChip key={t} label={t === "all" ? "All" : t} active={filterTag === t} onClick={() => setFilterTag(t)} color="#8b5cf6" />)}
                      </>)}
                    </div>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                    <thead style={{ background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                      <tr>
                        <th style={thStyle("host")} onClick={() => sortBy("host")}>Host {sortCol === "host" ? (sortDir === "asc" ? "↑" : "↓") : ""}</th>
                        <th style={{ ...thStyle("os_version"), width: 120 }} onClick={() => sortBy("os_version")}>OS {sortCol === "os_version" ? (sortDir === "asc" ? "↑" : "↓") : ""}</th>
                        <th style={{ ...thStyle("last_reboot_time"), width: 140 }} onClick={() => sortBy("last_reboot_time")}>Last Reboot {sortCol === "last_reboot_time" ? (sortDir === "asc" ? "↑" : "↓") : ""}</th>
                        <th style={thStyle("current_kernel_version")} onClick={() => sortBy("current_kernel_version")}>Current Kernel {sortCol === "current_kernel_version" ? (sortDir === "asc" ? "↑" : "↓") : ""}</th>
                        <th style={thStyle(null)}>Latest Kernel</th>
                        <th style={{ ...thStyle(null), width: 130 }}>Status</th>
                        <th style={{ ...thStyle("package_count"), width: 160 }} onClick={() => sortBy("package_count")}>Pending Packages {sortCol === "package_count" ? (sortDir === "asc" ? "↑" : "↓") : ""}</th>
                        <th style={{ ...thStyle(null), width: 80 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHosts.length === 0
                        ? <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No hosts match your filters</td></tr>
                        : filteredHosts.map(h => <HostRow key={h.host} host={h} />)}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── SCAN HISTORY ── */}
              {tab === "history" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                  <ComplianceTrendChart history={history} />
                </div>
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
                    {history.length} scan run{history.length !== 1 ? "s" : ""}
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                    <thead style={{ background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                      <tr>
                        <th style={{ ...thStyle(null), width: 140 }}>Scan ID</th>
                        <th style={thStyle(null)}>Triggered At</th>
                        <th style={{ ...thStyle(null), width: 140 }}>Hosts Scanned</th>
                        <th style={{ ...thStyle(null), width: 120 }}>Status</th>
                        <th style={{ ...thStyle(null), width: 100 }}>Return Code</th>
                        <th style={{ ...thStyle(null), width: 140 }}>Failed Hosts</th>
                        <th style={{ ...thStyle(null), width: 120 }}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.length === 0
                        ? <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No scan history yet</td></tr>
                        : history.map(s => (
                          <tr key={s.scan_id} style={{ borderBottom: "1px solid #f1f5f9" }}
                            onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                            onMouseLeave={e => e.currentTarget.style.background = ""}>
                            <td style={{ padding: "14px 16px", fontSize: 11, fontFamily: "monospace", color: "#64748b" }}>{s.scan_id.slice(0, 8)}...</td>
                            <td style={{ padding: "14px 16px", fontSize: 13, color: "#334155" }}>{fmtDate(s.scanned_at)}</td>
                            <td style={{ padding: "14px 16px", fontSize: 13, color: "#334155" }}>{s.host_count} hosts</td>
                            <td style={{ padding: "14px 16px" }}>
                              {s.status === "successful" ? badge("Successful", "green") : badge(s.status, "red")}
                            </td>
                            <td style={{ padding: "14px 16px", fontSize: 12, fontFamily: "monospace", color: s.rc === 0 ? "#10b981" : "#ef4444" }}>{s.rc}</td>
                            <td style={{ padding: "14px 16px" }}>
                              {s.failure_count > 0 ? (
                                <span style={{
                                  display: "inline-flex", alignItems: "center", gap: 5,
                                  background: "#fef2f2", color: "#dc2626",
                                  border: "1px solid #fecaca", borderRadius: 6,
                                  padding: "3px 10px", fontSize: 12, fontWeight: 700
                                }}>
                                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444" }} />
                                  {s.failure_count} failed
                                </span>
                              ) : (
                                <span style={{
                                  display: "inline-flex", alignItems: "center", gap: 5,
                                  background: "#f0fdf4", color: "#16a34a",
                                  border: "1px solid #86efac", borderRadius: 6,
                                  padding: "3px 10px", fontSize: 12, fontWeight: 600
                                }}>
                                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
                                  All OK
                                </span>
                              )}
                            </td>
                            <td style={{ padding: "14px 16px" }}>
                              <button onClick={() => setSelectedScanId(s.scan_id)} style={{
                                padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                                border: "1px solid #e2e8f0", background: "#f8fafc",
                                color: "#475569", cursor: "pointer", fontFamily: "inherit",
                                display: "inline-flex", alignItems: "center", gap: 5,
                                transition: "all 0.15s"
                              }}
                                onMouseEnter={e => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
                              >
                                <Icon d={Icons.search} size={11} color="#64748b" /> View
                              </button>
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* ── MODALS ── */}
      {showHostsManager && <HostsManager onClose={() => setShowHostsManager(false)} onSaved={fetchInventoryInfo} />}
      {showInventoryManager && <InventoryManager onClose={() => { setShowInventoryManager(false); fetchInventoryInfo(); }} onActivated={fetchInventoryInfo} />}
      {selectedScanId && <ScanFailuresModal scanId={selectedScanId} onClose={() => setSelectedScanId(null)} />}

      {/* ── REFRESH TOAST ── */}
      {refreshedAt && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 999,
          background: "#0f172a", color: "#4ade80", padding: "10px 16px", borderRadius: 8,
          fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)", animation: "fadeIn 0.2s ease"
        }}>
          <Icon d={Icons.check} size={13} color="#4ade80" />
          Refreshed at {refreshedAt.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}