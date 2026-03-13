import { useState, useEffect } from "react";

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>{label}</label>
      {hint && <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>{hint}</div>}
      {children}
    </div>
  );
}

export function SettingsTab() {
  const [form, setForm] = useState({
    smtp_host: "", smtp_port: 587, smtp_user: "", smtp_password: "",
    smtp_from: "", tls_enabled: true, recipients: [],
  });
  const [newRecipient, setNewRecipient] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [testing, setTesting] = useState(false);
  const [toast, setToast]     = useState(null);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    fetch("/api/notifications/settings")
      .then(r => r.json())
      .then(d => { setForm(d); setLoading(false); })
      .catch(() => setLoading(false));
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

  const removeRecipient = (email) =>
    setForm(f => ({ ...f, recipients: f.recipients.filter(r => r !== email) }));

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
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 24, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
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
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 24, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
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
        <button onClick={sendTest} disabled={testing || !form.smtp_host} style={{ padding: "10px 20px", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: form.smtp_host ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: form.smtp_host ? 1 : 0.5 }}>
          {testing ? "Sending..." : "Send Test Email"}
        </button>
        <button onClick={save} disabled={saving} style={{ padding: "10px 20px", background: "#0f172a", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
