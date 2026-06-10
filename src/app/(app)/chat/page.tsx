"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Bot, User } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "מה הפרוטוקול המומלץ לשיקום ACL לאחר ניתוח?",
  "איך מבדילים בין קרע בשרוול הסובב לבין תסמונת פגיעה?",
  "תרגילים להחזרת ROM בכתף לאחר הקפאה",
  "ציוני VAS — מה נחשב שיפור משמעותי קלינית?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");
    const next: Message[] = [...messages, { role: "user", content }];
    setMessages(next);
    setLoading(true);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: next }),
    });

    if (!res.ok || !res.body) {
      setMessages([...next, { role: "assistant", content: "אירעה שגיאה — נסו שוב." }]);
      setLoading(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let assistantMsg = "";
    setMessages([...next, { role: "assistant", content: "" }]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") break;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.delta?.text ?? "";
          assistantMsg += delta;
          setMessages([...next, { role: "assistant", content: assistantMsg }]);
        } catch {}
      }
    }
    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-3xl flex-col">
      <div className="mb-4 shrink-0">
        <h1 className="text-2xl font-bold text-slate-900">צ&apos;אט AI קליני</h1>
        <p className="mt-1 text-sm text-slate-500">שאלו שאלות קליניות — פרוטוקולים, אבחנות, תרגילים, תיעוד.</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="py-10 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-brand">
              <Bot size={28} />
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">עוזר AI קליני לפיזיותרפיה</p>
            <p className="text-sm text-slate-400 mb-6">שאלו כל שאלה קלינית — אני כאן לעזור.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-lg border border-line bg-white px-3.5 py-2.5 text-right text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-white ${m.role === "user" ? "bg-brand" : "bg-slate-700"}`}>
              {m.role === "user" ? <User size={15} /> : <Bot size={15} />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === "user"
                ? "bg-brand text-white rounded-tl-sm"
                : "bg-white border border-line text-slate-800 rounded-tr-sm shadow-card"
            }`}>
              {m.content || (loading && i === messages.length - 1 ? (
                <span className="inline-flex gap-1">
                  <span className="animate-bounce" style={{ animationDelay: "0ms" }}>•</span>
                  <span className="animate-bounce" style={{ animationDelay: "150ms" }}>•</span>
                  <span className="animate-bounce" style={{ animationDelay: "300ms" }}>•</span>
                </span>
              ) : "")}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-line bg-bg pt-4">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            rows={1}
            className="input flex-1 resize-none min-h-[44px] max-h-32 py-2.5 text-sm"
            placeholder="שאלו שאלה קלינית…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ overflow: input.includes("\n") ? "auto" : "hidden" }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="btn-primary !p-2.5 shrink-0"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-slate-400">Enter לשליחה · Shift+Enter לשורה חדשה</p>
      </div>
    </div>
  );
}
