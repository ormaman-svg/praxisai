"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Mic } from "lucide-react";
import { TREATMENT_TYPE_HE } from "@/lib/types";
import type { ClinicalTemplate } from "@/lib/clinic-templates";

export default function TreatmentForm({ patientId, template }: { patientId: string; template: ClinicalTemplate }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState("follow_up");
  const [vas, setVas] = useState("");
  const [sections, setSections] = useState<Record<string, string>>(() =>
    Object.fromEntries(template.sections.map((s) => [s.key, ""]))
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const r = await fetch("/api/scribe/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId, type, vas: vas === "" ? null : Number(vas), sections }),
    });
    setSaving(false);
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      return setError(j?.error ?? "שמירת הטיפול נכשלה.");
    }
    setSections(Object.fromEntries(template.sections.map((s) => [s.key, ""])));
    setType("follow_up");
    setVas("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <div className="card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Plus size={16} className="text-brand" />
          <h2 className="text-sm font-bold text-slate-900">תיעוד טיפול חדש</h2>
        </div>
        <p className="mb-3 text-[12.5px] text-slate-500">בחרו כיצד לתעד את הטיפול:</p>
        <div className="grid grid-cols-2 gap-2.5">
          <button onClick={() => setOpen(true)} className="btn-ghost !flex-col !items-start !gap-1 !py-3 text-start">
            <span className="flex items-center gap-1.5 font-bold text-slate-800"><Pencil size={15} /> תיעוד ידני</span>
            <span className="text-[11.5px] font-normal text-slate-500">מילוי הסעיפים בעצמכם</span>
          </button>
          <Link href={`/scribe?patient=${patientId}`} className="btn-primary !flex-col !items-start !gap-1 !py-3 text-start">
            <span className="flex items-center gap-1.5 font-bold"><Mic size={15} /> תיעוד עם AI</span>
            <span className="text-[11.5px] font-normal text-white/80">הקלטה ותמלול אוטומטי</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h2 className="mb-4 text-sm font-bold text-slate-900">
        תיעוד טיפול חדש — <span className="font-normal text-slate-500">{template.name}</span>
      </h2>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">סוג טיפול</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              {Object.entries(TREATMENT_TYPE_HE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {template.has_scale && (
            <div>
              <label className="label">{template.scale_label} (0–10)</label>
              <input dir="ltr" type="number" min={0} max={10} className="input" value={vas}
                     onChange={(e) => setVas(e.target.value)} placeholder="—" />
            </div>
          )}
        </div>

        {template.sections.map((s) => (
          <div key={s.key}>
            <label className="label">
              <span className={`inline-grid h-5 w-5 place-items-center rounded text-[10px] font-bold text-white ${s.color} me-1.5`}>{s.letter}</span>
              {s.label}
            </label>
            <textarea rows={2} className="input resize-y" value={sections[s.key] ?? ""}
                      placeholder={s.placeholder}
                      onChange={(e) => setSections({ ...sections, [s.key]: e.target.value })} />
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
