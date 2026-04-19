import { useState } from "react";
import { login } from "../utils/api";

/* ── Icons ──────────────────────────────────────────────────────────────────── */
const IconUser = ({ color }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.5"/>
    <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconLock = ({ color }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <rect x="5" y="11" width="14" height="10" rx="2" stroke={color} strokeWidth="1.5"/>
    <path d="M8 11V7a4 4 0 018 0v4" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconEye = ({ off }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    {off ? (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0112 20C6 20 2 12 2 12a18.06 18.06 0 015.06-5.94" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M9.9 4.24A9.12 9.12 0 0112 4c6 0 10 8 10 8a18.5 18.5 0 01-2.16 3.19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M14.12 14.12A3 3 0 119.88 9.88" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </>
    ) : (
      <>
        <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
      </>
    )}
  </svg>
);
const IconArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/* ── Main component ─────────────────────────────────────────────────────────── */
export function LoginPage({ onLogin, onRegister }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [uFocused, setUFocused] = useState(false);
  const [pFocused, setPFocused] = useState(false);

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!username || !password) { setError("Username and password are required."); return; }
    setError(null);
    setLoading(true);
    try {
      const data = await login(username, password);
      onLogin(data.user);
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onKey = e => e.key === "Enter" && handleSubmit();

  const borderColor = (focused, hasError) =>
    hasError ? "#f87171" : focused ? "#00c9a7" : "rgba(255,255,255,0.1)";
  const iconColor = (focused, hasError) =>
    hasError ? "#f87171" : focused ? "#00c9a7" : "rgba(255,255,255,0.25)";
  const inputStyle = (focused, hasError, withRight) => ({
    width: "100%", boxSizing: "border-box",
    padding: withRight ? "11px 42px 11px 40px" : "11px 14px 11px 40px",
    background: focused ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.03)",
    border: `1px solid ${borderColor(focused, hasError)}`,
    borderRadius: 8,
    color: "#f1f5f9", fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    transition: "border-color 0.18s, background 0.18s, box-shadow 0.18s",
    boxShadow: focused && !hasError ? "0 0 0 3px rgba(0,201,167,0.12)" : hasError ? "0 0 0 3px rgba(248,113,113,0.1)" : "none",
    letterSpacing: "0.01em",
  });

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      fontFamily: "'Inter', system-ui, sans-serif",
      background: "#060d18",
      position: "relative",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@700;800&display=swap');

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-8px); }
        }
        @keyframes orb1 {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%       { opacity: 0.9; transform: scale(1.08); }
        }

        input::placeholder { color: rgba(148,163,184,0.35); }
        input:disabled     { opacity: 0.45; cursor: not-allowed; }

        .pw-toggle {
          background: none; border: none; cursor: pointer;
          padding: 4px; display: flex; align-items: center;
          color: rgba(255,255,255,0.3); transition: color 0.15s;
        }
        .pw-toggle:hover { color: rgba(255,255,255,0.7); }

        .sign-in-btn {
          width: 100%; padding: 13px;
          background: linear-gradient(135deg, #00c9a7 0%, #00a896 100%);
          border: none; border-radius: 8px;
          color: #060d18;
          font-size: 14px; font-weight: 700;
          font-family: inherit; letter-spacing: 0.01em;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: filter 0.18s, transform 0.18s, box-shadow 0.18s;
          box-shadow: 0 4px 20px rgba(0,201,167,0.3);
        }
        .sign-in-btn:hover:not(:disabled) {
          filter: brightness(1.08);
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(0,201,167,0.4);
        }
        .sign-in-btn:disabled {
          opacity: 0.45; cursor: not-allowed; transform: none;
        }

        .req-link {
          color: #00c9a7; background: none; border: none;
          cursor: pointer; font-family: inherit;
          font-size: 13px; font-weight: 600; padding: 0;
          transition: color 0.15s;
        }
        .req-link:hover { color: #5eead4; }

        @media (max-width: 900px) {
          .login-left  { display: none !important; }
          .login-right { border-left: none !important; flex: 1 1 100% !important; max-width: 100% !important; }
          .login-right-row2 { padding: 0 32px !important; }
          .login-right-row1, .login-right-row3 { padding-left: 32px !important; padding-right: 32px !important; }
          .mobile-logo { display: flex !important; }
        }
            `}</style>

      {/* ── Background atmosphere ────────────────────────────────────────────── */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        backgroundImage: "radial-gradient(rgba(0,201,167,0.055) 1px, transparent 1px)",
        backgroundSize: "36px 36px",
      }} />
      {/* Ambient glow — top-left */}
      <div style={{
        position: "fixed", top: "-20%", left: "-10%",
        width: 600, height: 600, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(0,201,167,0.09) 0%, transparent 65%)",
        pointerEvents: "none", animation: "orb1 8s ease-in-out infinite",
      }} />
      {/* Ambient glow — bottom-right */}
      <div style={{
        position: "fixed", bottom: "-15%", right: "-5%",
        width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />

      {/* ── LEFT PANEL ───────────────────────────────────────────────────────── */}
      <div className="login-left" style={{
        flex: "1 0 420px", minWidth: 420,
        display: "flex", flexDirection: "column",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        position: "relative", zIndex: 10,
      }}>
        {/* Row 1 — Logo */}
        <div style={{
          flexShrink: 0,
          padding: "36px 60px",
          display: "flex", alignItems: "center", gap: 12,
          animation: "fadeUp 0.4s ease both",
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: "linear-gradient(135deg, #00c9a7, #0891b2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 16px rgba(0,201,167,0.3)",
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V6L12 2z"
                fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.8" strokeLinejoin="round"/>
              <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontSize: 17, fontWeight: 700, color: "#f8fafc", letterSpacing: "-0.2px", fontFamily: "'Outfit', sans-serif" }}>
            Kermonix
          </span>
        </div>

        {/* Row 2 — Marketing copy, vertically centred */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center",
          padding: "0 60px",
          animation: "fadeUp 0.45s ease 0.08s both",
        }}>
          <div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              background: "rgba(0,201,167,0.1)", border: "1px solid rgba(0,201,167,0.2)",
              borderRadius: 20, padding: "4px 12px", marginBottom: 24,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00c9a7" }} />
              <span style={{ fontSize: 11, color: "#00c9a7", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Security Compliance Platform
              </span>
            </div>

            <h1 style={{
              fontSize: 38,
              fontWeight: 800,
              margin: "0 0 20px",
              color: "#f8fafc",
              lineHeight: 1.15,
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: "-0.5px",
            }}>
              Unified<br/>
              <span style={{ background: "linear-gradient(90deg, #00c9a7, #22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Compliance
              </span><br/>
              Management
            </h1>

            <p style={{ fontSize: 15, color: "rgba(148,163,184,0.7)", margin: 0, lineHeight: 1.7, maxWidth: 360 }}>
              Scan, enrich, and remediate vulnerabilities across your Linux and Windows estate — from a single pane of glass.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 32 }}>
              {["Real-time CVE Scanning", "LDAP / Active Directory", "Multi-OS Asset Inventory"].map(f => (
                <span key={f} style={{
                  fontSize: 12, color: "rgba(148,163,184,0.6)",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 6, padding: "5px 12px",
                }}>
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3 — Copyright */}
        <div style={{
          flexShrink: 0,
          padding: "24px 60px",
          fontSize: 12, color: "rgba(100,116,139,0.45)", letterSpacing: "0.02em",
          animation: "fadeUp 0.4s ease 0.15s both",
        }}>
          © {new Date().getFullYear()} Kermonix. All rights reserved.
        </div>
      </div>

      {/* ── RIGHT PANEL ──────────────────────────────────────────────────────── */}
      <div className="login-right" style={{
        flex: "0 0 440px",
        display: "flex", flexDirection: "column",
        borderLeft: "1px solid rgba(255,255,255,0.06)",
        position: "relative", zIndex: 10,
      }}>
        {/* Row 1 — Logo spacer */}
        <div className="login-right-row1" style={{ flexShrink: 0, padding: "36px 52px", display: "flex", alignItems: "center" }}>
          {/* Mobile: show logo here */}
          <div className="mobile-logo" style={{ display: "none", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #00c9a7, #0891b2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V6L12 2z" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.8" strokeLinejoin="round"/>
                <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc", fontFamily: "'Outfit', sans-serif" }}>Kermonix</span>
          </div>
        </div>

        {/* Row 2 — Form, vertically centred */}
        <div className="login-right-row2" style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          padding: "0 52px",
          animation: "fadeUp 0.5s ease 0.05s both",
        }}>
          <div style={{ width: "100%", maxWidth: 340 }}>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: "#f1f5f9", margin: "0 0 6px", letterSpacing: "-0.4px", fontFamily: "'Outfit', sans-serif" }}>
                Sign in
              </h2>
              <p style={{ fontSize: 13, color: "rgba(148,163,184,0.5)", margin: 0 }}>
                Enter your credentials to continue
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Username */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(203,213,225,0.65)", marginBottom: 7, letterSpacing: "0.02em" }}>
                  Username
                </label>
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                    <IconUser color={iconColor(uFocused, !!error)} />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    onKeyDown={onKey}
                    placeholder="Enter your username"
                    autoFocus
                    autoComplete="username"
                    disabled={loading}
                    onFocus={() => setUFocused(true)}
                    onBlur={() => setUFocused(false)}
                    style={inputStyle(uFocused, !!error, false)}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(203,213,225,0.65)", marginBottom: 7, letterSpacing: "0.02em" }}>
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                    <IconLock color={iconColor(pFocused, !!error)} />
                  </div>
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={onKey}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={loading}
                    onFocus={() => setPFocused(true)}
                    onBlur={() => setPFocused(false)}
                    style={inputStyle(pFocused, !!error, true)}
                  />
                  <button
                    className="pw-toggle"
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    tabIndex={-1}
                    title={showPw ? "Hide password" : "Show password"}
                    style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)" }}
                  >
                    <IconEye off={showPw} />
                  </button>
                </div>
              </div>

              {error && (
                <div style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  borderRadius: 8, padding: "10px 14px",
                  fontSize: 13, color: "#fca5a5",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" stroke="#f87171" strokeWidth="1.5"/>
                    <path d="M12 8v4m0 4h.01" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  {error}
                </div>
              )}

              <button className="sign-in-btn" onClick={handleSubmit} disabled={loading} style={{ marginTop: 4 }}>
                {loading ? (
                  <>
                    <div style={{ width: 14, height: 14, border: "2px solid rgba(6,13,24,0.25)", borderTopColor: "#060d18", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                    Signing in...
                  </>
                ) : (
                  <>Sign in <IconArrow /></>
                )}
              </button>
            </div>

            {onRegister && (
              <div style={{ textAlign: "center", marginTop: 20 }}>
                <span style={{ fontSize: 13, color: "rgba(100,116,139,0.6)" }}>Don't have an account? </span>
                <button className="req-link" onClick={onRegister}>Request access</button>
              </div>
            )}
          </div>
        </div>

        {/* Row 3 — TLS footer */}
        <div className="login-right-row3" style={{
          flexShrink: 0,
          padding: "24px 52px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          fontSize: 11, color: "rgba(100,116,139,0.4)",
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Secured with TLS · Kermonix Security Compliance Platform
        </div>
      </div>
    </div>
  );
}