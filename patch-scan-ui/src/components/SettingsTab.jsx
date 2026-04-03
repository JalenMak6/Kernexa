import React, { useState, useEffect } from "react";
import { apiFetch, apiPost } from "./../utils/api";
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

const SettingsTabInner = React.memo(function SettingsTab({ onWinCredsSaved, onShowWinCreds }) {
  const [tab, setTab] = useState("winrm");
  const tabs = [
    { id: "winrm", label: "🔑 WinRM Credentials" },
    { id: "email", label: "✉️ Email Notifications" },
    { id: "ldap",  label: "🔒 Active Directory / LDAP" },
  ];
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 12, padding: 4, gap: 2, marginBottom: 24 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "9px 12px", borderRadius: 9, border: "none",
            background: tab === t.id ? "#fff" : "transparent",
            color: tab === t.id ? "#0f172a" : "#64748b",
            fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
            cursor: "pointer", fontFamily: "inherit",
            boxShadow: tab === t.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            transition: "all 0.15s",
          }}>{t.label}</button>
        ))}
      </div>
      {tab === "winrm" && <WinRMSettings onWinCredsSaved={onWinCredsSaved} onShowWinCreds={onShowWinCreds} />}
      {tab === "email" && <NotificationSettings />}
      {tab === "ldap"  && <LdapSettings />}
    </div>
  );
});

export const SettingsTab = SettingsTabInner;

// ── WinRM Credentials Tab ──────────────────────────────────────────────────────

function WinRMSettings({ onWinCredsSaved, onShowWinCreds }) {
  const [winCredsExist, setWinCredsExist] = useState(false);
  const [winCredsUser,  setWinCredsUser]  = useState(null);

  useEffect(() => {
    apiFetch("/api/windows/credentials")
      .then(d => { setWinCredsExist(d.has_credentials || false); setWinCredsUser(d.username || null); })
      .catch(() => {});
  }, []);

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a" }}>Windows WinRM Credentials</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>Used by the Windows patch compliance scanner to connect to hosts via WinRM</div>
        </div>
        <button onClick={() => onShowWinCreds && onShowWinCreds()}
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: winCredsExist ? "#f1f5f9" : "#0f172a", color: winCredsExist ? "#475569" : "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0, marginLeft: 16 }}>
          🔑 {winCredsExist ? "Update Credentials" : "Set Credentials"}
        </button>
      </div>
      <div style={{ padding: "12px 14px", borderRadius: 8, border: `1px solid ${winCredsExist ? "#bbf7d0" : "#fed7aa"}`, background: winCredsExist ? "#f0fdf4" : "#fff7ed", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: winCredsExist ? "#22c55e" : "#f59e0b", flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: winCredsExist ? "#166534" : "#92400e" }}>
          {winCredsExist ? <>Credentials configured for <strong>{winCredsUser}</strong> — Windows scan ready</> : "No WinRM credentials set — click Set Credentials to enable Windows scanning"}
        </span>
      </div>
      <div style={{ marginTop: 20, padding: "14px 16px", borderRadius: 8, background: "#0f172a", border: "1px solid #1e293b" }}>
        <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>WinRM Setup — run in elevated PowerShell on each Windows host</div>
        <pre style={{ fontSize: 12, color: "#7dd3fc", lineHeight: 1.8, fontFamily: "monospace", margin: 0, whiteSpace: "pre-wrap" }}>{[
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
  );
}

// ── Email Notifications Tab ───────────────────────────────────────────────────

function NotificationSettings() {
  const [form, setForm] = useState({
    smtp_host: "", smtp_port: 587, smtp_user: "", smtp_password: "",
    smtp_from: "", tls_enabled: true, recipients: [],
  });
  const [newRecipient,  setNewRecipient]  = useState("");
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [testing,       setTesting]       = useState(false);
  const [toast,         setToast]         = useState(null);
  
  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    apiFetch("/api/notifications/settings")
      .then(d => {
        setForm({
          smtp_host:     d.smtp_host     ?? "",
          smtp_port:     d.smtp_port     ?? 587,
          smtp_user:     d.smtp_user     ?? "",
          smtp_password: d.smtp_password ?? "",
          smtp_from:     d.smtp_from     ?? "",
          tls_enabled:   d.tls_enabled   ?? true,
          recipients:    Array.isArray(d.recipients) ? d.recipients : [],
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await apiPost("/api/notifications/settings", form);
      showToast("Settings saved successfully");
    } catch (e) { showToast("Failed to save: " + e.message, false); }
    setSaving(false);
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const data = await apiPost("/api/notifications/test", {});
      showToast(data.message || "Test email sent");
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


// ── LDAP Components Extracted for Stability ───────────────────────────────────

function LdapSection({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14, paddingBottom: 8, borderBottom: "1px solid #f1f5f9" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function LdapToggle({ checked, onChange, label }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
      <div onClick={onChange}
        style={{ width: 38, height: 22, borderRadius: 11, background: checked ? "#6366f1" : "#e2e8f0", position: "relative", transition: "background 0.2s", cursor: "pointer", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: 3, left: checked ? 19 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
      </div>
      <span style={{ fontSize: 13, color: "#475569" }}>{label}</span>
    </label>
  );
}

// ── LDAP / Active Directory Settings ─────────────────────────────────────────

function LdapSettings() {
  const [cfg, setCfg]           = useState({
    enabled: false, host: "", port: 389, use_ssl: false, use_starttls: false,
    tls_verify: true, bind_dn: "", bind_password: "", base_dn: "",
    user_attr: "sAMAccountName", admin_group: "", operator_group: "",
    reader_group: "", ca_cert: "",
  });
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [testing,    setTesting]    = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saved,      setSaved]      = useState(false);
  const [error,      setError]      = useState(null);
  const [loadError,  setLoadError]  = useState(false);

  useEffect(() => {
    apiFetch("/api/ldap/settings")
      .then(d => {
        setCfg({
          enabled:        !!d.enabled,
          host:           d.host           || "",
          port:           d.port           || 389,
          use_ssl:        !!d.use_ssl,
          use_starttls:   !!d.use_starttls,
          tls_verify:     d.tls_verify !== false,
          bind_dn:        d.bind_dn        || "",
          bind_password:  d.has_password ? "••••••••" : "",
          base_dn:        d.base_dn        || "",
          user_attr:      d.user_attr      || "sAMAccountName",
          admin_group:    d.admin_group    || "",
          operator_group: d.operator_group || "",
          reader_group:   d.reader_group   || "",
          ca_cert:        d.ca_cert        || "",
        });
        setLoading(false);
      })
      .catch(e => {
        if (e.message?.includes("403")) setLoadError(true);
        setLoading(false);
      });
  }, []);

  const set = (field, value) => setCfg(c => ({ ...c, [field]: value }));
  const tog = (field) => setCfg(c => ({ ...c, [field]: !c[field] }));

  const handleCertUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => set("ca_cert", ev.target.result);
    reader.readAsText(file);
  };

  // Build payload — treat "••••••••" as "keep existing" sentinel
  const getPayload = () => ({
    ...cfg,
    bind_password: cfg.bind_password === "••••••••" ? "" : cfg.bind_password,
  });

  const handleSave = async () => {
    setSaving(true); setError(null); setSaved(false);
    try {
      const result = await apiPost("/api/ldap/settings", getPayload());
      setCfg(prev => ({
        ...prev,
        enabled:        !!result.enabled,
        use_ssl:        !!result.use_ssl,
        use_starttls:   !!result.use_starttls,
        tls_verify:     result.tls_verify !== false,
        bind_password:  result.has_password ? "••••••••" : "",
      }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true); setTestResult(null); setError(null);
    try {
      const result = await apiPost("/api/ldap/test", getPayload());
      setTestResult(result);
    } catch (e) { setError(e.message); }
    finally { setTesting(false); }
  };

  // Safe as functions because they are invoked directly `{inp(...)}`
  // and not used as React components `<inp />`
  const inp = (field, type = "text", placeholder = "") => (
    <input
      type={type}
      value={cfg[field] ?? ""}
      onChange={e => set(field, type === "number" ? (parseInt(e.target.value) || 389) : e.target.value)}
      placeholder={placeholder}
      style={{ width: "100%", padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8,
               fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box", background: "#fff" }}
    />
  );

  const lbl = (text) => (
    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b",
                    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
      {text}
    </label>
  );

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
      <div style={{ width: 28, height: 28, border: "3px solid #e2e8f0", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    </div>
  );
  if (loadError) return null;

  return (
    <div>
      {/* Header with enable toggle */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Active Directory / LDAP</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>
            Allow AD users to log in with their domain credentials. Saved to database — takes effect immediately.
          </div>
        </div>
        <LdapToggle checked={cfg.enabled} onChange={() => tog("enabled")} label={cfg.enabled ? "Enabled" : "Disabled"} />
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24,
                    display: "flex", flexDirection: "column", gap: 24,
                    opacity: cfg.enabled ? 1 : 0.55,
                    pointerEvents: cfg.enabled ? "auto" : "none",
                    transition: "opacity 0.2s" }}>

        {/* Connection */}
        <LdapSection title="Connection">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12, marginBottom: 14 }}>
            <div>{lbl("LDAP Host")}{inp("host", "text", "ldap://192.168.1.76")}</div>
            <div>{lbl("Port")}{inp("port", "number", "389")}</div>
          </div>
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
            <LdapToggle checked={cfg.use_ssl}      onChange={() => tog("use_ssl")}      label="Use LDAPS (SSL, port 636)" />
            <LdapToggle checked={cfg.use_starttls} onChange={() => tog("use_starttls")} label="Use StartTLS (port 389)" />
            <LdapToggle checked={cfg.tls_verify}   onChange={() => tog("tls_verify")}   label="Verify TLS Certificate" />
          </div>
        </LdapSection>

        {/* CA Certificate */}
        <LdapSection title="CA Certificate (optional)">
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
            Upload your AD root CA certificate (.pem / .cer) to enable LDAPS with certificate verification.
            Leave empty and disable "Verify TLS Certificate" for self-signed certs.
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label style={{ padding: "7px 16px", border: "1px solid #e2e8f0", borderRadius: 8,
                            background: "#f8fafc", cursor: "pointer", fontSize: 12, color: "#475569",
                            fontFamily: "inherit", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
              📄 Upload .pem / .cer
              <input type="file" accept=".pem,.cer,.crt" onChange={handleCertUpload} style={{ display: "none" }} />
            </label>
            {cfg.ca_cert ? (
              <div style={{ fontSize: 12, color: "#22c55e", display: "flex", alignItems: "center", gap: 6 }}>
                ✓ Certificate loaded ({(cfg.ca_cert.length / 1024).toFixed(1)} KB)
                <button onClick={() => set("ca_cert", "")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 14, padding: 0 }}>×</button>
              </div>
            ) : (
              <span style={{ fontSize: 12, color: "#94a3b8" }}>No certificate uploaded</span>
            )}
          </div>
        </LdapSection>

        {/* Service Account */}
        <LdapSection title="Service Account">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>{lbl("Bind DN")}{inp("bind_dn", "text", "CN=svc-kernexa,OU=ServiceAccounts,DC=corp,DC=com")}</div>
            <div>{lbl("Bind Password (blank = keep existing)")}{inp("bind_password", "password", "••••••••")}</div>
          </div>
        </LdapSection>

        {/* Directory */}
        <LdapSection title="Directory Search">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>{lbl("Base DN")}{inp("base_dn", "text", "DC=corp,DC=com")}</div>
            <div>{lbl("Username Attribute")}{inp("user_attr", "text", "sAMAccountName")}</div>
          </div>
        </LdapSection>

        {/* Group → Role Mapping */}
        <LdapSection title="Group → Role Mapping">
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>
            Users get the <strong>highest</strong> matching role: Admin &gt; Operator &gt; Reader.
            Leave blank to disable that role from AD login.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { field: "admin_group",    label: "Admin Group DN",    color: "#f59e0b",
                placeholder: "CN=kernexa-admins-role,OU=role-group,DC=corp,DC=com" },
              { field: "operator_group", label: "Operator Group DN", color: "#8b5cf6",
                placeholder: "CN=kernexa-operators-role,OU=role-group,DC=corp,DC=com" },
              { field: "reader_group",   label: "Reader Group DN",   color: "#22c55e",
                placeholder: "CN=kernexa-readers-role,OU=role-group,DC=corp,DC=com" },
            ].map(({ field, label, color, placeholder }) => (
              <div key={field} style={{ display: "grid", gridTemplateColumns: "160px 1fr", alignItems: "center", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>{label}</span>
                </div>
                {inp(field, "text", placeholder)}
              </div>
            ))}
          </div>
        </LdapSection>

        {/* Test result */}
        {testResult && (
          <div style={{ background: testResult.success ? "#f0fdf4" : "#fef2f2",
                        border: `1px solid ${testResult.success ? "#bbf7d0" : "#fecaca"}`,
                        borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 13, fontWeight: 700,
                          color: testResult.success ? "#166534" : "#dc2626", marginBottom: 4 }}>
              {testResult.success ? "✓ Connection successful" : "✗ Connection failed"}
            </div>
            <div style={{ fontSize: 12, color: testResult.success ? "#166534" : "#dc2626" }}>
              {testResult.message}
            </div>
            {testResult.config && (
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: "4px 20px" }}>
                {Object.entries(testResult.config).map(([k, v]) => (
                  <span key={k} style={{ fontSize: 11, color: "#64748b" }}>
                    <strong>{k}:</strong> {String(v)}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca",
                        borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
          <button onClick={handleTest} disabled={testing}
            style={{ padding: "9px 20px", border: "1px solid #e2e8f0", borderRadius: 8,
                     background: "#f8fafc", cursor: testing ? "not-allowed" : "pointer",
                     fontSize: 13, color: "#475569", fontFamily: "inherit", fontWeight: 600,
                     opacity: testing ? 0.5 : 1 }}>
            {testing ? "Testing..." : "🔌 Test Connection"}
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: "9px 20px", border: "none", borderRadius: 8,
                     background: saved ? "linear-gradient(135deg,#22c55e,#16a34a)" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                     color: "#fff", cursor: saving ? "not-allowed" : "pointer",
                     fontSize: 13, fontWeight: 700, fontFamily: "inherit", transition: "background 0.2s" }}>
            {saving ? "Saving..." : saved ? "✓ Saved" : "Save LDAP Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}