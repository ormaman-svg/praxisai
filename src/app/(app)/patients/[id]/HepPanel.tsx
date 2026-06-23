"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, Plus, X, Sparkles, Send, Loader2, Check, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { HomeProgramConfig } from "@/lib/clinic-templates";

type Item = {
  id?: string;
  name: string;
  sets: number | null;
  reps: number | null;
  hold_sec: number | null;
  frequency: string;
  video_url: string;
  description: string;
};
type Program = {
  id: string;
  title: string;
  instructions: string | null;
  active: boolean;
  program_items: Item[];
  lastLog: { logged_at: string; completed: boolean; pain_score: number | null } | null;
};

const FREQ_HE: Record<string, string> = { daily: "יומי", "2x_daily": "פעמיים ביום", alternate_days: "יום כן יום לא" };

export default function HepPanel({
  patientId, clinicId, patientFirstName, lastPlan, programs, config,
}: {
  patientId: string;
  clinicId: string;
  patientFirstName: string;
  lastPlan: string;
  programs: Program[];
  config: HomeProgramConfig;
}) {
  const router = useRouter();
  const supabase = createClient();
  const blankItem = (): Item => ({
    name: "", sets: config.showSetsReps ? 3 : null, reps: config.showSetsReps ? 10 : null,
    hold_sec: 0, frequency: "daily", video_url: "", description: "",
  });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [items, setItems] = useState<Item[]>([blankItem()]);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sentId, setSentId] = useState<string | null>(null);
  const [sendingPlanId, setSendingPlanId] = useState<string | null>(null);

  function addItem() {
    setItems([...items, blankItem()]);
  }
  function updateItem(i: number, patch: Partial<Item>) {
    setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function removeItem(i: number) {
    setItems(items.filter((_, idx) => idx !== i));
  }

  async function aiGenerate() {
    setGenerating(true);
    const r = await fetch("/api/hep/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: lastPlan || title || "תוכנית תרגול כללית לחיזוק וגמישות" }),
    });
    setGenerating(false);
    const d = await r.json().catch(() => null);
    if (r.ok && d?.items) {
      if (d.title) setTitle(d.title);
      setItems(d.items.map((it: any) => ({
        name: it.name ?? "", sets: it.sets ?? null, reps: it.reps ?? null,
        hold_sec: it.hold_sec ?? 0, frequency: it.frequency ?? "daily",
        video_url: it.video_url ?? "", description: it.description ?? "",
      })));
    }
  }

  async function save() {
    if (!title.trim() || !items.some((i) => i.name.trim())) return;
    setSaving(true);
    const { data: program } = await supabase.from("exercise_programs").insert({
      clinic_id: clinicId, patient_id: patientId, title: title.trim(),
      instructions: instructions.trim() || null, active: true,
    }).select("id").single();

    if (program?.id) {
      const rows = items.filter((i) => i.name.trim()).map((i, idx) => ({
        program_id: program.id, name: i.name.trim(), sets: i.sets, reps: i.reps,
        hold_sec: i.hold_sec, frequency: i.frequency, sort_order: idx,
        video_url: i.video_url.trim() || null, description: i.description.trim() || null,
      }));
      await supabase.from("program_items").insert(rows);

      // Send full plan as WhatsApp text message immediately
      await sendPlan(program.id, title.trim(), items.filter((i) => i.name.trim()));
    }
    setSaving(false);
    setOpen(false);
    setTitle(""); setInstructions("");
    setItems([blankItem()]);
    router.refresh();
  }

  async function sendPlan(programId: string, planTitle: string, planItems: typeof items) {
    const lines: string[] = [`שלום ${patientFirstName}, הנה התוכנית שלך: *${planTitle}*`, ""];
    planItems.forEach((it, idx) => {
      if (!it.name) return;
      let line = `${idx + 1}. *${it.name}*`;
      if (it.sets && it.reps) line += ` — ${it.sets} סטים × ${it.reps} חזרות`;
      if (it.frequency) line += ` (${FREQ_HE[it.frequency] ?? it.frequency})`;
      lines.push(line);
      if (it.description) lines.push(`   ${it.description}`);
      if (it.video_url) lines.push(`   🎦 ${it.video_url}`);
    });
    if (instructions.trim()) {
      lines.push("", `📋 הוראות: ${instructions.trim()}`);
    }
    lines.push("", "בהצלחה! 💪");

    await supabase.from("scheduled_messages").insert({
      clinic_id: clinicId, patient_id: patientId, template_key: "free_text",
      template_vars: [lines.join("\n")], scheduled_for: new Date().toISOString(),
    });
  }

  async function sendNudge(programId: string) {
    await supabase.from("scheduled_messages").insert({
      clinic_id: clinicId, patient_id: patientId, template_key: "hep_nudge",
      template_vars: [patientFirstName], scheduled_for: new Date().toISOString(),
    });
    setSentId(programId);
    setTimeout(() => setSentId(null), 2000);
  }

  async function sendFullPlan(p: Program) {
    setSendingPlanId(p.id);
    await sendPlan(p.id, p.title, p.program_items);
    setTimeout(() => setSendingPlanId(null), 2000);
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <Dumbbell size={15} className="text-violet-500" /> {config.panelTitle}
        </h2>
        <button onClick={() => setOpen(true)} className="text-[12.5px] font-semibold text-brand hover:underline">
          + תוכנית
        </button>
      </div>

      {programs.length === 0 ? (
        <p className="py-4 text-center text-[12.5px] text-slate-400">אין עדיין תוכנית.</p>
      ) : (
        <ul className="space-y-3">
          {programs.map((p) => (
            <li key={p.id} className="rounded-lg border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-slate-800">{p.title}</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => sendFullPlan(p)}
                    className="flex items-center gap-1 text-[11.5px] font-semibold text-blue-600 hover:underline"
                  >
                    {sendingPlanId === p.id ? <><Check size={12} /> נשלח</> : <><Send size={12} /> שלח תוכנית</>}
                  </button>
                  <button
                    onClick={() => sendNudge(p.id)}
                    className="flex items-center gap-1 text-[11.5px] font-semibold text-emerald-600 hover:underline"
                  >
                    {sentId === p.id ? <><Check size={12} /> נשלח</> : "תזכורת יומית"}
                  </button>
                </div>
              </div>
              <ul className="mt-1.5 space-y-1 text-[12px] text-slate-500">
                {p.program_items.map((it, i) => (
                  <li key={i} className="space-y-0.5">
                    <div>
                      • {it.name} {it.sets && it.reps ? `— ${it.sets}×${it.reps}` : ""} {it.frequency ? `(${FREQ_HE[it.frequency] ?? it.frequency})` : ""}
                    </div>
                    {it.description && <div className="pr-3 text-[11px] text-slate-400">{it.description}</div>}
                    {it.video_url && (
                      <a href={it.video_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 pr-3 text-[11px] text-blue-500 hover:underline">
                        <ExternalLink size={10} /> צפייה בסרטון
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              {p.lastLog && (
                <div className="mt-1.5 text-[11px] text-slate-400">
                  דיווח אחרון: {new Date(p.lastLog.logged_at).toLocaleDateString("he-IL")} ·{" "}
                  {p.lastLog.completed ? "בוצע" : "לא בוצע"}
                  {p.lastLog.pain_score != null ? ` · כאב ${p.lastLog.pain_score}/10` : ""}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Create modal */}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
          <div className="card flex max-h-[88vh] w-full max-w-lg flex-col p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">{config.newTitle}</h2>
              <button onClick={() => setOpen(false)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="label !mb-0">שם התוכנית</label>
                  <button onClick={aiGenerate} disabled={generating}
                          className="flex items-center gap-1 text-[12px] font-semibold text-brand hover:underline disabled:opacity-50">
                    {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} הפקה מ-AI
                  </button>
                </div>
                <input className="input" placeholder="לדוגמא: חיזוק כתף ימין" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div>
                <label className="label">הוראות כלליות (אופציונלי)</label>
                <textarea className="input min-h-[60px]" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
              </div>

              <div>
                <label className="label">{config.itemNoun === "תרגיל" ? "תרגילים" : `${config.itemNoun}ות`}</label>
                <div className="space-y-3">
                  {items.map((it, i) => (
                    <div key={i} className="rounded-lg border border-line p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <input className="input !py-1.5 flex-1" placeholder={config.namePlaceholder} value={it.name} onChange={(e) => updateItem(i, { name: e.target.value })} />
                        <button onClick={() => removeItem(i)} className="rounded p-1 text-slate-300 hover:text-red-500"><X size={15} /></button>
                      </div>
                      <div className="flex items-center gap-2">
                        {config.showSetsReps && (
                          <>
                            <input dir="ltr" type="number" className="input !py-1.5 w-16" placeholder="סטים" value={it.sets ?? ""} onChange={(e) => updateItem(i, { sets: e.target.value ? +e.target.value : null })} />
                            <input dir="ltr" type="number" className="input !py-1.5 w-16" placeholder="חזרות" value={it.reps ?? ""} onChange={(e) => updateItem(i, { reps: e.target.value ? +e.target.value : null })} />
                          </>
                        )}
                        <select className="input !py-1.5 flex-1" value={it.frequency} onChange={(e) => updateItem(i, { frequency: e.target.value })}>
                          <option value="daily">יומי</option>
                          <option value="2x_daily">פעמיים ביום</option>
                          <option value="alternate_days">יום כן יום לא</option>
                        </select>
                      </div>
                      <input className="input !py-1.5 text-[12px]" placeholder="תיאור קצר (אופציונלי)" value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} />
                      {config.showVideo && (
                        <input dir="ltr" className="input !py-1.5 text-[12px]" placeholder="קישור וידאו YouTube/Vimeo (אופציונלי)" value={it.video_url} onChange={(e) => updateItem(i, { video_url: e.target.value })} />
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={addItem} className="mt-2 flex items-center gap-1 text-[12.5px] font-semibold text-brand hover:underline">
                  <Plus size={13} /> {config.addLabel}
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-1">
              <p className="text-[11px] text-slate-400 text-center">שמירה תשלח אוטומטית את התוכנית למטופל ב-WhatsApp</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setOpen(false)} className="btn-ghost">ביטול</button>
                <button onClick={save} disabled={saving} className="btn-primary">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : "שמירה ושליחה"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
