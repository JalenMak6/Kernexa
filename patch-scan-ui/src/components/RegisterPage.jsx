import { useState } from "react";

/* ── Icons ─────────────────────────────────────────────────────────────────── */
const IconUser = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" stroke="#4b5563" strokeWidth="1.5"/>
    <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconLock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <rect x="5" y="11" width="14" height="10" rx="2" stroke="#4b5563" strokeWidth="1.5"/>
    <path d="M8 11V7a4 4 0 018 0v4" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconEye = ({ off }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    {off ? (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0112 20C6 20 2 12 2 12a18.06 18.06 0 015.06-5.94" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M9.9 4.24A9.12 9.12 0 0112 4c6 0 10 8 10 8a18.5 18.5 0 01-2.16 3.19" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M14.12 14.12A3 3 0 119.88 9.88" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="2" y1="2" x2="22" y2="22" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round"/>
      </>
    ) : (
      <>
        <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" stroke="#4b5563" strokeWidth="1.5"/>
        <circle cx="12" cy="12" r="3" stroke="#4b5563" strokeWidth="1.5"/>
      </>
    )}
  </svg>
);

/* ── Password strength ─────────────────────────────────────────────────────── */
function strengthScore(pw) {
  let s = 0;
  if (pw.length >= 8)       s++;
  if (pw.length >= 12)      s++;
  if (/[A-Z]/.test(pw))     s++;
  if (/[0-9]/.test(pw))     s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
const STRENGTH_LABEL = ["—", "weak", "fair", "fair", "good", "strong"];
const STRENGTH_COLOR = ["#374151", "#ef4444", "#f97316", "#f97316", "#3b82f6", "#22c55e"];

function StrengthBar({ password }) {
  if (!password) return null;
  const s = strengthScore(password);
  return (
    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ display: "flex", gap: 3, flex: 1 }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{
            flex: 1, height: 2, borderRadius: 1,
            background: i <= s ? STRENGTH_COLOR[s] : "#111927",
            transition: "background 0.2s",
          }} />
        ))}
      </div>
      <span style={{ fontSize: 9, color: STRENGTH_COLOR[s], fontFamily: "monospace", letterSpacing: "0.05em", width: 36, textAlign: "right" }}>
        {STRENGTH_LABEL[s]}
      </span>
    </div>
  );
}

/* ── Input field ───────────────────────────────────────────────────────────── */
function InputField({ label, type, value, onChange, onKeyDown, placeholder, autoFocus, autoComplete, disabled, hasError, rightSlot, children }) {
  const [focused, setFocused] = useState(false);
  const isLockIcon = type === "password" || autoComplete?.startsWith("new-password");
  const border = hasError
    ? "#7f1d1d"
    : focused
    ? "#1d4ed8"
    : "#1a2438";
  const ring = focused
    ? hasError ? "0 0 0 2px rgba(127,29,29,0.35)" : "0 0 0 2px rgba(29,78,216,0.3)"
    : "none";

  return (
    <div>
      <label style={{
        display: "block", fontSize: 10, fontWeight: 600,
        color: "#4b5563", textTransform: "uppercase",
        letterSpacing: "0.08em", marginBottom: 6,
        fontFamily: "monospace",
      }}>{label}</label>
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex", pointerEvents: "none" }}>
          {isLockIcon ? <IconLock /> : <IconUser />}
        </div>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%",
            padding: rightSlot ? "10px 40px 10px 36px" : "10px 12px 10px 36px",
            background: "#070b14",
            border: `1px solid ${border}`,
            borderRadius: 5,
            color: "#d1d5db",
            fontSize: 13,
            outline: "none",
            fontFamily: "inherit",
            boxSizing: "border-box",
            transition: "border-color 0.12s, box-shadow 0.12s",
            boxShadow: ring,
          }}
        />
        {rightSlot && (
          <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}>
            {rightSlot}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/* ── RegisterPage ──────────────────────────────────────────────────────────── */
export function RegisterPage({ onBackToLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [showCf,   setShowCf]   = useState(false);
  const [error,    setError]    = useState(null);
  const [success,  setSuccess]  = useState(false);
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!username.trim() || !password.trim()) { setError("Username and password are required"); return; }
    if (username.trim().length < 3)            { setError("Username must be at least 3 characters"); return; }
    if (password.length < 8)                   { setError("Password must be at least 8 characters"); return; }
    if (password !== confirm)                  { setError("Passwords do not match"); return; }

    setLoading(true);
    try {
      const res  = await fetch("/api/auth/register", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Registration failed");
      setSuccess(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const onKey = e => e.key === "Enter" && handleSubmit();

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#08111e",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      padding: "32px 24px",
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #1e2d45; }
        .pw-toggle { background:none; border:none; cursor:pointer; padding:2px; display:flex; align-items:center; opacity:0.5; }
        .pw-toggle:hover { opacity:1; }
        .reg-btn:not(:disabled):hover { background: #1d4ed8 !important; }
        .reg-btn { transiton: background 0.15s !important; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 340 }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 6,
            background: "#1a2540", border: "1px solid #253354",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V6L12 2z"
                fill="#253354" stroke="#4b6cb7" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M9 12l2 2 4-4" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", letterSpacing: "-0.1px" }}>Kernexa</div>
            <div style={{ fontSize: 9, color: "#374151", letterSpacing: "0.08em", fontFamily: "monospace", textTransform: "uppercase" }}>Security Platform</div>
          </div>
        </div>

        {/* Heading */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", margin: 0, marginBottom: 3, letterSpacing: "-0.2px" }}>
            {success ? "Request received" : "Request access"}
          </h2>
          <p style={{ fontSize: 11, color: "#374151", margin: 0, fontFamily: "monospace" }}>
            {success ? "Pending administrator approval" : "Admin approval required · accounts are not self-serve"}
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "#060a12",
          border: "1px solid #111927",
          borderRadius: 6,
          padding: "22px 20px",
        }}>
          {success ? (
            <div>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "rgba(34,197,94,0.08)",
                border: "1px solid #14532d",
                borderRadius: 4, padding: "10px 12px",
                marginBottom: 16,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontSize: 12, color: "#4ade80", fontFamily: "monospace" }}>
                  Request queued for {username}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "#374151", fontFamily: "monospace", lineHeight: 1.6, marginBottom: 16, marginTop: 0 }}>
                An admin will review and activate your account. You will be able to sign in once approved.
              </p>
              <button
                onClick={onBackToLogin}
                style={{
                  width: "100%", padding: "10px",
                  background: "#1d4ed8", border: "1px solid #1e40af",
                  borderRadius: 5, color: "#e2e8f0",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <InputField
                label="Username"
                type="text"
                value={username}
                onChange={setUsername}
                onKeyDown={onKey}
                placeholder="choose a username"
                autoFocus
                autoComplete="username"
                disabled={loading}
              />

              <InputField
                label="Password"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={setPassword}
                onKeyDown={onKey}
                placeholder="min 8 characters"
                autoComplete="new-password"
                disabled={loading}
                rightSlot={
                  <button className="pw-toggle" type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}>
                    <IconEye off={showPw} />
                  </button>
                }
              >
                <StrengthBar password={password} />
              </InputField>

              <InputField
                label="Confirm Password"
                type={showCf ? "text" : "password"}
                value={confirm}
                onChange={setConfirm}
                onKeyDown={onKey}
                placeholder="re-enter password"
                autoComplete="new-password"
                disabled={loading}
                hasError={confirm.length > 0 && confirm !== password}
                rightSlot={
                  <button className="pw-toggle" type="button" onClick={() => setShowCf(v => !v)} tabIndex={-1}>
                    <IconEye off={showCf} />
                  </button>
                }
              />

              {error && (
                <div style={{
                  background: "rgba(127,29,29,0.2)",
                  border: "1px solid #7f1d1d",
                  borderRadius: 4, padding: "9px 12px",
                  fontSize: 12, color: "#fca5a5",
                  display: "flex", alignItems: "flex-start", gap: 8,
                  fontFamily: "monospace",
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="1.5"/>
                    <path d="M12 8v4m0 4h.01" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  {error}
                </div>
              )}

              <button
                className="reg-btn"
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  width: "100%", padding: "10px", marginTop: 2,
                  background: loading ? "#1e3a5f" : "#1d4ed8",
                  border: "1px solid #1e40af",
                  borderRadius: 5,
                  color: loading ? "#4b5563" : "#e2e8f0",
                  fontSize: 13, fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                }}
              >
                {loading ? (
                  <>
                    <div style={{ width: 12, height: 12, border: "1.5px solid #374151", borderTopColor: "#60a5fa", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                    Submitting...
                  </>
                ) : "Submit request"}
              </button>
            </div>
          )}
        </div>

        {/* Back link */}
        {!success && (
          <div style={{ marginTop: 14, textAlign: "center" }}>
            <button
              onClick={onBackToLogin}
              style={{
                background: "none", border: "none",
                color: "#374151", fontSize: 11,
                cursor: "pointer", fontFamily: "monospace",
                letterSpacing: "0.02em", padding: 0,
                transition: "color 0.12s",
              }}
              onMouseEnter={e => e.currentTarget.style.color = "#60a5fa"}
              onMouseLeave={e => e.currentTarget.style.color = "#374151"}
            >
              ← Back to sign in
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 28, paddingTop: 18,
          borderTop: "1px solid #0d1a2a",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontSize: 10, color: "#1a2438", fontFamily: "monospace",
        }}>
          <span>TLS 1.3 encrypted</span>
          <span>kernexa · v2.4.1</span>
        </div>
      </div>
    </div>
  );
}
