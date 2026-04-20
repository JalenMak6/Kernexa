import { useState, useRef, useEffect } from "react";

const WELCOME = "Hi! I'm Kermonix Assistant. Ask me anything about your infrastructure — host compliance, CVEs, Windows patches, or general security questions.";

function Message({ role, content, streaming }) {
  const isUser = role === "user";
  return (
    <div className={`flex mb-[10px] ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[82%] py-[10px] px-[14px] text-md leading-relaxed whitespace-pre-wrap break-words ${isUser ? "text-white" : "text-text-primary"}`}
        style={{
          borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
          background: isUser ? "linear-gradient(135deg, #3b82f6, #6366f1)" : "var(--bg-subtle)",
        }}
      >
        {content}
        {streaming && (
          <span className="inline-block w-[6px] h-[13px] bg-text-faint rounded-sm ml-1 align-middle animate-pulse" />
        )}
      </div>
    </div>
  );
}

export function ChatWidget() {
  const [open,     setOpen]     = useState(false);
  const [input,    setInput]    = useState("");
  const [messages, setMessages] = useState([{ role: "assistant", content: WELCOME }]);
  const [loading,  setLoading]  = useState(false);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

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

  const canSend = input.trim() && !loading;

  return (
    <>
      {open && (
        <div className="fixed bottom-[84px] right-6 z-[99999] w-[360px] h-[520px] bg-bg-card border border-border-base rounded-2xl overflow-hidden flex flex-col"
          style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.22)", animation: "fadeIn 0.18s ease" }}
        >
          {/* Header */}
          <div className="px-[14px] py-[13px] flex items-center justify-between shrink-0"
            style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)" }}
          >
            <div className="flex items-center gap-[10px]">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-base"
                style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
                🤖
              </div>
              <div>
                <div className="text-md font-bold text-slate-50">Kermonix Assistant</div>
                <div className="text-xs text-slate-600">Powered by GPT-4o mini</div>
              </div>
            </div>

            <div className="flex gap-1">
              <button onClick={clearChat} title="Clear conversation"
                className="bg-transparent border-none cursor-pointer text-slate-500 text-[15px] w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#1e3a5f] hover:text-[#93c5fd] transition-colors">
                ↺
              </button>
              <button onClick={() => setOpen(false)} title="Minimise"
                className="bg-transparent border-none cursor-pointer text-slate-500 text-lg w-7 h-7 rounded-md flex items-center justify-center leading-none hover:bg-[#1e3a5f] hover:text-[#93c5fd] transition-colors">
                −
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto py-[14px] px-3 flex flex-col">
            {messages.map((msg, i) => (
              <Message key={i} role={msg.role} content={msg.content} streaming={msg.streaming} />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-[10px] border-t border-border-base flex gap-2 items-end shrink-0">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your infrastructure..."
              rows={1}
              className="flex-1 resize-none border border-border-base rounded-[10px] py-2 px-3 text-md font-[inherit] outline-none bg-bg-page text-text-primary max-h-[100px] overflow-y-auto leading-relaxed"
              onInput={e => {
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
              }}
            />
            <button
              onClick={send}
              disabled={!canSend}
              className={`w-9 h-9 rounded-[10px] border-none flex items-center justify-center shrink-0 text-base transition-all duration-150 ${canSend ? "cursor-pointer text-white" : "cursor-not-allowed text-text-ghost bg-bg-subtle"}`}
              style={{ background: canSend ? "linear-gradient(135deg,#3b82f6,#6366f1)" : undefined }}
            >
              {loading
                ? <div className="w-[14px] h-[14px] border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : "↑"
              }
            </button>
          </div>
        </div>
      )}

      {/* Floating bubble */}
      <button
        onClick={() => setOpen(o => !o)}
        title={open ? "Minimise chat" : "Open Kermonix Assistant"}
        className="fixed bottom-6 right-6 z-[99999] w-[52px] h-[52px] rounded-full border-none text-white cursor-pointer flex items-center justify-center text-[22px] transition-all duration-200 hover:scale-[1.08]"
        style={{
          background: open ? "#1e293b" : "linear-gradient(135deg,#3b82f6,#6366f1)",
          boxShadow: "0 4px 16px rgba(59,130,246,0.4)",
        }}
      >
        {open ? "−" : "🤖"}

        {!open && unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
    </>
  );
}
