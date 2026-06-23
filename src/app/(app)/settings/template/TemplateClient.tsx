"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { TEMPLATES, type ClinicalTemplate } from "@/lib/clinic-templates";

export default function TemplateClient({
  clinicName,
  currentTemplateId,
  isDemo = false,
}: {
  clinicName: string;
  currentTemplateId: string | null;
  isDemo?: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(currentTemplateId ?? "");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoMsg, setDemoMsg] = useState<string | null>(null);

  // Custom template state
  const [customSample, setCustomSample] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [customPreview, setCustomPreview] = useState<ClinicalTemplate | null>(null);

  // In a demo clinic, regenerate all patients/treatments/analytics to match the new type.
  async function reseedDemo() {
    setDemoMsg("מרענן נתוני דמו להתאמה לסוג הקליניקה…");
    const r = await fetch("/api/clinic/demo-seed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!r.ok) { setDemoMsg(null); return; }
    const d = await r.json().catch(() => null);
    setDemoMsg(d ? `נתוני הדמו עודכנו: ${d.patients} מטופלים תואמים ל${d.profession}.` : null);
  }

  async function save(templateId: string) {
    setSaving(true);
    setError(null);
    setSaved(false);
    setDemoMsg(null);
    const tmpl = TEMPLATES.find((t) => t.id === templateId);
    const r = await fetch("/api/clinic/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template_id: templateId, template_profession: tmpl?.profession }),
    });
    if (!r.ok) { setSaving(false); setError("שמירה נכשלה — נסו שוב."); return; }
    setSelected(templateId);
    if (isDemo) await reseedDemo();
    setSaving(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 3000);
  }

  async function analyzeCustom() {
    if (!customSample.trim()) return;
    setAnalyzing(true);
    setError(null);
    const r = await fetch("/api/clinic/analyze-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sample: customSample }),
    });
    setAnalyzing(false);
    if (!r.ok) { setError("ניתוח התבנית נכשל — נסו שוב."); return; }
    const { template } = await r.json();
    setCustomPreview(template);
  }

  async function saveCustom() {
    if (!customPreview) return;
    setSaving(true);
    const r = await fetch("/api/clinic/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template_id: "custom",
        template_name: customPreview.name,
        template_profession: "אחר",
        template_sections: customPreview.sections,
        template_system_context: customPreview.systemContext,
      }),
    });
    if (!r.ok) { setSaving(false); setError("שמירה נכשלה."); return; }
    setSelected("custom");
    if (isDemo) await reseedDemo();
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="page-title">סוג הקליניקה</h1>
        <p className="mt-1 text-sm text-slate-500">
          בחרו את התחום הקליני של <strong>{clinicName}</strong>. ההגדרה קובעת את תבנית התיעוד, את המלצות צ&apos;אט ה‑AI ואת האנליטיקות בכל המערכת.
        </p>
      </div>

      {saved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 flex items-center gap-2">
          <Check size={16} /> התבנית נשמרה בהצלחה
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {isDemo && demoMsg && (
        <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 flex items-center gap-2">
          <Sparkles size={16} /> {demoMsg}
        </div>
      )}
      {isDemo && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12.5px] text-amber-700">
          קליניקת דמו — בחירת סוג קליניקה תיצור מחדש מטופלים, טיפולים ואנליטיקות לדוגמה המתאימים לתחום שנבחר.
        </div>
      )}

      {/* Pre-built templates grouped by profession */}
      <div>
        <h2 className="mb-5 text-sm font-bold uppercase tracking-wider text-slate-500">תבניות סטנדרטיות לישראל</h2>
        <div className="space-y-8">
        {Array.from(new Set(TEMPLATES.map((t) => t.profession))).map((profession) => {
          const group = TEMPLATES.filter((t) => t.profession === profession);
          return (
            <div key={profession}>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">{profession}</h2>
              <div className="space-y-3">
                {group.map((t) => {
                  const isSelected = selected === t.id;
                  const isOpen = expanded === t.id;
                  return (
                    <div
                      key={t.id}
                      className={`card overflow-hidden transition-all ${isSelected ? "ring-2 ring-brand" : ""}`}
                    >
                      <div
                        className="flex cursor-pointer items-center gap-4 p-4"
                        onClick={() => setExpanded(isOpen ? null : t.id)}
                      >
                        <span className="text-2xl">{t.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[13.5px] font-bold text-slate-900">{t.name}</span>
                            {isSelected && (
                              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand">פעיל</span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[12px] text-slate-500">{t.description}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {!isSelected && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelected(t.id); save(t.id); }}
                              disabled={saving}
                              className="btn-primary !py-1.5 !px-3 !text-xs"
                            >
                              {saving && selected === t.id ? <Loader2 size={12} className="animate-spin" /> : "בחירה"}
                            </button>
                          )}
                          {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                        </div>
                      </div>

                      {/* Section preview */}
                      {isOpen && (
                        <div className="border-t border-line bg-slate-50 px-4 py-3">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">סעיפי הרשומה</p>
                          <div className="flex flex-wrap gap-2">
                            {t.sections.map((s) => (
                              <span key={s.key} className="flex items-center gap-1.5 rounded-full bg-white border border-line px-3 py-1 text-[12px] font-semibold text-slate-700">
                                <span className={`grid h-5 w-5 place-items-center rounded-full ${s.color} text-[10px] font-bold text-white`}>
                                  {s.letter}
                                </span>
                                {s.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {/* Custom template */}
      <div>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wider text-slate-500">תבנית מותאמת אישית</h2>
        <p className="mb-4 text-[12px] text-slate-400">הדביקו רשומה לדוגמה מהתיעוד שלכם — ה‑AI ילמד את המבנה ויצור תבנית מותאמת</p>
        <div className="card p-5 space-y-4">
          <textarea
            className="input min-h-[160px] text-sm leading-relaxed font-mono"
            value={customSample}
            onChange={(e) => setCustomSample(e.target.value)}
            placeholder={`לדוגמה:\n\nתלונה עיקרית: כאב בכתף ימין...\nבדיקה: ROM פלקציה 110° כואבת...\nאבחנה: Impingement syndrome...\nטיפול: מובליזציה GH grade III...`}
            dir="rtl"
          />
          {customSample.trim() && !customPreview && (
            <button onClick={analyzeCustom} disabled={analyzing} className="btn-primary w-full">
              {analyzing
                ? <><Loader2 size={15} className="animate-spin" /> מנתח את מבנה הרשומה…</>
                : <><Sparkles size={15} /> ניתוח וזיהוי תבנית</>}
            </button>
          )}

          {customPreview && (
            <div className="space-y-3">
              <div className="rounded-lg bg-brand-50 border border-brand-100 p-3">
                <p className="text-[12px] font-semibold text-brand mb-2">תבנית זוהתה: <span className="font-bold">{customPreview.name}</span></p>
                <div className="flex flex-wrap gap-2">
                  {customPreview.sections.map((s) => (
                    <span key={s.key} className="flex items-center gap-1.5 rounded-full bg-white border border-line px-2.5 py-1 text-[11.5px] font-semibold text-slate-700">
                      <span className={`grid h-4 w-4 place-items-center rounded-full ${s.color} text-[9px] font-bold text-white`}>
                        {s.letter}
                      </span>
                      {s.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveCustom} disabled={saving} className="btn-primary flex-1">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  שמור תבנית זו
                </button>
                <button onClick={() => setCustomPreview(null)} className="btn-ghost">שנה</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
