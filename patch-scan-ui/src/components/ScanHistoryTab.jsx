import { Icon, Icons } from "../utils/icons.jsx";
import { fmtDate, badge } from "../utils/helpers.jsx";
import { ComplianceTrendChart } from "./ComplianceTrendChart.jsx";

export function ScanHistoryTab({ history, onSelectScan }) {
  const thStyle = {
    padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b",
    cursor: "default", userSelect: "none", whiteSpace: "nowrap",
    background: "transparent",
  };

  return (
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
              <th style={{ ...thStyle, width: 140 }}>Scan ID</th>
              <th style={thStyle}>Triggered At</th>
              <th style={{ ...thStyle, width: 140 }}>Hosts Scanned</th>
              <th style={{ ...thStyle, width: 120 }}>Status</th>
              <th style={{ ...thStyle, width: 100 }}>Return Code</th>
              <th style={{ ...thStyle, width: 140 }}>Failed Hosts</th>
              <th style={{ ...thStyle, width: 120 }}>Details</th>
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
                  <td style={{ padding: "14px 16px" }}>{s.status === "successful" ? badge("Successful", "green") : badge(s.status, "red")}</td>
                  <td style={{ padding: "14px 16px", fontSize: 12, fontFamily: "monospace", color: s.rc === 0 ? "#10b981" : "#ef4444" }}>{s.rc}</td>
                  <td style={{ padding: "14px 16px" }}>
                    {s.failure_count > 0
                      ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444" }} />{s.failure_count} failed
                        </span>
                      : <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#f0fdf4", color: "#16a34a", border: "1px solid #86efac", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />All OK
                        </span>
                    }
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <button onClick={() => onSelectScan(s.scan_id)}
                      style={{ padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 }}
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
  );
}