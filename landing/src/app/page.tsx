import {
  Mic,
  FileText,
  ShieldCheck,
  TrendingUp,
  Users,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  AudioLines,
  ClipboardCheck,
  Stamp,
} from "lucide-react";
import Logo from "@/components/Logo";
import RoiCalculator from "@/components/RoiCalculator";
import {
  HeroTilt,
  TiltCard,
  Reveal,
  ParallaxFloat,
  WireCube,
  Waveform,
} from "@/components/fx";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://praxisai-one.vercel.app";

/* ── content ─────────────────────────────────────────────────────────── */

const pipeline = [
  { icon: Mic, label: "מקליטים", sub: "לוחצים פעם אחת" },
  { icon: AudioLines, label: "תמלול עברי", sub: "כולל מינוח קליני" },
  { icon: Sparkles, label: "רשומת SOAP", sub: "נכתבת לבד" },
  { icon: FileText, label: "מסמכים", sub: "ביטוח לאומי והפניות" },
  { icon: TrendingUp, label: "תוצאים", sub: "גרפים ומדדים" },
];

const features = [
  {
    icon: Mic,
    title: "תמלול עברי בזמן אמת",
    desc: "מקליטים את הטיפול — והמערכת מתמללת בעברית מדויקת, כולל מינוח קליני, בלי להקליד מילה.",
  },
  {
    icon: Sparkles,
    title: "רשומות SOAP אוטומטיות",
    desc: "ה‑AI הופך את השיחה לרשומת SOAP מובנית — סובייקטיבי, אובייקטיבי, הערכה ותוכנית — מוכנה לחתימה.",
  },
  {
    icon: FileText,
    title: "דוחות ומסמכים אוטומטיים",
    desc: "הפניות, דוחות התקדמות, סיכומי שחרור ואישורים — נוצרים אוטומטית מתוך התיק הקליני.",
  },
  {
    icon: TrendingUp,
    title: "מעקב תוצאים (VAS)",
    desc: "גרפים של מדדי כאב ותפקוד לאורך הטיפול — רואים התקדמות, מציגים תוצאות, משפרים החלטות.",
  },
  {
    icon: Users,
    title: "ניהול צוות וקליניקה",
    desc: "הרשאות לפי תפקיד — בעלים, מנהל, מטפל וקבלה — כל אחד רואה בדיוק את מה שרלוונטי לו.",
  },
  {
    icon: ShieldCheck,
    title: "אבטחה ופרטיות",
    desc: "המידע הרפואי נשמר בארכיטקטורה מאובטחת, בהתאם לרגולציה הישראלית. הנתונים לא יוצאים לשום מקום.",
  },
];

const steps = [
  {
    num: "1",
    title: "מקליטים",
    desc: "לוחצים על הקלטה בתחילת הטיפול וממשיכים לעבוד כרגיל. בלי מקלדת, בלי מסך בין המטפל למטופל.",
  },
  {
    num: "2",
    title: "ה‑AI מתעד",
    desc: "תמלול עברי מדויק הופך לרשומת SOAP מלאה תוך שניות — סובייקטיבי, אובייקטיבי, הערכה ותוכנית.",
  },
  {
    num: "3",
    title: "חותמים ומסיימים",
    desc: "עוברים על הסיכום, חותמים — והמסמכים הנלווים כבר מוכנים: הפניות, דוחות, מכתבים לביטוח לאומי.",
  },
];

const valueProps = [
  { big: "שניות", small: "מהקלטה לרשומת SOAP מלאה" },
  { big: "שעות", small: "של תיעוד חוזרות לצוות בכל שבוע" },
  { big: "100%", small: "עברית — כולל מינוח קליני" },
  { big: "לחיצה אחת", small: "ממסמך ביטוח לאומי ועד הפניה" },
];

/* ── 3D scene pieces (server-rendered markup; animation via CSS) ─────── */

function SoapMiniCard() {
  const rows = [
    { k: "S", c: "bg-sky-500", w: "w-[88%]" },
    { k: "O", c: "bg-emerald-500", w: "w-[72%]" },
    { k: "A", c: "bg-amber-500", w: "w-[80%]" },
    { k: "P", c: "bg-violet-500", w: "w-[64%]" },
  ];
  return (
    <div className="w-[300px] rounded-2xl border border-white/10 bg-navy-800/90 p-5 shadow-glow backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-brand-100" />
          <span className="text-[13px] font-bold text-white">רשומת SOAP</span>
        </div>
        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
          מוכן לחתימה
        </span>
      </div>
      <div className="space-y-3">
        {rows.map(({ k, c, w }) => (
          <div key={k} className="flex items-center gap-3">
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${c} text-[11px] font-bold text-white`}>
              {k}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className={`h-full ${w} rounded-full bg-white/25`} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-3 text-[11px] text-slate-400">
        <Sparkles className="h-3.5 w-3.5 text-brand-100" />
        נוצר אוטומטית מהקלטת הטיפול
      </div>
    </div>
  );
}

function RecorderChip() {
  return (
    <div className="flex w-[210px] items-center gap-3 rounded-2xl border border-white/10 bg-navy-800/90 px-4 py-3 shadow-glow backdrop-blur">
      <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-500/15">
        <span className="absolute inset-0 rounded-full bg-red-500/25 animate-pulsering" />
        <Mic className="h-4 w-4 text-red-400" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[12px] font-bold text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-blink" />
          מקליט… 04:32
        </div>
        <Waveform bars={12} className="mt-1.5 text-brand-100" />
      </div>
    </div>
  );
}

function VasChip() {
  // Descending pain trend = improvement
  const bars = [86, 74, 66, 52, 38, 24];
  return (
    <div className="w-[180px] rounded-2xl border border-white/10 bg-navy-800/90 p-4 shadow-glow backdrop-blur">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[11px] font-bold text-white">מדד כאב VAS</span>
        <TrendingUp className="h-3.5 w-3.5 rotate-180 text-emerald-400" />
      </div>
      <div className="flex h-14 items-end gap-1.5">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm bg-gradient-to-t from-brand to-violet-500 animate-risebar"
            style={{ height: `${h}%`, animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
      <div className="mt-2 text-[10px] text-emerald-400">↓ שיפור עקבי בין טיפולים</div>
    </div>
  );
}

function DocChip() {
  return (
    <div className="flex w-[230px] items-center gap-3 rounded-2xl border border-white/10 bg-navy-800/90 px-4 py-3.5 shadow-glow backdrop-blur">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/20">
        <Stamp className="h-4 w-4 text-brand-100" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[12px] font-bold text-white">מכתב לביטוח לאומי</div>
        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-emerald-400">
          <CheckCircle2 className="h-3 w-3" /> נוצר אוטומטית — מוכן
        </div>
      </div>
    </div>
  );
}

function TranscriptChip() {
  return (
    <div className="w-[240px] rounded-2xl border border-white/10 bg-navy-800/80 p-4 backdrop-blur">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-bold text-slate-300">
        <AudioLines className="h-3.5 w-3.5 text-brand-100" />
        תמלול חי
      </div>
      <p className="text-[11.5px] leading-relaxed text-slate-400">
        ״כאב בכתף ימין כשבועיים, מתגבר בהרמת יד מעל הראש. טווח אבדוקציה 110°…״
      </p>
    </div>
  );
}

/* ── page ────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-bg">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-navy/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo size={32} className="text-brand-100" />
            <span className="font-display text-lg font-bold tracking-tight text-white">praxisAI</span>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-300 md:flex">
            <a href="#flow" className="transition-colors hover:text-white">הזרימה</a>
            <a href="#features" className="transition-colors hover:text-white">יכולות</a>
            <a href="#how" className="transition-colors hover:text-white">איך זה עובד</a>
            <a href="#roi" className="transition-colors hover:text-white">החזר השקעה</a>
            <a href="#contact" className="transition-colors hover:text-white">צור קשר</a>
          </nav>
          <a href={`${APP_URL}/login`} className="btn-primary !py-2">
            כניסה למערכת
          </a>
        </div>
      </header>

      {/* ── HERO — 3D scene ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-navy text-white">
        {/* ambient glow orbs */}
        <div className="orb absolute -top-24 right-[12%] h-72 w-72 bg-brand/30" aria-hidden />
        <div className="orb absolute top-40 left-[6%] h-80 w-80 bg-violet-600/25" aria-hidden />
        {/* perspective grid floor */}
        <div className="grid-floor absolute inset-x-[-20%] bottom-[-12%] h-[55%]" aria-hidden />

        <div className="relative mx-auto max-w-6xl px-4 pb-28 pt-16 sm:px-6 lg:pt-24">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            {/* copy */}
            <div>
              <Reveal from="up">
                <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-slate-300">
                  <Sparkles className="h-3.5 w-3.5 text-brand-100" />
                  AI קליני בעברית — נבנה לקליניקות בישראל
                </span>
                <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                  פחות הקלדה.
                  <br />
                  <span className="bg-gradient-to-l from-brand-100 via-sky-300 to-violet-300 bg-clip-text text-transparent">
                    יותר טיפול.
                  </span>
                </h1>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
                  הקליטו את הטיפול — praxisAI תכתוב את הרשומה, תכין את הדוחות ותשאיר
                  אתכם פנויים למה שבאמת חשוב: להיות נוכחים עם המטופל.
                </p>
                <div className="mt-10 flex flex-wrap items-center gap-4">
                  <a href={`${APP_URL}/login`} className="btn-primary !px-7 !py-3.5 !text-base shadow-glow">
                    כניסה למערכת
                    <ArrowLeft className="h-4 w-4" />
                  </a>
                  <a
                    href="#contact"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-7 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    תיאום הדגמה
                  </a>
                </div>
                <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400">
                  {["14 ימי ניסיון", "ללא התחייבות", "הטמעה תוך יום"].map((t) => (
                    <span key={t} className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      {t}
                    </span>
                  ))}
                </div>
              </Reveal>
            </div>

            {/* 3D floating scene — the product story in one glance */}
            <HeroTilt className="relative hidden h-[460px] lg:block">
              <div className="preserve-3d relative h-full w-full">
                {/* connecting beams */}
                <div
                  className="beam absolute right-[24%] top-[27%] h-[2px] w-[34%] rotate-[28deg] rounded-full opacity-70"
                  style={{ transform: "translateZ(40px) rotate(28deg)" }}
                  aria-hidden
                />
                <div
                  className="beam absolute left-[18%] top-[58%] h-[2px] w-[30%] rotate-[-24deg] rounded-full opacity-70"
                  style={{ transform: "translateZ(40px) rotate(-24deg)" }}
                  aria-hidden
                />

                {/* recorder — the start of the journey */}
                <div
                  className="animate-float absolute right-0 top-4"
                  style={{ transform: "translateZ(70px)" }}
                >
                  <RecorderChip />
                </div>

                {/* live transcript behind */}
                <div
                  className="animate-float-sm absolute right-[8%] top-[36%] opacity-90"
                  style={{ transform: "translateZ(20px)", animationDelay: "1.2s" }}
                >
                  <TranscriptChip />
                </div>

                {/* SOAP — the centerpiece */}
                <div
                  className="animate-float absolute left-[14%] top-[22%]"
                  style={{ transform: "translateZ(95px)", animationDelay: ".6s" }}
                >
                  <SoapMiniCard />
                </div>

                {/* outcomes */}
                <div
                  className="animate-float-sm absolute left-0 top-[64%]"
                  style={{ transform: "translateZ(55px)", animationDelay: ".3s" }}
                >
                  <VasChip />
                </div>

                {/* document */}
                <div
                  className="animate-float absolute bottom-0 right-[16%]"
                  style={{ transform: "translateZ(45px)", animationDelay: "1.6s" }}
                >
                  <DocChip />
                </div>

                {/* ambient cube */}
                <WireCube size={56} className="absolute left-[44%] top-0 opacity-60" />
              </div>
            </HeroTilt>
          </div>
        </div>

        {/* bottom fade into the next section */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-bg" aria-hidden />
      </section>

      {/* ── FLOW PIPELINE — the connecting thread ───────────────────── */}
      <section id="flow" className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <ParallaxFloat speed={-0.05} className="pointer-events-none absolute -top-10 left-[4%]" >
          <WireCube size={48} className="opacity-50" />
        </ParallaxFloat>

        <Reveal from="up" className="mb-12 text-center">
          <h2 className="font-display text-3xl font-bold text-slate-900">
            מהקול של הטיפול — עד המסמך החתום
          </h2>
          <p className="mt-3 text-slate-500">
            צינור אחד רציף. כל שלב מזין את הבא — בלי העתקות, בלי מערכות מקבילות.
          </p>
        </Reveal>

        <div className="relative">
          {/* the flowing beam behind the chips */}
          <div className="beam absolute right-[6%] left-[6%] top-1/2 hidden h-[2px] -translate-y-7 rounded-full md:block" aria-hidden />

          <div className="relative grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
            {pipeline.map(({ icon: Icon, label, sub }, i) => (
              <Reveal key={label} from="deep" delay={i * 130}>
                <TiltCard className="card !rounded-2xl p-5 text-center">
                  <div
                    className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-brand to-violet-600 text-white shadow-glow"
                    style={{ transform: "translateZ(30px)" }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="font-bold text-slate-900" style={{ transform: "translateZ(20px)" }}>
                    {label}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{sub}</div>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES — 3D tilt cards ─────────────────────────────────── */}
      <section id="features" className="relative border-y border-line bg-white">
        <div className="orb absolute left-[10%] top-10 h-64 w-64 bg-brand/10" aria-hidden />
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Reveal from="up" className="mb-12 max-w-2xl">
            <h2 className="font-display text-3xl font-bold text-slate-900">
              כל הקליניקה — במערכת אחת
            </h2>
            <p className="mt-3 text-slate-500">
              מהקלטת הטיפול ועד מכתב לביטוח לאומי — בלי לעבור בין מערכות, בלי להישאר אחרי שעות.
            </p>
          </Reveal>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} from="up" delay={(i % 3) * 120}>
                <TiltCard className="card !rounded-2xl p-6">
                  <div
                    className="mb-4 grid h-11 w-11 place-items-center rounded-lg bg-brand-50 text-brand"
                    style={{ transform: "translateZ(35px)" }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-1.5 font-bold text-slate-900" style={{ transform: "translateZ(25px)" }}>
                    {title}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-500" style={{ transform: "translateZ(15px)" }}>
                    {desc}
                  </p>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS — glowing spine timeline ───────────────────── */}
      <section id="how" className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <ParallaxFloat speed={-0.04} className="pointer-events-none absolute -top-6 right-[6%]">
          <WireCube size={44} className="opacity-40" />
        </ParallaxFloat>

        <Reveal from="up" className="mb-14 max-w-2xl">
          <h2 className="font-display text-3xl font-bold text-slate-900">איך זה עובד</h2>
          <p className="mt-3 text-slate-500">שלושה צעדים — וסיכום הטיפול כותב את עצמו.</p>
        </Reveal>

        <div className="relative">
          {/* vertical glowing spine (on the right — RTL reading direction) */}
          <div className="beam-v absolute right-[19px] top-2 bottom-2 hidden w-[2px] rounded-full sm:block" aria-hidden />

          <div className="space-y-10">
            {steps.map(({ num, title, desc }, i) => (
              <Reveal key={num} from={i % 2 ? "left" : "right"} delay={i * 100}>
                <div className="flex gap-6">
                  <div
                    className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-violet-600 font-display font-bold text-white shadow-glow"
                  >
                    {num}
                  </div>
                  <TiltCard className="card !rounded-2xl flex-1 p-6">
                    <h3 className="mb-1 font-bold text-slate-900" style={{ transform: "translateZ(20px)" }}>
                      {title}
                    </h3>
                    <p className="max-w-2xl text-sm leading-relaxed text-slate-500">{desc}</p>
                  </TiltCard>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROI — time & money back ─────────────────────────────────── */}
      <section id="roi" className="relative overflow-hidden bg-navy text-white">
        <div className="orb absolute -top-20 left-[20%] h-72 w-72 bg-violet-600/25" aria-hidden />
        <div className="orb absolute bottom-0 right-[10%] h-64 w-64 bg-brand/25" aria-hidden />
        <div className="grid-floor absolute inset-x-[-25%] bottom-[-18%] h-[45%] opacity-50" aria-hidden />

        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <Reveal from="up" className="mb-6 max-w-2xl">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-slate-300">
              <Sparkles className="h-3.5 w-3.5 text-brand-100" />
              החזר השקעה — ROI
            </span>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">
              כמה שווה לכם
              <span className="bg-gradient-to-l from-brand-100 via-sky-300 to-violet-300 bg-clip-text text-transparent"> כל דקת תיעוד?</span>
            </h2>
            <p className="mt-4 leading-relaxed text-slate-300">
              כל רשומה ידנית גוזלת דקות יקרות — שעות שלמות בכל שבוע שלא מטפלות באף אחד.
              הזיזו את הסליידרים לפי הקליניקה שלכם וראו כמה זמן וכסף praxisAI מחזירה לכם.
            </p>
          </Reveal>

          <Reveal from="deep" delay={150}>
            <RoiCalculator />
          </Reveal>

          {/* supporting value chips */}
          <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
            {valueProps.map(({ big, small }, i) => (
              <Reveal key={big} from="up" delay={i * 90}>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-center backdrop-blur">
                  <div className="font-display text-lg font-bold text-brand-100">{big}</div>
                  <div className="mt-1 text-[12px] leading-snug text-slate-400">{small}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section id="contact" className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <Reveal from="deep">
          <div className="relative overflow-hidden rounded-3xl bg-navy px-6 py-16 text-center text-white sm:px-12">
            <div className="orb absolute -top-16 right-[15%] h-60 w-60 bg-brand/30" aria-hidden />
            <div className="orb absolute -bottom-20 left-[18%] h-60 w-60 bg-violet-600/30" aria-hidden />
            <div className="grid-floor absolute inset-x-[-30%] bottom-[-30%] h-[70%] opacity-60" aria-hidden />

            {/* floating mini artifacts */}
            <div className="animate-float absolute right-8 top-10 hidden lg:block" style={{ animationDelay: ".4s" }}>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur">
                <Mic className="h-3.5 w-3.5 text-red-400" />
                <Waveform bars={8} className="text-brand-100" />
              </div>
            </div>
            <div className="animate-float-sm absolute left-8 bottom-12 hidden lg:block" style={{ animationDelay: "1s" }}>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-emerald-400 backdrop-blur">
                <CheckCircle2 className="h-3.5 w-3.5" />
                רשומה נחתמה
              </div>
            </div>

            <div className="relative">
              <h2 className="font-display text-3xl font-bold sm:text-4xl">מוכנים להפסיק להקליד?</h2>
              <p className="mx-auto mt-4 max-w-xl text-slate-300">
                הצטרפו לקליניקות שכבר חוסכות שעות תיעוד בכל שבוע. השאירו פרטים ונחזור אליכם
                לתיאום הדגמה אישית.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
                <a href="mailto:hello@praxisai.co.il" className="btn-primary !px-7 !py-3.5 !text-base shadow-glow">
                  תיאום הדגמה
                </a>
                <a
                  href={`${APP_URL}/login`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-7 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10"
                >
                  כבר לקוחות? כניסה למערכת
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-400 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <Logo size={24} className="text-brand" />
            <span className="font-semibold text-slate-600">praxisAI</span>
          </div>
          <p>© {new Date().getFullYear()} praxisAI — פלטפורמת ה‑AI הקלינית לפיזיותרפיה</p>
        </div>
      </footer>
    </div>
  );
}
