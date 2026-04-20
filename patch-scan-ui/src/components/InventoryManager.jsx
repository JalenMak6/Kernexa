import { useState, useEffect, useCallback } from "react";
import { Icon, Icons } from "../utils/icons.jsx";
import { apiFetch, apiPost, apiDelete, apiUpload } from "../utils/api";
import { fmtDate, badge } from "../utils/helpers.jsx";
import { CredentialsForm } from "./CredentialsForm";
import { WindowsCredentialsForm } from "./WindowsCredentialsForm";

export function InventoryManager({ onClose, onActivated }) {
  const [inventories,   setInventories]   = useState([]);
  const [invName,       setInvName]       = useState("");
  const [invType,       setInvType]       = useState("linux");
  const [file,          setFile]          = useState(null);
  const [uploading,     setUploading]     = useState(false);
  const [activating,    setActivating]    = useState(null);
  const [dragOver,      setDragOver]      = useState(false);
  const [credFormFor,   setCredFormFor]   = useState(null);
  const [showWinCreds,  setShowWinCreds]  = useState(false);
  const [winCredsReady, setWinCredsReady] = useState(false);

  const load = useCallback(() => {
    apiFetch("/api/inventories").then(setInventories).catch(() => {});
    apiFetch("/api/windows/credentials").then(d => setWinCredsReady(d.has_credentials || false)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, []);

  const isWindowsInventory = (inv) =>
    inv.inventory_type === "windows" || /win(dows|rm)?/i.test(inv.name);

  const upload = async () => {
    if (!file || !invName.trim()) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file); form.append("name", invName.trim()); form.append("inventory_type", invType);
      await apiUpload("/api/inventories/upload", form);
      setFile(null); setInvName(""); setInvType("linux"); load();
    } catch (e) { alert("Upload failed: " + e.message); }
    finally { setUploading(false); }
  };

  const activate = async (id) => {
    setActivating(id);
    try { await apiPost(`/api/inventories/${id}/activate`); load(); onActivated?.(); }
    catch (e) { alert("Failed to activate: " + e.message); }
    finally { setActivating(null); }
  };

  const remove = async (id, isActive) => {
    if (isActive) { alert("Cannot delete the active inventory. Activate another one first."); return; }
    if (!confirm("Delete this inventory?")) return;
    try { await apiDelete(`/api/inventories/${id}`); load(); }
    catch (e) { alert("Failed to delete: " + e.message); }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  const canUpload = file && invName.trim();

  return (
    <>
      <div className="fixed inset-0 bg-[var(--backdrop)] z-[100] flex items-center justify-center" onClick={onClose}>
        <div className="bg-bg-card border border-border-base rounded-3xl w-[min(680px,95vw)] max-h-[88vh] flex flex-col shadow-modal" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="px-6 py-5 border-b border-border-subtle flex justify-between items-start">
            <div>
              <div className="font-extrabold text-xl text-text-primary">Inventory Files</div>
              <div className="text-sm text-text-faint mt-0.5">
                Upload Ansible inventory files — activate one, then set its credentials.
                Linux and Windows inventories can both be active simultaneously.
              </div>
            </div>
            <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-text-ghost">
              <Icon d={Icons.close} size={20} />
            </button>
          </div>

          {/* Upload form */}
          <div className="px-6 py-4 border-b border-border-subtle flex flex-col gap-2.5">
            {/* Type toggle */}
            <div className="flex bg-bg-subtle rounded-base p-0.5 gap-0.5 self-start">
              {[
                { value: "linux",   label: "🐧 Linux / SSH" },
                { value: "windows", label: "🪟 Windows / WinRM" },
              ].map(opt => (
                <button key={opt.value} onClick={() => setInvType(opt.value)}
                  className={`px-3.5 py-1.5 rounded-md border-none text-sm font-[inherit] cursor-pointer whitespace-nowrap transition-all duration-150
                    ${invType === opt.value ? "bg-bg-card text-text-primary font-bold shadow-sm" : "bg-transparent text-text-ghost font-medium"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {invType === "windows" && (
              <div className={`px-3.5 py-2.5 rounded-base flex items-center justify-between gap-2 border
                ${winCredsReady ? "bg-green-tint border-green-border" : "bg-orange-tint border-orange-border"}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${winCredsReady ? "bg-green" : "bg-amber"}`} />
                  <span className={`text-sm ${winCredsReady ? "text-green-deeper" : "text-orange-text"}`}>
                    {winCredsReady
                      ? "WinRM credentials are configured — this inventory will use them automatically."
                      : "WinRM credentials are not set yet. Configure them before scanning."}
                  </span>
                </div>
                {!winCredsReady && (
                  <button onClick={() => setShowWinCreds(true)}
                    className="px-3 py-1 border-none rounded-md bg-amber text-bg-card text-xs font-bold cursor-pointer font-[inherit] whitespace-nowrap">
                    Set WinRM Creds
                  </button>
                )}
              </div>
            )}

            <input value={invName} onChange={e => setInvName(e.target.value)}
              placeholder={invType === "windows" ? "Inventory name (e.g. Windows Servers)" : "Inventory name (e.g. Production Servers)"}
              className="px-3 py-2 border border-border-base rounded-base text-md outline-none font-[inherit] bg-bg-card text-text-primary"
            />

            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("inv-file-input").click()}
              className={`border-2 border-dashed rounded-lg p-5 text-center transition-all duration-200 cursor-pointer
                ${dragOver ? "border-blue bg-blue-tint" : "border-border-muted bg-bg-hover"}`}
            >
              <Icon d={Icons.upload} size={24} color={dragOver ? "var(--blue)" : "var(--text-ghost)"} />
              <div className="mt-2 text-md text-text-faint font-medium">
                {file
                  ? <span className="text-blue font-semibold">📄 {file.name}</span>
                  : <>Drag & drop your inventory file, or <span className="text-blue underline">browse</span></>
                }
              </div>
              <div className="text-xs text-text-ghost mt-1">Accepts .txt or .ini Ansible inventory files</div>
              <input id="inv-file-input" type="file" accept=".txt,.ini" onChange={e => setFile(e.target.files[0])} className="hidden" />
            </div>

            <button onClick={upload} disabled={!canUpload || uploading}
              className={`py-2.5 border-none rounded-base text-md font-bold font-[inherit] flex items-center justify-center gap-2 transition-colors
                ${canUpload ? "bg-bg-sidebar text-bg-card cursor-pointer" : "bg-bg-subtle text-text-ghost cursor-not-allowed"}`}
            >
              <Icon d={Icons.upload} size={14} color={canUpload ? "var(--bg-card)" : "var(--text-ghost)"} />
              {uploading ? "Uploading..." : "Upload Inventory"}
            </button>
          </div>

          {/* Inventory list */}
          <div className="overflow-y-auto flex-1">
            {inventories.length === 0 ? (
              <div className="px-8 py-10 text-center">
                <Icon d={Icons.file} size={36} color="var(--border)" />
                <div className="mt-3 text-base font-semibold text-text-secondary">No inventories uploaded yet</div>
                <div className="text-sm text-text-ghost mt-1">Upload your first inventory file above</div>
              </div>
            ) : inventories.map((inv, i) => {
              const isWin   = isWindowsInventory(inv);
              const credsOk = isWin ? winCredsReady : inv.has_credentials;
              return (
                <div key={inv.id} className={`px-6 py-3.5 flex items-center justify-between border-b border-border-subtle
                  ${inv.is_active ? "bg-green-tint" : i % 2 === 0 ? "bg-bg-card" : "bg-bg-hover"}`}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-9 h-9 rounded-base shrink-0 flex items-center justify-center text-base
                      ${inv.is_active ? "bg-green-tint-mid" : "bg-bg-subtle"}`}>
                      {isWin ? "🪟" : <Icon d={Icons.file} size={16} color={inv.is_active ? "var(--green-dark)" : "var(--text-faint)"} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-md text-text-primary">{inv.name}</span>
                        {inv.is_active && badge("Active", "green")}
                        {credsOk
                          ? badge(isWin ? "WinRM set" : "Credentials set", "blue")
                          : <span className="inline-flex items-center gap-1 bg-orange-tint text-orange-dark border border-orange-border px-2 py-0.5 rounded-pill text-xs font-bold">
                              <Icon d={Icons.warning} size={10} color="var(--orange-dark)" /> {isWin ? "No WinRM creds" : "No credentials"}
                            </span>
                        }
                      </div>
                      <div className="text-xs text-text-ghost mt-0.5">
                        {inv.host_count} host{inv.host_count !== 1 ? "s" : ""} · uploaded {fmtDate(inv.uploaded_at)}
                        {isWin && <span className="ml-1.5 text-cyan font-semibold">· Windows / WinRM</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1 shrink-0 ml-3">
                    <button
                      onClick={() => isWin ? setShowWinCreds(true) : setCredFormFor({ id: inv.id, name: inv.name })}
                      className={`px-3 py-1.5 rounded-md text-sm font-semibold font-[inherit] flex items-center gap-1 cursor-pointer border transition-colors
                        ${credsOk ? "border-border-base bg-bg-hover text-text-muted-c" : "border-orange-border-lt bg-orange-tint text-orange-dark"}`}
                    >
                      <Icon d={Icons.key} size={12} color={credsOk ? "var(--text-muted)" : "var(--orange-dark)"} />
                      {credsOk ? (isWin ? "Edit WinRM" : "Edit Creds") : (isWin ? "Set WinRM" : "Set Creds")}
                    </button>

                    {!inv.is_active && (
                      <button onClick={() => activate(inv.id)} disabled={activating === inv.id}
                        className="px-3.5 py-1.5 border border-blue-border rounded-md bg-blue-tint text-blue-dark text-sm font-semibold font-[inherit] cursor-pointer">
                        {activating === inv.id ? "..." : "Use This"}
                      </button>
                    )}

                    <button onClick={() => remove(inv.id, inv.is_active)}
                      className={`px-2 py-1.5 border rounded-md bg-bg-card cursor-pointer
                        ${inv.is_active ? "border-red-tint-mid text-red-border-lt" : "border-red-tint-mid text-red"}`}
                      title={inv.is_active ? "Cannot delete active inventory" : "Delete"}>
                      <Icon d={Icons.close} size={13} color={inv.is_active ? "var(--red-border-lt)" : "var(--red)"} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer note */}
          <div className="px-6 py-3 border-t border-border-subtle flex items-center gap-2">
            <Icon d={Icons.warning} size={13} color="var(--text-ghost)" />
            <span className="text-xs text-text-ghost">
              Linux and Windows inventories can both be active at the same time.
              Windows inventories use the global WinRM credentials set in Settings.
            </span>
          </div>
        </div>
      </div>

      {credFormFor && (
        <CredentialsForm inventoryId={credFormFor.id} inventoryName={credFormFor.name} onClose={() => { setCredFormFor(null); load(); }} />
      )}
      {showWinCreds && (
        <WindowsCredentialsForm onClose={() => { setShowWinCreds(false); load(); }} />
      )}
    </>
  );
}
