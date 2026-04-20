import { useState } from "react";

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

function strengthScore(pw) {
  let s = 0;
  if (pw.length >= 8)            s++;
  if (pw.length >= 12)           s++;
  if (/[A-Z]/.test(pw))         s++;
  if (/[0-9]/.test(pw))         s++;
  if (/[^A-Za-z0-9]/.test(pw))  s++;
  return s;
}
const STRENGTH_LABEL = ["—", "weak", "fair", "fair", "good", "strong"];
const STRENGTH_COLOR = ["#374151", "#ef4444", "#f97316", "#f97316", "#3b82f6", "#22c55e"];

function StrengthBar({ password }) {
  if (!password) return null;
  const s = strengthScore(password);
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="flex gap-0.5 flex-1">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="flex-1 h-0.5 rounded-sm transition-colors duration-200"
            style={{ background: i <= s ? STRENGTH_COLOR[s] : "#111927" }} />
        ))}
      </div>
      <span className="text-[9px] mono tracking-[0.05em] w-9 text-right" style={{ color: STRENGTH_COLOR[s] }}>
        {STRENGTH_LABEL[s]}
      </span>
    </div>
  );
}

function InputField({ label, type, value, onChange, onKeyDown, placeholder, autoFocus, autoComplete, disabled, hasError, rightSlot, children }) {
  const [focused, setFocused] = useState(false);
  const isLockIcon = type === "password" || autoComplete?.startsWith("new-password");
  const borderColor = hasError ? "#7f1d1d" : focused ? "#1d4ed8" : "#1a2438";
  const ringStyle   = focused
    ? { boxShadow: hasError ? "0 0 0 2px rgba(127,29,29,0.35)" : "0 0 0 2px rgba(29,78,216,0.3)" }
    : {};

  return (
    <div>
      <label className="block text-[10px] font-semibold text-[#4b5563] uppercase tracking-[0.08em] mb-1.5 mono">{label}</label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex pointer-events-none">
          {isLockIcon ? <IconLock /> : <IconUser />}
        </div>
        <input
          type={type} value={value} onChange={e => onChange(e.target.value)}
          onKeyDown={onKeyDown} placeholder={placeholder} autoFocus={autoFocus}
          autoComplete={autoComplete} disabled={disabled}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          className="w-full pl-9 py-2.5 bg-[#070b14] rounded-[5px] text-[#d1d5db] text-md outline-none font-[inherit] transition-all duration-[120ms]"
          style={{ border: `1px solid ${borderColor}`, paddingRight: rightSlot ? "40px" : "12px", ...ringStyle }}
        />
        {rightSlot && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">{rightSlot}</div>
        )}
      </div>
      {children}
    </div>
  );
}

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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
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
    <div className="min-h-screen flex items-center justify-center bg-[#08111e] font-[Inter,system-ui,-apple-system,sans-serif] px-6 py-8">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #1e2d45; }
        .pw-toggle { background:none; border:none; cursor:pointer; padding:2px; display:flex; align-items:center; opacity:0.5; }
        .pw-toggle:hover { opacity:1; }
        .reg-btn:not(:disabled):hover { background: #1d4ed8 !important; }
      `}</style>

      <div className="w-full max-w-[340px]">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-7">
          <div className="w-[30px] h-[30px] rounded-[6px] bg-[#1a2540] border border-[#253354] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V6L12 2z" fill="#253354" stroke="#4b6cb7" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M9 12l2 2 4-4" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div className="text-[14px] font-bold text-[#e2e8f0] tracking-[-0.1px]">Kermonix</div>
            <div className="text-[9px] text-[#374151] tracking-[0.08em] mono uppercase">Security Platform</div>
          </div>
        </div>

        {/* Heading */}
        <div className="mb-5">
          <h2 className="text-[18px] font-bold text-[#e2e8f0] m-0 mb-0.5 tracking-[-0.2px]">
            {success ? "Request received" : "Request access"}
          </h2>
          <p className="text-xs text-[#374151] m-0 mono">
            {success ? "Pending administrator approval" : "Admin approval required · accounts are not self-serve"}
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#060a12] border border-[#111927] rounded-[6px] p-[22px_20px]">
          {success ? (
            <div>
              <div className="flex items-center gap-2.5 bg-[rgba(34,197,94,0.08)] border border-[#14532d] rounded-[4px] px-3 py-2.5 mb-4">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-sm text-[#4ade80] mono">Request queued for {username}</span>
              </div>
              <p className="text-sm text-[#374151] mono leading-relaxed mb-4 mt-0">
                An admin will review and activate your account. You will be able to sign in once approved.
              </p>
              <button
                onClick={onBackToLogin}
                className="w-full py-2.5 bg-[#1d4ed8] border border-[#1e40af] rounded-[5px] text-[#e2e8f0] text-md font-semibold cursor-pointer font-[inherit]"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">
              <InputField label="Username" type="text" value={username} onChange={setUsername}
                onKeyDown={onKey} placeholder="choose a username" autoFocus autoComplete="username" disabled={loading} />

              <InputField label="Password" type={showPw ? "text" : "password"} value={password}
                onChange={setPassword} onKeyDown={onKey} placeholder="min 8 characters"
                autoComplete="new-password" disabled={loading}
                rightSlot={
                  <button className="pw-toggle" type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}>
                    <IconEye off={showPw} />
                  </button>
                }>
                <StrengthBar password={password} />
              </InputField>

              <InputField label="Confirm Password" type={showCf ? "text" : "password"} value={confirm}
                onChange={setConfirm} onKeyDown={onKey} placeholder="re-enter password"
                autoComplete="new-password" disabled={loading}
                hasError={confirm.length > 0 && confirm !== password}
                rightSlot={
                  <button className="pw-toggle" type="button" onClick={() => setShowCf(v => !v)} tabIndex={-1}>
                    <IconEye off={showCf} />
                  </button>
                } />

              {error && (
                <div className="bg-[rgba(127,29,29,0.2)] border border-[#7f1d1d] rounded-[4px] px-3 py-2 text-sm text-[#fca5a5] flex items-start gap-2 mono">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="1.5"/>
                    <path d="M12 8v4m0 4h.01" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  {error}
                </div>
              )}

              <button
                className="reg-btn w-full py-2.5 mt-0.5 border border-[#1e40af] rounded-[5px] text-md font-semibold font-[inherit] flex items-center justify-center gap-1.5 transition-colors"
                onClick={handleSubmit} disabled={loading}
                style={{
                  background: loading ? "#1e3a5f" : "#1d4ed8",
                  color: loading ? "#4b5563" : "#e2e8f0",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? (
                  <>
                    <div className="w-3 h-3 border-[1.5px] border-[#374151] border-t-[#60a5fa] rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : "Submit request"}
              </button>
            </div>
          )}
        </div>

        {/* Back link */}
        {!success && (
          <div className="mt-3.5 text-center">
            <button
              onClick={onBackToLogin}
              className="bg-transparent border-none text-[#374151] text-xs cursor-pointer mono tracking-[0.02em] p-0 transition-colors duration-[120ms] hover:text-[#60a5fa]"
            >
              ← Back to sign in
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-7 pt-[18px] border-t border-[#0d1a2a] flex items-center justify-between text-[10px] text-[#1a2438] mono">
          <span>TLS 1.3 encrypted</span>
          <span>kermonix · v2.4.1</span>
        </div>
      </div>
    </div>
  );
}
