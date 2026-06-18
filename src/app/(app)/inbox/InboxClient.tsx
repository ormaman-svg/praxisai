"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MessageCircle, Bot, UserRound, Send, ArrowLeft, Loader2, Play, FileAudio, ArrowUpLeft, UserPlus, X, Search, Trash2, CornerUpLeft, Share2, Copy, ChevronDown, MessageSquarePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type PatientStatus = "active" | "discharged" | "on_hold";
type Conversation = {
  id: string;
  status: "bot" | "human" | "closed";
  wa_contact: string | null;
  display_name: string | null;
  last_message_at: string | null;
  patient_id: string | null;
  patients: { first_name: string; last_name: string; phone: string | null; status: PatientStatus | null } | null;
};

type Msg = {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  media_url: string | null;
  media_type: string | null;
  reply_to_id: string | null;
  wa_message_id: string | null;
  created_at: string;
};

// WhatsApp's revoke window for "delete for everyone" (~2 days). We mirror it.
const REVOKE_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

// Primary badge marks whether the contact is a registered (active) patient,
// not the bot/human channel state.
function patientBadge(c: Conversation): { label: string; cls: string } {
  if (!c.patient_id || !c.patients) return { label: "לא רשום", cls: "bg-amber-50 text-amber-600" };
  switch (c.patients.status) {
    case "active": return { label: "מטופל פעיל", cls: "bg-emerald-50 text-emerald-600" };
    case "discharged": return { label: "שוחרר", cls: "bg-slate-100 text-slate-400" };
    case "on_hold": return { label: "בהמתנה", cls: "bg-slate-100 text-slate-500" };
    default: return { label: "מטופל", cls: "bg-emerald-50 text-emerald-600" };
  }
}

// A real phone for display. @lid digits are an internal id, never a phone number.
function displayPhone(c: Conversation): string | null {
  if (c.patients?.phone) return c.patients.phone;
  if (c.wa_contact && !c.wa_contact.endsWith("@lid")) return c.wa_contact;
  return null;
}

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
  const [search, setSearch] = useState("");
  // Conversation IDs whose message bodies match the current search term
  const [contentMatchIds, setContentMatchIds] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [menuMsgId, setMenuMsgId] = useState<string | null>(null);
  const [forwardMsg, setForwardMsg] = useState<Msg | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Add-patient panel (shown for conversations without a linked patient)
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [addFirst, setAddFirst] = useState("");
  const [addLast, setAddLast] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  // Message bodies are encrypted at rest, so we load them through a server
  // endpoint that decrypts for authorized staff (not a direct DB read).
  async function loadMessages(convId: string): Promise<Msg[]> {
    const r = await fetch(`/api/inbox/messages?conversation_id=${convId}`);
    if (!r.ok) return [];
    const d = await r.json();
    return (d.messages ?? []) as Msg[];
  }

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    loadMessages(activeId).then((msgs) => { if (!cancelled) setMessages(msgs); });
    return () => { cancelled = true; };
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    // Realtime delivers the ciphertext row; refetch through the decrypt
    // endpoint so the thread always shows plaintext.
    const channel = supabase
      .channel(`messages:${activeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        () => { loadMessages(activeId).then(setMessages); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeId, supabase]);

  // Live conversation list — new conversations and status changes appear without refresh
  useEffect(() => {
    const channel = supabase
      .channel(`conversations:${clinicId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations", filter: `clinic_id=eq.${clinicId}` },
        (payload) => {
          const c = payload.new as Conversation;
          setConversations((prev) => [c, ...prev.filter((x) => x.id !== c.id)]);
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations", filter: `clinic_id=eq.${clinicId}` },
        (payload) => {
          const c = payload.new as Conversation;
          setConversations((prev) => prev.map((x) => x.id === c.id ? { ...x, ...c } : x));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clinicId, supabase]);

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

  // Pre-fill the add-patient form when the active conversation changes
  useEffect(() => {
    if (!active || active.patient_id) { setShowAddPatient(false); return; }
    const nameParts = (active.display_name ?? "").split(" ");
    setAddFirst(nameParts[0] ?? "");
    setAddLast(nameParts.slice(1).join(" ") ?? "");
    // Try to convert @lid contact to local number for display
    const raw = active.wa_contact ?? "";
    const digits = raw.replace(/^\+/, "");
    const localPhone = digits.startsWith("972") ? "0" + digits.slice(3) : raw;
    setAddPhone(/^\d{9,15}$/.test(digits) ? localPhone : "");
    setAddError(null);
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addPatient(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    setAddSaving(true);
    setAddError(null);
    const r = await fetch("/api/patients/from-conversation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: active.id,
        first_name: addFirst,
        last_name: addLast,
        phone: addPhone || undefined,
      }),
    });
    const d = await r.json().catch(() => null);
    setAddSaving(false);
    if (!r.ok) { setAddError(d?.error ?? "שגיאה"); return; }
    setConversations((prev) =>
      prev.map((c) =>
        c.id === active.id
          ? {
              ...c,
              patient_id: d.patient_id,
              display_name: `${addFirst} ${addLast}`,
              patients: { first_name: addFirst, last_name: addLast, phone: addPhone || null, status: "active" },
            }
          : c
      )
    );
    setShowAddPatient(false);
  }

  async function deleteConversation(id: string) {
    if (!confirm("למחוק את השיחה הזו לצמיתות? כל ההודעות יימחקו.")) return;
    setDeletingId(id);
    const r = await fetch(`/api/inbox/conversations/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (!r.ok) { alert("מחיקה נכשלה."); return; }
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setActiveId((cur) => (cur === id ? null : cur));
  }

  async function send() {
    if (!active || !draft.trim()) return;
    setSending(true);
    const r = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: active.id, text: draft.trim(), reply_to: replyTo?.id ?? null }),
    });
    setSending(false);
    if (r.ok) {
      setDraft("");
      setReplyTo(null);
      if (active.id) loadMessages(active.id).then(setMessages);
    } else {
      const d = await r.json().catch(() => null);
      alert(d?.error ?? "שליחת ההודעה נכשלה.");
    }
  }

  function copyMessage(m: Msg) {
    setMenuMsgId(null);
    if (m.body) navigator.clipboard?.writeText(m.body).catch(() => {});
  }

  // scope: "me" (our inbox only) or "everyone" (also revoke on WhatsApp)
  async function deleteMessage(m: Msg, scope: "me" | "everyone") {
    setMenuMsgId(null);
    if (scope === "everyone" && !confirm("למחוק את ההודעה גם אצל הנמען?")) return;
    const r = await fetch(`/api/inbox/messages/${m.id}?scope=${scope}`, { method: "DELETE" });
    if (!r.ok) { alert("מחיקה נכשלה."); return; }
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
  }

  // True when "delete for everyone" is allowed: our outbound message, sent via
  // WhatsApp, still inside the revoke window.
  function canRevoke(m: Msg): boolean {
    return (
      m.direction === "outbound" &&
      !!m.wa_message_id &&
      Date.now() - new Date(m.created_at).getTime() < REVOKE_WINDOW_MS
    );
  }

  const name = (c: Conversation) => {
    if (c.patients) return `${c.patients.first_name} ${c.patients.last_name}`;
    if (c.display_name) return c.display_name;
    if (c.wa_contact && !c.wa_contact.endsWith("@lid")) return c.wa_contact;
    return "פונה חדש";
  };

  const q = search.trim().toLowerCase();

  // Search inside message bodies (server-side). Debounced; results merge with
  // the name/phone filter so a chat is found by anything that was said in it.
  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) { setContentMatchIds(new Set()); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      // Server decrypts and matches (bodies are encrypted at rest)
      const r = await fetch(`/api/inbox/search?q=${encodeURIComponent(term)}`);
      if (!r.ok || cancelled) return;
      const d = await r.json();
      if (!cancelled) setContentMatchIds(new Set((d.conversationIds ?? []) as string[]));
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search]);

  const filteredConversations = q
    ? conversations.filter((c) => {
        const n = name(c).toLowerCase();
        const phone = (c.wa_contact ?? "").toLowerCase();
        return n.includes(q) || phone.includes(q) || contentMatchIds.has(c.id);
      })
    : conversations;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">תיבת הודעות</h1>
        <button onClick={() => setNewChatOpen(true)} className="btn-primary !py-2 !text-[13px]">
          <MessageSquarePlus size={16} /> הודעה חדשה
        </button>
      </div>

      <div className="card flex h-[calc(100vh-12rem)] overflow-hidden">
        {/* Conversation list */}
        <div className={`flex w-full shrink-0 flex-col border-e border-line sm:w-72 ${activeId ? "hidden sm:flex" : "flex"}`}>
          {/* Search input */}
          <div className="border-b border-line px-3 py-2">
            <div className="relative">
              <Search size={14} className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input w-full pe-8 !py-1.5 text-[13px]"
                placeholder="חיפוש לפי שם, טלפון…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="grid h-full place-items-center px-6 text-center text-[13px] text-slate-400">
              <div>
                <MessageCircle size={28} className="mx-auto mb-2 text-slate-300" />
                אין עדיין שיחות.
              </div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-slate-400">
              לא נמצאו תוצאות עבור &quot;{search}&quot;
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {filteredConversations.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setActiveId(c.id)}
                    className={`w-full px-4 py-3 text-start transition-colors hover:bg-slate-50 ${activeId === c.id ? "bg-brand-50/40" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13.5px] font-semibold text-slate-800">{name(c)}</span>
                      <span className={`badge shrink-0 ${patientBadge(c).cls}`}>{patientBadge(c).label}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      {displayPhone(c) && (
                        <span className="truncate text-[11.5px] text-slate-400" dir="ltr">{displayPhone(c)}</span>
                      )}
                      {c.status === "human" && (
                        <span className="badge shrink-0 bg-amber-50 text-amber-600">ממתין לטיפול</span>
                      )}
                      {c.status === "closed" && (
                        <span className="badge shrink-0 bg-slate-100 text-slate-400">סגור</span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          </div>
        </div>

        {/* Thread */}
        {active ? (
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-3 border-b border-line px-5 py-3">
              <button onClick={() => setActiveId(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 sm:hidden">
                <ArrowLeft size={18} />
              </button>
              <div className="min-w-0 flex-1">
                {active.patient_id ? (
                  <Link
                    href={`/patients/${active.patient_id}`}
                    className="group inline-flex items-center gap-1.5 truncate text-[14px] font-bold text-slate-900 hover:text-brand"
                  >
                    {name(active)}
                    <ArrowUpLeft size={13} className="shrink-0 text-slate-400 transition-colors group-hover:text-brand" />
                  </Link>
                ) : (
                  <div className="truncate text-[14px] font-bold text-slate-900">{name(active)}</div>
                )}
                {displayPhone(active) && (
                  <div className="text-[11.5px] text-slate-400" dir="ltr">{displayPhone(active)}</div>
                )}
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
              <button
                onClick={() => deleteConversation(active.id)}
                disabled={deletingId === active.id}
                title="מחק שיחה"
                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                {deletingId === active.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              </button>
            </div>

            {/* Add-patient banner — shown when this conversation has no linked patient */}
            {!active.patient_id && (
              <div className="border-b border-amber-100 bg-amber-50/60 px-5 py-2.5">
                {!showAddPatient ? (
                  <button
                    onClick={() => setShowAddPatient(true)}
                    className="flex items-center gap-1.5 text-[12.5px] font-semibold text-amber-700 hover:text-amber-900"
                  >
                    <UserPlus size={14} /> הוסף כמטופל חדש
                  </button>
                ) : (
                  <form onSubmit={addPatient} className="flex flex-wrap items-center gap-2">
                    <input
                      required
                      className="input !py-1 w-28 text-[12.5px]"
                      placeholder="שם פרטי"
                      value={addFirst}
                      onChange={(e) => setAddFirst(e.target.value)}
                    />
                    <input
                      required
                      className="input !py-1 w-28 text-[12.5px]"
                      placeholder="שם משפחה"
                      value={addLast}
                      onChange={(e) => setAddLast(e.target.value)}
                    />
                    <input
                      dir="ltr"
                      className="input !py-1 w-28 text-[12.5px]"
                      placeholder="טלפון"
                      value={addPhone}
                      onChange={(e) => setAddPhone(e.target.value)}
                    />
                    <button type="submit" disabled={addSaving} className="btn-primary !py-1 !text-[12px]">
                      {addSaving ? <Loader2 size={12} className="animate-spin" /> : "הוסף"}
                    </button>
                    <button type="button" onClick={() => setShowAddPatient(false)} className="rounded p-1 text-slate-400 hover:text-slate-600">
                      <X size={14} />
                    </button>
                    {addError && <span className="text-[11.5px] text-red-600">{addError}</span>}
                  </form>
                )}
              </div>
            )}

            <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto bg-slate-50/50 px-5 py-4">
              {messages.map((m) => {
                const out = m.direction === "outbound";
                const quoted = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : null;
                return (
                <div key={m.id} className={`group flex items-end gap-1 ${out ? "justify-start" : "justify-end"}`}>
                  {/* Action menu trigger (appears on hover) */}
                  <div className="relative self-center">
                    <button
                      onClick={() => setMenuMsgId(menuMsgId === m.id ? null : m.id)}
                      className="rounded-full p-1 text-slate-300 opacity-0 transition-opacity hover:bg-slate-200 hover:text-slate-600 group-hover:opacity-100"
                      title="פעולות"
                    >
                      <ChevronDown size={15} />
                    </button>
                    {menuMsgId === m.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuMsgId(null)} />
                        <div className="absolute z-20 mt-1 min-w-[150px] overflow-hidden rounded-xl border border-line bg-white py-1 text-[13px] shadow-lg start-0">
                          <button onClick={() => { setReplyTo(m); setMenuMsgId(null); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-start hover:bg-slate-50">
                            <CornerUpLeft size={14} className="text-slate-400" /> תגובה
                          </button>
                          <button onClick={() => { setForwardMsg(m); setMenuMsgId(null); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-start hover:bg-slate-50">
                            <Share2 size={14} className="text-slate-400" /> העברה
                          </button>
                          {m.body && (
                            <button onClick={() => copyMessage(m)} className="flex w-full items-center gap-2 px-3 py-1.5 text-start hover:bg-slate-50">
                              <Copy size={14} className="text-slate-400" /> העתקה
                            </button>
                          )}
                          <button onClick={() => deleteMessage(m, "me")} className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-red-600 hover:bg-red-50">
                            <Trash2 size={14} /> מחק עבורי
                          </button>
                          {canRevoke(m) && (
                            <button onClick={() => deleteMessage(m, "everyone")} className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-red-600 hover:bg-red-50">
                              <Trash2 size={14} /> מחק אצל כולם
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                    out ? "bg-brand text-white" : "border border-line bg-white text-slate-700"
                  }`}>
                    {quoted && (
                      <div className={`mb-1.5 truncate rounded-lg border-s-2 px-2 py-1 text-[11.5px] ${
                        out ? "border-white/50 bg-white/15 text-white/80" : "border-brand/50 bg-slate-50 text-slate-500"
                      }`}>
                        {quoted.body ?? "📎 מדיה"}
                      </div>
                    )}
                    {m.media_url && m.media_type && (
                      <div className="mb-1.5">
                        <MediaContent storagePath={m.media_url} mediaType={m.media_type} />
                      </div>
                    )}
                    {m.body && <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>}
                    <div className={`mt-0.5 text-[10px] ${out ? "text-white/60" : "text-slate-400"}`} dir="ltr">
                      {new Date(m.created_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>

            {active.status === "human" ? (
              <div className="border-t border-line">
                {replyTo && (
                  <div className="flex items-center gap-2 border-b border-line bg-slate-50 px-4 py-2">
                    <CornerUpLeft size={14} className="shrink-0 text-brand" />
                    <div className="min-w-0 flex-1 border-s-2 border-brand/50 ps-2">
                      <div className="text-[11px] font-semibold text-brand">תגובה</div>
                      <div className="truncate text-[12px] text-slate-500">{replyTo.body ?? "📎 מדיה"}</div>
                    </div>
                    <button onClick={() => setReplyTo(null)} className="rounded p-1 text-slate-400 hover:text-slate-600">
                      <X size={14} />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2 px-4 py-3">
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

      {forwardMsg && (
        <ForwardModal
          msg={forwardMsg}
          conversations={conversations}
          onClose={() => setForwardMsg(null)}
          onDone={(convId) => { setForwardMsg(null); setActiveId(convId); }}
        />
      )}
      {newChatOpen && (
        <NewChatModal
          onClose={() => setNewChatOpen(false)}
          onCreated={(conv) => {
            setNewChatOpen(false);
            setConversations((prev) => [conv, ...prev.filter((c) => c.id !== conv.id)]);
            setActiveId(conv.id);
          }}
        />
      )}
    </div>
  );
}

function convLabel(c: Conversation): string {
  if (c.patients) return `${c.patients.first_name} ${c.patients.last_name}`;
  if (c.display_name) return c.display_name;
  if (c.wa_contact && !c.wa_contact.endsWith("@lid")) return c.wa_contact;
  return "פונה חדש";
}

function ForwardModal({
  msg, conversations, onClose, onDone,
}: {
  msg: Msg;
  conversations: Conversation[];
  onClose: () => void;
  onDone: (conversationId: string) => void;
}) {
  const [q, setQ] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const list = q.trim()
    ? conversations.filter((c) => convLabel(c).toLowerCase().includes(q.trim().toLowerCase()) || (c.wa_contact ?? "").includes(q.trim()))
    : conversations;

  async function forward(body: Record<string, unknown>) {
    setBusy(true); setErr(null);
    const r = await fetch("/api/whatsapp/forward", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: msg.id, ...body }),
    });
    const d = await r.json().catch(() => null);
    setBusy(false);
    if (!r.ok) { setErr(d?.error ?? "ההעברה נכשלה."); return; }
    onDone(d.conversation_id);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-slate-900">העברת הודעה</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <div className="mb-3 truncate rounded-lg bg-slate-50 px-3 py-2 text-[12.5px] text-slate-500">
          {msg.body ?? "📎 מדיה"}
        </div>

        <div className="mb-2 flex items-end gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-[12px] text-slate-500">העברה למספר חדש</label>
            <input dir="ltr" className="input w-full !py-1.5 text-[13px]" placeholder="05XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <button disabled={busy || !phone.trim()} onClick={() => forward({ to_phone: phone.trim() })} className="btn-primary !py-2 !text-[12.5px]">שלח</button>
        </div>

        <div className="mb-1 mt-3 text-[12px] text-slate-500">או בחרו שיחה קיימת</div>
        <input className="input mb-2 w-full !py-1.5 text-[13px]" placeholder="חיפוש שיחה…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="max-h-56 overflow-y-auto rounded-lg border border-line">
          {list.length === 0 ? (
            <div className="px-3 py-4 text-center text-[12.5px] text-slate-400">אין שיחות</div>
          ) : (
            <ul className="divide-y divide-line">
              {list.map((c) => (
                <li key={c.id}>
                  <button disabled={busy} onClick={() => forward({ to_conversation_id: c.id })} className="flex w-full items-center justify-between px-3 py-2 text-start hover:bg-slate-50">
                    <span className="truncate text-[13px] text-slate-700">{convLabel(c)}</span>
                    {busy && <Loader2 size={13} className="animate-spin text-slate-400" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {err && <p className="mt-2 text-[12px] text-red-600">{err}</p>}
      </div>
    </div>
  );
}

function NewChatModal({
  onClose, onCreated,
}: {
  onClose: () => void;
  onCreated: (conv: Conversation) => void;
}) {
  const [phone, setPhone] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await fetch("/api/whatsapp/new-chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone.trim(), text: text.trim() }),
    });
    const d = await r.json().catch(() => null);
    setBusy(false);
    if (!r.ok) { setErr(d?.error ?? "השליחה נכשלה."); return; }
    onCreated(d.conversation as Conversation);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-slate-900">הודעה חדשה</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <label className="mb-1 block text-[12px] text-slate-500">מספר טלפון</label>
        <input dir="ltr" required className="input mb-3 w-full" placeholder="05XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <label className="mb-1 block text-[12px] text-slate-500">הודעה</label>
        <textarea required className="input mb-3 h-24 w-full resize-none" placeholder="כתבו הודעה…" value={text} onChange={(e) => setText(e.target.value)} />
        {err && <p className="mb-2 text-[12px] text-red-600">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost !border !border-line">ביטול</button>
          <button type="submit" disabled={busy || !phone.trim() || !text.trim()} className="btn-primary">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <><Send size={14} /> שלח</>}
          </button>
        </div>
      </form>
    </div>
  );
}
