"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { TEMPLATES, type ClinicalTemplate } from "@/lib/clinic-templates";

export default function TemplateClient({
  clinicName,
  currentTemplateId,
}: {
  clinicName: string;
  currentTemplateId: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(currentTemplateId ?? "");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom template state
  const [customSample, setCustomSample] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [customPreview, setCustomPreview] = useState<ClinicalTemplate | null>(null);

  async function save(templateId: string) {
    setSaving(true);
    setError(null);
    setSaved(false);
    const r = await fetch("/api/clinic/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template_id: templateId }),
    });
    setSaving(false);
    if (!r.ok) { setError("שמירה נכשלה — נסו שוב."); return; }
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
        template_sections: customPreview.sections,
        template_system_context: customPreview.systemContext,
      }),
    });
    setSaving(false);
    if (!r.ok) { setError("שמירה נכשלה."); return; }
    setSelected("custom");
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">תבנית תיעוד</h1>
        <p className="mt-1 text-sm text-slate-500">
          בחרו את הפורמט הקליני המתאים ל<strong>{clinicName}</strong>. ה‑AI ישתמש בתבנית זו לכתיבת כל הרשומות.
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

      {/* Pre-built templates */}
      <div>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">תבניות סטנדרטיות לישראל</h2>
        <div className="space-y-3">
          {TEMPLATES.map((t) => {
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
