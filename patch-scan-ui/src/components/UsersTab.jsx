import { useState, useEffect } from "react";
import { apiFetch, apiPost, apiPut, apiDelete } from "../utils/api";

const ROLE_CONFIG = {
  admin:    { bg: "#fef3c7", color: "#92400e", border: "#fde68a", dot: "#f59e0b" },
  operator: { bg: "#ede9fe", color: "#5b21b6", border: "#ddd6fe", dot: "#8b5cf6" },
  reader:   { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0", dot: "#22c55e" },
};

function RoleBadge({ role }) {
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.reader;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: "capitalize" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot }} />
      {role}
    </span>
  );
}

function StatusBadge({ active }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: active ? "#f0fdf4" : "#fef2f2", color: active ? "#166534" : "#dc2626", border: `1px solid ${active ? "#bbf7d0" : "#fecaca"}`, padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? "#22c55e" : "#ef4444" }} />
      {active ? "Active" : "Disabled"}
    </span>
  );
}

function SearchBar({ value, onChange, placeholder }) {
  return (
    <div style={{ position: "relative", width: 260 }}>
      <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || "Search..."}
        style={{ width: "100%", padding: "8px 12px 8px 32px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box", background: "#f8fafc", color: "#0f172a" }}
        onFocus={e => e.target.style.borderColor = "#6366f1"}
        onBlur={e  => e.target.style.borderColor = "#e2e8f0"}
      />
    </div>
  );
}

// ── Create User Modal ─────────────────────────────────────────────────────────

function CreateUserModal({ onClose, onCreated }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role,     setRole]     = useState("reader");
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(false);

  const handleCreate = async () => {
    if (!username.trim() || !password.trim()) { setError("Username and password are required"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setError(null); setLoading(true);
    try {
      const user = await apiPost("/api/users", { username: username.trim(), password, role });
      onCreated(user); onClose();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backdropFilter: "blur(2px)" }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>Create New User</div>
          <button onClick={onClose} style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 18, color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            { label: "Username", value: username, onChange: setUsername, type: "text",     placeholder: "e.g. jsmith" },
            { label: "Password", value: password, onChange: setPassword, type: "password", placeholder: "Min 8 characters" },
          ].map(({ label, value, onChange, type, placeholder }) => (
            <div key={label}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</label>
              <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>
          ))}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Role</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["admin", "operator", "reader"].map(r => {
                const cfg = ROLE_CONFIG[r];
                return (
                  <button key={r} onClick={() => setRole(r)} style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `2px solid ${role === r ? cfg.dot : "#e2e8f0"}`, background: role === r ? cfg.bg : "#fff", color: role === r ? cfg.color : "#64748b", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", textTransform: "capitalize", transition: "all 0.15s" }}>
                    {r}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
              {role === "admin"    && "Full access — can manage users, inventories, scan and patch"}
              {role === "operator" && "Can scan and patch — cannot manage users"}
              {role === "reader"   && "View only — cannot scan, patch or modify anything"}
            </div>
          </div>
          {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 13 }}>{error}</div>}
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ padding: "8px 18px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 13, color: "#64748b", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={handleCreate} disabled={loading} style={{ padding: "8px 18px", border: "none", borderRadius: 8, background: loading ? "#e2e8f0" : "linear-gradient(135deg,#6366f1,#8b5cf6)", color: loading ? "#94a3b8" : "#fff", cursor: loading ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
            {loading ? "Creating..." : "Create User"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit User Modal ───────────────────────────────────────────────────────────

function EditUserModal({ user, currentUser, onClose, onUpdated }) {
  const [role,     setRole]     = useState(user.role);
  const [isActive, setIsActive] = useState(user.is_active);
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(false);
  const isSelf = user.id === currentUser?.id;

  const handleSave = async () => {
    setError(null); setLoading(true);
    try {
      const updates = {};
      if (role !== user.role) updates.role = role;
      if (isActive !== user.is_active) updates.is_active = isActive;
      if (password.trim()) {
        if (password.length < 8) { setError("Password must be at least 8 characters"); setLoading(false); return; }
        updates.password = password;
      }
      if (Object.keys(updates).length === 0) { onClose(); return; }
      const updated = await apiPut(`/api/users/${user.id}`, updates);
      onUpdated(updated); onClose();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backdropFilter: "blur(2px)" }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>Edit User</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>@{user.username}</div>
          </div>
          <button onClick={onClose} style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 18, color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Role</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["admin", "operator", "reader"].map(r => {
                const cfg = ROLE_CONFIG[r];
                const disabled = isSelf && r !== "admin";
                return (
                  <button key={r} onClick={() => !disabled && setRole(r)}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `2px solid ${role === r ? cfg.dot : "#e2e8f0"}`, background: role === r ? cfg.bg : "#fff", color: disabled ? "#cbd5e1" : role === r ? cfg.color : "#64748b", cursor: disabled ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", textTransform: "capitalize", transition: "all 0.15s" }}>
                    {r}
                  </button>
                );
              })}
            </div>
            {isSelf && <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 4 }}>⚠ You cannot change your own role</div>}
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Account Status</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[true, false].map(active => (
                <button key={String(active)} onClick={() => !isSelf && setIsActive(active)}
                  style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `2px solid ${isActive === active ? (active ? "#22c55e" : "#ef4444") : "#e2e8f0"}`, background: isActive === active ? (active ? "#f0fdf4" : "#fef2f2") : "#fff", color: isSelf ? "#cbd5e1" : isActive === active ? (active ? "#166534" : "#dc2626") : "#64748b", cursor: isSelf ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", transition: "all 0.15s" }}>
                  {active ? "Active" : "Disabled"}
                </button>
              ))}
            </div>
            {isSelf && <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 4 }}>⚠ You cannot disable your own account</div>}
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              New Password <span style={{ fontWeight: 400, textTransform: "none" }}>(leave blank to keep current)</span>
            </label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters"
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
          {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 13 }}>{error}</div>}
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ padding: "8px 18px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 13, color: "#64748b", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={handleSave} disabled={loading} style={{ padding: "8px 18px", border: "none", borderRadius: 8, background: loading ? "#e2e8f0" : "linear-gradient(135deg,#6366f1,#8b5cf6)", color: loading ? "#94a3b8" : "#fff", cursor: loading ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main UsersTab ─────────────────────────────────────────────────────────────

export function UsersTab({ currentUser }) {
  const [activeUsers,   setActiveUsers]   = useState([]);
  const [pending,       setPending]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [innerTab,      setInnerTab]      = useState("active");
  const [activeSearch,  setActiveSearch]  = useState("");
  const [pendingSearch, setPendingSearch] = useState("");
  const [showCreate,    setShowCreate]    = useState(false);
  const [editUser,      setEditUser]      = useState(null);
  const [deleting,      setDeleting]      = useState(null);
  const [approving,     setApproving]     = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [all, pend] = await Promise.all([
        apiFetch("/api/users"),
        apiFetch("/api/users/pending"),
      ]);
      setActiveUsers(all.filter(u => u.is_active));
      setPending(pend);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleApprove = async (user) => {
    setApproving(user.id);
    try {
      const updated = await apiPut(`/api/users/${user.id}`, { is_active: true });
      setPending(p => p.filter(x => x.id !== user.id));
      setActiveUsers(u => [...u, updated]);
    } catch (e) { setError(e.message); }
    finally { setApproving(null); }
  };

  const handleReject = async (user) => {
    if (!window.confirm(`Reject and delete '${user.username}'s request?`)) return;
    setDeleting(user.id);
    try {
      await apiDelete(`/api/users/${user.id}`);
      setPending(p => p.filter(x => x.id !== user.id));
    } catch (e) { setError(e.message); }
    finally { setDeleting(null); }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Delete '${user.username}'? This cannot be undone.`)) return;
    setDeleting(user.id);
    try {
      await apiDelete(`/api/users/${user.id}`);
      setActiveUsers(u => u.filter(x => x.id !== user.id));
    } catch (e) { setError(e.message); }
    finally { setDeleting(null); }
  };

  const handleCreated = (user) => setActiveUsers(u => [...u, user]);
  const handleUpdated = (updated) => setActiveUsers(u => u.map(x => x.id === updated.id ? updated : x));

  const filteredActive  = activeUsers.filter(u =>
    u.username.toLowerCase().includes(activeSearch.toLowerCase()) ||
    u.role.toLowerCase().includes(activeSearch.toLowerCase())
  );
  const filteredPending = pending.filter(u =>
    u.username.toLowerCase().includes(pendingSearch.toLowerCase())
  );

  const thStyle = { padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#94a3b8", borderBottom: "1px solid #e2e8f0" };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <div style={{ width: 32, height: 32, border: "3px solid #e2e8f0", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    </div>
  );

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#dc2626", fontSize: 13, display: "flex", justifyContent: "space-between" }}>
          {error}
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 16 }}>×</button>
        </div>
      )}

      {/* ── Tab bar + search + actions ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 10, padding: 4, gap: 2 }}>
          {[
            { key: "active",  label: "Active Users",     count: activeUsers.length,  amber: false },
            { key: "pending", label: "Pending Approval", count: pending.length,       amber: true  },
          ].map(t => (
            <button key={t.key} onClick={() => setInnerTab(t.key)}
              style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: innerTab === t.key ? "#fff" : "transparent", color: innerTab === t.key ? "#0f172a" : "#64748b", cursor: "pointer", fontSize: 13, fontWeight: innerTab === t.key ? 700 : 500, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7, boxShadow: innerTab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>
              {t.label}
              {t.count > 0 && (
                <span style={{ background: t.amber ? "#f59e0b" : innerTab === t.key ? "#6366f1" : "#94a3b8", color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999 }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {innerTab === "active"  && <SearchBar value={activeSearch}  onChange={setActiveSearch}  placeholder="Search by name or role..." />}
          {innerTab === "pending" && <SearchBar value={pendingSearch} onChange={setPendingSearch} placeholder="Search by username..." />}
          {innerTab === "active" && (
            <button onClick={() => setShowCreate(true)}
              style={{ padding: "9px 18px", border: "none", borderRadius: 8, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(99,102,241,0.35)" }}>
              + Create User
            </button>
          )}
        </div>
      </div>

      {/* ── Active Users ── */}
      {innerTab === "active" && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                <th style={thStyle}>User</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Created</th>
                <th style={thStyle}>Last Login</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredActive.map((u, i) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr key={u.id} style={{ borderBottom: i < filteredActive.length - 1 ? "1px solid #f1f5f9" : "none", background: isSelf ? "#fafaf9" : "#fff" }}>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                          {u.username[0].toUpperCase()}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
                          {u.username}
                          {isSelf && <span style={{ fontSize: 10, color: "#6366f1", background: "#eef2ff", border: "1px solid #c7d2fe", padding: "1px 6px", borderRadius: 999, marginLeft: 6, fontWeight: 700 }}>You</span>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}><RoleBadge role={u.role} /></td>
                    <td style={{ padding: "14px 16px" }}><StatusBadge active={u.is_active} /></td>
                    <td style={{ padding: "14px 16px", fontSize: 12, color: "#64748b" }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                    <td style={{ padding: "14px 16px", fontSize: 12, color: "#64748b" }}>{u.last_login ? new Date(u.last_login).toLocaleString() : "Never"}</td>
                    <td style={{ padding: "14px 16px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button onClick={() => setEditUser(u)} style={{ padding: "5px 12px", border: "1px solid #e2e8f0", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 12, color: "#475569", fontFamily: "inherit", fontWeight: 600 }}>Edit</button>
                        <button onClick={() => handleDelete(u)} disabled={isSelf || deleting === u.id}
                          style={{ padding: "5px 12px", border: "1px solid #fecaca", borderRadius: 6, background: isSelf ? "#f8fafc" : "#fef2f2", cursor: isSelf ? "not-allowed" : "pointer", fontSize: 12, color: isSelf ? "#cbd5e1" : "#dc2626", fontFamily: "inherit", fontWeight: 600, opacity: deleting === u.id ? 0.5 : 1 }}
                          title={isSelf ? "Cannot delete your own account" : ""}>
                          {deleting === u.id ? "..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredActive.length === 0 && (
            <div style={{ padding: 48, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
              {activeSearch ? `No users match "${activeSearch}"` : "No active users — click Create User to add one."}
            </div>
          )}
        </div>
      )}

      {/* ── Pending Approval ── */}
      {innerTab === "pending" && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          {filteredPending.length === 0 ? (
            <div style={{ padding: 64, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
                {pendingSearch ? `No requests match "${pendingSearch}"` : "No pending requests"}
              </div>
              <div style={{ fontSize: 13, color: "#94a3b8" }}>
                {pendingSearch ? "Try a different search term" : "All access requests have been reviewed"}
              </div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#fffbeb" }}>
                <tr>
                  <th style={{ ...thStyle, color: "#92400e" }}>Username</th>
                  <th style={{ ...thStyle, color: "#92400e" }}>Requested</th>
                  <th style={{ ...thStyle, color: "#92400e", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPending.map((u, i) => (
                  <tr key={u.id} style={{ borderBottom: i < filteredPending.length - 1 ? "1px solid #fef3c7" : "none" }}>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#f59e0b,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                          {u.username[0].toUpperCase()}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{u.username}</div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 12, color: "#64748b" }}>
                      {u.created_at ? new Date(u.created_at).toLocaleString() : "—"}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button onClick={() => handleApprove(u)} disabled={approving === u.id}
                          style={{ padding: "6px 16px", border: "none", borderRadius: 7, background: approving === u.id ? "#e2e8f0" : "linear-gradient(135deg,#22c55e,#16a34a)", color: approving === u.id ? "#94a3b8" : "#fff", cursor: approving === u.id ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>
                          {approving === u.id ? "..." : "✓ Approve"}
                        </button>
                        <button onClick={() => handleReject(u)} disabled={deleting === u.id}
                          style={{ padding: "6px 16px", border: "1px solid #fecaca", borderRadius: 7, background: "#fef2f2", color: "#dc2626", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", opacity: deleting === u.id ? 0.5 : 1 }}>
                          {deleting === u.id ? "..." : "✕ Reject"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Role reference ── */}
      <div style={{ marginTop: 24, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "20px 24px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>Role Permissions</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {[
            { role: "admin",    perms: ["Manage users", "All operator permissions", "Manage inventories & credentials", "Notification settings"] },
            { role: "operator", perms: ["Trigger scans", "Apply patches", "View all data", "Scheduler settings"] },
            { role: "reader",   perms: ["View dashboard", "View CVE advisories", "View scan history", "Read-only access"] },
          ].map(({ role, perms }) => {
            const cfg = ROLE_CONFIG[role];
            return (
              <div key={role} style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: cfg.color, textTransform: "capitalize", marginBottom: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.dot, display: "inline-block", marginRight: 6 }} />{role}
                </div>
                {perms.map(p => (
                  <div key={p} style={{ fontSize: 12, color: cfg.color, opacity: 0.8, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10 }}>✓</span> {p}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
      {editUser   && <EditUserModal user={editUser} currentUser={currentUser} onClose={() => setEditUser(null)} onUpdated={handleUpdated} />}
    </div>
  );
}