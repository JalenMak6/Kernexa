import React, { useState, useEffect } from "react";
import { apiFetch, apiPost } from "./../utils/api";
import { WindowsCredentialsForm } from "./WindowsCredentialsForm.jsx";

function Field({ label, hint, children }) {
  return (
    <div className="mb-5">
      <label className="block text-base font-bold text-text-secondary mb-1.5">{label}</label>
      {hint && <div className="text-sm text-text-ghost mb-1.5">{hint}</div>}
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
    <div className="max-w-[720px] mx-auto">
      <div className="flex bg-bg-subtle rounded-xl p-1 gap-0.5 mb-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 px-3 py-[9px] rounded-[9px] border-none text-md font-[inherit] cursor-pointer transition-all duration-150
              ${tab === t.id ? "bg-bg-card text-text-primary font-bold shadow-sm" : "bg-transparent text-text-ghost font-medium"}`}
          >{t.label}</button>
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
    <div className="bg-bg-card border border-border-base rounded-2xl p-6 shadow-card">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="font-bold text-xl text-text-primary">Windows WinRM Credentials</div>
          <div className="text-md text-text-ghost mt-[3px]">Used by the Windows patch compliance scanner to connect to hosts via WinRM</div>
        </div>
        <button onClick={() => onShowWinCreds && onShowWinCreds()}
          className={`px-4 py-2 rounded-base border-none text-md font-semibold cursor-pointer font-[inherit] whitespace-nowrap shrink-0 ml-4
            ${winCredsExist ? "bg-bg-subtle text-text-secondary" : "bg-bg-sidebar text-bg-card"}`}>
          🔑 {winCredsExist ? "Update Credentials" : "Set Credentials"}
        </button>
      </div>
      <div className={`px-[14px] py-3 rounded-base border flex items-center gap-2
        ${winCredsExist ? "bg-green-tint border-green-border" : "bg-orange-tint border-orange-border"}`}>
        <div className={`w-2 h-2 rounded-full shrink-0 ${winCredsExist ? "bg-green-bright" : "bg-amber"}`} />
        <span className={`text-md ${winCredsExist ? "text-green-dark" : "text-orange-text"}`}>
          {winCredsExist
            ? <>Credentials configured for <strong>{winCredsUser}</strong> — Windows scan ready</>
            : "No WinRM credentials set — click Set Credentials to enable Windows scanning"}
        </span>
      </div>
      <div className="mt-5 px-4 py-[14px] rounded-base border border-[#1e293b]" style={{ background: "#0f172a" }}>
        <div className="text-xs text-slate-400 font-bold mb-2.5 uppercase tracking-[0.06em]">WinRM Setup — run in elevated PowerShell on each Windows host</div>
        <pre className="text-sm text-sky-300 leading-[1.8] font-mono m-0 whitespace-pre-wrap">{[
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

const inputCls = "w-full px-3 py-[9px] border border-border-base rounded-base text-md font-[inherit] outline-none bg-bg-card text-text-primary box-border";

function NotificationSettings() {
  const [form, setForm] = useState({
    smtp_host: "", smtp_port: 587, smtp_user: "", smtp_password: "",
    smtp_from: "", tls_enabled: true, recipients: [],
  });
  const [newRecipient, setNewRecipient] = useState("");
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [testing,      setTesting]      = useState(false);
  const [toast,        setToast]        = useState(null);

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

  if (loading) return (
    <div className="flex items-center justify-center h-[300px]">
      <div className="w-7 h-7 border-[3px] border-border-base border-t-blue rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-[680px] mx-auto">
      {toast && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-md font-semibold border
          ${toast.ok ? "bg-green-tint border-green-border text-green-dark" : "bg-red-tint border-red-border text-red-dark"}`}>
          {toast.ok ? "✓" : "✗"} {toast.msg}
        </div>
      )}

      {/* ── SMTP Configuration ── */}
      <div className="bg-bg-card border border-border-base rounded-2xl p-6 mb-4 shadow-card">
        <div className="font-bold text-xl text-text-primary mb-1">SMTP Configuration</div>
        <div className="text-base text-text-ghost mb-5">Configure the mail server used to send scan reports</div>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="SMTP Host">
            <input className={inputCls} value={form.smtp_host} onChange={e => setForm(f => ({ ...f, smtp_host: e.target.value }))} placeholder="smtp.gmail.com" />
          </Field>
          <Field label="Port">
            <input className={`${inputCls} w-[90px]`} type="number" value={form.smtp_port} onChange={e => setForm(f => ({ ...f, smtp_port: parseInt(e.target.value) || 587 }))} />
          </Field>
        </div>

        <Field label="Username" hint="Leave blank if your relay doesn't require authentication">
          <input className={inputCls} value={form.smtp_user} onChange={e => setForm(f => ({ ...f, smtp_user: e.target.value }))} placeholder="you@gmail.com" />
        </Field>
        <Field label="Password">
          <input className={inputCls} type="password" value={form.smtp_password} onChange={e => setForm(f => ({ ...f, smtp_password: e.target.value }))} placeholder="App password or SMTP password" />
        </Field>
        <Field label="From Address" hint="Displayed as the sender — defaults to username if blank">
          <input className={inputCls} value={form.smtp_from} onChange={e => setForm(f => ({ ...f, smtp_from: e.target.value }))} placeholder="kermonix@yourdomain.com" />
        </Field>

        <div className="flex items-center gap-2.5">
          <div onClick={() => setForm(f => ({ ...f, tls_enabled: !f.tls_enabled }))}
            className="w-9 h-5 rounded-pill cursor-pointer relative transition-colors duration-200 shrink-0"
            style={{ background: form.tls_enabled ? "var(--indigo)" : "var(--border-muted)" }}>
            <div className="absolute top-[2px] w-4 h-4 rounded-full bg-bg-card transition-all duration-200"
              style={{ left: form.tls_enabled ? 18 : 2, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
          </div>
          <span className="text-md text-text-secondary font-medium">Use STARTTLS (recommended — port 587)</span>
        </div>
      </div>

      {/* ── Recipients ── */}
      <div className="bg-bg-card border border-border-base rounded-2xl p-6 mb-4 shadow-card">
        <div className="font-bold text-xl text-text-primary mb-1">Recipients</div>
        <div className="text-base text-text-ghost mb-5">Scan reports will be sent to all addresses below after every scan completes</div>

        <div className="flex gap-2 mb-3">
          <input className={`${inputCls} flex-1`} value={newRecipient}
            onChange={e => setNewRecipient(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addRecipient(); }}
            placeholder="email@example.com" />
          <button onClick={addRecipient}
            className="px-4 py-[9px] bg-bg-sidebar text-bg-card border-none rounded-base text-md font-semibold cursor-pointer font-[inherit] whitespace-nowrap">
            Add
          </button>
        </div>

        {form.recipients.length === 0 ? (
          <div className="text-center py-5 text-text-ghost text-md border border-dashed border-border-base rounded-base">
            No recipients added yet
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {form.recipients.map(email => (
              <div key={email} className="flex justify-between items-center px-3 py-2 bg-bg-hover border border-border-base rounded-base">
                <span className="text-md text-text-secondary font-mono">{email}</span>
                <button onClick={() => removeRecipient(email)}
                  className="bg-transparent border-none cursor-pointer text-text-ghost text-base leading-none px-1 hover:text-red-dark transition-colors">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-2.5 justify-end">
        <button onClick={sendTest} disabled={testing || !form.smtp_host}
          className={`px-5 py-[10px] border border-border-base bg-bg-hover text-text-muted-c rounded-base text-md font-semibold font-[inherit] transition-opacity
            ${form.smtp_host ? "cursor-pointer opacity-100" : "cursor-not-allowed opacity-50"}`}>
          {testing ? "Sending..." : "Send Test Email"}
        </button>
        <button onClick={save} disabled={saving}
          className="px-5 py-[10px] bg-bg-sidebar text-bg-card border-none rounded-base text-md font-semibold cursor-pointer font-[inherit]">
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

// ── LDAP Components ───────────────────────────────────────────────────────────

function LdapSection({ title, children }) {
  return (
    <div>
      <div className="text-md font-bold text-text-primary mb-3.5 pb-2 border-b border-bg-subtle">
        {title}
      </div>
      {children}
    </div>
  );
}

function LdapToggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <div onClick={onChange}
        className="w-[38px] h-[22px] rounded-pill relative cursor-pointer shrink-0 transition-colors duration-200"
        style={{ background: checked ? "var(--indigo)" : "var(--border-muted)" }}>
        <div className="absolute top-[3px] w-4 h-4 rounded-full bg-bg-card transition-all duration-200"
          style={{ left: checked ? 19 : 3, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
      </div>
      <span className="text-md text-text-secondary">{label}</span>
    </label>
  );
}

// ── LDAP / Active Directory Settings ─────────────────────────────────────────

const ldapInputCls = "w-full px-3 py-[9px] border border-border-base rounded-base text-md outline-none font-[inherit] bg-bg-card text-text-primary box-border";

function LdapSettings() {
  const [cfg, setCfg] = useState({
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
        enabled:       !!result.enabled,
        use_ssl:       !!result.use_ssl,
        use_starttls:  !!result.use_starttls,
        tls_verify:    result.tls_verify !== false,
        bind_password: result.has_password ? "••••••••" : "",
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

  const inp = (field, type = "text", placeholder = "") => (
    <input type={type} value={cfg[field] ?? ""}
      onChange={e => set(field, type === "number" ? (parseInt(e.target.value) || 389) : e.target.value)}
      placeholder={placeholder}
      className={ldapInputCls}
    />
  );

  const lbl = (text) => (
    <label className="block text-xs font-bold text-text-muted-c uppercase tracking-[0.06em] mb-[5px]">{text}</label>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-[200px]">
      <div className="w-7 h-7 border-[3px] border-border-base border-t-indigo rounded-full animate-spin" />
    </div>
  );
  if (loadError) return null;

  return (
    <div>
      {/* Header with enable toggle */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="text-xl font-bold text-text-primary">Active Directory / LDAP</div>
          <div className="text-md text-text-ghost mt-[3px]">
            Allow AD users to log in with their domain credentials. Saved to database — takes effect immediately.
          </div>
        </div>
        <LdapToggle checked={cfg.enabled} onChange={() => tog("enabled")} label={cfg.enabled ? "Enabled" : "Disabled"} />
      </div>

      <div className="bg-bg-card border border-border-base rounded-2xl p-6 flex flex-col gap-6 transition-opacity duration-200"
        style={{ opacity: cfg.enabled ? 1 : 0.55, pointerEvents: cfg.enabled ? "auto" : "none" }}>

        {/* Connection */}
        <LdapSection title="Connection">
          <div className="grid grid-cols-[1fr_120px] gap-3 mb-3.5">
            <div>{lbl("LDAP Host")}{inp("host", "text", "192.168.1.76 or dc.example.com")}</div>
            <div>{lbl("Port")}{inp("port", "number", "389")}</div>
          </div>
          <div className="flex gap-7 flex-wrap">
            <LdapToggle checked={cfg.use_ssl}      onChange={() => tog("use_ssl")}      label="Use LDAPS (SSL, port 636)" />
            <LdapToggle checked={cfg.use_starttls} onChange={() => tog("use_starttls")} label="Use StartTLS (port 389)" />
            <LdapToggle checked={cfg.tls_verify}   onChange={() => tog("tls_verify")}   label="Verify TLS Certificate" />
          </div>
        </LdapSection>

        {/* CA Certificate */}
        <LdapSection title="CA Certificate (optional)">
          <div className="text-sm text-text-ghost mb-3">
            Upload your AD root CA certificate (.pem / .cer) to enable LDAPS with certificate verification.
            Leave empty and disable "Verify TLS Certificate" for self-signed certs.
          </div>
          <div className="flex gap-3 items-center">
            <label className="px-4 py-[7px] border border-border-base rounded-base bg-bg-subtle cursor-pointer text-sm text-text-secondary font-[inherit] font-semibold inline-flex items-center gap-1.5">
              📄 Upload .pem / .cer
              <input type="file" accept=".pem,.cer,.crt" onChange={handleCertUpload} className="hidden" />
            </label>
            {cfg.ca_cert ? (
              <div className="text-sm text-green-bright flex items-center gap-1.5">
                ✓ Certificate loaded ({(cfg.ca_cert.length / 1024).toFixed(1)} KB)
                <button onClick={() => set("ca_cert", "")}
                  className="bg-transparent border-none cursor-pointer text-red text-base p-0">×</button>
              </div>
            ) : (
              <span className="text-sm text-text-ghost">No certificate uploaded</span>
            )}
          </div>
        </LdapSection>

        {/* Service Account */}
        <LdapSection title="Service Account">
          <div className="grid grid-cols-2 gap-3">
            <div>{lbl("Bind DN")}{inp("bind_dn", "text", "CN=svc-kermonix,OU=ServiceAccounts,DC=corp,DC=com")}</div>
            <div>{lbl("Bind Password (blank = keep existing)")}{inp("bind_password", "password", "••••••••")}</div>
          </div>
        </LdapSection>

        {/* Directory */}
        <LdapSection title="Directory Search">
          <div className="grid grid-cols-2 gap-3">
            <div>{lbl("Base DN")}{inp("base_dn", "text", "DC=corp,DC=com")}</div>
            <div>{lbl("Username Attribute")}{inp("user_attr", "text", "sAMAccountName")}</div>
          </div>
        </LdapSection>

        {/* Group → Role Mapping */}
        <LdapSection title="Group → Role Mapping">
          <div className="text-sm text-text-ghost mb-3.5">
            Users get the <strong>highest</strong> matching role: Admin &gt; Operator &gt; Reader.
            Leave blank to disable that role from AD login.
          </div>
          <div className="flex flex-col gap-2.5">
            {[
              { field: "admin_group",    label: "Admin Group DN",    dotCls: "bg-amber",
                placeholder: "CN=kermonix-admins-role,OU=role-group,DC=corp,DC=com" },
              { field: "operator_group", label: "Operator Group DN", dotCls: "bg-purple",
                placeholder: "CN=kermonix-operators-role,OU=role-group,DC=corp,DC=com" },
              { field: "reader_group",   label: "Reader Group DN",   dotCls: "bg-green-bright",
                placeholder: "CN=kermonix-readers-role,OU=role-group,DC=corp,DC=com" },
            ].map(({ field, label, dotCls, placeholder }) => (
              <div key={field} className="grid grid-cols-[160px_1fr] items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${dotCls}`} />
                  <span className="text-sm font-bold text-text-secondary">{label}</span>
                </div>
                {inp(field, "text", placeholder)}
              </div>
            ))}
          </div>
        </LdapSection>

        {/* Test result */}
        {testResult && (
          <div className={`border rounded-lg px-4 py-[14px]
            ${testResult.success ? "bg-green-tint border-green-border" : "bg-red-tint border-red-border"}`}>
            <div className={`text-md font-bold mb-1 ${testResult.success ? "text-green-dark" : "text-red-dark"}`}>
              {testResult.success ? "✓ Connection successful" : "✗ Connection failed"}
            </div>
            <div className={`text-sm ${testResult.success ? "text-green-dark" : "text-red-dark"}`}>
              {testResult.message}
            </div>
            {testResult.config && (
              <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1">
                {Object.entries(testResult.config).map(([k, v]) => (
                  <span key={k} className="text-xs text-text-muted-c">
                    <strong>{k}:</strong> {String(v)}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-tint border border-red-border rounded-base px-[14px] py-2.5 text-red-dark text-md">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2.5 justify-end pt-1">
          <button onClick={handleTest} disabled={testing}
            className={`px-5 py-[9px] border border-border-base rounded-base bg-bg-subtle text-md text-text-secondary font-[inherit] font-semibold transition-opacity
              ${testing ? "opacity-50 cursor-not-allowed" : "cursor-pointer opacity-100"}`}>
            {testing ? "Testing..." : "🔌 Test Connection"}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-[9px] border-none rounded-base text-white text-md font-bold font-[inherit] transition-colors duration-200"
            style={{ background: saved ? "linear-gradient(135deg,#22c55e,#16a34a)" : "linear-gradient(135deg,#6366f1,#8b5cf6)", cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Saving..." : saved ? "✓ Saved" : "Save LDAP Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
