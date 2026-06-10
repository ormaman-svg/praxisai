"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Mic, Square, Loader2, Sparkles, Save, RotateCcw, ChevronDown,
  AudioLines, ClipboardCheck, CheckCircle2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Phase = "idle" | "recording" | "transcribing" | "soaping" | "review";
type Soap = { subjective: string; objective: string; assessment: string; plan: string };

const SOAP_META: { key: keyof Soap; letter: string; he: string; en: string; chip: string; ring: string }[] = [
  { key: "subjective", letter: "S", he: "דיווח סובייקטיבי", en: "Subjective", chip: "bg-sky-500", ring: "focus-within:ring-sky-200" },
  { key: "objective", letter: "O", he: "ממצאים אובייקטיביים", en: "Objective", chip: "bg-emerald-500", ring: "focus-within:ring-emerald-200" },
  { key: "assessment", letter: "A", he: "הערכה קלינית", en: "Assessment", chip: "bg-amber-500", ring: "focus-within:ring-amber-200" },
  { key: "plan", letter: "P", he: "תוכנית טיפול", en: "Plan", chip: "bg-violet-500", ring: "focus-within:ring-violet-200" },
];

const STEPS = [
  { id: "record", label: "הקלטה", icon: Mic },
  { id: "transcribe", label: "תמלול", icon: AudioLines },
  { id: "soap", label: "רשומת SOAP", icon: Sparkles },
  { id: "save", label: "חתימה ושמירה", icon: ClipboardCheck },
];

function stepIndex(phase: Phase, hasSoap: boolean, saved: boolean) {
  if (saved) return 4;
  if (hasSoap) return 3;
  if (phase === "review") return 2;
  if (phase === "transcribing" || phase === "soaping") return 2;
  if (phase === "recording") return 1;
  return 0;
}

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

  // live visualizer
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    supabase.from("patients").select("id, first_name, last_name").eq("status", "active").order("last_name")
      .then(({ data }) => { if (data) setPatients(data); });
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Draw live frequency bars from the mic stream onto the canvas. */
  function startVisualizer(stream: MediaStream) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    audioCtxRef.current = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const c = canvas.getContext("2d");
      if (!c) return;
      const { width, height } = canvas;
      analyser.getByteFrequencyData(data);
      c.clearRect(0, 0, width, height);

      const bars = 48;
      const gap = 3;
      const barW = (width - gap * (bars - 1)) / bars;
      for (let i = 0; i < bars; i++) {
        const v = data[Math.floor((i / bars) * data.length)] / 255;
        const h = Math.max(4, v * height * 0.92);
        const x = i * (barW + gap);
        const y = (height - h) / 2;
        const grad = c.createLinearGradient(0, y, 0, y + h);
        grad.addColorStop(0, "#60a5fa");
        grad.addColorStop(1, "#8b5cf6");
        c.fillStyle = grad;
        c.beginPath();
        c.roundRect(x, y, barW, h, 3);
        c.fill();
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
  }

  function stopVisualizer() {
    cancelAnimationFrame(rafRef.current);
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }

  const handleStop = useCallback(async (chunks: Blob[]) => {
    setPhase("transcribing");
    const blob = new Blob(chunks, { type: chunks[0]?.type || "audio/webm" });
    const fd = new FormData();
    fd.append("audio", blob, "recording.webm");
    const r = await fetch("/api/scribe/transcribe", { method: "POST", body: fd });
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      setError(j?.error ?? "התמלול נכשל — נסו שוב.");
      setPhase("idle");
      return;
    }
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
      mr.onstop = () => { stopVisualizer(); handleStop(chunksRef.current); };
      mr.start();
      mediaRef.current = mr;
      setPhase("recording");
      startVisualizer(stream);
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
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      setError(j?.error ?? "יצירת ה-SOAP נכשלה.");
      setPhase("review");
      return;
    }
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
  const hasSoap = Boolean(soap.subjective || soap.objective || soap.assessment || soap.plan);
  const activeStep = stepIndex(phase, hasSoap, saved);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">תיעוד AI — Scribe</h1>
        <p className="mt-1 text-sm text-slate-500">הקליטו את הטיפול — praxisAI תמלל ותכתוב את הרשומה.</p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-2">
        {STEPS.map(({ id, label, icon: Icon }, i) => {
          const done = i < activeStep;
          const current = i === activeStep || (i === activeStep - 1 && activeStep === 4 && i === 3);
          return (
            <div key={id} className="flex flex-1 items-center gap-2">
              <div
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all duration-500 ${
                  done
                    ? "bg-emerald-50 text-emerald-600"
                    : current
                      ? "bg-gradient-to-l from-brand to-violet-600 text-white shadow-pop"
                      : "bg-slate-100 text-slate-400"
                }`}
              >
                {done ? <CheckCircle2 size={13} /> : <Icon size={13} />}
                <span className="hidden sm:inline">{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-px flex-1 transition-colors duration-500 ${done ? "bg-emerald-300" : "bg-line"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Patient selector */}
      <div className="card flex items-center gap-3 p-4">
        <label className="shrink-0 text-sm font-semibold text-slate-700">מטופל</label>
        <div className="relative flex-1">
          <select
            className="input appearance-none !pr-8"
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

      {/* Recording stage — the showcase */}
      <div className="relative overflow-hidden rounded-2xl bg-navy p-10 text-center text-white shadow-pop">
        {/* ambient glow */}
        <div className="pointer-events-none absolute -top-20 right-1/4 h-56 w-56 rounded-full bg-brand/25 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-violet-600/20 blur-3xl" aria-hidden />

        <div className="relative">
          {phase === "idle" && (
            <>
              <button
                onClick={startRecording}
                className="group mx-auto mb-6 grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-brand to-violet-600 shadow-[0_0_60px_rgba(37,99,235,.45)] transition-transform hover:scale-105"
                title="התחל הקלטה"
              >
                <Mic size={38} className="transition-transform group-hover:scale-110" />
              </button>
              <h2 className="mb-1.5 text-lg font-bold">מוכנים להקליט?</h2>
              <p className="text-sm text-slate-400">לחצו על המיקרופון — והתחילו לטפל. אנחנו נכתוב.</p>
            </>
          )}

          {phase === "recording" && (
            <>
              <div className="mb-2 flex items-center justify-center gap-2 text-sm font-semibold text-red-400">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                </span>
                מקליט
              </div>
              <div className="mb-5 font-mono text-5xl font-bold tracking-wider">{fmt(elapsed)}</div>

              {/* live audio visualizer */}
              <canvas ref={canvasRef} width={560} height={72} className="mx-auto mb-7 h-[72px] w-full max-w-[560px]" />

              <button
                onClick={stopRecording}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/40 bg-red-500/15 px-8 py-3 text-base font-semibold text-red-300 transition-colors hover:bg-red-500/25"
              >
                <Square size={18} /> עצור — וצור רשומה
              </button>
            </>
          )}

          {(phase === "transcribing" || phase === "soaping") && (
            <div className="py-6">
              <div className="relative mx-auto mb-6 grid h-20 w-20 place-items-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-brand/30" />
                <span className="absolute inset-2 rounded-full bg-brand/20" />
                {phase === "transcribing"
                  ? <AudioLines size={30} className="relative text-brand-100" />
                  : <Sparkles size={30} className="relative text-brand-100" />}
              </div>
              <p className="text-base font-semibold">
                {phase === "transcribing" ? "מתמלל בעברית…" : "ה‑AI כותב את רשומת ה‑SOAP…"}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {phase === "transcribing" ? "מזהה מינוח קליני ומפסק את הדיבור." : "סובייקטיבי · אובייקטיבי · הערכה · תוכנית"}
              </p>
            </div>
          )}

          {phase === "review" && (
            <div className="py-2">
              <CheckCircle2 size={34} className="mx-auto mb-3 text-emerald-400" />
              <p className="text-base font-semibold">ההקלטה תומללה</p>
              <p className="mt-1 text-sm text-slate-400">עברו על התמלול למטה — ואז צרו רשומת SOAP בלחיצה.</p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Transcript */}
      {phase === "review" && (
        <div className="card space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <AudioLines size={15} className="text-brand" /> תמלול
            </h2>
            {!hasSoap && (
              <button
                onClick={generateSoap}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-l from-brand to-violet-600 px-4 py-2 text-xs font-bold text-white shadow-pop transition-transform hover:scale-[1.03]"
              >
                <Sparkles size={13} /> צור רשומת SOAP
              </button>
            )}
          </div>
          <textarea
            className="input min-h-[110px] text-sm leading-relaxed"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="התמלול יופיע כאן — ניתן לערוך לפני יצירת ה-SOAP."
          />
        </div>
      )}

      {/* SOAP form */}
      {phase === "review" && hasSoap && (
        <div className="card space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <ClipboardCheck size={15} className="text-brand" /> רשומת SOAP
            </h2>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-600">
              נוצר על‑ידי AI — עברו ואשרו
            </span>
          </div>

          {SOAP_META.map(({ key, letter, he, en, chip, ring }) => (
            <div key={key} className={`rounded-xl border border-line p-4 transition-shadow focus-within:ring-2 ${ring}`}>
              <div className="mb-2 flex items-center gap-2.5">
                <span className={`grid h-7 w-7 place-items-center rounded-lg ${chip} text-[12px] font-bold text-white`}>
                  {letter}
                </span>
                <div>
                  <div className="text-[13px] font-bold leading-tight text-slate-900">{he}</div>
                  <div className="text-[10.5px] text-slate-400">{en}</div>
                </div>
              </div>
              <textarea
                className="w-full resize-y rounded-lg border-0 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700 outline-none min-h-[76px]"
                value={soap[key]}
                onChange={(e) => setSoap({ ...soap, [key]: e.target.value })}
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
            <>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700">
                ✓ הרשומה נשמרה בהצלחה
              </div>
              <button onClick={reset} className="btn-ghost w-full">
                <RotateCcw size={16} /> טיפול חדש
              </button>
            </>
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
        </div>
      )}
    </div>
  );
}
