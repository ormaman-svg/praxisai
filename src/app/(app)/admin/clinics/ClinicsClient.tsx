"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Building2, LogIn, Users } from "lucide-react";

type ClinicRow = { id: string; name: string; slug: string | null; created_at: string; memberCount: number };

export default function ClinicsClient({ clinics }: { clinics: ClinicRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entering, setEntering] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", ownerEmail: "" });

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
              </li>
            ))}
          </ul>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
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
    </div>
  );
}
