import { useState, useEffect, useCallback } from "react";
import { Icon, Icons } from "../utils/icons.jsx";
import { apiFetch, apiPost, apiDelete, API_BASE } from "../utils/api";
import { fmtDate, badge } from "../utils/helpers.jsx";
import { CredentialsForm } from "./CredentialsForm";

export function InventoryManager({ onClose, onActivated }) {
  const [inventories, setInventories] = useState([]);
  const [invName, setInvName]         = useState("");
  const [file, setFile]               = useState(null);
  const [uploading, setUploading]     = useState(false);
  const [activating, setActivating]   = useState(null);
  const [dragOver, setDragOver]       = useState(false);
  const [credFormFor, setCredFormFor] = useState(null); // { id, name }

  
  const load = useCallback(() => {
    apiFetch("/api/inventories").then(setInventories).catch(() => {});
  }, []);

  useEffect(() => { load(); }, []);

  const upload = async () => {
    if (!file || !invName.trim()) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("name", invName.trim());
      const r = await fetch(`${API_BASE}/api/inventories/upload`, { method: "POST", body: form });
      if (!r.ok) { const err = await r.json(); throw new Error(err.detail || r.statusText); }
      setFile(null);
      setInvName("");
      load();
    } catch (e) {
      alert("Upload failed: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const activate = async (id) => {
    setActivating(id);
    try {
      await apiPost(`/api/inventories/${id}/activate`);
      load();
      onActivated?.();
    } catch (e) {
      alert("Failed to activate: " + e.message);
    } finally {
      setActivating(null);
    }
  };

  const remove = async (id, isActive) => {
    if (isActive) { alert("Cannot delete the active inventory. Activate another one first."); return; }
    if (!confirm("Delete this inventory?")) return;
    try { await apiDelete(`/api/inventories/${id}`); load(); }
    catch (e) { alert("Failed to delete: " + e.message); }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
        <div style={{ background: "#fff", borderRadius: 16, width: "min(680px,95vw)", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }} onClick={e => e.stopPropagation()}>

          {/* header */}
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>Inventory Files</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Upload Ansible inventory files — activate one, then set its SSH credentials</div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
              <Icon d={Icons.close} size={20} />
            </button>
          </div>

          {/* upload form */}
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              value={invName}
              onChange={e => setInvName(e.target.value)}
              placeholder="Inventory name (e.g. Production Servers, Lab VMs)"
              style={{ padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", fontFamily: "inherit" }}
            />
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("inv-file-input").click()}
              style={{
                border: `2px dashed ${dragOver ? "#3b82f6" : "#cbd5e1"}`, borderRadius: 10,
                padding: "20px", textAlign: "center",
                background: dragOver ? "#eff6ff" : "#fafbfc",
                transition: "all 0.2s", cursor: "pointer"
              }}
            >
              <Icon d={Icons.upload} size={24} color={dragOver ? "#3b82f6" : "#94a3b8"} />
              <div style={{ marginTop: 8, fontSize: 13, color: "#64748b", fontWeight: 500 }}>
                {file
                  ? <span style={{ color: "#3b82f6", fontWeight: 600 }}>📄 {file.name}</span>
                  : <>Drag & drop your inventory file, or <span style={{ color: "#3b82f6", textDecoration: "underline" }}>browse</span></>
                }
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Accepts .txt or .ini Ansible inventory files</div>
              <input id="inv-file-input" type="file" accept=".txt,.ini" onChange={e => setFile(e.target.files[0])} style={{ display: "none" }} />
            </div>
            <button onClick={upload} disabled={!file || !invName.trim() || uploading} style={{
              padding: "10px", border: "none", borderRadius: 8,
              background: !file || !invName.trim() ? "#f1f5f9" : "#0f172a",
              color: !file || !invName.trim() ? "#94a3b8" : "#fff",
              cursor: !file || !invName.trim() ? "not-allowed" : "pointer",
              fontSize: 13, fontWeight: 700, fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8
            }}>
              <Icon d={Icons.upload} size={14} color={!file || !invName.trim() ? "#94a3b8" : "#fff"} />
              {uploading ? "Uploading..." : "Upload Inventory"}
            </button>
          </div>

          {/* inventory list */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {inventories.length === 0 ? (
              <div style={{ padding: "40px 32px", textAlign: "center" }}>
                <Icon d={Icons.file} size={36} color="#e2e8f0" />
                <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: "#334155" }}>No inventories uploaded yet</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Upload your first inventory file above</div>
              </div>
            ) : inventories.map((inv, i) => (
              <div key={inv.id} style={{
                padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid #f1f5f9",
                background: inv.is_active ? "#f0fdf4" : i % 2 === 0 ? "#fff" : "#fafbfc"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, background: inv.is_active ? "#dcfce7" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon d={Icons.file} size={16} color={inv.is_active ? "#16a34a" : "#64748b"} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{inv.name}</span>
                      {inv.is_active && badge("Active", "green")}
                      {inv.has_credentials
                        ? badge("Credentials set", "blue")
                        : <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                            <Icon d={Icons.warning} size={10} color="#c2410c" /> No credentials
                          </span>
                      }
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                      {inv.host_count} host{inv.host_count !== 1 ? "s" : ""} · uploaded {fmtDate(inv.uploaded_at)}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 12 }}>
                  <button
                    onClick={() => setCredFormFor({ id: inv.id, name: inv.name })}
                    style={{
                      padding: "6px 12px", border: `1px solid ${inv.has_credentials ? "#e2e8f0" : "#fdba74"}`,
                      borderRadius: 6,
                      background: inv.has_credentials ? "#f8fafc" : "#fff7ed",
                      color: inv.has_credentials ? "#475569" : "#c2410c",
                      cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                      display: "flex", alignItems: "center", gap: 5
                    }}
                  >
                    <Icon d={Icons.key} size={12} color={inv.has_credentials ? "#475569" : "#c2410c"} />
                    {inv.has_credentials ? "Edit Creds" : "Set Creds"}
                  </button>
                  {!inv.is_active && (
                    <button onClick={() => activate(inv.id)} disabled={activating === inv.id} style={{
                      padding: "6px 14px", border: "1px solid #3b82f6", borderRadius: 6,
                      background: "#eff6ff", color: "#2563eb", cursor: "pointer",
                      fontSize: 12, fontWeight: 600, fontFamily: "inherit"
                    }}>
                      {activating === inv.id ? "..." : "Use This"}
                    </button>
                  )}
                  <button onClick={() => remove(inv.id, inv.is_active)} style={{
                    padding: "6px 8px", border: "1px solid #fee2e2", borderRadius: 6,
                    background: "#fff", color: inv.is_active ? "#fca5a5" : "#ef4444", cursor: "pointer"
                  }} title={inv.is_active ? "Cannot delete active inventory" : "Delete"}>
                    <Icon d={Icons.close} size={13} color={inv.is_active ? "#fca5a5" : "#ef4444"} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* footer */}
          <div style={{ padding: "12px 24px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 8 }}>
            <Icon d={Icons.warning} size={13} color="#94a3b8" />
            <span style={{ fontSize: 11, color: "#94a3b8" }}>
              Activate an inventory, then click <strong>Set Creds</strong> to add SSH credentials before running a scan.
            </span>
          </div>
        </div>
      </div>

      {/* credentials sub-modal — rendered above inventory modal */}
      {credFormFor && (
        <CredentialsForm
          inventoryId={credFormFor.id}
          inventoryName={credFormFor.name}
          onClose={() => { setCredFormFor(null); load(); }}
        />
      )}
    </>
  );
}
