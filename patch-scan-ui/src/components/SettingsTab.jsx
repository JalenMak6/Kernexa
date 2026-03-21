import { useState, useEffect } from "react";
import { WindowsCredentialsForm } from "./WindowsCredentialsForm.jsx";

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: "var(--space-5)" }}>
      <label style={{ display: "block", fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6 }}>{label}</label>
      {hint && <div style={{ fontSize: "var(--text-sm)", color: "var(--text-ghost)", marginBottom: 6 }}>{hint}</div>}
      {children}
    </div>
  );
}

export function SettingsTab({ onWinCredsSaved, onShowWinCreds }) {
  const [form, setForm] = useState({
    smtp_host: "", smtp_port: 587, smtp_user: "", smtp_password: "",
    smtp_from: "", tls_enabled: true, recipients: [],
  });
  const [newRecipient,  setNewRecipient]  = useState("");
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [testing,       setTesting]       = useState(false);
  const [toast,         setToast]         = useState(null);
  const [winCredsExist, setWinCredsExist] = useState(false);
  const [winCredsUser,  setWinCredsUser]  = useState(null);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    fetch("/api/notifications/settings")
      .then(r => r.json())
      .then(d => { setForm(d); setLoading(false); })
      .catch(() => setLoading(false));
    fetch("/api/windows/credentials")
      .then(r => r.json())
      .then(d => { setWinCredsExist(d.has_credentials || false); setWinCredsUser(d.username || null); })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/notifications/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      showToast("Settings saved successfully");
    } catch (e) { showToast("Failed to save: " + e.message, false); }
    setSaving(false);
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const res  = await fetch("/api/notifications/test", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      showToast(data.message);
    } catch (e) { showToast("Test failed: " + e.message, false); }
    setTesting(false);
  };

  const addRecipient = () => {
    const email = newRecipient.trim().toLowerCase();
    if (!email || !email.includes("@") || form.recipients.includes(email)) return;
    setForm(f => ({ ...f, recipients: [...f.recipients, email] }));
    setNewRecipient("");
  };

  const removeRecipient = (email) =>
    setForm(f => ({ ...f, recipients: f.recipients.filter(r => r !== email) }));

  const inputStyle = {
    width: "100%", padding: "9px 12px",
    border: "1px solid var(--border)", borderRadius: "var(--radius-base)",
    fontSize: "var(--text-md)", fontFamily: "inherit", outline: "none",
    boxSizing: "border-box", background: "var(--bg-card)", color: "var(--text-primary)",
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
        <div style={{ width: 28, height: 28, border: "3px solid var(--border)", borderTopColor: "var(--blue)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>

      {toast && (
        <div style={{
          marginBottom: "var(--space-4)", padding: "12px 16px", borderRadius: "var(--radius-lg)",
          fontSize: "var(--text-md)", fontWeight: 600,
          background: toast.ok ? "var(--green-tint)"  : "var(--red-tint)",
          color:      toast.ok ? "var(--green-dark)"  : "var(--red-dark)",
          border: `1px solid ${toast.ok ? "var(--green-border)" : "var(--red-border)"}`,
        }}>
          {toast.ok ? "✓" : "✗"} {toast.msg}
        </div>
      )}

      {/* ── Windows WinRM Credentials ── */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-2xl)", padding: "var(--space-6)", marginBottom: "var(--space-4)", boxShadow: "var(--shadow-card)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "var(--text-xl)", color: "var(--text-primary)" }}>Windows WinRM Credentials</div>
            <div style={{ fontSize: "var(--text-base)", color: "var(--text-ghost)", marginTop: 2 }}>
              Used by the Windows patch compliance scanner to connect to hosts via WinRM
            </div>
          </div>
          <button
            onClick={() => onShowWinCreds ? onShowWinCreds() : null}
            style={{
              padding: "8px 16px", borderRadius: "var(--radius-base)", border: "none",
              background: winCredsExist ? "var(--bg-subtle)" : "var(--bg-sidebar)",
              color:      winCredsExist ? "var(--text-muted)" : "var(--bg-card)",
              fontSize: "var(--text-md)", fontWeight: 600, cursor: "pointer",
              fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
              whiteSpace: "nowrap", flexShrink: 0, marginLeft: "var(--space-4)",
            }}
          >
            {"🔑 " + (winCredsExist ? "Update Credentials" : "Set Credentials")}
          </button>
        </div>

        <div style={{
          marginTop: "var(--space-4)", padding: "12px 14px", borderRadius: "var(--radius-base)",
          border: `1px solid ${winCredsExist ? "var(--green-border)" : "var(--orange-border)"}`,
          background: winCredsExist ? "var(--green-tint)" : "var(--orange-tint)",
          display: "flex", alignItems: "center", gap: "var(--space-2)",
        }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: winCredsExist ? "var(--green)" : "var(--amber)", flexShrink: 0 }} />
          {winCredsExist ? (
            <span style={{ fontSize: "var(--text-md)", color: "var(--green-deeper)" }}>
              Credentials configured for <strong>{winCredsUser}</strong> — Windows scan is ready
            </span>
          ) : (
            <span style={{ fontSize: "var(--text-md)", color: "var(--orange-text)" }}>
              No Windows credentials set — click <strong>Set Credentials</strong> to enable Windows scanning
            </span>
          )}
        </div>

        <div style={{ marginTop: "var(--space-3)", padding: "12px 14px", borderRadius: "var(--radius-base)", background: "var(--bg-sidebar)", border: "1px solid var(--border-dark)" }}>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-faint)", fontWeight: 600, marginBottom: "var(--space-2)", fontFamily: "inherit" }}>WinRM Setup (run in elevated PowerShell on each Windows host):</div>
          <pre style={{ fontSize: "var(--text-sm)", color: "var(--text-ghost)", lineHeight: 1.9, fontFamily: "monospace", margin: 0, whiteSpace: "pre-wrap" }}>{[
            "# Enable WinRM",
            "winrm quickconfig -q",
            "",
            "# Create self-signed cert",
            "$cert = New-SelfSignedCertificate `",
            "    -DnsName $env:COMPUTERNAME `",
            '    -CertStoreLocation "cert:\\LocalMachine\\My" `',
            "    -NotAfter (Get-Date).AddYears(5)",
            "",
            "# Create HTTPS listener",
            "New-WSManInstance -ResourceURI winrm/config/Listener `",
            '    -SelectorSet @{Address="*"; Transport="HTTPS"} `',
            "    -ValueSet @{Hostname=$env:COMPUTERNAME; CertificateThumbprint=$cert.Thumbprint}",
            "",
            "# Open firewall",
            'netsh advfirewall firewall add rule name="WinRM HTTPS" protocol=TCP dir=in localport=5986 action=allow',
          ].join("\n")}</pre>
        </div>
      </div>

      {/* ── SMTP Configuration ── */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-2xl)", padding: "var(--space-6)", marginBottom: "var(--space-4)", boxShadow: "var(--shadow-card)" }}>
        <div style={{ fontWeight: 700, fontSize: "var(--text-xl)", color: "var(--text-primary)", marginBottom: 4 }}>SMTP Configuration</div>
        <div style={{ fontSize: "var(--text-base)", color: "var(--text-ghost)", marginBottom: "var(--space-5)" }}>Configure the mail server used to send scan reports</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "var(--space-3)" }}>
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
          <div
            onClick={() => setForm(f => ({ ...f, tls_enabled: !f.tls_enabled }))}
            style={{ width: 36, height: 20, borderRadius: "var(--radius-pill)", background: form.tls_enabled ? "var(--indigo)" : "var(--border-muted)", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
          >
            <div style={{ position: "absolute", top: 2, left: form.tls_enabled ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "var(--bg-card)", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
          </div>
          <span style={{ fontSize: "var(--text-md)", color: "var(--text-secondary)", fontWeight: 500 }}>Use STARTTLS (recommended — port 587)</span>
        </div>
      </div>

      {/* ── Recipients ── */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-2xl)", padding: "var(--space-6)", marginBottom: "var(--space-4)", boxShadow: "var(--shadow-card)" }}>
        <div style={{ fontWeight: 700, fontSize: "var(--text-xl)", color: "var(--text-primary)", marginBottom: 4 }}>Recipients</div>
        <div style={{ fontSize: "var(--text-base)", color: "var(--text-ghost)", marginBottom: "var(--space-5)" }}>Scan reports will be sent to all addresses below after every scan completes</div>

        <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={newRecipient}
            onChange={e => setNewRecipient(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addRecipient(); }}
            placeholder="email@example.com"
          />
          <button onClick={addRecipient} style={{ padding: "9px 16px", background: "var(--bg-sidebar)", color: "var(--bg-card)", border: "none", borderRadius: "var(--radius-base)", fontSize: "var(--text-md)", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            Add
          </button>
        </div>

        {form.recipients.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-ghost)", fontSize: "var(--text-md)", border: "1px dashed var(--border)", borderRadius: "var(--radius-base)" }}>
            No recipients added yet
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            {form.recipients.map(email => (
              <div key={email} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--bg-hover)", border: "1px solid var(--border)", borderRadius: "var(--radius-base)" }}>
                <span style={{ fontSize: "var(--text-md)", color: "var(--text-secondary)", fontFamily: "monospace" }}>{email}</span>
                <button
                  onClick={() => removeRecipient(email)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)", fontSize: 16, lineHeight: 1, padding: "0 4px" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "var(--red-dark)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "var(--text-ghost)"; }}
                >×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button
          onClick={sendTest} disabled={testing || !form.smtp_host}
          style={{ padding: "10px 20px", border: "1px solid var(--border)", background: "var(--bg-hover)", color: "var(--text-muted)", borderRadius: "var(--radius-base)", fontSize: "var(--text-md)", fontWeight: 600, cursor: form.smtp_host ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: form.smtp_host ? 1 : 0.5 }}
        >
          {testing ? "Sending..." : "Send Test Email"}
        </button>
        <button
          onClick={save} disabled={saving}
          style={{ padding: "10px 20px", background: "var(--bg-sidebar)", color: "var(--bg-card)", border: "none", borderRadius: "var(--radius-base)", fontSize: "var(--text-md)", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}