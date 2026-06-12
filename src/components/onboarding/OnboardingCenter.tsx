"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  X, Check, ChevronLeft, ChevronRight, Sparkles, Mic, Users, Compass, PartyPopper, Rocket,
} from "lucide-react";

export type OnboardingStep = {
  key: string;
  label: string;
  desc: string;
  href: string | null;
  done: boolean;
};

async function patchOnboarding(patch: { tour_done?: boolean; dismissed_at?: string | null }) {
  await fetch("/api/onboarding", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

/* ── Welcome tour slides ─────────────────────────────────────────────── */

const SLIDES = [
  {
    icon: Sparkles,
    tint: "from-brand to-violet-500",
    title: "ברוכים הבאים ל‑praxisAI 👋",
    body: "המערכת שתחסוך לכם שעות של תיעוד בכל שבוע. בדקות הקרובות נכיר יחד את המערכת ונוודא שאתם מוכנים לעבודה — זה קצר, מבטיחים.",
  },
  {
    icon: Mic,
    tint: "from-rose-500 to-red-500",
    title: "תיעוד AI — הקסם המרכזי",
    body: "במקום להקליד אחרי כל טיפול: לוחצים על הקלטה, מטפלים כרגיל — וה‑AI מתמלל בעברית והופך את השיחה לרשומה קלינית מלאה. נשאר רק לעבור ולחתום.",
  },
  {
    icon: Users,
    tint: "from-emerald-500 to-teal-500",
    title: "מטופלים, מסמכים ותוצאים",
    body: "כל מטופל מקבל תיק מסודר: היסטוריית טיפולים, גרף VAS להתקדמות, ומסמכים שנוצרים בלחיצה — הפניות, דוחות וסיכומים לביטוח לאומי.",
  },
  {
    icon: Compass,
    tint: "from-amber-500 to-orange-500",
    title: "מרכז ההתחלה ילווה אתכם",
    body: "בפינת המסך מחכה לכם עיגול התקדמות — מרכז ההתחלה. הוא מציג בדיוק מה נשאר להגדיר, והאחוזים מתמלאים עם כל צעד. כשתגיעו ל‑100% אתם בעניינים. בואו נתחיל!",
  },
];

/* ── Progress ring ───────────────────────────────────────────────────── */

function Ring({ pct, size = 56 }: { pct: number; size?: number }) {
  const r = 15.5;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 36 36" width={size} height={size} className="-rotate-90">
      <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="3" />
      <circle
        cx="18" cy="18" r={r} fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`}
        className="transition-[stroke-dasharray] duration-700 ease-out"
      />
    </svg>
  );
}

/* ── Main component ──────────────────────────────────────────────────── */

export default function OnboardingCenter({
  steps: dataSteps,
  initialTourDone,
  initialDismissed,
}: {
  steps: OnboardingStep[];
  initialTourDone: boolean;
  initialDismissed: boolean;
}) {
  const router = useRouter();
  const [tourDone, setTourDone] = useState(initialTourDone);
  const [dismissed, setDismissed] = useState(initialDismissed);
  const [tourOpen, setTourOpen] = useState(!initialTourDone && !initialDismissed);
  const [slide, setSlide] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);

  if (dismissed) return null;

  const steps: OnboardingStep[] = [
    {
      key: "tour",
      label: "סיור היכרות במערכת",
      desc: "ארבעה מסכים קצרים שמסבירים את הכל",
      href: null,
      done: tourDone,
    },
    ...dataSteps,
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const allDone = pct === 100;

  function finishTour() {
    setTourDone(true);
    setTourOpen(false);
    setPanelOpen(true);
    patchOnboarding({ tour_done: true });
  }

  function dismiss() {
    setDismissed(true);
    setPanelOpen(false);
    patchOnboarding({ dismissed_at: new Date().toISOString() });
  }

  const Icon = SLIDES[slide].icon;

  return (
    <>
      {/* ── First-entry guided tour ── */}
      {tourOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-lg overflow-hidden">
            <div className={`relative bg-gradient-to-l ${SLIDES[slide].tint} px-8 pb-10 pt-12 text-center text-white`}>
              <button
                onClick={finishTour}
                title="דילוג"
                className="absolute left-4 top-4 rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
              >
                <X size={18} />
              </button>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/15 backdrop-blur">
                <Icon size={30} />
              </div>
            </div>
            <div className="px-8 pb-8 pt-6 text-center">
              <h2 className="text-xl font-bold text-slate-900">{SLIDES[slide].title}</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500">{SLIDES[slide].body}</p>

              {/* dots */}
              <div className="mt-6 flex items-center justify-center gap-2">
                {SLIDES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSlide(i)}
                    className={`h-2 rounded-full transition-all ${i === slide ? "w-6 bg-brand" : "w-2 bg-slate-200 hover:bg-slate-300"}`}
                  />
                ))}
              </div>

              <div className="mt-7 flex items-center justify-between">
                <button
                  onClick={() => setSlide((s) => Math.max(0, s - 1))}
                  disabled={slide === 0}
                  className="btn-ghost !px-4 disabled:invisible"
                >
                  <ChevronRight size={16} /> הקודם
                </button>
                {slide < SLIDES.length - 1 ? (
                  <button onClick={() => setSlide((s) => s + 1)} className="btn-primary !px-6">
                    הבא <ChevronLeft size={16} />
                  </button>
                ) : (
                  <button onClick={finishTour} className="btn-primary !px-6">
                    <Rocket size={16} /> יוצאים לדרך
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Checklist panel ── */}
      {panelOpen && (
        <div className="fixed bottom-24 left-6 z-50 w-[340px] max-w-[calc(100vw-3rem)]">
          <div className="card overflow-hidden shadow-xl">
            <div className="bg-navy px-5 py-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {allDone ? <PartyPopper size={18} className="text-amber-400" /> : <Compass size={18} className="text-brand-100" />}
                  <span className="text-sm font-bold">{allDone ? "סיימתם! המערכת מוכנה 🎉" : "מרכז ההתחלה"}</span>
                </div>
                <button onClick={() => setPanelOpen(false)} className="rounded-md p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white">
                  <X size={16} />
                </button>
              </div>
              <div className="mt-3">
                <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-300">
                  <span>{doneCount} מתוך {steps.length} הושלמו</span>
                  <span className="font-bold text-white">{pct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-brand to-violet-400 transition-all duration-700 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>

            <ul className="divide-y divide-line">
              {steps.map((s) => {
                const inner = (
                  <>
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                        s.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-200 text-transparent"
                      }`}
                    >
                      <Check size={13} strokeWidth={3} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[13px] font-semibold ${s.done ? "text-slate-400 line-through" : "text-slate-800"}`}>
                        {s.label}
                      </span>
                      {!s.done && <span className="block text-[11.5px] text-slate-400">{s.desc}</span>}
                    </span>
                    {!s.done && <ChevronLeft size={15} className="shrink-0 text-slate-300" />}
                  </>
                );
                const cls = "flex w-full items-center gap-3 px-4 py-3 text-right transition-colors hover:bg-slate-50";
                return (
                  <li key={s.key}>
                    {s.href ? (
                      <Link href={s.href} className={cls} onClick={() => setPanelOpen(false)}>{inner}</Link>
                    ) : (
                      <button
                        className={cls}
                        onClick={() => { setSlide(0); setPanelOpen(false); setTourOpen(true); }}
                      >
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>

            {allDone && (
              <div className="border-t border-line p-3">
                <button onClick={dismiss} className="btn-primary w-full">
                  <PartyPopper size={15} /> מעולה, אפשר להסתיר
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Floating progress button ── */}
      <button
        onClick={() => { setPanelOpen((o) => !o); router.refresh(); }}
        title="מרכז ההתחלה"
        className={`fixed bottom-6 left-6 z-50 grid h-14 w-14 place-items-center rounded-full text-white shadow-lg transition-transform hover:scale-105 ${
          allDone ? "bg-gradient-to-br from-emerald-500 to-teal-600" : "bg-gradient-to-br from-brand to-violet-600"
        }`}
      >
        <span className="absolute inset-0 grid place-items-center">
          <Ring pct={pct} />
        </span>
        <span className="relative text-[11px] font-bold">{allDone ? <Check size={20} strokeWidth={3} /> : `${pct}%`}</span>
        {!allDone && !panelOpen && (
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-amber-400 ring-2 ring-white" />
        )}
      </button>
    </>
  );
}
