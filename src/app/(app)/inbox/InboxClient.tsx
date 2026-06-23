"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { MessageCircle, Bot, UserRound, Send, ArrowLeft, Loader2, Play, FileAudio, ArrowUpLeft, UserPlus, X, Search, Trash2, CornerUpLeft, Share2, Copy, ChevronDown, MessageSquarePlus, Download, Maximize2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Close-on-Escape for any overlay. Pass the same onClose the overlay uses.
function useEsc(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

// Force a real download (with a filename) instead of opening the file in a tab.
async function downloadFile(url: string, filename: string) {
  try {
    const blob = await (await fetch(url)).blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
  } catch {
    window.open(url, "_blank");
  }
}

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
  if (!c.patient_id || !c.patients) return { label: "לא רשום", cls: "badge-warning" };
  switch (c.patients.status) {
    case "active": return { label: "מטופל פעיל", cls: "badge-success" };
    case "discharged": return { label: "שוחרר", cls: "badge-neutral" };
    case "on_hold": return { label: "בהמתנה", cls: "badge-neutral" };
    default: return { label: "מטופל", cls: "badge-success" };
  }
}

// +972527305577 → 0527305577 (Israeli local format)
function formatLocalPhone(phone: string): string {
  if (phone.startsWith("+972")) return "0" + phone.slice(4);
  if (phone.startsWith("972")) return "0" + phone.slice(3);
  return phone;
}

// Pleasant two-tone chime for new-message notification (no external files needed).
function playChime() {
  try {
    const ctx = new AudioContext();
    const play = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0.12, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    };
    play(880, 0, 0.25);   // high note
    play(1100, 0.18, 0.3); // slightly higher note overlaps
    ctx.close().catch(() => {});
  } catch {
    // AudioContext blocked by browser autoplay policy — silent fallback
  }
}

// A real phone for display. @lid digits are an internal id, never a phone number.
function displayPhone(c: Conversation): string | null {
  if (c.patients?.phone) return formatLocalPhone(c.patients.phone);
  if (c.wa_contact && !c.wa_contact.endsWith("@lid")) return formatLocalPhone(c.wa_contact);
  return null;
}

function MediaContent({ storagePath, mediaType }: { storagePath: string; mediaType: string }) {
  const supabase = createClient();
  const [url, setUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  useEsc(() => setZoom(false));

  useEffect(() => {
    supabase.storage.from("whatsapp-media").createSignedUrl(storagePath, 3600).then(({ data }) => {
      if (data?.signedUrl) setUrl(data.signedUrl);
    });
  }, [storagePath]); // eslint-disable-line react-hooks/exhaustive-deps

  const filename = storagePath.split("/").pop() ?? "media";

  if (!url) return <Loader2 size={16} className="animate-spin text-ink-400" />;

  if (mediaType === "image") {
    return (
      <>
        <div className="group relative inline-block">
          <img
            src={url}
            alt="תמונה"
            className="max-w-[220px] cursor-zoom-in rounded-lg"
            loading="lazy"
            onClick={() => setZoom(true)}
          />
          <div className="absolute end-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button onClick={() => setZoom(true)} title="הגדלה" className="rounded bg-black/50 p-1 text-white hover:bg-black/70"><Maximize2 size={13} /></button>
            <button onClick={() => downloadFile(url, filename)} title="הורדה" className="rounded bg-black/50 p-1 text-white hover:bg-black/70"><Download size={13} /></button>
          </div>
        </div>
        {zoom && createPortal(
          <div className="fixed inset-0 z-[60] grid place-items-center bg-black/80 p-4" onClick={() => setZoom(false)}>
            <img src={url} alt="תמונה" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
            <div className="absolute end-4 top-4 flex gap-2">
              <button onClick={() => downloadFile(url, filename)} title="הורדה" className="rounded-full bg-white/15 p-2 text-white hover:bg-white/25"><Download size={18} /></button>
              <button onClick={() => setZoom(false)} title="סגירה (Esc)" className="rounded-full bg-white/15 p-2 text-white hover:bg-white/25"><X size={18} /></button>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }
  if (mediaType === "video") {
    return (
      <div className="max-w-[260px]">
        <video src={url} controls className="w-full rounded-lg" preload="metadata">
          <source src={url} />
        </video>
        <div className="mt-1 flex items-center justify-between text-[11px] text-ink-400">
          <span className="flex items-center gap-1"><Play size={10} /> סרטון</span>
          <button onClick={() => downloadFile(url, filename)} className="flex items-center gap-1 hover:text-ink-600"><Download size={11} /> הורדה</button>
        </div>
      </div>
    );
  }
  if (mediaType === "audio") {
    return (
      <div className="flex items-center gap-2">
        <FileAudio size={16} className="shrink-0 text-ink-400" />
        <audio src={url} controls className="h-8 w-40" preload="metadata" />
        <button onClick={() => downloadFile(url, filename)} title="הורדה" className="text-ink-400 hover:text-ink-600"><Download size={14} /></button>
      </div>
    );
  }
  return (
    <button onClick={() => downloadFile(url, filename)} className="flex items-center gap-1 underline">
      <Download size={13} /> הורדת קובץ
    </button>
  );
}

/* ── Avatar helper ── */
function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("");
  const dim = size === "sm" ? "h-8 w-8 text-[11px]" : "h-10 w-10 text-[13px]";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700 ${dim}`}>
      {initials || "?"}
    </span>
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
  // Small in-app notification when a new patient message arrives
  const [toast, setToast] = useState<{ convId: string; label: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<string | null>(activeId);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  const conversationsRef = useRef(conversations);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          const old = payload.old as { last_message_at?: string | null };
          setConversations((prev) => prev.map((x) => x.id === c.id ? { ...x, ...c } : x));
          // Belt-and-suspenders: when the active conversation receives a new message
          // its last_message_at is updated — reload messages so bot replies appear.
          if (c.id === activeIdRef.current) {
            loadMessages(c.id).then(setMessages);
            return;
          }
          // Show a toast + chime when last_message_at advances on a background chat.
          // Only inbound messages (from patients) update last_message_at in the webhook.
          if (c.last_message_at && c.last_message_at !== old?.last_message_at) {
            const conv = conversationsRef.current.find((x) => x.id === c.id);
            const label = conv ? convLabel(conv) : (c.display_name ?? "פונה חדש");
            playChime();
            setToast({ convId: c.id, label });
            if (toastTimer.current) clearTimeout(toastTimer.current);
            toastTimer.current = setTimeout(() => setToast(null), 6000);
          }
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

  /* ── timestamp helper ── */
  function shortTime(iso: string) {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">תקשורת</p>
          <h1 className="page-title">תיבת הודעות</h1>
        </div>
        <button onClick={() => setNewChatOpen(true)} className="btn-primary btn-sm gap-1.5">
          <MessageSquarePlus size={15} /> הודעה חדשה
        </button>
      </div>

      {/* Two-column shell */}
      <div className="card flex h-[calc(100vh-13rem)] overflow-hidden">

        {/* ── Conversation list (320px) ── */}
        <div className={`flex w-full shrink-0 flex-col border-e border-line sm:w-80 ${activeId ? "hidden sm:flex" : "flex"}`}>
          {/* Search */}
          <div className="border-b border-line px-3 py-3">
            <div className="relative">
              <Search size={14} className="absolute end-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
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
              <div className="grid h-full place-items-center px-6 text-center">
                <div>
                  <MessageCircle size={32} className="mx-auto mb-3 text-ink-200" />
                  <p className="text-[13px] text-ink-400">אין עדיין שיחות.</p>
                </div>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-ink-400">
                לא נמצאו תוצאות עבור &quot;{search}&quot;
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {filteredConversations.map((c) => {
                  const isActive = activeId === c.id;
                  const badge = patientBadge(c);
                  const hasUnread = c.status === "human";
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => setActiveId(c.id)}
                        className={`w-full px-4 py-3.5 text-start transition-colors hover:bg-brand-50/30 ${isActive ? "bg-brand-50/50 border-e-2 border-brand" : ""}`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Avatar */}
                          <div className="relative mt-0.5">
                            <Avatar name={name(c)} size="sm" />
                            {hasUnread && (
                              <span className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-electric-500 ring-2 ring-white" />
                            )}
                          </div>
                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className={`truncate text-[13px] font-semibold ${isActive ? "text-brand-700" : "text-ink-800"}`}>{name(c)}</span>
                              {c.last_message_at && (
                                <span className="shrink-0 text-[10.5px] text-ink-300">{shortTime(c.last_message_at)}</span>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              <span className={`badge ${badge.cls}`}>{badge.label}</span>
                              {c.status === "human" && (
                                <span className="badge badge-warning">ממתין לטיפול</span>
                              )}
                              {c.status === "closed" && (
                                <span className="badge badge-neutral">סגור</span>
                              )}
                              {c.status === "bot" && (
                                <span className="badge badge-brand">בוט</span>
                              )}
                            </div>
                            {displayPhone(c) && (
                              <p className="mt-0.5 truncate text-[11px] text-ink-300" dir="ltr">{displayPhone(c)}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* ── Message thread (flex-1) ── */}
        {active ? (
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Thread header */}
            <div className="flex items-center gap-3 border-b border-line bg-white px-5 py-3.5">
              {/* Back (mobile) */}
              <button onClick={() => setActiveId(null)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 sm:hidden">
                <ArrowLeft size={17} />
              </button>
              {/* Avatar */}
              <Avatar name={name(active)} />
              {/* Name + status */}
              <div className="min-w-0 flex-1">
                {active.patient_id ? (
                  <Link
                    href={`/patients/${active.patient_id}`}
                    className="group inline-flex items-center gap-1.5 truncate text-[14px] font-bold text-ink-900 hover:text-brand"
                  >
                    {name(active)}
                    <ArrowUpLeft size={13} className="shrink-0 text-ink-300 transition-colors group-hover:text-brand" />
                  </Link>
                ) : (
                  <div className="truncate text-[14px] font-bold text-ink-900">{name(active)}</div>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  {/* Channel status badge */}
                  {active.status === "bot" && <span className="badge badge-brand">בוט פעיל</span>}
                  {active.status === "human" && <span className="badge badge-warning">ממתין לנציג</span>}
                  {active.status === "closed" && <span className="badge badge-neutral">סגור</span>}
                  {/* Patient status badge */}
                  <span className={`badge ${patientBadge(active).cls}`}>{patientBadge(active).label}</span>
                  {displayPhone(active) && (
                    <span className="text-[11.5px] text-ink-300" dir="ltr">{displayPhone(active)}</span>
                  )}
                </div>
              </div>
              {/* Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                {active.status === "bot" ? (
                  <button onClick={() => setStatus("human")} className="btn-ghost btn-sm gap-1.5">
                    <UserRound size={13} /> קח על עצמי
                  </button>
                ) : active.status === "human" ? (
                  <button onClick={() => setStatus("bot")} className="btn-ghost btn-sm gap-1.5">
                    <Bot size={13} /> החזר לבוט
                  </button>
                ) : null}
                <button
                  onClick={() => deleteConversation(active.id)}
                  disabled={deletingId === active.id}
                  title="מחק שיחה"
                  className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  {deletingId === active.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </button>
              </div>
            </div>

            {/* Add-patient banner */}
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
                    <input required className="input !py-1 w-28 text-[12.5px]" placeholder="שם פרטי" value={addFirst} onChange={(e) => setAddFirst(e.target.value)} />
                    <input required className="input !py-1 w-28 text-[12.5px]" placeholder="שם משפחה" value={addLast} onChange={(e) => setAddLast(e.target.value)} />
                    <input dir="ltr" className="input !py-1 w-28 text-[12.5px]" placeholder="טלפון" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} />
                    <button type="submit" disabled={addSaving} className="btn-primary btn-sm">
                      {addSaving ? <Loader2 size={12} className="animate-spin" /> : "הוסף"}
                    </button>
                    <button type="button" onClick={() => setShowAddPatient(false)} className="rounded p-1 text-ink-400 hover:text-ink-600">
                      <X size={14} />
                    </button>
                    {addError && <span className="text-[11.5px] text-red-600">{addError}</span>}
                  </form>
                )}
              </div>
            )}

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50/50 px-5 py-5">
              {messages.map((m) => {
                const isBot = m.direction === "outbound";
                const quoted = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : null;
                return (
                  <div key={m.id} className={`group flex items-end gap-2 ${isBot ? "justify-start" : "justify-end"}`}>
                    {/* Bot avatar */}
                    {isBot && (
                      <span className="mb-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-brand">
                        <Bot size={14} />
                      </span>
                    )}

                    {/* Message action menu */}
                    <div className="relative self-center order-first">
                      <button
                        onClick={() => setMenuMsgId(menuMsgId === m.id ? null : m.id)}
                        className="rounded-full p-1 text-ink-200 opacity-0 transition-opacity hover:bg-ink-100 hover:text-ink-600 group-hover:opacity-100"
                        title="פעולות"
                      >
                        <ChevronDown size={14} />
                      </button>
                      {menuMsgId === m.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuMsgId(null)} />
                          <div className="absolute z-20 mt-1 min-w-[150px] overflow-hidden rounded-xl border border-line bg-white py-1 text-[13px] shadow-lg start-0">
                            <button onClick={() => { setReplyTo(m); setMenuMsgId(null); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-start hover:bg-slate-50">
                              <CornerUpLeft size={14} className="text-ink-400" /> תגובה
                            </button>
                            <button onClick={() => { setForwardMsg(m); setMenuMsgId(null); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-start hover:bg-slate-50">
                              <Share2 size={14} className="text-ink-400" /> העברה
                            </button>
                            {m.body && (
                              <button onClick={() => copyMessage(m)} className="flex w-full items-center gap-2 px-3 py-1.5 text-start hover:bg-slate-50">
                                <Copy size={14} className="text-ink-400" /> העתקה
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

                    {/* Bubble */}
                    <div className={`max-w-[72%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                      isBot
                        ? "rounded-ss-sm bg-brand-50 text-ink-800"
                        : "rounded-se-sm bg-ink-100 text-ink-900"
                    }`}>
                      {quoted && (
                        <div className={`mb-1.5 truncate rounded-lg border-s-2 px-2 py-1 text-[11.5px] ${
                          isBot ? "border-brand/50 bg-brand-100/50 text-ink-500" : "border-ink-400/40 bg-ink-200/40 text-ink-500"
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
                      <div className="mt-0.5 text-[10px] text-ink-400" dir="ltr">
                        {new Date(m.created_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Compose area */}
            {active.status === "human" ? (
              <div className="border-t border-line bg-white">
                {replyTo && (
                  <div className="flex items-center gap-2 border-b border-line bg-slate-50 px-4 py-2">
                    <CornerUpLeft size={14} className="shrink-0 text-brand" />
                    <div className="min-w-0 flex-1 border-s-2 border-brand/50 ps-2">
                      <div className="text-[11px] font-semibold text-brand">תגובה</div>
                      <div className="truncate text-[12px] text-ink-400">{replyTo.body ?? "📎 מדיה"}</div>
                    </div>
                    <button onClick={() => setReplyTo(null)} className="rounded p-1 text-ink-400 hover:text-ink-600">
                      <X size={14} />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2.5 px-4 py-3">
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
              <div className="border-t border-line bg-white px-4 py-3.5 text-center text-[12px] text-ink-400">
                {active.status === "bot"
                  ? "הבוט מנהל את השיחה. לחצו \"קח על עצמי\" כדי לכתוב ידנית."
                  : "השיחה סגורה."}
              </div>
            )}
          </div>
        ) : (
          <div className="hidden flex-1 flex-col items-center justify-center gap-3 text-center sm:flex">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand">
              <MessageCircle size={26} />
            </span>
            <p className="text-[13px] text-ink-400">בחרו שיחה מהרשימה כדי לצפות בהודעות</p>
          </div>
        )}
      </div>

      {/* Modals */}
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

      {/* Toast notification */}
      {toast && (
        <button
          onClick={() => { setActiveId(toast.convId); setToast(null); }}
          className="fixed bottom-5 start-5 z-[70] flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 shadow-pop transition hover:shadow-card-hover"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-brand">
            <MessageCircle size={17} />
          </span>
          <span className="text-start">
            <span className="block text-[13px] font-semibold text-ink-900">הודעה חדשה מ{toast.label}</span>
            <span className="block text-[11.5px] text-ink-400">לחצו לפתיחת השיחה</span>
          </span>
        </button>
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
  useEsc(onClose);

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
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="section-title">העברת הודעה</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100"><X size={16} /></button>
        </div>
        <div className="modal-body space-y-4">
          <div className="truncate rounded-lg bg-ink-50 px-3 py-2 text-[12.5px] text-ink-500">
            {msg.body ?? "📎 מדיה"}
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="label">העברה למספר חדש</label>
              <input dir="ltr" className="input w-full" placeholder="05XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <button disabled={busy || !phone.trim()} onClick={() => forward({ to_phone: phone.trim() })} className="btn-primary">שלח</button>
          </div>

          <p className="text-[12px] text-ink-400">או בחרו שיחה קיימת</p>
          <input className="input w-full" placeholder="חיפוש שיחה…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="max-h-48 overflow-y-auto rounded-lg border border-line">
            {list.length === 0 ? (
              <div className="px-3 py-4 text-center text-[12.5px] text-ink-400">אין שיחות</div>
            ) : (
              <ul className="divide-y divide-line">
                {list.map((c) => (
                  <li key={c.id}>
                    <button disabled={busy} onClick={() => forward({ to_conversation_id: c.id })} className="flex w-full items-center justify-between px-3 py-2.5 text-start hover:bg-slate-50">
                      <span className="truncate text-[13px] text-ink-700">{convLabel(c)}</span>
                      {busy && <Loader2 size={13} className="animate-spin text-ink-400" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {err && <p className="text-[12px] text-red-600">{err}</p>}
        </div>
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
  useEsc(onClose);

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
    <div className="overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h2 className="section-title">הודעה חדשה</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100"><X size={16} /></button>
        </div>
        <div className="modal-body space-y-4">
          <div>
            <label className="label">מספר טלפון</label>
            <input dir="ltr" required className="input w-full" placeholder="05XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="label">הודעה</label>
            <textarea required className="input h-24 w-full resize-none" placeholder="כתבו הודעה…" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          {err && <p className="text-[12px] text-red-600">{err}</p>}
        </div>
        <div className="modal-foot">
          <button type="button" onClick={onClose} className="btn-ghost">ביטול</button>
          <button type="submit" disabled={busy || !phone.trim() || !text.trim()} className="btn-primary">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <><Send size={14} /> שלח</>}
          </button>
        </div>
      </form>
    </div>
  );
}
