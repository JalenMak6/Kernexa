import { useState, useEffect } from "react";
import { apiFetch, apiPost, apiPut, apiDelete } from "../utils/api";

const ROLE_CONFIG = {
  admin:    { bg: "bg-amber-tint-lt",  text: "text-orange-text",  border: "border-yellow-border",    dot: "bg-amber"        },
  operator: { bg: "bg-purple-tint-lt", text: "text-purple",       border: "border-purple-border-lt", dot: "bg-purple"       },
  reader:   { bg: "bg-green-tint",     text: "text-green-text",   border: "border-green-border",     dot: "bg-green-bright" },
};

function RoleBadge({ role }) {
  const c = ROLE_CONFIG[role] || ROLE_CONFIG.reader;
  return (
    <span className={`inline-flex items-center gap-1 ${c.bg} ${c.text} border ${c.border} px-2.5 py-0.5 rounded-pill text-xs font-bold capitalize`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />{role}
    </span>
  );
}

function StatusBadge({ active }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-xs font-bold border
      ${active ? "bg-green-tint text-green-text border-green-border" : "bg-red-tint text-red-dark border-red-border"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-green-bright" : "bg-red"}`} />
      {active ? "Active" : "Disabled"}
    </span>
  );
}

function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="relative w-64">
      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-ghost)" strokeWidth="2.5" strokeLinecap="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || "Search..."}
        className="w-full pl-8 pr-3 py-2 border border-border-base rounded-base text-md outline-none font-[inherit] bg-bg-page text-text-primary focus:border-indigo transition-colors"
      />
    </div>
  );
}

function RoleSelector({ role, setRole, disabled, isLdap }) {
  return (
    <div className="flex gap-2">
      {["admin", "operator", "reader"].map(r => {
        const cfg = ROLE_CONFIG[r];
        const dis = (disabled && r !== "admin") || isLdap;
        const active = role === r;
        return (
          <button key={r} onClick={() => !dis && setRole(r)}
            className={`flex-1 py-2 px-3 rounded-base text-md font-bold font-[inherit] capitalize transition-all duration-150 border-2
              ${active ? `${cfg.bg} ${cfg.text} ${cfg.border}` : "bg-bg-card border-border-base text-text-faint"}
              ${dis ? "text-text-disabled cursor-not-allowed" : "cursor-pointer"}`}
          >{r}</button>
        );
      })}
    </div>
  );
}

function ModalShell({ title, subtitle, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 bg-[var(--backdrop-dark)] z-[1000] flex items-center justify-center p-6 backdrop-blur-sm">
      <div className="bg-bg-card border border-border-base rounded-3xl w-full max-w-[440px] shadow-modal overflow-hidden">
        <div className="px-6 py-5 border-b border-border-base flex justify-between items-center">
          <div>
            <div className="font-extrabold text-xl text-text-primary">{title}</div>
            {subtitle && <div className="text-md text-text-faint mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="bg-bg-subtle border border-border-base rounded-base w-8 h-8 cursor-pointer flex items-center justify-center text-lg text-text-secondary hover:bg-border-base transition-colors">×</button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">{children}</div>
        <div className="px-6 py-4 border-t border-border-base flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 border border-border-base rounded-base text-base outline-none font-[inherit] bg-bg-card text-text-primary";
const labelCls = "block text-xs font-bold text-text-faint uppercase tracking-widest mb-1.5";
const errCls   = "bg-red-tint border border-red-border rounded-base px-3.5 py-2.5 text-md text-red-dark";

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
    try { const user = await apiPost("/api/users", { username: username.trim(), password, role }); onCreated(user); onClose(); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <ModalShell title="Create New User" onClose={onClose} footer={
      <>
        <button onClick={onClose} className="px-4 py-2 border border-border-base rounded-base bg-bg-card cursor-pointer text-md text-text-muted-c font-[inherit]">Cancel</button>
        <button onClick={handleCreate} disabled={loading}
          className={`px-4 py-2 border-none rounded-base text-md font-bold font-[inherit] text-white cursor-pointer ${loading ? "bg-bg-subtle text-text-ghost cursor-not-allowed" : ""}`}
          style={{ background: loading ? undefined : "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
          {loading ? "Creating..." : "Create User"}
        </button>
      </>
    }>
      {[
        { label: "Username", value: username, set: setUsername, type: "text",     ph: "e.g. jsmith" },
        { label: "Password", value: password, set: setPassword, type: "password", ph: "Min 8 characters" },
      ].map(({ label, value, set, type, ph }) => (
        <div key={label}>
          <label className={labelCls}>{label}</label>
          <input type={type} value={value} onChange={e => set(e.target.value)} placeholder={ph} className={inputCls} />
        </div>
      ))}
      <div>
        <label className={labelCls}>Role</label>
        <RoleSelector role={role} setRole={setRole} />
        <div className="text-xs text-text-ghost mt-1.5">
          {role === "admin"    && "Full access — can manage users, inventories, scan and patch"}
          {role === "operator" && "Can scan and patch — cannot manage users"}
          {role === "reader"   && "View only — cannot scan, patch or modify anything"}
        </div>
      </div>
      {error && <div className={errCls}>{error}</div>}
    </ModalShell>
  );
}

function EditUserModal({ user, currentUser, onClose, onUpdated }) {
  const [role,     setRole]     = useState(user.role);
  const [isActive, setIsActive] = useState(user.is_active);
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(false);
  const isSelf = user.id === currentUser?.id;
  const isLdap = user.auth_source === "ldap";

  const handleSave = async () => {
    setError(null); setLoading(true);
    try {
      const updates = {};
      if (role !== user.role)           updates.role      = role;
      if (isActive !== user.is_active)  updates.is_active = isActive;
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
    <ModalShell title="Edit User" subtitle={`@${user.username}`} onClose={onClose} footer={
      <>
        <button onClick={onClose} className="px-4 py-2 border border-border-base rounded-base bg-bg-card cursor-pointer text-md text-text-muted-c font-[inherit]">Cancel</button>
        <button onClick={handleSave} disabled={loading}
          className={`px-4 py-2 border-none rounded-base text-md font-bold font-[inherit] text-white cursor-pointer ${loading ? "bg-bg-subtle text-text-ghost cursor-not-allowed" : ""}`}
          style={{ background: loading ? undefined : "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </>
    }>
      {isLdap && (
        <div className="bg-cyan-tint border border-cyan-border rounded-base px-3.5 py-2.5 text-md text-cyan-dark flex items-center gap-2">
          <span>🔒</span>
          <span>This is an <strong>Active Directory</strong> account. Role is managed by AD group membership. Password cannot be changed here.</span>
        </div>
      )}
      <div>
        <label className={labelCls}>Role</label>
        <RoleSelector role={role} setRole={setRole} disabled={isSelf} isLdap={isLdap} />
        {isSelf && !isLdap && <div className="text-xs text-amber mt-1">⚠ You cannot change your own role</div>}
        {isLdap             && <div className="text-xs text-cyan mt-1">Role is controlled by Active Directory group membership</div>}
      </div>
      <div>
        <label className={labelCls}>Account Status</label>
        <div className="flex gap-2">
          {[true, false].map(active => {
            const selected = isActive === active;
            const selCls = selected
              ? (active ? "bg-green-tint text-green-text border-green-border" : "bg-red-tint text-red-dark border-red-border")
              : "bg-bg-card text-text-faint border-border-base";
            return (
              <button key={String(active)} onClick={() => !isSelf && setIsActive(active)}
                className={`flex-1 py-2 px-3 rounded-base text-md font-bold font-[inherit] transition-all duration-150 border-2
                  ${selCls} ${isSelf ? "text-text-disabled cursor-not-allowed" : "cursor-pointer"}`}
              >{active ? "Active" : "Disabled"}</button>
            );
          })}
        </div>
        {isSelf && <div className="text-xs text-amber mt-1">⚠ You cannot disable your own account</div>}
      </div>
      {!isLdap && (
        <div>
          <label className={labelCls}>New Password <span className="normal-case font-normal text-text-ghost">(leave blank to keep current)</span></label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" className={inputCls} />
        </div>
      )}
      {error && <div className={errCls}>{error}</div>}
    </ModalShell>
  );
}

const thCls = "px-4 py-2.5 text-left text-xs font-bold tracking-widest uppercase text-text-ghost border-b border-border-base";

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
      const [all, pend] = await Promise.all([apiFetch("/api/users"), apiFetch("/api/users/pending")]);
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
    try { await apiDelete(`/api/users/${user.id}`); setPending(p => p.filter(x => x.id !== user.id)); }
    catch (e) { setError(e.message); }
    finally { setDeleting(null); }
  };
  const handleDelete = async (user) => {
    if (!window.confirm(`Delete '${user.username}'? This cannot be undone.`)) return;
    setDeleting(user.id);
    try { await apiDelete(`/api/users/${user.id}`); setActiveUsers(u => u.filter(x => x.id !== user.id)); }
    catch (e) { setError(e.message); }
    finally { setDeleting(null); }
  };

  const filteredActive  = activeUsers.filter(u => u.username.toLowerCase().includes(activeSearch.toLowerCase()) || u.role.toLowerCase().includes(activeSearch.toLowerCase()));
  const filteredPending = pending.filter(u => u.username.toLowerCase().includes(pendingSearch.toLowerCase()));

  if (loading) return (
    <div className="flex items-center justify-center h-[300px]">
      <div className="w-8 h-8 border-[3px] border-border-base border-t-indigo rounded-full animate-spin" />
    </div>
  );

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      {error && (
        <div className="bg-red-tint border border-red-border rounded-lg px-4 py-3 mb-5 text-md text-red-dark flex justify-between">
          {error}
          <button onClick={() => setError(null)} className="bg-transparent border-none cursor-pointer text-red-dark text-lg">×</button>
        </div>
      )}

      {/* Tab bar + search + actions */}
      <div className="flex justify-between items-center mb-5">
        <div className="flex bg-bg-subtle rounded-lg p-1 gap-0.5">
          {[
            { key: "active",  label: "Active Users",     count: activeUsers.length, amber: false },
            { key: "pending", label: "Pending Approval", count: pending.length,     amber: true  },
          ].map(t => (
            <button key={t.key} onClick={() => setInnerTab(t.key)}
              className={`px-4 py-1.5 rounded-md border-none font-[inherit] cursor-pointer text-md flex items-center gap-1.5 transition-all duration-150
                ${innerTab === t.key ? "bg-bg-card text-text-primary font-bold shadow-card" : "bg-transparent text-text-faint font-medium"}`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`text-white text-xxs font-bold px-1.5 py-0.5 rounded-pill ${t.amber ? "bg-amber" : innerTab === t.key ? "bg-indigo" : "bg-text-ghost"}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-2.5 items-center">
          {innerTab === "active"  && <SearchBar value={activeSearch}  onChange={setActiveSearch}  placeholder="Search by name or role..." />}
          {innerTab === "pending" && <SearchBar value={pendingSearch} onChange={setPendingSearch} placeholder="Search by username..." />}
          {innerTab === "active" && (
            <button onClick={() => setShowCreate(true)}
              className="px-4 py-2 border-none rounded-base text-md font-bold font-[inherit] text-white cursor-pointer whitespace-nowrap"
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow: "0 2px 8px rgba(99,102,241,0.35)" }}>
              + Create User
            </button>
          )}
        </div>
      </div>

      {/* Active Users table */}
      {innerTab === "active" && (
        <div className="bg-bg-card border border-border-base rounded-2xl overflow-hidden shadow-card">
          <table className="w-full border-collapse">
            <thead className="bg-bg-page">
              <tr>
                <th className={thCls}>User</th>
                <th className={thCls}>Role</th>
                <th className={thCls}>Status</th>
                <th className={thCls}>Created</th>
                <th className={thCls}>Last Login</th>
                <th className={`${thCls} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredActive.map((u, i) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr key={u.id} className={`border-b border-border-subtle ${isSelf ? "bg-bg-row" : "bg-bg-card"}`}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-md font-bold text-white shrink-0"
                          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                          {u.username[0].toUpperCase()}
                        </div>
                        <div className="text-base font-semibold text-text-primary flex items-center gap-1.5">
                          {u.username}
                          {isSelf && <span className="text-xxs text-indigo bg-indigo-tint border border-indigo-border px-1.5 py-0.5 rounded-pill font-bold">You</span>}
                          {u.auth_source === "ldap" && <span className="text-xxs text-cyan-dark bg-cyan-tint border border-cyan-border px-1.5 py-0.5 rounded-pill font-bold">AD</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><RoleBadge role={u.role} /></td>
                    <td className="px-4 py-3.5"><StatusBadge active={u.is_active} /></td>
                    <td className="px-4 py-3.5 text-sm text-text-faint">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3.5 text-sm text-text-faint">{u.last_login ? new Date(u.last_login).toLocaleString() : "Never"}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={() => setEditUser(u)} className="px-3 py-1 border border-border-base rounded-md bg-bg-card cursor-pointer text-sm text-text-muted-c font-[inherit] font-semibold hover:bg-bg-subtle transition-colors">Edit</button>
                        <button onClick={() => handleDelete(u)} disabled={isSelf || deleting === u.id}
                          className={`px-3 py-1 border border-red-border rounded-md text-sm font-[inherit] font-semibold transition-colors
                            ${isSelf ? "bg-bg-page text-text-disabled cursor-not-allowed" : "bg-red-tint text-red-dark cursor-pointer hover:bg-red-tint-mid"}
                            ${deleting === u.id ? "opacity-50" : ""}`}
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
            <div className="py-12 text-center text-text-ghost text-base">
              {activeSearch ? `No users match "${activeSearch}"` : "No active users — click Create User to add one."}
            </div>
          )}
        </div>
      )}

      {/* Pending Approval table */}
      {innerTab === "pending" && (
        <div className="bg-bg-card border border-border-base rounded-2xl overflow-hidden shadow-card">
          {filteredPending.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-[40px] mb-3">✓</div>
              <div className="text-xl font-bold text-text-primary mb-1.5">
                {pendingSearch ? `No requests match "${pendingSearch}"` : "No pending requests"}
              </div>
              <div className="text-md text-text-ghost">
                {pendingSearch ? "Try a different search term" : "All access requests have been reviewed"}
              </div>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead className="bg-amber-tint-lt">
                <tr>
                  <th className={`${thCls} text-orange-text border-yellow-border`}>Username</th>
                  <th className={`${thCls} text-orange-text border-yellow-border`}>Requested</th>
                  <th className={`${thCls} text-orange-text border-yellow-border text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPending.map((u, i) => (
                  <tr key={u.id} className="border-b border-yellow-border">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-md font-bold text-white shrink-0"
                          style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                          {u.username[0].toUpperCase()}
                        </div>
                        <div className="text-base font-semibold text-text-primary">{u.username}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-text-faint">{u.created_at ? new Date(u.created_at).toLocaleString() : "—"}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => handleApprove(u)} disabled={approving === u.id}
                          className={`px-4 py-1.5 border-none rounded-md text-sm font-bold font-[inherit] text-white ${approving === u.id ? "bg-bg-subtle text-text-ghost cursor-not-allowed" : "cursor-pointer"}`}
                          style={{ background: approving === u.id ? undefined : "linear-gradient(135deg,#22c55e,#16a34a)" }}>
                          {approving === u.id ? "..." : "✓ Approve"}
                        </button>
                        <button onClick={() => handleReject(u)} disabled={deleting === u.id}
                          className={`px-4 py-1.5 border border-red-border rounded-md bg-red-tint text-red-dark text-sm font-bold font-[inherit] cursor-pointer ${deleting === u.id ? "opacity-50" : ""}`}>
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

      {/* Role reference */}
      <div className="mt-6 bg-bg-card border border-border-base rounded-2xl px-6 py-5">
        <div className="text-md font-bold text-text-primary mb-3.5">Role Permissions</div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { role: "admin",    perms: ["Manage users", "All operator permissions", "Manage inventories & credentials", "Notification settings"] },
            { role: "operator", perms: ["Trigger scans", "Apply patches", "View all data", "Scheduler settings"] },
            { role: "reader",   perms: ["View dashboard", "View CVE advisories", "View scan history", "Read-only access"] },
          ].map(({ role, perms }) => {
            const cfg = ROLE_CONFIG[role];
            return (
              <div key={role} className={`rounded-lg px-4 py-3.5 border ${cfg.bg} ${cfg.border}`}>
                <div className={`text-sm font-bold capitalize mb-2.5 flex items-center gap-1.5 ${cfg.text}`}>
                  <span className={`w-2 h-2 rounded-full inline-block ${cfg.dot}`} />{role}
                </div>
                {perms.map(p => (
                  <div key={p} className={`text-sm mb-1 flex items-center gap-1.5 opacity-80 ${cfg.text}`}>
                    <span className="text-xxs">✓</span> {p}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={u => setActiveUsers(prev => [...prev, u])} />}
      {editUser   && <EditUserModal user={editUser} currentUser={currentUser} onClose={() => setEditUser(null)} onUpdated={u => setActiveUsers(prev => prev.map(x => x.id === u.id ? u : x))} />}
    </div>
  );
}
