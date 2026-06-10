"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DOC_TYPE_HE } from "@/lib/types";

type DocRow = {
  id: string; type: string; title: string; status: "draft" | "final"; created_at: string;
  patients: { first_name: string; last_name: string } | null;
};

export default function DocumentsClient({
  clinicId, docs, patients,
}: {
  clinicId: string;
  docs: DocRow[];
  patients: { id: string; first_name: string; last_name: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ type: "bituach_leumi", patient_id: "", title: "", content: "" });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("documents").insert({
      clinic_id: clinicId,
      patient_id: form.patient_id || null,
      type: form.type,
      title: form.title.trim() || DOC_TYPE_HE[form.type],
      content: form.content,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) return setError("שמירת המסמך נכשלה.");
    setOpen(false);
    setForm({ type: "bituach_leumi", patient_id: "", title: "", content: "" });
    router.refresh();
  }

  async function finalize(id: string) {
    await supabase.from("documents").update({ status: "final" }).eq("id", id);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">מסמכים</h1>
          <p className="mt-1 text-sm text-slate-500">מכתבים ודו&Prime;חות רפואיים — כולל ביטוח לאומי</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary"><Plus size={16} /> מסמך חדש</button>
      </div>

      <div className="card overflow-hidden">
        {docs.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm text-slate-400">אין עדיין מסמכים. צרו את הראשון.</div>
        ) : (
          <ul className="divide-y divide-line">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-4 px-5 py-4">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand"><FileText size={17} /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-slate-800">{d.title}</div>
                  <div className="text-xs text-slate-500">
                    {DOC_TYPE_HE[d.type] ?? d.type}
                    {d.patients ? ` · ${d.patients.first_name} ${d.patients.last_name}` : ""}
                    {" · "}
                    {new Date(d.created_at).toLocaleDateString("he-IL")}
                  </div>
                </div>
                <span className={`badge ${d.status === "final" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                  {d.status === "final" ? "סופי" : "טיוטה"}
                </span>
                {d.status === "draft" && (
                  <button onClick={() => finalize(d.id)} className="btn-ghost !px-3 !py-1.5 text-xs">סימון כסופי</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">מסמך חדש</h2>
              <button onClick={() => setOpen(false)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <form onSubmit={save} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">סוג מסמך</label>
                  <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    {Object.entries(DOC_TYPE_HE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">מטופל</label>
                  <select className="input" value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
                    <option value="">ללא שיוך</option>
                    {patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">כותרת</label>
                <input className="input" value={form.title} placeholder={DOC_TYPE_HE[form.type]} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="label">תוכן</label>
                <textarea rows={6} className="input resize-y" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
              </div>
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">{error}</div>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost">ביטול</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? "שומר…" : "שמירה כטיוטה"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
