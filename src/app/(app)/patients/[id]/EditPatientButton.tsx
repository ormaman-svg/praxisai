"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import type { Patient } from "@/lib/types";

const KUPOT = ["כללית", "מכבי", "מאוחדת", "לאומית", "פרטי"];
const STATUSES = [
  { value: "active", label: "פעיל" },
  { value: "on_hold", label: "בהמתנה" },
  { value: "discharged", label: "שוחרר" },
];

export default function EditPatientButton({
  patient,
  therapists,
}: {
  patient: Patient;
  therapists: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    first_name: patient.first_name,
    last_name: patient.last_name,
    national_id: patient.national_id ?? "",
    dob: patient.dob ?? "",
    phone: patient.phone ?? "",
    email: patient.email ?? "",
    kupah: patient.kupah ?? "כללית",
    diagnosis: patient.diagnosis ?? "",
    status: patient.status,
    primary_therapist_id: patient.primary_therapist_id ?? "",
    bituach_leumi_case: patient.bituach_leumi_case,
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/patients/${patient.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      setError(d?.error ?? "שמירה נכשלה");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"
      >
        <Pencil size={13} /> עריכת פרטים
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4"
          onClick={() => !saving && setOpen(false)}
        >
          <div
            className="card w-full max-w-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">עריכת פרטי מטופל</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">שם פרטי *</label>
                <input
                  required
                  className="input"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                />
              </div>
              <div>
                <label className="label">שם משפחה *</label>
                <input
                  required
                  className="input"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                />
              </div>
              <div>
                <label className="label">ת״ז</label>
                <input
                  dir="ltr"
                  className="input"
                  value={form.national_id}
                  onChange={(e) => setForm({ ...form, national_id: e.target.value })}
                />
              </div>
              <div>
                <label className="label">תאריך לידה</label>
                <input
                  dir="ltr"
                  type="date"
                  className="input"
                  value={form.dob}
                  onChange={(e) => setForm({ ...form, dob: e.target.value })}
                />
              </div>
              <div>
                <label className="label">טלפון</label>
                <input
                  dir="ltr"
                  className="input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="label">מייל</label>
                <input
                  dir="ltr"
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label className="label">קופת חולים</label>
                <select
                  className="input"
                  value={form.kupah}
                  onChange={(e) => setForm({ ...form, kupah: e.target.value })}
                >
                  {KUPOT.map((k) => <option key={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label className="label">סטטוס</label>
                <select
                  className="input"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as Patient["status"] })}
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">אבחנה</label>
                <input
                  className="input"
                  value={form.diagnosis}
                  onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
                />
              </div>
              <div>
                <label className="label">מטפל/ת אחראי/ת</label>
                <select
                  className="input"
                  value={form.primary_therapist_id}
                  onChange={(e) => setForm({ ...form, primary_therapist_id: e.target.value })}
                >
                  <option value="">ללא</option>
                  {therapists.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2.5 self-end pb-2.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-line text-brand focus:ring-brand/30"
                  checked={form.bituach_leumi_case}
                  onChange={(e) => setForm({ ...form, bituach_leumi_case: e.target.checked })}
                />
                תיק ביטוח לאומי
              </label>

              {error && (
                <div className="col-span-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
                  {error}
                </div>
              )}

              <div className="col-span-2 mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-ghost"
                  disabled={saving}
                >
                  ביטול
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? "שומר…" : "שמירת שינויים"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
