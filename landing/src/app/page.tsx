import {
  Mic,
  FileText,
  ShieldCheck,
  TrendingUp,
  Users,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://praxisai-one.vercel.app";

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
    title: "מסמכים בלחיצה",
    desc: "מכתבים לביטוח לאומי, הפניות, סיכומי שחרור ודוחות סטטוס — נוצרים אוטומטית מתוך התיק הקליני.",
  },
  {
    icon: TrendingUp,
    title: "מעקב תוצאים (VAS)",
    desc: "גרפים של מדדי כאב ותפקוד לאורך הטיפול — רואים התקדמות, מציגים תוצאות, משפרים החלטות.",
  },
  {
    icon: Users,
    title: "ניהול צוות וקליניקה",
    desc: "הרשאות לפי תפקיד — בעלים, מנהל, מטפל וקבלן — כל אחד רואה בדיוק את מה שרלוונטי לו.",
  },
  {
    icon: ShieldCheck,
    title: "אבטחה ופרטיות",
    desc: "המידע הרפואי נשמר בארכיטקטורה מאובטחת, בהתאם לרגולציה הישראלית. הנתונים שלכם לא יוצאים לשום מקום.",
  },
];

const steps = [
  { num: "1", title: "מקליטים", desc: "לוחצים על הקלטה בתחילת הטיפול וממשיכים לעבוד כרגיל." },
  { num: "2", title: "ה‑AI מתעד", desc: "תמלול עברי מדויק הופך לרשומת SOAP מלאה תוך שניות." },
  { num: "3", title: "חותמים ומסיימים", desc: "עוברים על הסיכום, חותמים — והמסמכים הנלווים כבר מוכנים." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-line bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand font-display text-lg font-bold text-white">
              P
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-slate-900">praxisAI</span>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-600 md:flex">
            <a href="#features" className="hover:text-slate-900">יכולות</a>
            <a href="#how" className="hover:text-slate-900">איך זה עובד</a>
            <a href="#contact" className="hover:text-slate-900">צור קשר</a>
          </nav>
          <a href={`${APP_URL}/login`} className="btn-primary !py-2">
            כניסה למערכת
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="max-w-3xl">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-slate-300">
              <Sparkles className="h-3.5 w-3.5 text-brand-100" />
              AI קליני בעברית — נבנה לקליניקות בישראל
            </span>
            <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              פחות הקלדה.
              <br />
              <span className="text-brand-100">יותר טיפול.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
              praxisAI מתמללת את הטיפול בזמן אמת, כותבת את רשומת ה‑SOAP במקומך ומפיקה את כל
              המסמכים — כדי שתחזרו לעשות את מה שאתם הכי טובים בו: לטפל.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <a href={`${APP_URL}/login`} className="btn-primary !px-7 !py-3.5 !text-base">
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
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mb-12 max-w-2xl">
          <h2 className="font-display text-3xl font-bold text-slate-900">
            כל הקליניקה — במערכת אחת
          </h2>
          <p className="mt-3 text-slate-500">
            מהקלטת הטיפול ועד מכתב לביטוח לאומי — בלי לעבור בין מערכות, בלי להישאר אחרי שעות.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card p-6">
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-lg bg-brand-50 text-brand">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mb-1.5 font-bold text-slate-900">{title}</h3>
              <p className="text-sm leading-relaxed text-slate-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mb-12 max-w-2xl">
            <h2 className="font-display text-3xl font-bold text-slate-900">איך זה עובד</h2>
            <p className="mt-3 text-slate-500">שלושה צעדים — וסיכום הטיפול כותב את עצמו.</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map(({ num, title, desc }) => (
              <div key={num} className="flex gap-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand font-display font-bold text-white">
                  {num}
                </div>
                <div>
                  <h3 className="mb-1 font-bold text-slate-900">{title}</h3>
                  <p className="text-sm leading-relaxed text-slate-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contact" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="rounded-2xl bg-navy px-6 py-14 text-center text-white sm:px-12">
          <h2 className="font-display text-3xl font-bold">מוכנים להפסיק להקליד?</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-300">
            הצטרפו לקליניקות שכבר חוסכות שעות תיעוד בכל שבוע. השאירו פרטים ונחזור אליכם לתיאום
            הדגמה אישית.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a href="mailto:hello@praxisai.co.il" className="btn-primary !px-7 !py-3.5 !text-base">
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
      </section>

      {/* Footer */}
      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-400 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-brand text-xs font-bold text-white">
              P
            </div>
            <span className="font-semibold text-slate-600">praxisAI</span>
          </div>
          <p>© {new Date().getFullYear()} praxisAI — פלטפורמת ה‑AI הקלינית לפיזיותרפיה</p>
        </div>
      </footer>
    </div>
  );
}
