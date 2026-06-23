"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Plus, X, Copy, Check, UserX, UserCheck, Trash2 } from "lucide-react";
import { ROLE_HE, type MemberRole } from "@/lib/types";

type MemberRow = {
  id: string; user_id: string; role: MemberRole; status: "active" | "disabled"; created_at: string;
  profiles: { id: string; full_name: string } | null;
};
type InviteRow = { id: string; email: string; role: MemberRole; created_at: string; expires_at: string };

const INVITABLE: MemberRole[] = ["admin", "therapist", "receptionist"];

function lastSeenLabel(iso: string | null | undefined): string {
  if (!iso) return "לא התחבר/ה עדיין";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "עכשיו מחובר/ת";
  if (mins < 60) return `לפני ${mins} דק׳`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "אתמול";
  if (days < 30) return `לפני ${days} ימים`;
  return new Date(iso).toLocaleDateString("he-IL");
}

export default function UsersClient({
  clinicId, myUserId, myRole, members, invitations, lastSeen,
}: {
  clinicId: string; myUserId: string; myRole: MemberRole;
  members: MemberRow[]; invitations: InviteRow[];
  lastSeen: Record<string, string | null>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fallbackLink, setFallbackLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ email: "", fullName: "", role: "therapist" as MemberRole });

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    setFallbackLink(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let res: Response;
    try {
      res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId, email: form.email.trim(), role: form.role, fullName: form.fullName.trim() }),
        signal: controller.signal,
      });
    } catch {
      setSending(false);
      setError("הבקשה נכשלה — ודאו שמשתנה SUPABASE_SERVICE_ROLE_KEY מוגדר ב-Vercel.");
      return;
    } finally {
      clearTimeout(timeout);
    }
    const json = await res.json();
    setSending(false);
    if (!res.ok) return setError(json.error ?? "שליחת ההזמנה נכשלה.");
    if (json.existed) {
      setNotice(json.sent
        ? `המשתמש נוסף לקליניקה ומייל עדכון נשלח אל ${form.email}.`
        : `המשתמש נוסף לקליניקה בהצלחה.`);
      setOpen(false);
    } else if (json.sent) {
      setNotice(`מייל הזמנה נשלח אל ${form.email}.`);
      setOpen(false);
    } else {
      setNotice("ההזמנה נוצרה. לא ניתן היה לשלוח מייל — העתיקו את הקישור ושלחו ידנית:");
      setFallbackLink(json.link);
    }
    setForm({ email: "", fullName: "", role: "therapist" });
    router.refresh();
  }

  async function revoke(id: string) {
    await fetch(`/api/invitations?id=${id}&clinicId=${clinicId}`, { method: "DELETE" });
    router.refresh();
  }

  async function setRole(memberId: string, role: MemberRole) {
    await fetch("/api/clinic-members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, clinicId, role }),
    });
    router.refresh();
  }

  async function toggleStatus(m: MemberRow) {
    await fetch("/api/clinic-members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: m.id, clinicId, status: m.status === "active" ? "disabled" : "active" }),
    });
    router.refresh();
  }

  async function removeMember(m: MemberRow) {
    const name = m.profiles?.full_name || "משתמש זה";
    if (!confirm(`האם למחוק את ${name} מהקליניקה? פעולה זו אינה הפיכה.`)) return;
    const res = await fetch(`/api/clinic-members?memberId=${m.id}&clinicId=${clinicId}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "המחיקה נכשלה.");
    }
    router.refresh();
  }

  async function copyLink() {
    if (!fallbackLink) return;
    await navigator.clipboard.writeText(fallbackLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">משתמשים והרשאות</h1>
          <p className="mt-1 text-sm text-slate-500">הכניסה למערכת בהזמנה בלבד — רק מי שהוזמן יכול להתחבר.</p>
        </div>
        <button onClick={() => { setOpen(true); setNotice(null); setFallbackLink(null); }} className="btn-primary">
          <Plus size={16} /> הזמנת משתמש
        </button>
      </div>

      {notice && (
        <div className="card border-brand-100 bg-brand-50/60 p-4 text-[13px] leading-relaxed text-slate-700">
          {notice}
          {fallbackLink && (
            <div className="mt-2 flex items-center gap-2">
              <code dir="ltr" className="block flex-1 truncate rounded-md bg-white px-3 py-2 text-xs text-slate-600 border border-line">{fallbackLink}</code>
              <button onClick={copyLink} className="btn-ghost !px-3 !py-2">{copied ? <Check size={14} /> : <Copy size={14} />}</button>
            </div>
          )}
        </div>
      )}

      {/* Members */}
      <div className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-bold text-slate-900">חברי צוות ({members.length})</h2>
        </div>
        <ul className="divide-y divide-line">
          {members.map((m) => {
            const isSelf = m.user_id === myUserId;
            const isOwnerRow = m.role === "owner";
            const canEdit = !isSelf && !isOwnerRow && (myRole === "owner" || m.role !== "admin");
            return (
              <li key={m.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand">
                  {m.profiles?.full_name?.charAt(0) ?? "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-slate-800">
                    {m.profiles?.full_name || "משתמש"} {isSelf && <span className="text-xs font-normal text-slate-400">(אני)</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-3 text-xs text-slate-400">
                    <span>הצטרף/ה {new Date(m.created_at).toLocaleDateString("he-IL")}</span>
                    <span className="text-slate-300">·</span>
                    <span>{lastSeenLabel(lastSeen[m.user_id])}</span>
                  </div>
                </div>

                {m.status === "disabled" && <span className="badge bg-slate-100 text-slate-500">מושבת</span>}

                {canEdit ? (
                  <select
                    className="input !w-auto !py-1.5 text-xs"
                    value={m.role}
                    onChange={(e) => setRole(m.id, e.target.value as MemberRole)}
                  >
                    {INVITABLE.map((r) => <option key={r} value={r}>{ROLE_HE[r]}</option>)}
                  </select>
                ) : (
                  <span className="badge bg-brand-50 text-brand">{ROLE_HE[m.role]}</span>
                )}

                {canEdit && (
                  <>
                    <button
                      onClick={() => toggleStatus(m)}
                      title={m.status === "active" ? "השבתת גישה" : "הפעלת גישה"}
                      className={`rounded-md p-2 transition-colors ${m.status === "active" ? "text-slate-400 hover:bg-red-50 hover:text-red-600" : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"}`}
                    >
                      {m.status === "active" ? <UserX size={16} /> : <UserCheck size={16} />}
                    </button>
                    <button
                      onClick={() => removeMember(m)}
                      title="הסרה מהקליניקה"
                      className="rounded-md p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Pending invitations */}
      <div className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-bold text-slate-900">הזמנות ממתינות ({invitations.length})</h2>
        </div>
        {invitations.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-slate-400">אין הזמנות ממתינות.</div>
        ) : (
          <ul className="divide-y divide-line">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600"><Mail size={16} /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-slate-800" dir="ltr">{inv.email}</div>
                  <div className="text-xs text-slate-400">
                    {ROLE_HE[inv.role]} · בתוקף עד {new Date(inv.expires_at).toLocaleDateString("he-IL")}
                  </div>
                </div>
                <button onClick={() => revoke(inv.id)} className="btn-ghost !px-3 !py-1.5 text-xs text-red-600 hover:bg-red-50">ביטול הזמנה</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Invite dialog */}
      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">הזמנת משתמש חדש</h2>
              <button onClick={() => setOpen(false)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <form onSubmit={invite} className="space-y-4">
              <div>
                <label className="label">דוא&Prime;ל *</label>
                <input dir="ltr" type="email" required className="input" value={form.email}
                       onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@clinic.co.il" />
              </div>
              <div>
                <label className="label">שם מלא</label>
                <input className="input" value={form.fullName}
                       onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="יופיע במייל ההזמנה" />
              </div>
              <div>
                <label className="label">תפקיד</label>
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as MemberRole })}>
                  {INVITABLE.map((r) => <option key={r} value={r}>{ROLE_HE[r]}</option>)}
                </select>
              </div>
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">{error}</div>}
              <button type="submit" disabled={sending} className="btn-primary w-full">
                <Mail size={15} /> {sending ? "שולח…" : "שליחת הזמנה במייל"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
