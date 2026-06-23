"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";

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
        // Force Google's account chooser every time so the browser's currently
        // signed-in Google account is never used silently — prevents logging
        // in as the wrong person.
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
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-navy p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* atmospheric depth */}
        <div className="pointer-events-none absolute -start-24 -top-24 h-96 w-96 rounded-full bg-violet-600/25 blur-[120px]" />
        <div className="pointer-events-none absolute -end-32 bottom-0 h-[28rem] w-[28rem] rounded-full bg-indigo-600/20 blur-[130px]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, black, transparent)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, black, transparent)",
          }}
        />

        <div className="relative flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-glow ring-1 ring-white/10">
            <Logo size={20} className="text-white" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">praxisAI</span>
        </div>

        <div className="relative">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[12px] font-medium text-violet-200">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
            פלטפורמת AI קלינית
          </div>
          <h1 className="mb-4 font-display text-[2.6rem] font-bold leading-[1.08] tracking-tight">
            פחות ניירת.<br />
            <span className="bg-gradient-to-l from-violet-300 to-indigo-300 bg-clip-text text-transparent">יותר זמן לטפל.</span>
          </h1>
          <p className="max-w-md leading-relaxed text-slate-300/90">
            הקליטו את הטיפול — praxisAI תכתוב את הרשומה, תכין את הדוחות
            ותשאיר אתכם פנויים למה שבאמת חשוב.
          </p>
        </div>

        <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} praxisAI · כל הזכויות שמורות</p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center bg-bg p-6">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-glow">
              <Logo size={18} className="text-white" />
            </div>
            <span className="font-display text-lg font-bold">praxisAI</span>
          </div>

          <h2 className="mb-1.5 text-2xl font-bold tracking-tight text-ink-900">כניסה למערכת</h2>
          <p className="mb-6 text-sm text-ink-500">ברוכים השבים — התחברו כדי להמשיך.</p>

          {expired && (
            <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800">
              פג תוקף החיבור — מטעמי אבטחה יש להתחבר מחדש.
            </div>
          )}

          <button
            onClick={signInWithGoogle}
            disabled={googleLoading}
            className="btn-ghost w-full mb-4 !py-3 gap-3"
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
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-line" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-slate-400">או עם דוא&Prime;ל</span></div>
          </div>

          <form onSubmit={signIn} className="space-y-4">
            <div>
              <label className="label">דוא&Prime;ל</label>
              <input dir="ltr" type="email" required className="input" value={email}
                     onChange={(e) => setEmail(e.target.value)} placeholder="name@clinic.co.il" />
            </div>
            <div>
              <label className="label">סיסמה</label>
              <input dir="ltr" type="password" required className="input" value={password}
                     onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-[13px] text-red-700 leading-relaxed">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "מתחבר..." : "כניסה"}
            </button>
          </form>

          <p className="mt-6 text-xs text-slate-400 leading-relaxed">
            קיבלת מייל הזמנה? לחץ על הקישור שבמייל כדי להגדיר סיסמה ולהיכנס לראשונה.
          </p>
        </div>
      </div>
    </div>
  );
}
