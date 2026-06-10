"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square, Loader2, Sparkles, Save, RotateCcw, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Phase = "idle" | "recording" | "transcribing" | "soaping" | "review";
type Soap = { subjective: string; objective: string; assessment: string; plan: string };

const SOAP_LABELS: Record<keyof Soap, string> = {
  subjective: "Subjective — דיווח סובייקטיבי",
  objective: "Objective — ממצאים אובייקטיביים",
  assessment: "Assessment — הערכה קלינית",
  plan: "Plan — תוכנית טיפול",
};

export default function ScribePage() {
  const supabase = createClient();
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [soap, setSoap] = useState<Soap>({ subjective: "", objective: "", assessment: "", plan: "" });
  const [vas, setVas] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [patientId, setPatientId] = useState("");

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    supabase.from("patients").select("id, first_name, last_name").eq("status", "active").order("last_name")
      .then(({ data }) => { if (data) setPatients(data); });
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const handleStop = useCallback(async (chunks: Blob[]) => {
    setPhase("transcribing");
    const blob = new Blob(chunks, { type: "audio/webm" });
    const fd = new FormData();
    fd.append("audio", blob, "recording.webm");
    const r = await fetch("/api/scribe/transcribe", { method: "POST", body: fd });
    if (!r.ok) { setError("התמלול נכשל — נסו שוב."); setPhase("idle"); return; }
    const { transcript: t } = await r.json();
    setTranscript(t || "");
    setPhase("review");
  }, []);

  async function startRecording() {
    setError(null);
    setTranscript("");
    setSoap({ subjective: "", objective: "", assessment: "", plan: "" });
    setVas("");
    setSaved(false);
    setElapsed(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => { handleStop(chunksRef.current); };
      mr.start();
      mediaRef.current = mr;
      setPhase("recording");
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      setError("לא ניתן לגשת למיקרופון — אנא אשרו הרשאה בדפדפן.");
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRef.current?.stop();
    mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
  }

  async function generateSoap() {
    if (!transcript.trim()) return;
    setPhase("soaping");
    const r = await fetch("/api/scribe/soap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    });
    if (!r.ok) { setError("יצירת ה-SOAP נכשלה."); setPhase("review"); return; }
    const data = await r.json();
    setSoap(data);
    setPhase("review");
  }

  async function saveRecord() {
    if (!patientId) { setError("יש לבחור מטופל לפני השמירה."); return; }
    setSaving(true);
    setError(null);
    const r = await fetch("/api/scribe/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId, ...soap, vas: vas === "" ? null : Number(vas) }),
    });
    setSaving(false);
    if (!r.ok) { setError("שמירה נכשלה — נסו שוב."); return; }
    setSaved(true);
  }

  function reset() {
    setPhase("idle");
    setTranscript("");
    setSoap({ subjective: "", objective: "", assessment: "", plan: "" });
    setVas("");
    setSaved(false);
    setElapsed(0);
    setError(null);
  }

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">תיעוד AI — Scribe</h1>
        <p className="mt-1 text-sm text-slate-500">הקליטו את הטיפול — praxisAI תמלל ותכתוב את הרשומה.</p>
      </div>

      {/* Patient selector */}
      <div className="card p-4 flex items-center gap-3">
        <label className="text-sm font-semibold text-slate-700 shrink-0">מטופל</label>
        <div className="relative flex-1">
          <select
            className="input !pr-8 appearance-none"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          >
            <option value="">— בחרו מטופל —</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>{p.last_name} {p.first_name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {/* Recording card */}
      <div className="card p-10 text-center">
        {phase === "idle" && (
          <>
            <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-brand-50 text-brand">
              <Mic size={36} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">מוכנים להקליט?</h2>
            <p className="text-sm text-slate-500 mb-6">לחצו להתחיל — המיקרופון יתחיל לקלוט מיד.</p>
            <button onClick={startRecording} className="btn-primary !px-8 !py-3 !text-base">
              <Mic size={18} /> התחל הקלטה
            </button>
          </>
        )}

        {phase === "recording" && (
          <>
            <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-red-50 text-red-500">
              <span className="relative flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500" />
              </span>
            </div>
            <div className="text-4xl font-mono font-bold text-slate-900 mb-2">{fmt(elapsed)}</div>
            <p className="text-sm text-slate-500 mb-6">מקליט… לחצו לעצור כשסיימתם.</p>
            <button onClick={stopRecording} className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-8 py-3 text-base font-semibold text-red-600 hover:bg-red-100 transition-colors">
              <Square size={18} /> עצור הקלטה
            </button>
          </>
        )}

        {(phase === "transcribing" || phase === "soaping") && (
          <div className="py-4">
            <Loader2 size={40} className="mx-auto mb-4 animate-spin text-brand" />
            <p className="text-sm text-slate-500">
              {phase === "transcribing" ? "מתמלל… רגע אחד." : "יוצר רשומת SOAP…"}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Transcript */}
      {phase === "review" && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">תמלול</h2>
            {!soap.subjective && (
              <button onClick={generateSoap} className="btn-primary !py-1.5 !px-3 !text-xs">
                <Sparkles size={13} /> צור רשומת SOAP
              </button>
            )}
          </div>
          <textarea
            className="input min-h-[100px] text-sm leading-relaxed"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="התמלול יופיע כאן — ניתן לערוך לפני יצירת ה-SOAP."
          />
        </div>
      )}

      {/* SOAP form */}
      {phase === "review" && soap.subjective && (
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">רשומת SOAP</h2>
          {(Object.keys(SOAP_LABELS) as (keyof Soap)[]).map((field) => (
            <div key={field}>
              <label className="label">{SOAP_LABELS[field]}</label>
              <textarea
                className="input min-h-[80px] text-sm leading-relaxed"
                value={soap[field]}
                onChange={(e) => setSoap({ ...soap, [field]: e.target.value })}
              />
            </div>
          ))}
          <div>
            <label className="label">VAS — דרגת כאב (0–10)</label>
            <input
              type="number" min={0} max={10}
              className="input !w-24"
              value={vas}
              onChange={(e) => setVas(e.target.value)}
              placeholder="0–10"
            />
          </div>

          {saved ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 font-semibold text-center">
              ✓ הרשומה נשמרה בהצלחה
            </div>
          ) : (
            <div className="flex gap-3 pt-2">
              <button onClick={saveRecord} disabled={saving} className="btn-primary flex-1">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? "שומר..." : "שמור רשומה"}
              </button>
              <button onClick={reset} className="btn-ghost">
                <RotateCcw size={16} /> טיפול חדש
              </button>
            </div>
          )}
          {saved && (
            <button onClick={reset} className="btn-ghost w-full">
              <RotateCcw size={16} /> טיפול חדש
            </button>
          )}
        </div>
      )}
    </div>
  );
}
