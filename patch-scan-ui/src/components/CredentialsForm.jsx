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
      .then(d => { if (d.has_credentials) setExistingUser(d.username); })
      .catch(() => {})
      .finally(() => setLoadingCreds(false));
  }, [inventoryId]);

  const save = async () => {
    if (!username.trim() || !password.trim()) return;
    setSaving(true);
    try {
      await apiPost("/api/credentials", { inventory_id: inventoryId, username: username.trim(), password });
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

  const canSave = username.trim() && password.trim();

  return (
    <div className="fixed inset-0 bg-[var(--backdrop)] z-[200] flex items-center justify-center" onClick={onClose}>
      <div className="bg-bg-card border border-border-base rounded-3xl w-[min(460px,95vw)] shadow-modal overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-5 border-b border-border-subtle flex justify-between items-start bg-bg-sidebar">
          <div>
            <div className="flex items-center gap-2">
              <Icon d={Icons.key} size={16} color="#93c5fd" />
              <span className="font-extrabold text-lg text-[#f8fafc]">SSH Credentials</span>
            </div>
            <div className="text-sm text-slate-400 mt-0.5">{inventoryName}</div>
          </div>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-slate-400 hover:text-slate-200 transition-colors">
            <Icon d={Icons.close} size={18} />
          </button>
        </div>

        {/* Existing creds notice */}
        {!loadingCreds && existingUser && (
          <div className="mx-6 mt-4 px-3.5 py-2.5 bg-green-tint border border-green-border rounded-base flex items-center gap-2">
            <Icon d={Icons.check} size={14} color="#16a34a" />
            <span className="text-sm text-green-deeper">
              Credentials set for <strong>{existingUser}</strong>. Enter new values below to update.
            </span>
          </div>
        )}

        {/* Form */}
        <div className="px-6 py-5 flex flex-col gap-3.5">
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-1.5">SSH Username</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder={existingUser ? `Current: ${existingUser}` : "e.g. ansible, ubuntu, root"}
              className="w-full px-3 py-2 border border-border-base rounded-base text-md outline-none font-[inherit] bg-bg-card text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-1.5">
              SSH Password <span className="text-text-ghost font-normal">(also used for sudo/become)</span>
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && save()}
                placeholder="••••••••"
                className="w-full pr-10 pl-3 py-2 border border-border-base rounded-base text-md outline-none font-[inherit] bg-bg-card text-text-primary"
              />
              <button
                onClick={() => setShowPass(s => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-text-ghost p-0.5"
              >
                <Icon d={showPass ? Icons.eyeOff : Icons.eye} size={15} />
              </button>
            </div>
          </div>

          <div className="bg-amber-tint border border-yellow-border rounded-base px-3 py-2.5 flex gap-2">
            <Icon d={Icons.lock} size={13} color="#d97706" />
            <span className="text-xs text-orange-text leading-relaxed">
              Credentials are stored in the database and used by Ansible for SSH and sudo access. They are never returned to the UI after saving.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-subtle flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border-base rounded-base bg-bg-card cursor-pointer text-md font-[inherit] text-text-muted-c"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !canSave}
            className={`px-5 py-2 border-none rounded-base text-md font-bold font-[inherit] min-w-[110px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors
              ${saved ? "bg-green text-white" : canSave ? "bg-bg-sidebar text-white" : "bg-bg-subtle text-text-ghost cursor-not-allowed"}`}
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
