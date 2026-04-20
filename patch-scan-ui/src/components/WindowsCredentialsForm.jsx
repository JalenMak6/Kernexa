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
        username: username.trim(), password,
        domain: domain.trim(), port: parseInt(port) || 5986, transport,
      });
      setSaved(true);
      setExisting({ username: username.trim(), domain: domain.trim() });
      setUsername(""); setPassword(""); setDomain("");
      setTimeout(() => { setSaved(false); onClose(); }, 1500);
    } catch (e) {
      alert("Failed to save Windows credentials: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const canSave = username.trim() && password.trim();
  const inputCls = "w-full px-3 py-2 border border-border-base rounded-base text-md outline-none font-[inherit] bg-bg-card text-text-primary";
  const labelCls = "block text-sm font-semibold text-text-secondary mb-1.5";

  return (
    <div className="fixed inset-0 bg-[var(--backdrop)] z-[200] flex items-center justify-center" onClick={onClose}>
      <div className="bg-bg-card border border-border-base rounded-3xl w-[min(500px,95vw)] shadow-modal overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-5 border-b border-border-subtle flex justify-between items-start bg-bg-sidebar">
          <div>
            <div className="flex items-center gap-2">
              <Icon d={Icons.key} size={16} color="#93c5fd" />
              <span className="font-extrabold text-lg text-[#f8fafc]">Windows WinRM Credentials</span>
            </div>
            <div className="text-sm text-slate-400 mt-0.5">Used for Windows patch compliance scanning</div>
          </div>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-slate-400 hover:text-slate-200 transition-colors">
            <Icon d={Icons.close} size={18} />
          </button>
        </div>

        {/* Existing creds notice */}
        {!loading && existing && (
          <div className="mx-6 mt-4 px-3.5 py-2.5 bg-green-tint border border-green-border rounded-base flex items-center gap-2">
            <Icon d={Icons.check} size={14} color="#16a34a" />
            <span className="text-sm text-green-deeper">
              Credentials set for <strong>{existing.domain ? `${existing.domain}\\${existing.username}` : existing.username}</strong>. Enter new values below to update.
            </span>
          </div>
        )}

        {/* Form */}
        <div className="px-6 py-5 flex flex-col gap-3.5">
          {/* Username + domain */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Username</label>
              <input value={username} onChange={e => setUsername(e.target.value)}
                placeholder={existing ? existing.username : "administrator/Domain Account"}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Domain <span className="text-text-ghost font-normal">(optional)</span></label>
              <input value={domain} onChange={e => setDomain(e.target.value)}
                placeholder={existing?.domain || "EAD.ABC.CA"}
                className={inputCls} />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className={labelCls}>Password</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && save()}
                placeholder="••••••••"
                className={`${inputCls} pr-10`}
              />
              <button
                onClick={() => setShowPass(s => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-text-ghost p-0.5"
              >
                <Icon d={showPass ? Icons.eyeOff : Icons.eye} size={15} />
              </button>
            </div>
          </div>

          {/* Port + transport */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>WinRM Port</label>
              <select value={port} onChange={e => setPort(e.target.value)} className={`${inputCls} cursor-pointer`}>
                <option value="5985">5985 — HTTP</option>
                <option value="5986">5986 — HTTPS</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Auth Transport</label>
              <select value={transport} onChange={e => setTransport(e.target.value)} className={`${inputCls} cursor-pointer`}>
                <option value="ntlm">NTLM (recommended)</option>
                <option value="kerberos">Kerberos</option>
                <option value="basic">Basic</option>
              </select>
            </div>
          </div>

          {transport === "kerberos" && (
            <div className="bg-amber-tint border border-yellow-border rounded-base px-3 py-2 text-xs text-orange-text leading-relaxed">
              ⚠️ Kerberos requires a valid <code>kinit</code> ticket on the control node before scanning.
            </div>
          )}
          {transport === "basic" && (
            <div className="bg-red-tint border border-red-border rounded-base px-3 py-2 text-xs text-red-text leading-relaxed">
              ⚠️ Basic auth sends credentials in plaintext. Only use over HTTPS (port 5986).
            </div>
          )}

          <div className="bg-amber-tint border border-yellow-border rounded-base px-3 py-2.5 flex gap-2">
            <Icon d={Icons.lock} size={13} color="#d97706" />
            <span className="text-xs text-orange-text leading-relaxed">
              Credentials are stored encrypted in the database and used by Ansible for WinRM access. They are never returned to the UI after saving.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-subtle flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-border-base rounded-base bg-bg-card cursor-pointer text-md font-[inherit] text-text-muted-c">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !canSave}
            className={`px-5 py-2 border-none rounded-base text-md font-bold font-[inherit] min-w-[130px] flex items-center justify-center gap-1.5 transition-colors
              ${saved ? "bg-green text-white cursor-pointer" : canSave ? "bg-bg-sidebar text-white cursor-pointer" : "bg-bg-subtle text-text-ghost cursor-not-allowed"}`}
          >
            {saved ? (
              <><Icon d={Icons.check} size={13} color="#fff" /> Saved!</>
            ) : saving ? "Saving..." : (
              <><Icon d={Icons.key} size={13} color={canSave ? "#fff" : "var(--text-ghost)"} /> Save Credentials</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
