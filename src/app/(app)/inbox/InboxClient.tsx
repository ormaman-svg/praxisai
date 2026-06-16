"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Bot, UserRound, Send, ArrowLeft, Loader2, Play, FileAudio } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Conversation = {
  id: string;
  status: "bot" | "human" | "closed";
  wa_contact: string | null;
  last_message_at: string | null;
  patient_id: string | null;
  patients: { first_name: string; last_name: string } | null;
};

type Msg = {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
};

const STATUS_BADGE: Record<string, string> = {
  bot: "bg-brand-50 text-brand",
  human: "bg-amber-50 text-amber-600",
  closed: "bg-slate-100 text-slate-400",
};
const STATUS_HE: Record<string, string> = { bot: "בוט", human: "נציג", closed: "סגור" };

function MediaContent({ storagePath, mediaType }: { storagePath: string; mediaType: string }) {
  const supabase = createClient();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase.storage.from("whatsapp-media").createSignedUrl(storagePath, 3600).then(({ data }) => {
      if (data?.signedUrl) setUrl(data.signedUrl);
    });
  }, [storagePath]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!url) return <Loader2 size={16} className="animate-spin text-slate-400" />;

  if (mediaType === "image") {
    return <img src={url} alt="תמונה" className="max-w-[220px] rounded-lg" loading="lazy" />;
  }
  if (mediaType === "video") {
    return (
      <div className="max-w-[260px]">
        <video src={url} controls className="w-full rounded-lg" preload="metadata">
          <source src={url} />
        </video>
        <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
          <Play size={10} /> סרטון שנשלח על ידי המטופל
        </div>
      </div>
    );
  }
  if (mediaType === "audio") {
    return (
      <div className="flex items-center gap-2">
        <FileAudio size={16} className="shrink-0 text-slate-400" />
        <audio src={url} controls className="h-8 w-40" preload="metadata" />
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
      📎 הורדת קובץ
    </a>
  );
}

export default function InboxClient({
  clinicId, userId, initialConversations,
}: {
  clinicId: string;
  userId: string;
  initialConversations: Conversation[];
}) {
  const supabase = createClient();
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(initialConversations[0]?.id ?? null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, direction, body, media_url, media_type, created_at")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true });
      if (!cancelled) setMessages((data ?? []) as Msg[]);
    })();
    return () => { cancelled = true; };
  }, [activeId, supabase]);

  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`messages:${activeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Msg]))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeId, supabase]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function setStatus(status: "bot" | "human") {
    if (!active) return;
    await supabase
      .from("conversations")
      .update({ status, assigned_to: status === "human" ? userId : null })
      .eq("id", active.id);
    setConversations((prev) => prev.map((c) => (c.id === active.id ? { ...c, status } : c)));
  }

  async function send() {
    if (!active || !draft.trim()) return;
    setSending(true);
    const r = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: active.id, text: draft.trim() }),
    });
    setSending(false);
    if (r.ok) setDraft("");
  }

  const name = (c: Conversation) =>
    c.patients ? `${c.patients.first_name} ${c.patients.last_name}` : (c.wa_contact ?? "לא ידוע");

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-5 text-2xl font-bold text-slate-900">תיבת הודעות</h1>

      <div className="card flex h-[calc(100vh-12rem)] overflow-hidden">
        {/* Conversation list */}
        <div className={`w-full shrink-0 overflow-y-auto border-e border-line sm:w-72 ${activeId ? "hidden sm:block" : "block"}`}>
          {conversations.length === 0 ? (
            <div className="grid h-full place-items-center px-6 text-center text-[13px] text-slate-400">
              <div>
                <MessageCircle size={28} className="mx-auto mb-2 text-slate-300" />
                אין עדיין שיחות.
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setActiveId(c.id)}
                    className={`w-full px-4 py-3 text-start transition-colors hover:bg-slate-50 ${activeId === c.id ? "bg-brand-50/40" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13.5px] font-semibold text-slate-800">{name(c)}</span>
                      <span className={`badge shrink-0 ${STATUS_BADGE[c.status]}`}>{STATUS_HE[c.status]}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[11.5px] text-slate-400" dir="ltr">{c.wa_contact}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Thread */}
        {active ? (
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-3 border-b border-line px-5 py-3">
              <button onClick={() => setActiveId(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 sm:hidden">
                <ArrowLeft size={18} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-bold text-slate-900">{name(active)}</div>
                <div className="text-[11.5px] text-slate-400" dir="ltr">{active.wa_contact}</div>
              </div>
              {active.status === "bot" ? (
                <button onClick={() => setStatus("human")} className="btn-ghost !border !border-line !py-1.5 !text-[12.5px]">
                  <UserRound size={14} /> קח על עצמי
                </button>
              ) : active.status === "human" ? (
                <button onClick={() => setStatus("bot")} className="btn-ghost !border !border-line !py-1.5 !text-[12.5px]">
                  <Bot size={14} /> החזר לבוט
                </button>
              ) : null}
            </div>

            <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto bg-slate-50/50 px-5 py-4">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                    m.direction === "outbound" ? "bg-brand text-white" : "border border-line bg-white text-slate-700"
                  }`}>
                    {m.media_url && m.media_type && (
                      <div className="mb-1.5">
                        <MediaContent storagePath={m.media_url} mediaType={m.media_type} />
                      </div>
                    )}
                    {m.body && <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>}
                    <div className={`mt-0.5 text-[10px] ${m.direction === "outbound" ? "text-white/60" : "text-slate-400"}`} dir="ltr">
                      {new Date(m.created_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {active.status === "human" ? (
              <div className="flex items-center gap-2 border-t border-line px-4 py-3">
                <input
                  className="input flex-1"
                  placeholder="כתבו הודעה…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                />
                <button onClick={send} disabled={sending || !draft.trim()} className="btn-primary shrink-0">
                  <Send size={15} />
                </button>
              </div>
            ) : (
              <div className="border-t border-line px-4 py-3 text-center text-[12px] text-slate-400">
                {active.status === "bot"
                  ? "הבוט מנהל את השיחה. לחצו \"קח על עצמי\" כדי לכתוב ידנית."
                  : "השיחה סגורה."}
              </div>
            )}
          </div>
        ) : (
          <div className="hidden flex-1 place-items-center text-[13px] text-slate-400 sm:grid">
            בחרו שיחה כדי לצפות בהודעות
          </div>
        )}
      </div>
    </div>
  );
}
