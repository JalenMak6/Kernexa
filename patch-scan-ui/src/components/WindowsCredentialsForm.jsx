import { useState, useEffect } from "react";
import { Icon, Icons } from "../utils/icons.jsx";
import { apiFetch, apiPost } from "../utils/api";

export function WindowsCredentialsForm({ onClose }) {
  const [username, setUsername]   = useState("");
  const [password, setPassword]   = useState("");
  const [domain,   setDomain]     = useState("");
  const [port,     setPort]       = useState("5986");
  const [transport,setTransport]  = useState("ntlm");
  const [showPass, setShowPass]   = useState(false);
  const [saving,   setSaving]     = useState(false);
  const [saved,    setSaved]      = useState(false);
  const [existing, setExisting]   = useState(null);
  const [loading,  setLoading]    = useState(true);

  useEffect(() => {
    apiFetch("/api/windows/credentials")
      .then(d => { if (d.has_credentials) setExisting(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!username.trim() || !password.trim()) return;
    setSaving(true);
    try {
      await apiPost("/api/windows/credentials", {
        username:  username.trim(),
        password,
        domain:    domain.trim(),
        port:      parseInt(port) || 5986,
        transport,
      });
      setSaved(true);
      setExisting({ username: username.trim(), domain: domain.trim() });
      setUsername(""); setPassword(""); setDomain("");
      // Auto-close after showing success for 1.5 seconds
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 1500);
    } catch (e) {
      alert("Failed to save Windows credentials: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "9px 12px",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    fontSize: 13,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    background: "#ffffff",
    color: "#0f172a",
    appearance: "none",
    WebkitAppearance: "none",
  };

  const selectStyle = {
    ...inputStyle,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
    paddingRight: 32,
    cursor: "pointer",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center"
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 16, width: "min(500px,95vw)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden"
      }} onClick={e => e.stopPropagation()}>

        {/* header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "#0f172a" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon d={Icons.key} size={16} color="#93c5fd" />
              <span style={{ fontWeight: 800, fontSize: 15, color: "#f8fafc" }}>Windows WinRM Credentials</span>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>Used for Windows patch compliance scanning</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#475569" }}>
            <Icon d={Icons.close} size={18} />
          </button>
        </div>

        {/* existing creds notice */}
        {!loading && existing && (
          <div style={{ margin: "16px 24px 0", padding: "10px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon d={Icons.check} size={14} color="#16a34a" />
            <span style={{ fontSize: 12, color: "#15803d" }}>
              Credentials set for <strong>{existing.domain ? `${existing.domain}\\${existing.username}` : existing.username}</strong>. Enter new values below to update.
            </span>
          </div>
        )}

        {/* form */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* username + domain side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Username
              </label>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder={existing ? existing.username : "jmak05.adm"}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Domain <span style={{ color: "#94a3b8", fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder={existing?.domain || "EAD.UBC.CA"}
                style={inputStyle}
              />
            </div>
          </div>

          {/* password */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && save()}
                placeholder="••••••••"
                style={{ ...inputStyle, padding: "9px 40px 9px 12px" }}
              />
              <button
                onClick={() => setShowPass(s => !s)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}
              >
                <Icon d={showPass ? Icons.eyeOff : Icons.eye} size={15} />
              </button>
            </div>
          </div>

          {/* port + transport side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                WinRM Port
              </label>
              <select value={port} onChange={e => setPort(e.target.value)} style={selectStyle}>
                <option value="5985">5985 — HTTP</option>
                <option value="5986">5986 — HTTPS</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Auth Transport
              </label>
              <select value={transport} onChange={e => setTransport(e.target.value)} style={selectStyle}>
                <option value="ntlm">NTLM (recommended)</option>
                <option value="kerberos">Kerberos</option>
                <option value="basic">Basic</option>
              </select>
            </div>
          </div>

          {/* transport hint */}
          {transport === "kerberos" && (
            <div style={{ background: "#fff7ed", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#92400e", lineHeight: 1.5 }}>
              ⚠️ Kerberos requires a valid <code>kinit</code> ticket on the control node before scanning.
            </div>
          )}
          {transport === "basic" && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#991b1b", lineHeight: 1.5 }}>
              ⚠️ Basic auth sends credentials in plaintext. Only use over HTTPS (port 5986).
            </div>
          )}

          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 12px", display: "flex", gap: 8 }}>
            <Icon d={Icons.lock} size={13} color="#d97706" />
            <span style={{ fontSize: 11, color: "#92400e", lineHeight: 1.5 }}>
              Credentials are stored encrypted in the database and used by Ansible for WinRM access. They are never returned to the UI after saving.
            </span>
          </div>
        </div>

        {/* footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ padding: "9px 16px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 13, fontFamily: "inherit", color: "#475569" }}>
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !username.trim() || !password.trim()}
            style={{
              padding: "9px 20px", border: "none", borderRadius: 8,
              background: saved ? "#10b981" : (!username.trim() || !password.trim()) ? "#e2e8f0" : "#0f172a",
              color: saved ? "#fff" : (!username.trim() || !password.trim()) ? "#94a3b8" : "#fff",
              cursor: (!username.trim() || !password.trim()) ? "not-allowed" : "pointer",
              fontSize: 13, fontWeight: 700, fontFamily: "inherit", minWidth: 130,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            {saved ? (
              <><Icon d={Icons.check} size={13} color="#fff" /> Saved!</>
            ) : saving ? "Saving..." : (
              <><Icon d={Icons.key} size={13} color={(!username.trim() || !password.trim()) ? "#94a3b8" : "#fff"} /> Save Credentials</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}