import { useState, useEffect, useCallback } from "react";
import { Icon, Icons } from "../utils/icons.jsx";
import { apiFetch, apiPost, apiDelete, apiUpload, API_BASE } from "../utils/api";
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
      form.append("file", file);
      form.append("name", invName.trim());
      form.append("inventory_type", invType);
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

  const TypeToggle = () => (
    <div style={{ display: "flex", background: "var(--bg-subtle)", borderRadius: "var(--radius-base)", padding: 3, gap: 2, alignSelf: "flex-start" }}>
      {[
        { value: "linux",   label: "🐧 Linux / SSH"    },
        { value: "windows", label: "🪟 Windows / WinRM" },
      ].map(opt => (
        <button key={opt.value} onClick={() => setInvType(opt.value)} style={{
          padding: "6px 14px", borderRadius: "var(--radius-md)", border: "none",
          background: invType === opt.value ? "var(--bg-card)" : "transparent",
          color:      invType === opt.value ? "var(--text-primary)" : "var(--text-ghost)",
          fontSize: "var(--text-base)", fontWeight: invType === opt.value ? 700 : 500,
          cursor: "pointer", fontFamily: "inherit",
          boxShadow: invType === opt.value ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
          transition: "all 0.15s", whiteSpace: "nowrap",
        }}>
          {opt.label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "var(--backdrop)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
        <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius-3xl)", width: "min(680px,95vw)", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "var(--shadow-modal)" }} onClick={e => e.stopPropagation()}>

          {/* header */}
          <div style={{ padding: "var(--space-5) var(--space-6)", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: "var(--text-2xl)", color: "var(--text-primary)" }}>Inventory Files</div>
              <div style={{ fontSize: "var(--text-base)", color: "var(--text-faint)", marginTop: 2 }}>
                Upload Ansible inventory files — activate one, then set its credentials.
                Linux and Windows inventories can both be active simultaneously.
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}>
              <Icon d={Icons.close} size={20} />
            </button>
          </div>

          {/* upload form */}
          <div style={{ padding: "var(--space-4) var(--space-6)", borderBottom: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 10 }}>
            <TypeToggle />

            {invType === "windows" && (
              <div style={{
                padding: "10px 14px",
                background: winCredsReady ? "var(--green-tint)" : "var(--orange-tint)",
                border: `1px solid ${winCredsReady ? "var(--green-border)" : "var(--orange-border)"}`,
                borderRadius: "var(--radius-base)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: winCredsReady ? "var(--green)" : "var(--amber)", flexShrink: 0 }} />
                  <span style={{ fontSize: "var(--text-base)", color: winCredsReady ? "var(--green-deeper)" : "var(--orange-text)" }}>
                    {winCredsReady
                      ? "WinRM credentials are configured — this inventory will use them automatically."
                      : "WinRM credentials are not set yet. Configure them before scanning."}
                  </span>
                </div>
                {!winCredsReady && (
                  <button onClick={() => setShowWinCreds(true)} style={{ padding: "5px 12px", border: "none", borderRadius: "var(--radius-md)", background: "var(--amber)", color: "var(--bg-card)", fontSize: "var(--text-sm)", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                    Set WinRM Creds
                  </button>
                )}
              </div>
            )}

            <input value={invName} onChange={e => setInvName(e.target.value)}
              placeholder={invType === "windows" ? "Inventory name (e.g. Windows Servers)" : "Inventory name (e.g. Production Servers)"}
              style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-base)", fontSize: "var(--text-md)", outline: "none", fontFamily: "inherit" }}
            />

            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("inv-file-input").click()}
              style={{
                border: `2px dashed ${dragOver ? "var(--blue)" : "var(--border-muted)"}`,
                borderRadius: "var(--radius-lg)", padding: "var(--space-5)", textAlign: "center",
                background: dragOver ? "var(--blue-tint)" : "var(--bg-hover)",
                transition: "all 0.2s", cursor: "pointer",
              }}
            >
              <Icon d={Icons.upload} size={24} color={dragOver ? "var(--blue)" : "var(--text-ghost)"} />
              <div style={{ marginTop: "var(--space-2)", fontSize: "var(--text-md)", color: "var(--text-faint)", fontWeight: 500 }}>
                {file
                  ? <span style={{ color: "var(--blue)", fontWeight: 600 }}>📄 {file.name}</span>
                  : <>Drag & drop your inventory file, or <span style={{ color: "var(--blue)", textDecoration: "underline" }}>browse</span></>
                }
              </div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--text-ghost)", marginTop: 4 }}>Accepts .txt or .ini Ansible inventory files</div>
              <input id="inv-file-input" type="file" accept=".txt,.ini" onChange={e => setFile(e.target.files[0])} style={{ display: "none" }} />
            </div>

            <button onClick={upload} disabled={!file || !invName.trim() || uploading} style={{
              padding: 10, border: "none", borderRadius: "var(--radius-base)",
              background: !file || !invName.trim() ? "var(--bg-subtle)" : "var(--bg-sidebar)",
              color:      !file || !invName.trim() ? "var(--text-ghost)" : "var(--bg-card)",
              cursor: !file || !invName.trim() ? "not-allowed" : "pointer",
              fontSize: "var(--text-md)", fontWeight: 700, fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)",
            }}>
              <Icon d={Icons.upload} size={14} color={!file || !invName.trim() ? "var(--text-ghost)" : "var(--bg-card)"} />
              {uploading ? "Uploading..." : "Upload Inventory"}
            </button>
          </div>

          {/* inventory list */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {inventories.length === 0 ? (
              <div style={{ padding: "40px 32px", textAlign: "center" }}>
                <Icon d={Icons.file} size={36} color="var(--border)" />
                <div style={{ marginTop: "var(--space-3)", fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-secondary)" }}>No inventories uploaded yet</div>
                <div style={{ fontSize: "var(--text-base)", color: "var(--text-ghost)", marginTop: 4 }}>Upload your first inventory file above</div>
              </div>
            ) : inventories.map((inv, i) => {
              const isWin   = isWindowsInventory(inv);
              const credsOk = isWin ? winCredsReady : inv.has_credentials;
              return (
                <div key={inv.id} style={{
                  padding: "14px var(--space-6)", display: "flex", alignItems: "center", justifyContent: "space-between",
                  borderBottom: "1px solid var(--border-subtle)",
                  background: inv.is_active ? "var(--green-tint)" : i % 2 === 0 ? "var(--bg-card)" : "var(--bg-hover)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minWidth: 0, flex: 1 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "var(--radius-base)", flexShrink: 0, background: inv.is_active ? "var(--green-tint-mid)" : "var(--bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                      {isWin ? "🪟" : <Icon d={Icons.file} size={16} color={inv.is_active ? "var(--green-dark)" : "var(--text-faint)"} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: "var(--text-md)", color: "var(--text-primary)" }}>{inv.name}</span>
                        {inv.is_active && badge("Active", "green")}
                        {credsOk
                          ? badge(isWin ? "WinRM set" : "Credentials set", "blue")
                          : <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--orange-tint)", color: "var(--orange-dark)", border: "1px solid var(--orange-border)", padding: "2px 8px", borderRadius: "var(--radius-pill)", fontSize: "var(--text-sm)", fontWeight: 700 }}>
                              <Icon d={Icons.warning} size={10} color="var(--orange-dark)" /> {isWin ? "No WinRM creds" : "No credentials"}
                            </span>
                        }
                      </div>
                      <div style={{ fontSize: "var(--text-sm)", color: "var(--text-ghost)", marginTop: 2 }}>
                        {inv.host_count} host{inv.host_count !== 1 ? "s" : ""} · uploaded {fmtDate(inv.uploaded_at)}
                        {isWin && <span style={{ marginLeft: 6, color: "var(--cyan)", fontWeight: 600 }}>· Windows / WinRM</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "var(--space-1)", flexShrink: 0, marginLeft: "var(--space-3)" }}>
                    <button
                      onClick={() => isWin ? setShowWinCreds(true) : setCredFormFor({ id: inv.id, name: inv.name })}
                      style={{
                        padding: "6px 12px",
                        border: `1px solid ${credsOk ? "var(--border)" : "var(--orange-border-lt)"}`,
                        borderRadius: "var(--radius-md)",
                        background: credsOk ? "var(--bg-hover)" : "var(--orange-tint)",
                        color:      credsOk ? "var(--text-muted)" : "var(--orange-dark)",
                        cursor: "pointer", fontSize: "var(--text-base)", fontWeight: 600, fontFamily: "inherit",
                        display: "flex", alignItems: "center", gap: 5,
                      }}
                    >
                      <Icon d={Icons.key} size={12} color={credsOk ? "var(--text-muted)" : "var(--orange-dark)"} />
                      {credsOk ? (isWin ? "Edit WinRM" : "Edit Creds") : (isWin ? "Set WinRM" : "Set Creds")}
                    </button>

                    {!inv.is_active && (
                      <button onClick={() => activate(inv.id)} disabled={activating === inv.id} style={{
                        padding: "6px 14px", border: "1px solid var(--blue-border)", borderRadius: "var(--radius-md)",
                        background: "var(--blue-tint)", color: "var(--blue-dark)",
                        cursor: "pointer", fontSize: "var(--text-base)", fontWeight: 600, fontFamily: "inherit",
                      }}>
                        {activating === inv.id ? "..." : "Use This"}
                      </button>
                    )}

                    <button onClick={() => remove(inv.id, inv.is_active)} style={{
                      padding: "6px 8px", border: "1px solid var(--red-tint-mid)", borderRadius: "var(--radius-md)",
                      background: "var(--bg-card)", color: inv.is_active ? "var(--red-border-lt)" : "var(--red)",
                      cursor: "pointer",
                    }} title={inv.is_active ? "Cannot delete active inventory" : "Delete"}>
                      <Icon d={Icons.close} size={13} color={inv.is_active ? "var(--red-border-lt)" : "var(--red)"} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* footer */}
          <div style={{ padding: "12px var(--space-6)", borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <Icon d={Icons.warning} size={13} color="var(--text-ghost)" />
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-ghost)" }}>
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