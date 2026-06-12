"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Mic, Square, Loader2, Sparkles, Save, RotateCcw, ChevronDown,
  AudioLines, ClipboardCheck, CheckCircle2, Ear, ToggleLeft, ToggleRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ClinicalTemplate } from "@/lib/clinic-templates";

/* ── types ────────────────────────────────────────────────────────── */

type Mode = "command" | "manual";
type Phase = "standby" | "idle" | "recording" | "transcribing" | "generating" | "review";

/* ── voice command matching ───────────────────────────────────────── */

const START_COMMANDS = ["פרקסיס תרשום", "תרשום", "פרקסיס הקלט", "התחל הקלטה", "פרקסיס תקליט"];
const STOP_COMMANDS  = ["פרקסיס סיים", "פרקסיס תסכם", "סיים הקלטה", "תסכם", "פרקסיס עצור", "עצור הקלטה"];

function matchesAny(text: string, commands: string[]): boolean {
  const clean = text.replace(/[.,!?]/g, "").trim().toLowerCase();
  return commands.some((c) => clean.includes(c.toLowerCase()));
}

/* ── steps bar ────────────────────────────────────────────────────── */

const STEPS = [
  { id: "record",    label: "הקלטה",   icon: Mic },
  { id: "transcribe",label: "תמלול",   icon: AudioLines },
  { id: "note",      label: "רשומה",   icon: Sparkles },
  { id: "save",      label: "שמירה",   icon: ClipboardCheck },
];

function stepIndex(phase: Phase, hasNote: boolean, saved: boolean) {
  if (saved) return 4;
  if (hasNote) return 3;
  if (phase === "review" || phase === "generating" || phase === "transcribing") return 2;
  if (phase === "recording") return 1;
  return 0;
}

/* ── timer format ─────────────────────────────────────────────────── */
const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/* ══════════════════════════════════════════════════════════════════ */

export default function ScribeClient({ template }: { template: ClinicalTemplate }) {
  const supabase = createClient();

  /* state */
  const [mode, setMode] = useState<Mode>("command");
  const [phase, setPhase] = useState<Phase>("standby");
  const [transcript, setTranscript] = useState("");
  const [note, setNote] = useState<Record<string, string>>({});
  const [vas, setVas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [patientId, setPatientId] = useState("");
  const [cmdStatus, setCmdStatus] = useState<string>("ממתין לפקודה…");
  const [listening, setListening] = useState(false);

  /* refs */
  const mediaRef   = useRef<MediaRecorder | null>(null);
  const chunksRef  = useRef<Blob[]>([]);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef     = useRef<number>(0);
  const srRef      = useRef<any>(null); // SpeechRecognition instance
  const phaseRef   = useRef<Phase>("standby"); // readable in SR callbacks
  const mountedRef = useRef(true); // guards SR auto-restart after unmount

  phaseRef.current = phase;

  /* load patients + cleanup all resources on unmount */
  useEffect(() => {
    supabase.from("patients").select("id, first_name, last_name").eq("status", "active").order("last_name")
      .then(({ data }) => { if (data) setPatients(data); });
    return () => {
      mountedRef.current = false;
      stopSR();
      if (timerRef.current) clearInterval(timerRef.current);
      cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => {});
      // Release microphone — stop all tracks on the active MediaRecorder stream
      mediaRef.current?.stream?.getTracks().forEach((t) => t.stop());
      try { if (mediaRef.current?.state === "recording") mediaRef.current.stop(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Speech Recognition ─────────────────────────────────────── */

  function buildSR() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return null;
    const sr = new SR();
    sr.lang = "he-IL";
    sr.continuous = true;
    sr.interimResults = false;
    sr.maxAlternatives = 3;
    return sr;
  }

  function startSR() {
    if (srRef.current) return;
    const sr = buildSR();
    if (!sr) return;

    sr.onstart = () => { setListening(true); setCmdStatus("ממתין לפקודה…"); };
    sr.onend   = () => {
      setListening(false);
      if (!mountedRef.current) return; // component unmounted — don't restart
      // Auto-restart unless we intentionally stopped
      if (phaseRef.current !== "idle" && phaseRef.current !== "transcribing" &&
          phaseRef.current !== "generating" && phaseRef.current !== "review") {
        srRef.current = null;
        setTimeout(() => { if (mountedRef.current) startSR(); }, 300);
      }
    };
    sr.onerror = (e: any) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      console.warn("SR error", e.error);
    };
    sr.onresult = (e: any) => {
      const results = Array.from(e.results as SpeechRecognitionResultList);
      const texts = results.flatMap((r: any) =>
        Array.from({ length: r.length }, (_: any, i: number) => r[i].transcript as string)
      );
      for (const text of texts) {
        if (phaseRef.current === "standby" && matchesAny(text, START_COMMANDS)) {
          setCmdStatus(`זוהתה פקודה: "${text}" — מתחיל הקלטה`);
          startRecording(true);
          return;
        }
        if (phaseRef.current === "recording" && matchesAny(text, STOP_COMMANDS)) {
          setCmdStatus(`זוהתה פקודה: "${text}" — עוצר ומעבד`);
          stopRecording();
          return;
        }
      }
    };

    srRef.current = sr;
    try { sr.start(); } catch {}
  }

  function stopSR() {
    if (!srRef.current) return;
    try { srRef.current.stop(); } catch {}
    srRef.current = null;
    setListening(false);
  }

  /* Start SR when in command mode + standby/recording */
  useEffect(() => {
    if (mode === "command" && (phase === "standby" || phase === "recording")) {
      startSR();
    } else {
      stopSR();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, phase]);

  /* ── Visualizer ─────────────────────────────────────────────── */

  function startVisualizer(stream: MediaStream) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
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
      const bars = 48; const gap = 3;
      const barW = (width - gap * (bars - 1)) / bars;
      for (let i = 0; i < bars; i++) {
        const v = data[Math.floor((i / bars) * data.length)] / 255;
        const h = Math.max(4, v * height * 0.92);
        const x = i * (barW + gap); const y = (height - h) / 2;
        const grad = c.createLinearGradient(0, y, 0, y + h);
        grad.addColorStop(0, "#60a5fa"); grad.addColorStop(1, "#8b5cf6");
        c.fillStyle = grad; c.beginPath(); c.roundRect(x, y, barW, h, 3); c.fill();
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

  /* ── Recording ──────────────────────────────────────────────── */

  const handleStop = useCallback(async (chunks: Blob[]) => {
    setPhase("transcribing");
    const blob = new Blob(chunks, { type: chunks[0]?.type || "audio/webm" });
    const fd = new FormData();
    fd.append("audio", blob, "recording.webm");
    const r = await fetch("/api/scribe/transcribe", { method: "POST", body: fd });
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      setError(j?.error ?? "התמלול נכשל — נסו שוב.");
      setPhase(mode === "command" ? "standby" : "idle");
      return;
    }
    const { transcript: t } = await r.json();
    setTranscript(t || "");
    // Auto-generate note
    await generateNote(t || "");
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  async function startRecording(fromCommand = false) {
    setError(null);
    setTranscript("");
    setNote({});
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
      if (fromCommand) setCmdStatus('מקליט… אמרו "פרקסיס סיים" לסיום');
    } catch {
      setError("לא ניתן לגשת למיקרופון — אנא אשרו הרשאה בדפדפן.");
      setPhase(mode === "command" ? "standby" : "idle");
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRef.current?.stop();
    mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
  }

  /* ── Note generation ────────────────────────────────────────── */

  async function generateNote(text: string) {
    if (!text.trim()) { setPhase("review"); return; }
    setPhase("generating");
    const r = await fetch("/api/scribe/soap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: text }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      setError(j?.error ?? "יצירת הרשומה נכשלה.");
      setPhase("review");
      return;
    }
    const data = await r.json();
    const { _template_id, ...sections } = data;
    setNote(sections);
    setPhase("review");
  }

  /* ── Save ───────────────────────────────────────────────────── */

  async function saveRecord() {
    if (!patientId) { setError("יש לבחור מטופל לפני השמירה."); return; }
    setSaving(true); setError(null);
    const r = await fetch("/api/scribe/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId, sections: note, vas: vas === "" ? null : Number(vas) }),
    });
    setSaving(false);
    if (!r.ok) { setError("שמירה נכשלה — נסו שוב."); return; }
    setSaved(true);
  }

  function reset() {
    setPhase(mode === "command" ? "standby" : "idle");
    setTranscript(""); setNote({}); setVas("");
    setSaved(false); setElapsed(0); setError(null);
    setCmdStatus("ממתין לפקודה…");
  }

  /* ── derived ────────────────────────────────────────────────── */

  const hasNote = Object.values(note).some(Boolean);
  const activeStep = stepIndex(phase, hasNote, saved);

  /* ── render ─────────────────────────────────────────────────── */

  const SRSupported = typeof window !== "undefined" &&
    (!!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">תיעוד AI — Scribe</h1>
          <p className="mt-1 text-sm text-slate-500">
            הקליטו את הטיפול — praxisAI תמלל ותכתוב רשומה בפורמט{" "}
            <span className="font-semibold text-slate-700">{template.name}</span>.
          </p>
        </div>
        {/* Mode toggle */}
        {SRSupported && (
          <button
            onClick={() => {
              const next = mode === "command" ? "manual" : "command";
              setMode(next);
              setPhase(next === "command" ? "standby" : "idle");
            }}
            className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-[12.5px] font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
          >
            {mode === "command" ? <ToggleRight size={18} className="text-brand" /> : <ToggleLeft size={18} className="text-slate-400" />}
            {mode === "command" ? "מצב פקודה קולית" : "מצב ידני"}
          </button>
        )}
      </div>

      {/* Steps bar */}
      <div className="flex items-center gap-2">
        {STEPS.map(({ id, label, icon: Icon }, i) => {
          const done = i < activeStep;
          const current = i === activeStep;
          return (
            <div key={id} className="flex flex-1 items-center gap-2">
              <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all duration-500 ${
                done ? "bg-emerald-50 text-emerald-600" :
                current ? "bg-gradient-to-l from-brand to-violet-600 text-white shadow-pop" :
                "bg-slate-100 text-slate-400"}`}>
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
          <select className="input appearance-none !pr-8" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">— בחרו מטופל —</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.last_name} {p.first_name}</option>)}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {/* ── Main stage ── */}
      <div className="relative overflow-hidden rounded-2xl bg-navy p-10 text-center text-white shadow-pop">
        <div className="pointer-events-none absolute -top-20 right-1/4 h-56 w-56 rounded-full bg-brand/25 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-violet-600/20 blur-3xl" aria-hidden />

        <div className="relative">
          {/* ── COMMAND MODE: standby ── */}
          {mode === "command" && phase === "standby" && (
            <div className="space-y-6">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/10 ring-4 ring-white/20">
                <Ear size={36} className={listening ? "text-brand-100 animate-pulse" : "text-slate-400"} />
              </div>
              <div>
                <h2 className="text-lg font-bold">
                  {listening ? cmdStatus : "מפעיל זיהוי קולי…"}
                </h2>
                {listening && (
                  <p className="mt-2 text-sm text-slate-400">המיקרופון פתוח — ממתין לפקודת ההתחלה</p>
                )}
              </div>

              {/* Command cards */}
              <div className="mx-auto grid max-w-md grid-cols-1 gap-3 text-right sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">פקודת התחלה</p>
                  <div className="space-y-1">
                    {START_COMMANDS.slice(0, 3).map((c) => (
                      <div key={c} className="rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-[12.5px] font-bold text-emerald-300">
                        "{c}"
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">פקודת סיום</p>
                  <div className="space-y-1">
                    {STOP_COMMANDS.slice(0, 3).map((c) => (
                      <div key={c} className="rounded-lg bg-red-500/15 px-2.5 py-1.5 text-[12.5px] font-bold text-red-300">
                        "{c}"
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={() => startRecording(false)} className="text-xs text-slate-500 underline hover:text-slate-300 transition-colors">
                לחצו כאן להתחלה ידנית
              </button>
            </div>
          )}

          {/* ── MANUAL MODE: idle ── */}
          {(mode === "manual" || phase === "idle") && phase !== "recording" &&
           phase !== "transcribing" && phase !== "generating" && phase !== "review" && (
            <>
              <button
                onClick={() => startRecording(false)}
                className="group mx-auto mb-6 grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-brand to-violet-600 shadow-[0_0_60px_rgba(37,99,235,.45)] transition-transform hover:scale-105"
              >
                <Mic size={38} className="transition-transform group-hover:scale-110" />
              </button>
              <h2 className="mb-1.5 text-lg font-bold">מוכנים להקליט?</h2>
              <p className="text-sm text-slate-400">לחצו על המיקרופון — והתחילו לטפל. אנחנו נכתוב.</p>
            </>
          )}

          {/* ── Recording ── */}
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
              <canvas ref={canvasRef} width={560} height={72} className="mx-auto mb-5 h-[72px] w-full max-w-[560px]" />
              {mode === "command" && (
                <p className="mb-4 text-sm text-slate-400">אמרו <span className="font-bold text-red-300">"פרקסיס סיים"</span> לסיום</p>
              )}
              <button
                onClick={stopRecording}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/40 bg-red-500/15 px-8 py-3 text-base font-semibold text-red-300 transition-colors hover:bg-red-500/25"
              >
                <Square size={18} /> עצור — וצור רשומה
              </button>
            </>
          )}

          {/* ── Processing ── */}
          {(phase === "transcribing" || phase === "generating") && (
            <div className="py-6">
              <div className="relative mx-auto mb-6 grid h-20 w-20 place-items-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-brand/30" />
                <span className="absolute inset-2 rounded-full bg-brand/20" />
                {phase === "transcribing"
                  ? <AudioLines size={30} className="relative text-brand-100" />
                  : <Sparkles size={30} className="relative text-brand-100" />}
              </div>
              <p className="text-base font-semibold">
                {phase === "transcribing" ? "מתמלל בעברית…" : `ה‑AI כותב רשומת ${template.name}…`}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {phase === "transcribing"
                  ? "מזהה מינוח קליני ומפסק את הדיבור."
                  : template.sections.map((s) => s.label).join(" · ")}
              </p>
            </div>
          )}

          {/* ── Review ready ── */}
          {phase === "review" && !hasNote && (
            <div className="py-2">
              <CheckCircle2 size={34} className="mx-auto mb-3 text-emerald-400" />
              <p className="text-base font-semibold">ההקלטה תומללה</p>
              <p className="mt-1 text-sm text-slate-400">עברו על התמלול למטה — ואז צרו רשומה.</p>
            </div>
          )}

          {phase === "review" && hasNote && (
            <div className="py-2">
              <CheckCircle2 size={34} className="mx-auto mb-3 text-emerald-400" />
              <p className="text-base font-semibold">הרשומה מוכנה לעיון</p>
              <p className="mt-1 text-sm text-slate-400">עברו, ערכו ואשרו את הסעיפים למטה.</p>
            </div>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Transcript */}
      {phase === "review" && (
        <div className="card space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <AudioLines size={15} className="text-brand" /> תמלול
            </h2>
            {!hasNote && (
              <button
                onClick={() => generateNote(transcript)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-l from-brand to-violet-600 px-4 py-2 text-xs font-bold text-white shadow-pop transition-transform hover:scale-[1.03]"
              >
                <Sparkles size={13} /> צור רשומה
              </button>
            )}
          </div>
          <textarea
            className="input min-h-[110px] text-sm leading-relaxed"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="התמלול יופיע כאן — ניתן לערוך לפני יצירת הרשומה."
          />
        </div>
      )}

      {/* Clinical note — dynamic template sections */}
      {phase === "review" && hasNote && (
        <div className="card space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <ClipboardCheck size={15} className="text-brand" /> {template.name}
            </h2>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-600">
              <Sparkles size={11} /> נוצר על‑ידי AI — עברו ואשרו
            </span>
          </div>

          {template.sections.map(({ key, letter, label, color, ring, placeholder }) => (
            <div key={key} className={`rounded-xl border border-line p-4 transition-shadow focus-within:ring-2 ${ring}`}>
              <div className="mb-2 flex items-center gap-2.5">
                <span className={`grid h-7 w-7 place-items-center rounded-lg ${color} text-[12px] font-bold text-white`}>
                  {letter}
                </span>
                <div className="text-[13px] font-bold text-slate-900">{label}</div>
              </div>
              <textarea
                className="w-full resize-y rounded-lg border-0 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700 outline-none min-h-[76px]"
                value={note[key] ?? ""}
                onChange={(e) => setNote({ ...note, [key]: e.target.value })}
                placeholder={placeholder}
              />
            </div>
          ))}

          <div>
            <label className="label">VAS — דרגת כאב (0–10)</label>
            <input type="number" min={0} max={10} className="input !w-24"
              value={vas} onChange={(e) => setVas(e.target.value)} placeholder="0–10" />
          </div>

          {saved ? (
            <>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700">
                ✓ הרשומה נשמרה בהצלחה
              </div>
              <button onClick={reset} className="btn-ghost w-full">
                <RotateCcw size={16} /> {mode === "command" ? "חזרה למצב המתנה" : "טיפול חדש"}
              </button>
            </>
          ) : (
            <div className="flex gap-3 pt-2">
              <button onClick={saveRecord} disabled={saving} className="btn-primary flex-1">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? "שומר..." : "שמור רשומה"}
              </button>
              <button onClick={reset} className="btn-ghost"><RotateCcw size={16} /> ביטול</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
