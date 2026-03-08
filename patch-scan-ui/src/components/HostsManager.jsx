import { useState, useEffect } from "react";
import { Icon, Icons } from "../utils/icons.jsx";
import { apiFetch, apiPost } from "../utils/api";

export function HostsManager({ onClose, onSaved }) {
  const [hosts, setHosts]     = useState([]);
  const [newHost, setNewHost] = useState("");
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    apiFetch("/api/hosts").then(d => setHosts(d.hosts || [])).catch(() => {});
  }, []);

  const addHost = () => {
    const h = newHost.trim();
    if (!h || hosts.includes(h)) { setNewHost(""); return; }
    setHosts(prev => [...prev, h]);
    setNewHost("");
  };

  const removeHost = (host) => setHosts(prev => prev.filter(h => h !== host));

  const save = async () => {
    if (!hosts.length) return;
    setSaving(true);
    try {
      await apiPost("/api/hosts", { hosts });
      setSaved(true);
      setTimeout(() => { setSaved(false); onSaved?.(); onClose(); }, 1000);
    } catch (e) {
      alert("Failed to save: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, width: "min(540px,95vw)", maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>Manage Hosts</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{hosts.length} host{hosts.length !== 1 ? "s" : ""} in inventory</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><Icon d={Icons.close} size={20} /></button>
        </div>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={newHost} onChange={e => setNewHost(e.target.value)} onKeyDown={e => e.key === "Enter" && addHost()}
              placeholder="192.168.1.10 or hostname.domain.com"
              style={{ flex: 1, padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
            <button onClick={addHost} style={{ padding: "9px 16px", background: "#0f172a", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
              <Icon d={Icons.plus} size={14} color="#fff" /> Add
            </button>
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>Press Enter or click Add. Accepts IPs or hostnames.</div>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "8px 0" }}>
          {hosts.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No hosts yet — add one above</div>
          ) : hosts.map((h, i) => (
            <div key={i} style={{ padding: "10px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f8fafc", background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981" }} />
                <span style={{ fontSize: 13, fontFamily: "monospace", color: "#334155" }}>{h}</span>
              </div>
              <button onClick={() => removeHost(h)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4 }}
                onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}>
                <Icon d={Icons.close} size={14} />
              </button>
            </div>
          ))}
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>Changes update the Ansible inventory file</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{ padding: "9px 16px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 13, fontFamily: "inherit", color: "#475569" }}>Cancel</button>
            <button onClick={save} disabled={saving || !hosts.length} style={{ padding: "9px 20px", border: "none", borderRadius: 8, background: saved ? "#10b981" : "#3b82f6", color: "#fff", cursor: !hosts.length ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", minWidth: 90, opacity: !hosts.length ? 0.5 : 1 }}>
              {saved ? "✓ Saved!" : saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
