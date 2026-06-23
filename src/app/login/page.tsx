"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";
import { ArrowLeft, Stethoscope, BarChart3, MessageSquare, Shield } from "lucide-react";

const FEATURES = [
  { icon: Stethoscope,   title: "תיעוד AI",      desc: "הקלטת טיפול → SOAP מלא בשניות" },
  { icon: BarChart3,     title: "אנליטיקות",    desc: "נתוני קליניקה בזמן אמת" },
  { icon: MessageSquare, title: "WhatsApp Bot", desc: "עוזר AI שמתקשר עם מטופלים" },
  { icon: Shield,        title: "אבטחה מלאה",   desc: "הצפנה end-to-end, HIPAA-ready" },
];

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setExpired(params.get("expired") === "1");
    const err = params.get("error");
    if (err === "not_invited") {
      setError("הכתובת הזו לא הוזמנה למערכת. הכניסה היא בהזמנה בלבד — פנה למנהל הקליניקה.");
    } else if (err === "auth") {
      setError("ההתחברות נכשלה. נסה שוב.");
    }
  }, []);

  async function signInWithGoogle() {
    setGoogleLoading(true);
    setError(null);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("פרטי ההתחברות שגויים. פנה למנהל הקליניקה אם אינך זוכר את הסיסמה.");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div
      className="min-h-screen grid lg:grid-cols-[1fr_480px]"
      style={{ background: "#F4F6FA" }}
    >
      {/* Brand panel */}
      <div
        className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between p-12"
        style={{
          background: "linear-gradient(160deg, #0C111D 0%, #111827 40%, #0F1E2E 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute -top-32 -end-20 h-[500px] w-[500px] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #0D9488 0%, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute bottom-0 -start-32 h-[400px] w-[400px] rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #3B82F6 0%, transparent 70%)" }}
        />

        <div className="relative flex items-center gap-3">
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
            style={{ background: "linear-gradient(135deg, #14B8A6, #0D9488)" }}
          >
            <Logo size={20} className="text-white" />
          </div>
          <span className="text-[20px] font-bold text-white">
            praxis<span style={{ color: "#14B8A6" }}>AI</span>
          </span>
        </div>

        <div className="relative">
          <div
            className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-medium"
            style={{
              color: "#5EEAD4",
              background: "rgba(13,148,136,0.12)",
              border: "1px solid rgba(13,148,136,0.2)",
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#14B8A6" }} />
            מערכת ניהול קליניקה חכמה
          </div>
          <h1 className="mb-4 text-[2.8rem] font-bold leading-[1.08] tracking-tight text-white">
            פחות ניירת.<br />
            <span style={{
              background: "linear-gradient(135deg,#14B8A6,#3B82F6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              יותר טיפול.
            </span>
          </h1>
          <p className="max-w-md text-[15px] leading-relaxed text-slate-400">
            praxisAI מתעדת כל טיפול, שולחת תזכורות, ומנהלת את הקליניקה — כדי שתוכלו להתמקד במה שחשוב.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="flex items-start gap-3 rounded-2xl p-3.5"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-xl"
                  style={{ background: "rgba(13,148,136,0.15)" }}
                >
                  <Icon size={15} style={{ color: "#5EEAD4" }} />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-white">{title}</div>
                  <div className="text-[11.5px] leading-tight mt-0.5" style={{ color: "#64748B" }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[12px]" style={{ color: "#374151" }}>
          © {new Date().getFullYear()} praxisAI · כל הזכויות שמורות
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-white p-8">
        <div className="w-full max-w-[360px] animate-slide-up">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <div
              className="grid h-9 w-9 place-items-center rounded-xl"
              style={{ background: "linear-gradient(135deg, #14B8A6, #0D9488)" }}
            >
              <Logo size={17} className="text-white" />
            </div>
            <span className="text-[17px] font-bold text-ink-900">
              praxis<span style={{ color: "#0D9488" }}>AI</span>
            </span>
          </div>

          <h2 className="text-[1.65rem] font-bold tracking-tight text-ink-900 mb-1">
            כניסה למערכת
          </h2>
          <p className="text-[14px] text-ink-500 mb-6">ברוכים השבים — התחברו כדי להמשיך</p>

          {expired && (
            <div
              className="mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px]"
              style={{ background: "#FFFBEB", borderColor: "#FDE68A", color: "#92400E" }}
            >
              פג תוקף החיבור — מטעמי אבטחה יש להתחבר מחדש.
            </div>
          )}

          <button
            onClick={signInWithGoogle}
            disabled={googleLoading}
            className="w-full mb-4 flex items-center justify-center gap-3 rounded-xl py-3 text-[14px] font-semibold transition-all hover:bg-ink-50 disabled:opacity-50"
            style={{
              color: "#1E293B",
              border: "1px solid rgba(15,23,42,0.12)",
              boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            {googleLoading ? "מחבר..." : "כניסה עם Google"}
          </button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-line" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-[12px] text-ink-400">או עם דוא&Prime;ל</span>
            </div>
          </div>

          <form onSubmit={signIn} className="space-y-4">
            <div>
              <label className="label">דוא&Prime;ל</label>
              <input
                dir="ltr" type="email" required className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@clinic.co.il"
              />
            </div>
            <div>
              <label className="label">סיסמה</label>
              <input
                dir="ltr" type="password" required className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div
                className="flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px]"
                style={{ background: "#FFF1F2", borderColor: "#FECDD3", color: "#BE123C" }}
              >
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full" style={{ paddingTop: "12px", paddingBottom: "12px", fontSize: "15px" }}>
              {loading ? "מתחבר..." : "כניסה"}
              {!loading && <ArrowLeft size={16} />}
            </button>
          </form>

          <p className="mt-6 text-[12px] text-ink-400 leading-relaxed">
            קיבלת מייל הזמנה? לחץ על הקישור שבמייל כדי להגדיר סיסמה ולהיכנס לראשונה.
          </p>
        </div>
      </div>
    </div>
  );
}
