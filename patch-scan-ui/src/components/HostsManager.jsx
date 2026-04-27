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
    <div className="fixed inset-0 bg-[var(--backdrop)] z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="bg-bg-card border border-border-base rounded-3xl w-[min(540px,95vw)] max-h-[80vh] flex flex-col shadow-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-5 border-b border-border-subtle flex justify-between items-start">
          <div>
            <div className="font-extrabold text-xl text-text-primary">Manage Hosts</div>
            <div className="text-sm text-text-faint mt-0.5">{hosts.length} host{hosts.length !== 1 ? "s" : ""} in inventory</div>
          </div>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-text-ghost">
            <Icon d={Icons.close} size={20} />
          </button>
        </div>

        {/* Add input */}
        <div className="px-6 py-4 border-b border-border-subtle">
          <div className="flex gap-2">
            <input
              value={newHost} onChange={e => setNewHost(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addHost()}
              placeholder="192.168.1.10 or hostname.domain.com"
              className="flex-1 px-3 py-2 border border-border-base rounded-base text-md outline-none font-[inherit] bg-bg-card text-text-primary"
            />
            <button onClick={addHost} className="px-4 py-2 bg-bg-sidebar text-white border-none rounded-base cursor-pointer text-md font-bold font-[inherit] flex items-center gap-1.5">
              <Icon d={Icons.plus} size={14} color="#fff" /> Add
            </button>
          </div>
          <div className="text-xs text-text-ghost mt-1.5">Press Enter or click Add. Accepts IPs or hostnames.</div>
        </div>

        {/* Host list */}
        <div className="overflow-y-auto flex-1 py-2">
          {hosts.length === 0 ? (
            <div className="px-6 py-8 text-center text-text-ghost text-md">No hosts yet — add one above</div>
          ) : hosts.map((h, i) => (
            <div key={i} className={`px-6 py-2.5 flex justify-between items-center border-b border-border-subtle ${i % 2 === 0 ? "bg-bg-card" : "bg-bg-row"}`}>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green shrink-0" />
                <span className="text-md mono text-text-secondary">{h}</span>
              </div>
              <button
                onClick={() => removeHost(h)}
                className="bg-transparent border-none cursor-pointer text-text-ghost p-1 transition-colors hover:text-red"
              >
                <Icon d={Icons.close} size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-subtle flex justify-between items-center">
          <span className="text-sm text-text-ghost">Changes update the Ansible inventory file</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-border-base rounded-base bg-bg-card cursor-pointer text-md font-[inherit] text-text-muted-c">Cancel</button>
            <button
              onClick={save} disabled={saving || !hosts.length}
              className={`px-5 py-2 border-none rounded-base text-md font-bold font-[inherit] min-w-[90px] transition-colors
                ${saved ? "bg-green" : "bg-blue"} text-white ${!hosts.length ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              {saved ? "✓ Saved!" : saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
