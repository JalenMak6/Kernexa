import { useState, useEffect } from "react";
import { Icon, Icons } from "../utils/icons.jsx";
import { apiFetch, apiPost } from "../utils/api";

export function CredentialsForm({ inventoryId, inventoryName, onClose }) {
  const [username, setUsername]         = useState("");
  const [password, setPassword]         = useState("");
  const [showPass, setShowPass]         = useState(false);
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [existingUser, setExistingUser] = useState(null);
  const [loadingCreds, setLoadingCreds] = useState(true);

  useEffect(() => {
    setLoadingCreds(true);
    apiFetch(`/api/credentials/${inventoryId}`)
      .then(d => {
        if (d.has_credentials) setExistingUser(d.username);
      })
      .catch(() => {})
      .finally(() => setLoadingCreds(false));
  }, [inventoryId]);

  const save = async () => {
    if (!username.trim() || !password.trim()) return;
    setSaving(true);
    try {
      await apiPost("/api/credentials", {
        inventory_id: inventoryId,
        username: username.trim(),
        password: password,
      });
      setSaved(true);
      setExistingUser(username.trim());
      setTimeout(() => setSaved(false), 2000);
      setUsername(""); setPassword("");
    } catch (e) {
      alert("Failed to save credentials: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center"
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 16, width: "min(460px,95vw)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden"
      }} onClick={e => e.stopPropagation()}>

        {/* header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "#0f172a" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon d={Icons.key} size={16} color="#93c5fd" />
              <span style={{ fontWeight: 800, fontSize: 15, color: "#f8fafc" }}>SSH Credentials</span>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{inventoryName}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#475569" }}>
            <Icon d={Icons.close} size={18} />
          </button>
        </div>

        {/* existing creds notice */}
        {!loadingCreds && existingUser && (
          <div style={{ margin: "16px 24px 0", padding: "10px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon d={Icons.check} size={14} color="#16a34a" />
            <span style={{ fontSize: 12, color: "#15803d" }}>
              Credentials set for <strong>{existingUser}</strong>. Enter new values below to update.
            </span>
          </div>
        )}

        {/* form */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              SSH Username
            </label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder={existingUser ? `Current: ${existingUser}` : "e.g. ansible, ubuntu, root"}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              SSH Password <span style={{ color: "#94a3b8", fontWeight: 400 }}>(also used for sudo/become)</span>
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && save()}
                placeholder="••••••••"
                style={{ width: "100%", padding: "9px 40px 9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
              />
              <button
                onClick={() => setShowPass(s => !s)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}
              >
                <Icon d={showPass ? Icons.eyeOff : Icons.eye} size={15} />
              </button>
            </div>
          </div>

          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 12px", display: "flex", gap: 8 }}>
            <Icon d={Icons.lock} size={13} color="#d97706" />
            <span style={{ fontSize: 11, color: "#92400e", lineHeight: 1.5 }}>
              Credentials are stored in the database and used by Ansible for SSH and sudo access. They are never returned to the UI after saving.
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
              fontSize: 13, fontWeight: 700, fontFamily: "inherit", minWidth: 110,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6
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
