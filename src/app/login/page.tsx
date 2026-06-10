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
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-navy p-12 text-white">
        <div className="flex items-center gap-3">
          <Logo size={40} className="text-brand" />
          <span className="text-xl font-bold font-display tracking-tight">praxisAI</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold leading-snug mb-4">
            פחות ניירת.<br />יותר זמן לטפל.
          </h1>
          <p className="text-slate-300 leading-relaxed max-w-md">
            הקליטו את הטיפול — praxisAI תכתוב את הרשומה, תכין את הדוחות
            ותשאיר אתכם פנויים למה שבאמת חשוב.
          </p>
        </div>
        <p className="text-xs text-slate-400">© {new Date().getFullYear()} praxisAI</p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <Logo size={32} className="text-brand" />
            <span className="text-lg font-bold">praxisAI</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-6">כניסה למערכת</h2>

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
