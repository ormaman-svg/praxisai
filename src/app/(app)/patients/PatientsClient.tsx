"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Patient } from "@/lib/types";

const KUPOT = ["כללית", "מכבי", "מאוחדת", "לאומית", "פרטי"];

export default function PatientsClient({
  clinicId, initialPatients, therapists,
}: {
  clinicId: string;
  initialPatients: Patient[];
  therapists: { id: string; name: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    first_name: "", last_name: "", national_id: "", phone: "", email: "",
    kupah: "כללית", diagnosis: "", dob: "", primary_therapist_id: "", bituach_leumi_case: false,
  });

  const filtered = useMemo(() => {
    const s = q.trim();
    if (!s) return initialPatients;
    return initialPatients.filter((p) =>
      `${p.first_name} ${p.last_name} ${p.national_id ?? ""} ${p.phone ?? ""}`.includes(s)
    );
  }, [q, initialPatients]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await supabase.from("patients").insert({
      clinic_id: clinicId,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      national_id: form.national_id || null,
      phone: form.phone || null,
      email: form.email || null,
      kupah: form.kupah,
      diagnosis: form.diagnosis || null,
      dob: form.dob || null,
      primary_therapist_id: form.primary_therapist_id || null,
      bituach_leumi_case: form.bituach_leumi_case,
    });
    setSaving(false);
    if (error) return setError("שמירת המטופל נכשלה. בדקו את הפרטים ונסו שוב.");
    setOpen(false);
    setForm({ first_name: "", last_name: "", national_id: "", phone: "", email: "", kupah: "כללית", diagnosis: "", dob: "", primary_therapist_id: "", bituach_leumi_case: false });
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">מטופלים</h1>
          <p className="mt-1 text-sm text-slate-500">{initialPatients.length} מטופלים בקליניקה</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary">
          <Plus size={16} /> מטופל חדש
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input pe-10" placeholder="חיפוש לפי שם, ת&Prime;ז או טלפון…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm text-slate-400">
            {initialPatients.length === 0 ? "אין עדיין מטופלים — הוסיפו את הראשון." : "לא נמצאו תוצאות לחיפוש."}
          </div>
        ) : (
          <table className="w-full text-start">
            <thead>
              <tr className="border-b border-line bg-slate-50 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 text-start">שם</th>
                <th className="px-5 py-3 text-start">קופה</th>
                <th className="px-5 py-3 text-start">אבחנה</th>
                <th className="px-5 py-3 text-start">טלפון</th>
                <th className="px-5 py-3 text-start">סטטוס</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-[13.5px]">
              {filtered.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-5 py-3.5">
                    <Link href={`/patients/${p.id}`} className="font-semibold text-slate-800 hover:text-brand">
                      {p.first_name} {p.last_name}
                    </Link>
                    {p.bituach_leumi_case && <span className="badge ms-2 bg-blue-50 text-blue-600">ביטוח לאומי</span>}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{p.kupah ?? "—"}</td>
                  <td className="max-w-[220px] truncate px-5 py-3.5 text-slate-600">{p.diagnosis ?? "—"}</td>
                  <td className="px-5 py-3.5 text-slate-600" dir="ltr">{p.phone ?? "—"}</td>
                  <td className="px-5 py-3.5">
                    <span className={`badge ${p.status === "active" ? "bg-emerald-50 text-emerald-600" : p.status === "on_hold" ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"}`}>
                      {p.status === "active" ? "פעיל" : p.status === "on_hold" ? "בהמתנה" : "שוחרר"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add patient modal */}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">מטופל חדש</h2>
              <button onClick={() => setOpen(false)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <form onSubmit={save} className="grid grid-cols-2 gap-4">
              <div><label className="label">שם פרטי *</label>
                <input required className="input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
              <div><label className="label">שם משפחה *</label>
                <input required className="input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
              <div><label className="label">ת&Prime;ז</label>
                <input dir="ltr" className="input" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} /></div>
              <div><label className="label">תאריך לידה</label>
                <input dir="ltr" type="date" className="input" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></div>
              <div><label className="label">טלפון</label>
                <input dir="ltr" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><label className="label">קופת חולים</label>
                <select className="input" value={form.kupah} onChange={(e) => setForm({ ...form, kupah: e.target.value })}>
                  {KUPOT.map((k) => <option key={k}>{k}</option>)}
                </select></div>
              <div className="col-span-2"><label className="label">אבחנה</label>
                <input className="input" placeholder="למשל: כאב כתף ימין, s/p ניתוח" value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} /></div>
              <div><label className="label">מטפל/ת אחראי/ת</label>
                <select className="input" value={form.primary_therapist_id} onChange={(e) => setForm({ ...form, primary_therapist_id: e.target.value })}>
                  <option value="">ללא</option>
                  {therapists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select></div>
              <label className="col-span-2 flex items-center gap-2.5 text-sm text-slate-700 sm:col-span-1 sm:self-end sm:pb-2.5">
                <input type="checkbox" className="h-4 w-4 rounded border-line text-brand focus:ring-brand/30"
                       checked={form.bituach_leumi_case} onChange={(e) => setForm({ ...form, bituach_leumi_case: e.target.checked })} />
                תיק ביטוח לאומי
              </label>

              {error && <div className="col-span-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">{error}</div>}

              <div className="col-span-2 mt-1 flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost">ביטול</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? "שומר…" : "שמירת מטופל"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
