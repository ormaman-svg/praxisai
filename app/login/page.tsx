"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
    setExpired(new URLSearchParams(window.location.search).get("expired") === "1");
  }, []);

  async function signInWithGoogle() {
    setGoogleLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setError("כניסה עם Google נכשלה. נסה שוב.");
      setGoogleLoading(false);
    }
    // on success Supabase redirects — no need to set loading false
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("פרטי ההתחברות שגויים. הכניסה למערכת בהזמנה בלבד — אם לא קיבלת הזמנה, פנה למנהל הקליניקה.");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-navy p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-lg font-bold">P</div>
          <span className="text-xl font-bold tracking-tight">praxisAI</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold leading-snug mb-4">
            פלטפורמת ה‑AI הקלינית<br />לקליניקות פיזיותרפיה בישראל
          </h1>
          <p className="text-slate-300 leading-relaxed max-w-md">
            תמלול עברי בזמן אמת, רשומות SOAP אוטומטיות, מסמכי ביטוח לאומי
            ומעקב תוצאים — הכל במקום אחד.
          </p>
        </div>
        <p className="text-xs text-slate-400">© {new Date().getFullYear()} praxisAI</p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-white font-bold">P</div>
            <span className="text-lg font-bold">praxisAI</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">כניסה למערכת</h2>
          <p className="text-sm text-slate-500 mb-6">הכניסה בהזמנה בלבד — באמצעות החשבון שהוגדר לך.</p>

          {expired && (
            <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800">
              החיבור פג לאחר 8 שעות — מטעמי אבטחה יש להתחבר מחדש.
            </div>
          )}

          {/* Google SSO */}
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
          >
            {googleLoading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />
            ) : (
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {googleLoading ? "מחבר..." : "כניסה עם Google"}
          </button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-slate-400">או עם דוא&Prime;ל וסיסמה</span></div>
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

            <button type="submit" disabled={loading || googleLoading} className="btn-primary w-full">
              {loading ? "מתחבר..." : "כניסה"}
            </button>
          </form>

          <p className="mt-5 text-xs text-slate-400 leading-relaxed">
            קיבלת מייל הזמנה? לחץ על הקישור שבמייל כדי להגדיר סיסמה ולהיכנס לראשונה.
          </p>
        </div>
      </div>
    </div>
  );
}
