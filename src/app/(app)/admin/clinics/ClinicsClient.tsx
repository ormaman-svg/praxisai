"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Building2, LogIn, Users, Trash2, AlertTriangle } from "lucide-react";

type ClinicRow = { id: string; name: string; slug: string | null; created_at: string; memberCount: number };

export default function ClinicsClient({ clinics }: { clinics: ClinicRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entering, setEntering] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", ownerEmail: "" });

  // Delete-confirmation state
  const [toDelete, setToDelete] = useState<ClinicRow | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function enterClinic(clinicId: string) {
    setEntering(clinicId);
    await fetch("/api/clinic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinicId }),
    });
    router.push("/dashboard");
    router.refresh();
  }

  function openDelete(c: ClinicRow) {
    setToDelete(c);
    setConfirmText("");
    setDeleteError(null);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch("/api/super-admin/clinics", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinicId: toDelete.id, confirmName: confirmText.trim() }),
    });
    const json = await res.json();
    setDeleting(false);
    if (!res.ok) { setDeleteError(json.error ?? "מחיקת הקליניקה נכשלה."); return; }
    setToDelete(null);
    router.refresh();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/super-admin/clinics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setError(json.error ?? "שגיאה ביצירת הקליניקה."); return; }
    setOpen(false);
    setForm({ name: "", slug: "", ownerEmail: "" });
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ניהול קליניקות</h1>
          <p className="mt-1 text-sm text-slate-500">Super-admin — גלוי לך בלבד.</p>
        </div>
        <button onClick={() => { setOpen(true); setError(null); }} className="btn-primary">
          <Plus size={16} /> קליניקה חדשה
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-bold text-slate-900">כל הקליניקות ({clinics.length})</h2>
        </div>
        {clinics.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">אין קליניקות עדיין.</div>
        ) : (
          <ul className="divide-y divide-line">
            {clinics.map((c) => (
              <li key={c.id} className="flex items-center gap-4 px-5 py-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand">
                  <Building2 size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900">{c.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    {c.slug && <span dir="ltr">/{c.slug}</span>}
                    <span>· נוצרה {new Date(c.created_at).toLocaleDateString("he-IL")}</span>
                    <span className="inline-flex items-center gap-1">· <Users size={11} /> {c.memberCount} משתמשים</span>
                  </div>
                </div>
                <button
                  onClick={() => enterClinic(c.id)}
                  disabled={entering === c.id}
                  className="btn-ghost !px-3 !py-1.5 text-xs gap-1.5"
                  title="כניסה לקליניקה"
                >
                  <LogIn size={14} /> {entering === c.id ? "נכנס…" : "כניסה"}
                </button>
                <button
                  onClick={() => openDelete(c)}
                  title="מחיקת קליניקה"
                  className="rounded-md p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center glass-overlay p-4" onClick={() => setOpen(false)}>
          <div className="glass-panel w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">קליניקה חדשה</h2>
              <button onClick={() => setOpen(false)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <form onSubmit={create} className="space-y-4">
              <div>
                <label className="label">שם הקליניקה *</label>
                <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="קליניקת השיקום" />
              </div>
              <div>
                <label className="label">Slug (URL)</label>
                <input dir="ltr" className="input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })} placeholder="rehab-clinic" />
              </div>
              <div>
                <label className="label">מייל בעלים *</label>
                <input dir="ltr" type="email" required className="input" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} placeholder="owner@clinic.co.il" />
              </div>
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">{error}</div>}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? "יוצר…" : "צור קליניקה"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {toDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center glass-overlay p-4" onClick={() => setToDelete(null)}>
          <div className="glass-panel w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">מחיקת קליניקה</h2>
                <p className="text-xs text-slate-500">הפעולה בלתי הפיכה.</p>
              </div>
            </div>

            <p className="text-[13.5px] leading-relaxed text-slate-600">
              מחיקת <strong className="text-slate-900">{toDelete.name}</strong> תמחק לצמיתות את כל המטופלים,
              הטיפולים, המסמכים, ההזמנות ו-{toDelete.memberCount} המשתמשים המשויכים אליה.
            </p>

            <p className="mt-4 mb-1.5 text-[13px] text-slate-600">
              להמשך, הקלד את שם הקליניקה: <strong className="text-slate-900">{toDelete.name}</strong>
            </p>
            <input
              autoFocus
              className="input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={toDelete.name}
            />

            {deleteError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">{deleteError}</div>
            )}

            <div className="mt-5 flex gap-3">
              <button onClick={() => setToDelete(null)} className="btn-ghost flex-1">ביטול</button>
              <button
                onClick={confirmDelete}
                disabled={deleting || confirmText.trim() !== toDelete.name.trim()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 size={15} /> {deleting ? "מוחק…" : "מחק לצמיתות"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
