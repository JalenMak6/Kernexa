import { useState } from "react";
import { login } from "../utils/api";

export function LoginPage({ onLogin, onRegister }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Username and password are required");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await login(username, password);
      onLogin(data.user);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight:       "100vh",
      display:         "flex",
      alignItems:      "center",
      justifyContent:  "center",
      background:      "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
      fontFamily:      "system-ui, -apple-system, sans-serif",
    }}>
      {/* Background grid pattern */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.05,
        backgroundImage: "linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      <div style={{
        position:     "relative",
        width:        "100%",
        maxWidth:     420,
        padding:      "0 24px",
      }}>
        {/* Logo / brand */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            display:        "inline-flex",
            alignItems:     "center",
            justifyContent: "center",
            width:           56,
            height:          56,
            borderRadius:    14,
            background:      "linear-gradient(135deg, #6366f1, #8b5cf6)",
            marginBottom:    16,
            boxShadow:       "0 8px 24px rgba(99,102,241,0.4)",
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.5px" }}>
            Kernexa
          </div>
          <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 4 }}>
            Security Compliance Platform
          </div>
        </div>

        {/* Card */}
        <div style={{
          background:   "rgba(30, 41, 59, 0.8)",
          border:       "1px solid rgba(148, 163, 184, 0.12)",
          borderRadius: 16,
          padding:      "36px 32px",
          backdropFilter: "blur(12px)",
          boxShadow:    "0 20px 60px rgba(0,0,0,0.4)",
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>
            Sign in
          </div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 28 }}>
            Enter your credentials to access the dashboard
          </div>

          <div onSubmit={handleSubmit}>
            {/* Username */}
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: "block", fontSize: 12, fontWeight: 600,
                color: "#94a3b8", textTransform: "uppercase",
                letterSpacing: "0.06em", marginBottom: 6,
              }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit(e)}
                placeholder="Enter username"
                autoFocus
                autoComplete="username"
                disabled={loading}
                style={{
                  width:        "100%",
                  padding:      "11px 14px",
                  background:   "rgba(15, 23, 42, 0.6)",
                  border:       `1px solid ${error ? "rgba(239,68,68,0.5)" : "rgba(148,163,184,0.15)"}`,
                  borderRadius: 8,
                  color:        "#f1f5f9",
                  fontSize:     14,
                  outline:      "none",
                  fontFamily:   "inherit",
                  boxSizing:    "border-box",
                  transition:   "border-color 0.15s",
                }}
                onFocus={e => e.target.style.borderColor = "rgba(99,102,241,0.6)"}
                onBlur={e  => e.target.style.borderColor = error
                  ? "rgba(239,68,68,0.5)" : "rgba(148,163,184,0.15)"}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 24 }}>
              <label style={{
                display: "block", fontSize: 12, fontWeight: 600,
                color: "#94a3b8", textTransform: "uppercase",
                letterSpacing: "0.06em", marginBottom: 6,
              }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit(e)}
                placeholder="Enter password"
                autoComplete="current-password"
                disabled={loading}
                style={{
                  width:        "100%",
                  padding:      "11px 14px",
                  background:   "rgba(15, 23, 42, 0.6)",
                  border:       `1px solid ${error ? "rgba(239,68,68,0.5)" : "rgba(148,163,184,0.15)"}`,
                  borderRadius: 8,
                  color:        "#f1f5f9",
                  fontSize:     14,
                  outline:      "none",
                  fontFamily:   "inherit",
                  boxSizing:    "border-box",
                  transition:   "border-color 0.15s",
                }}
                onFocus={e => e.target.style.borderColor = "rgba(99,102,241,0.6)"}
                onBlur={e  => e.target.style.borderColor = error
                  ? "rgba(239,68,68,0.5)" : "rgba(148,163,184,0.15)"}
              />
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background:   "rgba(239,68,68,0.1)",
                border:       "1px solid rgba(239,68,68,0.3)",
                borderRadius: 8,
                padding:      "10px 14px",
                fontSize:     13,
                color:        "#fca5a5",
                marginBottom: 20,
                display:      "flex",
                alignItems:   "center",
                gap:          8,
              }}>
                <span>⚠</span> {error}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                width:        "100%",
                padding:      "12px",
                background:   loading
                  ? "rgba(99,102,241,0.4)"
                  : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border:       "none",
                borderRadius: 8,
                color:        loading ? "rgba(255,255,255,0.5)" : "#fff",
                fontSize:     14,
                fontWeight:   700,
                cursor:       loading ? "not-allowed" : "pointer",
                fontFamily:   "inherit",
                transition:   "all 0.15s",
                display:      "flex",
                alignItems:   "center",
                justifyContent: "center",
                gap:          8,
                boxShadow:    loading ? "none" : "0 4px 14px rgba(99,102,241,0.4)",
              }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: 14, height: 14,
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "rgba(255,255,255,0.8)",
                    borderRadius: "50%",
                    animation: "spin 0.7s linear infinite",
                  }} />
                  Signing in...
                </>
              ) : "Sign in"}
            </button>

            {/* Request access link */}
            {onRegister && (
              <div style={{ textAlign: "center", marginTop: 4 }}>
                <button onClick={onRegister} style={{ background: "none", border: "none", color: "#6366f1", fontSize: 13, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
                  Don't have an account? Request access
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "#475569" }}>
          Kernexa · Security Compliance Platform
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #475569; }
      `}</style>
    </div>
  );
}