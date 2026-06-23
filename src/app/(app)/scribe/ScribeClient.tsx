"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Mic, Square, Loader2, Sparkles, Save, RotateCcw, ChevronDown,
  AudioLines, ClipboardCheck, CheckCircle2, Ear, ToggleLeft, ToggleRight,
  Pause, Play, Lightbulb, User2, AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import { AI_RECS_KEY, type ClinicalTemplate } from "@/lib/clinic-templates";

/* ── types ────────────────────────────────────────────────────────── */

type Mode = "command" | "manual";
type Phase = "standby" | "idle" | "recording" | "transcribing" | "generating" | "review";

/* ── voice command matching ───────────────────────────────────────── */

const START_COMMANDS = ["קליני תרשום", "קליני הקלט", "קליני תקליט", "תרשום", "התחל הקלטה", "תתחיל הקלטה"];
const STOP_COMMANDS  = ["קליני סיים", "קליני תסכם", "קליני עצור", "סיים הקלטה", "תסכם", "עצור הקלטה"];

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

export default function ScribeClient({ template, initialPatientId = "" }: { template: ClinicalTemplate; initialPatientId?: string }) {
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
  const [patientId, setPatientId] = useState(initialPatientId);
  const [cmdStatus, setCmdStatus] = useState<string>("ממתין לפקודה…");
  const [listening, setListening] = useState(false);
  const [paused, setPaused] = useState(false);
  // Microphone picker (lets the therapist select a Bluetooth/external mic)
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [micId, setMicId] = useState<string>("");

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
  const startingRef = useRef(false); // guards double-start while mic permission resolves

  phaseRef.current = phase;

  /* enumerate microphones (labels appear once mic permission is granted) */
  const refreshMics = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setMics(devices.filter((d) => d.kind === "audioinput"));
    } catch { /* enumerateDevices unsupported — ignore, default mic is used */ }
  }, []);

  /* load patients + cleanup all resources on unmount */
  useEffect(() => {
    supabase.from("patients").select("id, first_name, last_name").eq("status", "active").order("last_name")
      .then(({ data }) => { if (data) setPatients(data); });
    refreshMics();
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshMics);
    return () => {
      mountedRef.current = false;
      stopSR();
      if (timerRef.current) clearInterval(timerRef.current);
      cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => {});
      // Release microphone — stop all tracks on the active MediaRecorder stream
      mediaRef.current?.stream?.getTracks().forEach((t) => t.stop());
      try { if (mediaRef.current?.state === "recording") mediaRef.current.stop(); } catch {}
      navigator.mediaDevices?.removeEventListener?.("devicechange", refreshMics);
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
    sr.interimResults = true; // match commands as they're spoken — far more responsive
    sr.maxAlternatives = 3;
    return sr;
  }

  function startSR() {
    if (srRef.current) return;
    const sr = buildSR();
    if (!sr) return;

    // `listening` reflects our INTENT to listen, set once when SR is engaged.
    // We never flip it off on the frequent auto-restarts, so the UI stays steady.
    sr.onstart = () => { setListening(true); };
    sr.onend   = () => {
      if (!mountedRef.current) return; // component unmounted — don't restart
      srRef.current = null;
      // Chrome ends recognition on silence — seamlessly restart while we still listen.
      if (phaseRef.current === "standby" || phaseRef.current === "recording") {
        setTimeout(() => { if (mountedRef.current) startSR(); }, 150);
      } else {
        setListening(false);
      }
    };
    sr.onerror = (e: any) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("אין הרשאת מיקרופון לזיהוי קולי — אשרו גישה בדפדפן ורעננו.");
        setListening(false);
      }
    };
    sr.onresult = (e: any) => {
      // Only scan results new to this event (interim + final) for fast matching.
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        for (let a = 0; a < r.length; a++) {
          const text = r[a].transcript as string;
          if (phaseRef.current === "standby" && matchesAny(text, START_COMMANDS)) {
            startRecording(true);
            return;
          }
          if (phaseRef.current === "recording" && matchesAny(text, STOP_COMMANDS)) {
            stopRecording();
            return;
          }
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
    if (startingRef.current || phaseRef.current === "recording") return; // already starting/recording
    startingRef.current = true;
    phaseRef.current = "recording"; // block re-trigger from further interim results immediately
    setError(null);
    setTranscript("");
    setNote({});
    setVas("");
    setSaved(false);
    setElapsed(0);
    setPaused(false);
    if (fromCommand) setCmdStatus('מקליט… אמרו "קליני סיים" לסיום');
    try {
      // Use the chosen mic (e.g. a Bluetooth headset) when one is selected.
      const audio: MediaTrackConstraints | boolean = micId ? { deviceId: { exact: micId } } : true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio });
      refreshMics(); // labels become available after permission is granted
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
      phaseRef.current = mode === "command" ? "standby" : "idle";
      setError("לא ניתן לגשת למיקרופון — אנא אשרו הרשאה בדפדפן.");
      setPhase(mode === "command" ? "standby" : "idle");
    } finally {
      startingRef.current = false;
    }
  }

  function stopRecording() {
    if (phaseRef.current !== "recording") return; // ignore repeat stop commands
    phaseRef.current = "transcribing"; // block further STOP matches immediately
    if (timerRef.current) clearInterval(timerRef.current);
    setPaused(false);
    mediaRef.current?.stop();
    mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
  }

  /* Pause/resume — lets the therapist record in segments (e.g. between joints)
     without producing multiple files; chunks accumulate into one recording. */
  function pauseRecording() {
    if (mediaRef.current?.state !== "recording") return;
    mediaRef.current.pause();
    if (timerRef.current) clearInterval(timerRef.current);
    setPaused(true);
  }

  function resumeRecording() {
    if (mediaRef.current?.state !== "paused") return;
    mediaRef.current.resume();
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    setPaused(false);
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
      body: JSON.stringify({
        patientId,
        sections: note,
        aiRecommendations: note[AI_RECS_KEY] ?? "",
        vas: vas === "" ? null : Number(vas),
      }),
    });
    setSaving(false);
    if (!r.ok) { setError("שמירה נכשלה — נסו שוב."); return; }
    setSaved(true);
  }

  function reset() {
    setPhase(mode === "command" ? "standby" : "idle");
    setTranscript(""); setNote({}); setVas("");
    setSaved(false); setElapsed(0); setError(null); setPaused(false);
    setCmdStatus("ממתין לפקודה…");
  }

  /* ── derived ────────────────────────────────────────────────── */

  // SOAP content excludes the AI-recommendations field (rendered separately).
  const aiRecs = note[AI_RECS_KEY] ?? "";
  const hasNote = Object.entries(note).some(([k, v]) => k !== AI_RECS_KEY && Boolean(v));
  const activeStep = stepIndex(phase, hasNote, saved);

  /* ── render ─────────────────────────────────────────────────── */

  const SRSupported = typeof window !== "undefined" &&
    (!!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition);

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      {/* Header */}
      <PageHeader
        icon={Mic}
        eyebrow="תיעוד חכם"
        title="Scribe — תיעוד טיפול"
        subtitle={
          <>
            הקליטו את הטיפול — praxisAI תמלל ותכתוב רשומה בפורמט{" "}
            <span className="font-semibold text-ink-700">{template.name}</span>.
          </>
        }
      >
        {/* Mode toggle */}
        {SRSupported && (
          <button
            onClick={() => {
              const next = mode === "command" ? "manual" : "command";
              setMode(next);
              setPhase(next === "command" ? "standby" : "idle");
            }}
            className="btn-ghost"
          >
            {mode === "command" ? <ToggleRight size={18} className="text-brand" /> : <ToggleLeft size={18} className="text-ink-400" />}
            {mode === "command" ? "מצב פקודה קולית" : "מצב ידני"}
          </button>
        )}
      </PageHeader>

      {/* Steps bar */}
      <div className="flex items-center gap-2">
        {STEPS.map(({ id, label, icon: Icon }, i) => {
          const done = i < activeStep;
          const current = i === activeStep;
          return (
            <div key={id} className="flex flex-1 items-center gap-2">
              <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all duration-500 ${
                done ? "bg-emerald-50 text-emerald-600" :
                current ? "bg-brand-gradient text-white shadow-glow" :
                "bg-surface-3 text-ink-400"}`}>
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

      {/* Patient + microphone selectors */}
      <div className="card card-body grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label flex items-center gap-1.5"><User2 size={13} className="text-ink-400" /> מטופל</label>
          <div className="relative">
            <select className="select appearance-none pe-9" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">— בחרו מטופל —</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.last_name} {p.first_name}</option>)}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-ink-400" />
          </div>
        </div>
        <div>
          <label className="label flex items-center gap-1.5"><Mic size={13} className="text-ink-400" /> מיקרופון</label>
          <div className="relative">
            <select
              className="select appearance-none pe-9"
              value={micId}
              onChange={(e) => setMicId(e.target.value)}
              disabled={phase === "recording"}
            >
              <option value="">מיקרופון ברירת מחדל</option>
              {mics.map((m, i) => (
                <option key={m.deviceId || i} value={m.deviceId}>
                  {m.label || `מיקרופון ${i + 1}`}
                </option>
              ))}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-ink-400" />
          </div>
        </div>
      </div>

      {/* ── Main stage ── */}
      <div className="relative overflow-hidden rounded-3xl bg-navy p-10 text-center text-white shadow-pop ring-1 ring-white/5">
        <div className="pointer-events-none absolute -top-24 end-1/4 h-64 w-64 rounded-full bg-brand/30 blur-3xl animate-aurora" aria-hidden />
        <div className="pointer-events-none absolute -bottom-28 start-1/4 h-64 w-64 rounded-full bg-accent/20 blur-3xl animate-aurora" aria-hidden />
        <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] [background-size:22px_22px]" aria-hidden />

        <div className="relative">
          {/* ── COMMAND MODE: standby ── */}
          {mode === "command" && phase === "standby" && (
            <div className="space-y-6">
              <div className={`relative mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white/[0.07] ring-1 ring-inset ring-white/15 ${listening ? "shadow-glow-accent" : ""}`}>
                {listening && <span className="absolute inset-0 animate-ping rounded-full bg-accent/20" aria-hidden />}
                <span className="absolute inset-2 rounded-full bg-accent/10" aria-hidden />
                <Ear size={38} className="relative text-accent-200 animate-pulse" />
              </div>
              <div>
                <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-accent-400/30 bg-accent-400/10 px-3 py-1 text-[11px] font-semibold text-accent-200">
                  <span className={`dot ${listening ? "bg-accent-300 animate-pulse" : "bg-ink-400"}`} />
                  {listening ? "האזנה פעילה" : "מתחבר…"}
                </div>
                <h2 className="text-xl font-bold tracking-tight">{cmdStatus}</h2>
                <p className="mt-1.5 text-sm text-ink-300">
                  {listening ? "המיקרופון פתוח — ממתין לפקודת ההתחלה" : "מפעיל מיקרופון…"}
                </p>
              </div>

              {/* Command cards */}
              <div className="mx-auto grid max-w-md grid-cols-1 gap-3 text-start sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-sm">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300/80">פקודת התחלה</p>
                  <div className="space-y-1.5">
                    {START_COMMANDS.slice(0, 3).map((c) => (
                      <div key={c} className="rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-[12.5px] font-bold text-emerald-300">
                        &ldquo;{c}&rdquo;
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-sm">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-red-300/80">פקודת סיום</p>
                  <div className="space-y-1.5">
                    {STOP_COMMANDS.slice(0, 3).map((c) => (
                      <div key={c} className="rounded-lg bg-red-500/15 px-2.5 py-1.5 text-[12.5px] font-bold text-red-300">
                        &ldquo;{c}&rdquo;
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={() => startRecording(false)} className="text-xs font-medium text-ink-400 underline underline-offset-2 transition-colors hover:text-ink-200">
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
                className="group relative mx-auto mb-6 grid h-28 w-28 place-items-center rounded-full bg-brand-gradient shadow-glow-lg ring-1 ring-inset ring-white/25 transition-transform duration-300 hover:scale-105 focus-visible:outline-none"
                aria-label="התחלת הקלטה"
              >
                <span className="absolute inset-0 rounded-full bg-brand/40 blur-xl transition-opacity duration-300 group-hover:opacity-80" aria-hidden />
                <span className="absolute -inset-1.5 rounded-full ring-1 ring-white/10 transition-all duration-500 group-hover:-inset-2.5 group-hover:ring-white/20" aria-hidden />
                <Mic size={40} className="relative transition-transform duration-300 group-hover:scale-110" />
              </button>
              <h2 className="mb-1.5 text-xl font-bold tracking-tight">מוכנים להקליט?</h2>
              <p className="text-sm text-ink-300">לחצו על המיקרופון — והתחילו לטפל. אנחנו נכתוב.</p>
            </>
          )}

          {/* ── Recording ── */}
          {phase === "recording" && (
            <>
              {paused ? (
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[12px] font-semibold text-amber-300">
                  <Pause size={13} /> מושהה
                </div>
              ) : (
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-[12px] font-semibold text-red-300">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                  </span>
                  מקליט · האזנה חיה
                </div>
              )}
              <div className={`mb-5 font-mono text-6xl font-bold tracking-wider tabular-nums transition-colors ${paused ? "text-ink-400" : "text-white"}`}>{fmt(elapsed)}</div>
              <div className={`mx-auto mb-5 w-full max-w-[560px] rounded-2xl border p-3 transition-all ${paused ? "border-white/5 bg-white/[0.02]" : "border-accent-400/20 bg-accent-400/[0.04] shadow-glow-accent"}`}>
                <canvas ref={canvasRef} width={560} height={72} className={`h-[72px] w-full transition-opacity ${paused ? "opacity-30" : ""}`} />
              </div>
              {mode === "command" && !paused && (
                <p className="mb-4 text-sm text-ink-300">אמרו <span className="font-bold text-red-300">&ldquo;קליני סיים&rdquo;</span> לסיום</p>
              )}
              <div className="flex flex-wrap items-center justify-center gap-3">
                {paused ? (
                  <button
                    onClick={resumeRecording}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-6 py-3 text-base font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/25"
                  >
                    <Play size={18} /> המשך הקלטה
                  </button>
                ) : (
                  <button
                    onClick={pauseRecording}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/15 px-6 py-3 text-base font-semibold text-amber-300 transition-colors hover:bg-amber-500/25"
                  >
                    <Pause size={18} /> השהה
                  </button>
                )}
                <button
                  onClick={stopRecording}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-red-500 to-rose-600 px-8 py-3 text-base font-semibold text-white shadow-[0_8px_24px_rgba(225,29,72,0.4)] ring-1 ring-inset ring-white/20 transition-transform hover:-translate-y-0.5"
                >
                  <Square size={18} className="fill-current" /> סיים — וצור רשומה
                </button>
              </div>
            </>
          )}

          {/* ── Processing ── */}
          {(phase === "transcribing" || phase === "generating") && (
            <div className="py-6">
              <div className="relative mx-auto mb-6 grid h-24 w-24 place-items-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-accent/25" />
                <span className="absolute inset-3 rounded-full bg-accent/15" />
                {phase === "transcribing"
                  ? <AudioLines size={32} className="relative text-accent-200" />
                  : <Sparkles size={32} className="relative text-accent-200" />}
              </div>
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-accent-400/30 bg-accent-400/10 px-3 py-1 text-[11px] font-semibold text-accent-200">
                <Loader2 size={12} className="animate-spin" /> AI בעבודה
              </div>
              <p className="text-lg font-bold tracking-tight">
                {phase === "transcribing" ? "מתמלל בעברית…" : `ה‑AI כותב רשומת ${template.name}…`}
              </p>
              <p className="mt-1.5 text-sm text-ink-300">
                {phase === "transcribing"
                  ? "מזהה מינוח קליני ומפסק את הדיבור."
                  : template.sections.map((s) => s.label).join(" · ")}
              </p>
            </div>
          )}

          {/* ── Review ready ── */}
          {phase === "review" && !hasNote && (
            <div className="py-2">
              <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 ring-1 ring-inset ring-emerald-400/30">
                <CheckCircle2 size={30} className="text-emerald-400" />
              </div>
              <p className="text-lg font-bold tracking-tight">ההקלטה תומללה</p>
              <p className="mt-1.5 text-sm text-ink-300">עברו על התמלול למטה — ואז צרו רשומה.</p>
            </div>
          )}

          {phase === "review" && hasNote && (
            <div className="py-2">
              <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 ring-1 ring-inset ring-emerald-400/30">
                <CheckCircle2 size={30} className="text-emerald-400" />
              </div>
              <p className="text-lg font-bold tracking-tight">הרשומה מוכנה לעיון</p>
              <p className="mt-1.5 text-sm text-ink-300">עברו, ערכו ואשרו את הסעיפים למטה.</p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-slide-up">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Transcript */}
      {phase === "review" && (
        <div className="card animate-slide-up">
          <div className="card-head">
            <h2 className="flex items-center gap-2 section-title">
              <AudioLines size={16} className="text-accent-600" /> תמלול
            </h2>
            {!hasNote && (
              <button
                onClick={() => generateNote(transcript)}
                className="btn-primary btn-sm"
              >
                <Sparkles size={14} /> צור רשומה
              </button>
            )}
          </div>
          <div className="card-body">
            <textarea
              className="textarea min-h-[110px] text-sm leading-relaxed"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="התמלול יופיע כאן — ניתן לערוך לפני יצירת הרשומה."
            />
          </div>
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

          {template.sections.map((section) => {
            const { key, letter, label, color, ring, placeholder, subsections } = section;
            // Single field → one textarea; subsections → a labelled field per sub.
            const fields = subsections?.length
              ? subsections.map((s) => ({ key: s.key, label: s.label, placeholder: s.placeholder ?? "" }))
              : [{ key, label, placeholder }];
            return (
              <div key={key} className={`rounded-xl border border-line p-4 transition-shadow focus-within:ring-2 ${ring}`}>
                <div className="mb-3 flex items-center gap-2.5">
                  <span className={`grid h-7 w-7 place-items-center rounded-lg ${color} text-[12px] font-bold text-white`}>
                    {letter}
                  </span>
                  <div className="text-[13px] font-bold text-slate-900">{label}</div>
                </div>
                <div className="space-y-2.5">
                  {fields.map((f) => (
                    <div key={f.key}>
                      {subsections?.length ? (
                        <label className="mb-1 block text-[12px] font-semibold text-slate-500">{f.label}</label>
                      ) : null}
                      <textarea
                        className="w-full resize-y rounded-lg border-0 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700 outline-none min-h-[60px]"
                        value={note[f.key] ?? ""}
                        onChange={(e) => setNote({ ...note, [f.key]: e.target.value })}
                        placeholder={f.placeholder}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <div>
            <label className="label">VAS — דרגת כאב (0–10)</label>
            <input type="number" min={0} max={10} className="input !w-24"
              value={vas} onChange={(e) => setVas(e.target.value)} placeholder="0–10" />
          </div>

          {/* AI recommendations — clearly SEPARATE from the verbatim record */}
          <div className="rounded-xl border border-dashed border-violet-300 bg-violet-50/60 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-500 text-white">
                <Lightbulb size={14} />
              </span>
              <div>
                <div className="text-[13px] font-bold text-violet-900">המלצות AI</div>
                <div className="text-[11px] text-violet-500">תוספת של ה‑AI — אינה חלק מהתיעוד הקליני שמבוסס על ההקלטה בלבד</div>
              </div>
            </div>
            <textarea
              className="w-full resize-y rounded-lg border-0 bg-white/70 p-3 text-sm leading-relaxed text-slate-700 outline-none min-h-[60px]"
              value={aiRecs}
              onChange={(e) => setNote({ ...note, [AI_RECS_KEY]: e.target.value })}
              placeholder="אבחנה מבדלת אפשרית, דגשים, רעיונות לטיפול והמשך מעקב…"
            />
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
