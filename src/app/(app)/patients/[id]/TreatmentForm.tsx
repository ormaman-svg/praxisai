"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TREATMENT_TYPE_HE } from "@/lib/types";

export default function TreatmentForm({ clinicId, patientId }: { clinicId: string; patientId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: "follow_up", vas: "", subjective: "", objective: "", assessment: "", plan: "",
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("treatments").insert({
      clinic_id: clinicId,
      patient_id: patientId,
      therapist_id: user?.id ?? null,
      type: form.type,
      vas: form.vas === "" ? null : Number(form.vas),
      subjective: form.subjective || null,
      objective: form.objective || null,
      assessment: form.assessment || null,
      plan: form.plan || null,
    });
    setSaving(false);
    if (error) return setError("שמירת הטיפול נכשלה.");
    setForm({ type: "follow_up", vas: "", subjective: "", objective: "", assessment: "", plan: "" });
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={16} /> תיעוד טיפול חדש
      </button>
    );
  }

  return (
    <div className="card p-5">
      <h2 className="mb-4 text-sm font-bold text-slate-900">תיעוד טיפול חדש</h2>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">סוג טיפול</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(TREATMENT_TYPE_HE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label">VAS (0–10)</label>
            <input dir="ltr" type="number" min={0} max={10} className="input" value={form.vas}
                   onChange={(e) => setForm({ ...form, vas: e.target.value })} placeholder="—" />
          </div>
        </div>
        {([["subjective", "S — סובייקטיבי"], ["objective", "O — אובייקטיבי"], ["assessment", "A — הערכה"], ["plan", "P — תוכנית"]] as const).map(([key, label]) => (
          <div key={key}>
            <label className="label">{label}</label>
            <textarea rows={2} className="input resize-y" value={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
          </div>
        ))}
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost">ביטול</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? "שומר…" : "שמירת טיפול"}</button>
        </div>
      </form>
    </div>
  );
}
