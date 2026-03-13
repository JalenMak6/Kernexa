import { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { fmtDate, badge } from "../utils/helpers.jsx";

export function ScanFailuresModal({ scanId, onClose }) {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState("failures");

  useEffect(() => {
    apiFetch(`/api/scans/${scanId}/failures`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [scanId]);

  const failures       = data?.host_failures || {};
  const failureEntries = Object.entries(failures);

  const reasonColor = (reason) => ({
    unreachable: { bg: "#fff7ed", border: "#fed7aa", text: "#c2410c", dot: "#f97316" },
    task_failed: { bg: "#fef2f2", border: "#fecaca", text: "#dc2626", dot: "#ef4444" },
  }[reason] || { bg: "#f8fafc", border: "#e2e8f0", text: "#475569", dot: "#94a3b8" });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backdropFilter: "blur(2px)" }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 860, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.2)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>Scan Details</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, fontFamily: "monospace" }}>{scanId}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {data && (
              <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
                <span style={{ background: "#f1f5f9", padding: "4px 10px", borderRadius: 6, color: "#475569" }}>{fmtDate(data.scanned_at)}</span>
                {data.status === "successful"
                  ? <span style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #86efac", padding: "4px 10px", borderRadius: 6, fontWeight: 600 }}>Successful</span>
                  : <span style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "4px 10px", borderRadius: 6, fontWeight: 600 }}>{data.status}</span>
                }
                <span style={{ background: "#f1f5f9", padding: "4px 10px", borderRadius: 6, color: "#475569", fontFamily: "monospace" }}>rc={data.rc}</span>
              </div>
            )}
            <button onClick={onClose} style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#334155" }}
              onMouseEnter={e => e.currentTarget.style.background = "#e2e8f0"}
              onMouseLeave={e => e.currentTarget.style.background = "#f1f5f9"}
            >×</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", padding: "0 24px" }}>
          {[
            { id: "failures", label: `Failed Hosts (${failureEntries.length})` },
            { id: "log",      label: "Ansible Log" },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: "12px 16px", border: "none", background: "none", cursor: "pointer",
              fontSize: 13, fontWeight: activeTab === t.id ? 700 : 500,
              color: activeTab === t.id ? "#3b82f6" : "#64748b",
              borderBottom: activeTab === t.id ? "2px solid #3b82f6" : "2px solid transparent",
              fontFamily: "inherit", marginBottom: -1,
            }}>{t.label}</button>
          ))}
        </div>

        {/* Body */}
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
                    <div key={host} style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 16 }}>
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
                            <span style={{ fontSize: 11, color: "#64748b", background: "#fff", border: "1px solid #e2e8f0", padding: "2px 8px", borderRadius: 4 }}>{failure.task}</span>
                          )}
                        </div>
                      </div>
                      {failure.msg && (
                        <div style={{ fontSize: 12, color: "#334155", background: "#fff", border: `1px solid ${colors.border}`, borderRadius: 6, padding: "10px 12px", fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.6 }}>
                          {failure.msg}
                        </div>
                      )}
                      {failure.stderr && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>stderr</div>
                          <div style={{ fontSize: 11, color: "#dc2626", background: "#fff", border: "1px solid #fecaca", borderRadius: 6, padding: "8px 12px", fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
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
            <div>
              {data.ansible_log ? (
                <pre style={{ fontSize: 11, color: "#e2e8f0", background: "#0f172a", borderRadius: 10, padding: 20, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.7, fontFamily: "JetBrains Mono, monospace", margin: 0 }}>
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
