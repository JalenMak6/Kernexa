import { useState } from "react";

export function RegisterPage({ onBackToLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
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
      const res = await fetch("/api/auth/register", {
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

  return (
    <div style={{
      minHeight:      "100vh",
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      background:     "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
      fontFamily:     "system-ui, -apple-system, sans-serif",
      padding:        24,
    }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.05, backgroundImage: "linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

      <div style={{ position: "relative", width: "100%", maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", marginBottom: 16, boxShadow: "0 8px 24px rgba(99,102,241,0.4)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.5px" }}>Kernexa</div>
          <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 4 }}>Request Access</div>
        </div>

        {/* Card */}
        <div style={{ background: "rgba(30, 41, 59, 0.8)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: 16, padding: "36px 32px", backdropFilter: "blur(12px)", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>

          {success ? (
            /* Success state */
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(34,197,94,0.15)", border: "2px solid rgba(34,197,94,0.4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 24 }}>
                ✓
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>Request Submitted</div>
              <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, marginBottom: 24 }}>
                Your account request has been sent to the administrator for approval. You'll be able to log in once it's approved.
              </div>
              <button onClick={onBackToLogin}
                style={{ width: "100%", padding: "12px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: 8, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                Back to Sign In
              </button>
            </div>
          ) : (
            /* Registration form */
            <>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>Create Account</div>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 28 }}>Your request will be reviewed by an administrator</div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[
                  { label: "Username",         value: username, onChange: setUsername, type: "text",     placeholder: "Choose a username" },
                  { label: "Password",         value: password, onChange: setPassword, type: "password", placeholder: "Min 8 characters" },
                  { label: "Confirm Password", value: confirm,  onChange: setConfirm,  type: "password", placeholder: "Re-enter password" },
                ].map(({ label, value, onChange, type, placeholder }) => (
                  <div key={label}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</label>
                    <input
                      type={type}
                      value={value}
                      onChange={e => onChange(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleSubmit()}
                      placeholder={placeholder}
                      disabled={loading}
                      style={{ width: "100%", padding: "11px 14px", background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.15)", borderRadius: 8, color: "#f1f5f9", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                      onFocus={e => e.target.style.borderColor = "rgba(99,102,241,0.6)"}
                      onBlur={e  => e.target.style.borderColor = "rgba(148,163,184,0.15)"}
                    />
                  </div>
                ))}

                {error && (
                  <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#fca5a5", display: "flex", alignItems: "center", gap: 8 }}>
                    <span>⚠</span> {error}
                  </div>
                )}

                <button onClick={handleSubmit} disabled={loading}
                  style={{ width: "100%", padding: "12px", background: loading ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: 8, color: loading ? "rgba(255,255,255,0.5)" : "#fff", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: loading ? "none" : "0 4px 14px rgba(99,102,241,0.4)" }}>
                  {loading ? (
                    <><div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "rgba(255,255,255,0.8)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />Submitting...</>
                  ) : "Request Access"}
                </button>

                <button onClick={onBackToLogin}
                  style={{ width: "100%", padding: "10px", background: "transparent", border: "none", color: "#64748b", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                  ← Back to Sign In
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } input::placeholder { color: #475569; }`}</style>
    </div>
  );
}