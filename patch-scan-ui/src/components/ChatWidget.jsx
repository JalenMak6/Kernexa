import { useState, useRef, useEffect } from "react";

const WELCOME = "Hi! I'm Kernexa Assistant. Ask me anything about your infrastructure — host compliance, CVEs, Windows patches, or general security questions.";

function Message({ role, content, streaming }) {
  const isUser = role === "user";
  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 10,
    }}>
      <div style={{
        maxWidth: "82%",
        padding: "10px 14px",
        borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
        background: isUser
          ? "linear-gradient(135deg, #3b82f6, #6366f1)"
          : "var(--bg-subtle, #f1f5f9)",
        color: isUser ? "#fff" : "var(--text-primary, #0f172a)",
        fontSize: 13,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}>
        {content}
        {streaming && (
          <span style={{
            display: "inline-block", width: 6, height: 13,
            background: "var(--text-faint, #64748b)", borderRadius: 2,
            marginLeft: 4, animation: "pulse 1s infinite", verticalAlign: "middle",
          }} />
        )}
      </div>
    </div>
  );
}

export function ChatWidget() {
  // open   = panel fully visible
  // closed = bubble only (history preserved)
  const [open,     setOpen]     = useState(false);
  const [input,    setInput]    = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", content: WELCOME },
  ]);
  const [loading,  setLoading]  = useState(false);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const history     = messages.filter(m => m.role !== "system");
    const userMessage = { role: "user", content: text };

    setMessages(prev => [...prev, userMessage, { role: "assistant", content: "", streaming: true }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: history.slice(-10) }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || "Chat request failed");
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.content) {
              setMessages(prev => {
                const updated = [...prev];
                const last    = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = { ...last, content: last.content + parsed.content };
                }
                return updated;
              });
            }
          } catch (e) {
            if (e.message !== "Unexpected end of JSON input") throw e;
          }
        }
      }

      // Mark streaming done
      setMessages(prev => {
        const updated = [...prev];
        const last    = updated[updated.length - 1];
        if (last?.role === "assistant") updated[updated.length - 1] = { ...last, streaming: false };
        return updated;
      });

    } catch (e) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: `Sorry, something went wrong: ${e.message}`,
          streaming: false,
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const clearChat = () => setMessages([{ role: "assistant", content: WELCOME }]);

  const unreadCount = !open
    ? messages.filter(m => m.role === "assistant" && m.content !== WELCOME).length
    : 0;

  return (
    <>
      {/* ── Chat panel — only renders when open, history persists in state ── */}
      {open && (
        <div style={{
          position: "fixed", bottom: 84, right: 24,
          zIndex: 99999,                          // above all modals and detail panels
          width: 360, height: 520,
          background: "var(--bg-card, #fff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: 16,
          boxShadow: "0 12px 40px rgba(0,0,0,0.22)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          animation: "fadeIn 0.18s ease",
        }}>

          {/* Header */}
          <div style={{
            padding: "13px 14px",
            background: "linear-gradient(135deg, #0f172a, #1e293b)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#3b82f6,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                🤖
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>Kernexa Assistant</div>
                <div style={{ fontSize: 11, color: "#475569" }}>Powered by GPT-4o mini</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 4 }}>
              {/* Clear button */}
              <button onClick={clearChat} title="Clear conversation"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 15, width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#1e3a5f"; e.currentTarget.style.color = "#93c5fd"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#64748b"; }}
              >↺</button>

              {/* Minimise — hides panel, keeps history */}
              <button onClick={() => setOpen(false)} title="Minimise"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 18, width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
                onMouseEnter={e => { e.currentTarget.style.background = "#1e3a5f"; e.currentTarget.style.color = "#93c5fd"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#64748b"; }}
              >−</button>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "14px 12px",
            display: "flex", flexDirection: "column",
          }}>
            {messages.map((msg, i) => (
              <Message key={i} role={msg.role} content={msg.content} streaming={msg.streaming} />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: "10px 12px",
            borderTop: "1px solid var(--border, #e2e8f0)",
            display: "flex", gap: 8, alignItems: "flex-end",
            flexShrink: 0,
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your infrastructure..."
              rows={1}
              style={{
                flex: 1, resize: "none",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: 10, padding: "8px 12px",
                fontSize: 13, fontFamily: "inherit", outline: "none",
                background: "var(--bg-page, #f8fafc)",
                color: "var(--text-primary, #0f172a)",
                maxHeight: 100, overflowY: "auto", lineHeight: 1.5,
              }}
              onInput={e => {
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
              }}
            />
            <button onClick={send} disabled={!input.trim() || loading}
              style={{
                width: 36, height: 36, borderRadius: 10, border: "none",
                background: !input.trim() || loading
                  ? "var(--bg-subtle, #f1f5f9)"
                  : "linear-gradient(135deg,#3b82f6,#6366f1)",
                color: !input.trim() || loading ? "var(--text-ghost, #94a3b8)" : "#fff",
                cursor: !input.trim() || loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "all 0.15s", fontSize: 16,
              }}
            >
              {loading
                ? <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                : "↑"
              }
            </button>
          </div>
        </div>
      )}

      {/* ── Floating bubble — clicking opens/minimises panel ── */}
      <button
        onClick={() => setOpen(o => !o)}
        title={open ? "Minimise chat" : "Open Kernexa Assistant"}
        style={{
          position: "fixed", bottom: 24, right: 24,
          zIndex: 99999,
          width: 52, height: 52, borderRadius: "50%", border: "none",
          background: open
            ? "#1e293b"
            : "linear-gradient(135deg,#3b82f6,#6366f1)",
          color: "#fff", cursor: "pointer",
          boxShadow: "0 4px 16px rgba(59,130,246,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: open ? 22 : 22, transition: "all 0.2s",
        }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.08)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
      >
        {open ? "−" : "🤖"}

        {/* Unread badge — shows number of AI replies received while minimised */}
        {!open && unreadCount > 0 && (
          <span style={{
            position: "absolute", top: 0, right: 0,
            width: 18, height: 18, borderRadius: "50%",
            background: "#ef4444", color: "#fff",
            fontSize: 10, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #fff",
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
    </>
  );
}