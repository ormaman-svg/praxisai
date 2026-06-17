"use client";

import { useState } from "react";
import { Sparkles, AlertTriangle, CheckCircle, Lightbulb, Loader2, ChevronDown, ChevronUp } from "lucide-react";

type Flag = {
  type: "red_flag" | "plateau" | "adherence" | "info";
  severity: "high" | "medium" | "low";
  message_he: string;
};

type Suggestion = {
  title_he: string;
  body_he: string;
  evidence_level: "high" | "moderate" | "low" | "expert";
};

type Insights = {
  flags: Flag[];
  suggestions: Suggestion[];
  generated_at: string;
  cached: boolean;
};

const FLAG_STYLE: Record<string, { icon: typeof AlertTriangle; cls: string }> = {
  red_flag:  { icon: AlertTriangle, cls: "border-red-200 bg-red-50 text-red-700" },
  plateau:   { icon: AlertTriangle, cls: "border-amber-200 bg-amber-50 text-amber-700" },
  adherence: { icon: AlertTriangle, cls: "border-orange-200 bg-orange-50 text-orange-700" },
  info:      { icon: CheckCircle,   cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
};

const EVIDENCE_LABEL: Record<string, string> = {
  high:     "עדות גבוהה",
  moderate: "עדות בינונית",
  low:      "עדות נמוכה",
  expert:   "דעת מומחים",
};
const EVIDENCE_CLS: Record<string, string> = {
  high:     "bg-emerald-50 text-emerald-700",
  moderate: "bg-blue-50 text-blue-700",
  low:      "bg-slate-100 text-slate-600",
  expert:   "bg-violet-50 text-violet-700",
};

export default function CopilotPanel({
  patientId,
  initialInsights,
}: {
  patientId: string;
  initialInsights: Insights | null;
}) {
  const [insights, setInsights] = useState<Insights | null>(initialInsights);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [expandedSug, setExpandedSug] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setLoading(true);
    setError(null);
    setExpanded(true);
    try {
      const r = await fetch("/api/copilot/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: patientId, force: true }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        setError(d?.error ?? `שגיאה (${r.status}). נסו שוב.`);
        return;
      }
      setInsights(d);
    } catch (e: any) {
      setError(e?.message ?? "שגיאת רשת. נסו שוב.");
    } finally {
      setLoading(false);
    }
  }

  const highFlags = (insights?.flags ?? []).filter((f) => f.severity === "high");

  return (
    <div className={`card overflow-hidden ${highFlags.length > 0 ? "ring-1 ring-red-200" : ""}`}>
      <button
        className="flex w-full items-center justify-between p-4 text-start"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-violet-50">
            <Sparkles size={15} className="text-violet-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">AI Co-pilot קליני</span>
              {highFlags.length > 0 && (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {highFlags.length} דגל
                </span>
              )}
            </div>
            <p className="text-[11.5px] text-slate-400">ניתוח אוטומטי, התראות ומלצות מבוססות עדות</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {insights && (
            <button
              onClick={(e) => { e.stopPropagation(); analyze(); }}
              disabled={loading}
              className="rounded-md border border-line px-2.5 py-1 text-[11.5px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              {loading ? <Loader2 size={11} className="animate-spin" /> : "עדכן"}
            </button>
          )}
          {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-line px-4 pb-4 pt-3 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-600" />
              <div className="flex-1">
                <p className="text-[12.5px] text-red-700">{error}</p>
                <button onClick={analyze} disabled={loading} className="mt-1.5 text-[11.5px] font-semibold text-red-600 underline">
                  נסה שוב
                </button>
              </div>
            </div>
          )}
          {loading && !insights ? (
            <div className="flex items-center justify-center gap-2 py-6 text-[13px] text-slate-500">
              <Loader2 size={16} className="animate-spin text-violet-500" /> מנתח את נתוני המטופל…
            </div>
          ) : !insights && !error ? (
            <div className="py-6 text-center">
              <p className="mb-3 text-[13px] text-slate-500">הפעל את ה-AI לניתוח ראשוני של המטופל</p>
              <button onClick={analyze} disabled={loading} className="btn-primary gap-2">
                {loading ? <><Loader2 size={14} className="animate-spin" /> מנתח…</> : <><Sparkles size={14} /> הפעל ניתוח</>}
              </button>
            </div>
          ) : !insights ? null : (
            <>
              {/* Flags */}
              {insights.flags.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-[11.5px] font-bold uppercase tracking-wide text-slate-400">התראות</h3>
                  {insights.flags.map((flag, i) => {
                    const { icon: Icon, cls } = FLAG_STYLE[flag.type] ?? FLAG_STYLE.info;
                    return (
                      <div key={i} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${cls}`}>
                        <Icon size={14} className="mt-0.5 shrink-0" />
                        <p className="text-[12.5px] leading-snug">{flag.message_he}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Suggestions */}
              {insights.suggestions.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-[11.5px] font-bold uppercase tracking-wide text-slate-400">המלצות</h3>
                  {insights.suggestions.map((sug, i) => (
                    <div key={i} className="rounded-lg border border-line">
                      <button
                        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-start"
                        onClick={() => setExpandedSug(expandedSug === i ? null : i)}
                      >
                        <div className="flex items-center gap-2">
                          <Lightbulb size={13} className="shrink-0 text-violet-500" />
                          <span className="text-[13px] font-semibold text-slate-800">{sug.title_he}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${EVIDENCE_CLS[sug.evidence_level] ?? EVIDENCE_CLS.expert}`}>
                            {EVIDENCE_LABEL[sug.evidence_level] ?? sug.evidence_level}
                          </span>
                          {expandedSug === i ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
                        </div>
                      </button>
                      {expandedSug === i && (
                        <p className="border-t border-line px-3 py-2.5 text-[12.5px] leading-relaxed text-slate-600">
                          {sug.body_he}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {insights.flags.length === 0 && insights.suggestions.length === 0 && (
                <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                  <CheckCircle size={14} className="text-emerald-600" />
                  <p className="text-[12.5px] text-emerald-700">לא זוהו דגלים — המשך הטיפול הנוכחי תקין.</p>
                </div>
              )}

              <p className="text-[10.5px] text-slate-400">
                {insights.cached ? "תוצאות מהמטמון · " : ""}
                עודכן {new Date(insights.generated_at).toLocaleString("he-IL")}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
