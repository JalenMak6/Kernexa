import { useState } from "react";
import { login } from "../utils/api";

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
    setError(null); setLoading(true);
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

  return (
    <div className="min-h-screen flex font-[Inter,system-ui,sans-serif] bg-[#060d18] relative">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@700;800&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        @keyframes orb1   { 0%,100% { opacity:.55; transform:scale(1); } 50% { opacity:.9; transform:scale(1.08); } }
        .login-input::placeholder { color: rgba(148,163,184,0.35); }
        .login-input:disabled     { opacity: 0.45; cursor: not-allowed; }
        .pw-toggle { background:none; border:none; cursor:pointer; padding:4px; display:flex; align-items:center; color:rgba(255,255,255,0.3); transition:color 0.15s; }
        .pw-toggle:hover { color: rgba(255,255,255,0.7); }
        .sign-in-btn { width:100%; padding:13px; background:linear-gradient(135deg,#00c9a7 0%,#00a896 100%); border:none; border-radius:8px; color:#060d18; font-size:14px; font-weight:700; font-family:inherit; letter-spacing:0.01em; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; transition:filter 0.18s,transform 0.18s,box-shadow 0.18s; box-shadow:0 4px 20px rgba(0,201,167,0.3); }
        .sign-in-btn:hover:not(:disabled) { filter:brightness(1.08); transform:translateY(-1px); box-shadow:0 8px 28px rgba(0,201,167,0.4); }
        .sign-in-btn:disabled { opacity:0.45; cursor:not-allowed; transform:none; }
        .req-link { color:#00c9a7; background:none; border:none; cursor:pointer; font-family:inherit; font-size:13px; font-weight:600; padding:0; transition:color 0.15s; }
        .req-link:hover { color:#5eead4; }
        @media (max-width:900px) { .login-left { display:none !important; } .login-right { border-left:none !important; flex:1 1 100% !important; max-width:100% !important; } }
      `}</style>

      {/* Background atmosphere */}
      <div className="fixed inset-0 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(rgba(0,201,167,0.055) 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
      <div className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(0,201,167,0.09) 0%, transparent 65%)", animation: "orb1 8s ease-in-out infinite" }} />
      <div className="fixed bottom-[-15%] right-[-5%] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 65%)" }} />

      {/* LEFT PANEL */}
      <div className="login-left flex-[1_0_420px] min-w-[420px] flex flex-col border-r border-[rgba(255,255,255,0.06)] relative z-10">
        {/* Logo */}
        <div className="shrink-0 px-[60px] py-9 flex items-center gap-3" style={{ animation: "fadeUp 0.4s ease both" }}>
          <div className="w-9 h-9 rounded-[9px] flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#00c9a7,#0891b2)", boxShadow: "0 4px 16px rgba(0,201,167,0.3)" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V6L12 2z" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.8" strokeLinejoin="round"/>
              <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-[17px] font-bold text-[#f8fafc] tracking-[-0.2px] font-[Outfit,sans-serif]">Kermonix</span>
        </div>

        {/* Marketing copy */}
        <div className="flex-1 flex items-center px-[60px]" style={{ animation: "fadeUp 0.45s ease 0.08s both" }}>
          <div>
            <div className="inline-flex items-center gap-1.5 border border-[rgba(0,201,167,0.2)] rounded-[20px] px-3 py-1 mb-6"
              style={{ background: "rgba(0,201,167,0.1)" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-[#00c9a7]" />
              <span className="text-xs text-[#00c9a7] font-semibold tracking-[0.08em] uppercase">Security Compliance Platform</span>
            </div>
            <h1 className="text-[38px] font-extrabold mb-5 text-[#f8fafc] leading-[1.15] font-[Outfit,sans-serif] tracking-[-0.5px]">
              Unified<br/>
              <span style={{ background: "linear-gradient(90deg,#00c9a7,#22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Compliance
              </span><br/>
              Management
            </h1>
            <p className="text-[15px] text-[rgba(148,163,184,0.7)] m-0 leading-[1.7] max-w-[360px]">
              Scan, enrich, and remediate vulnerabilities across your Linux and Windows estate — from a single pane of glass.
            </p>
            <div className="flex flex-wrap gap-2.5 mt-8">
              {["Real-time CVE Scanning", "LDAP / Active Directory", "Multi-OS Asset Inventory"].map(f => (
                <span key={f} className="text-sm text-[rgba(148,163,184,0.6)] border border-[rgba(255,255,255,0.07)] rounded-md px-3 py-1"
                  style={{ background: "rgba(255,255,255,0.04)" }}>{f}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="shrink-0 px-[60px] py-6 text-sm text-[rgba(100,116,139,0.45)] tracking-[0.02em]"
          style={{ animation: "fadeUp 0.4s ease 0.15s both" }}>
          © {new Date().getFullYear()} Kermonix. All rights reserved.
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="login-right flex-[0_0_440px] flex flex-col border-l border-[rgba(255,255,255,0.06)] relative z-10">
        <div className="shrink-0 px-[52px] py-9 flex items-center" />

        {/* Form */}
        <div className="flex-1 flex items-center justify-center px-[52px]" style={{ animation: "fadeUp 0.5s ease 0.05s both" }}>
          <div className="w-full max-w-[340px]">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-[#f1f5f9] mb-1.5 tracking-[-0.4px] font-[Outfit,sans-serif]">Sign in</h2>
              <p className="text-md text-[rgba(148,163,184,0.5)] m-0">Enter your credentials to continue</p>
            </div>

            <div className="flex flex-col gap-4">
              {/* Username */}
              <div>
                <label className="block text-sm font-semibold text-[rgba(203,213,225,0.65)] mb-1.5 tracking-[0.02em]">Username</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <IconUser color={iconColor(uFocused, !!error)} />
                  </div>
                  <input
                    type="text" value={username} onChange={e => setUsername(e.target.value)}
                    onKeyDown={onKey} placeholder="Enter your username" autoFocus autoComplete="username"
                    disabled={loading} onFocus={() => setUFocused(true)} onBlur={() => setUFocused(false)}
                    className="login-input w-full pl-10 pr-3.5 py-[11px] rounded-base text-[14px] text-[#f1f5f9] outline-none tracking-[0.01em] transition-all duration-[180ms]"
                    style={{
                      background: uFocused ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${borderColor(uFocused, !!error)}`,
                      boxShadow: uFocused && !error ? "0 0 0 3px rgba(0,201,167,0.12)" : error ? "0 0 0 3px rgba(248,113,113,0.1)" : "none",
                    }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-[rgba(203,213,225,0.65)] mb-1.5 tracking-[0.02em]">Password</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <IconLock color={iconColor(pFocused, !!error)} />
                  </div>
                  <input
                    type={showPw ? "text" : "password"} value={password}
                    onChange={e => setPassword(e.target.value)} onKeyDown={onKey}
                    placeholder="Enter your password" autoComplete="current-password"
                    disabled={loading} onFocus={() => setPFocused(true)} onBlur={() => setPFocused(false)}
                    className="login-input w-full pl-10 pr-10 py-[11px] rounded-base text-[14px] text-[#f1f5f9] outline-none tracking-[0.01em] transition-all duration-[180ms]"
                    style={{
                      background: pFocused ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${borderColor(pFocused, !!error)}`,
                      boxShadow: pFocused && !error ? "0 0 0 3px rgba(0,201,167,0.12)" : error ? "0 0 0 3px rgba(248,113,113,0.1)" : "none",
                    }}
                  />
                  <button className="pw-toggle absolute right-2.5 top-1/2 -translate-y-1/2" type="button"
                    onClick={() => setShowPw(v => !v)} tabIndex={-1} title={showPw ? "Hide password" : "Show password"}>
                    <IconEye off={showPw} />
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.25)] rounded-base px-3.5 py-2.5 text-md text-[#fca5a5] flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
                    <circle cx="12" cy="12" r="10" stroke="#f87171" strokeWidth="1.5"/>
                    <path d="M12 8v4m0 4h.01" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  {error}
                </div>
              )}

              <button className="sign-in-btn" onClick={handleSubmit} disabled={loading} style={{ marginTop: 4 }}>
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-[rgba(6,13,24,0.25)] border-t-[#060d18] animate-spin" />
                    Signing in...
                  </>
                ) : <>Sign in <IconArrow /></>}
              </button>
            </div>

            {onRegister && (
              <div className="text-center mt-5">
                <span className="text-md text-[rgba(100,116,139,0.6)]">Don't have an account? </span>
                <button className="req-link" onClick={onRegister}>Request access</button>
              </div>
            )}
          </div>
        </div>

        {/* TLS footer */}
        <div className="shrink-0 px-[52px] py-6 flex items-center justify-center gap-1.5 text-xs text-[rgba(100,116,139,0.4)]">
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
