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
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    setExpired(new URLSearchParams(window.location.search).get("expired") === "1");
  }, []);

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
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-lg font-bold font-display">P</div>
          <span className="text-xl font-bold font-display tracking-tight">praxisAI</span>
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
          <p className="text-sm text-slate-500 mb-8">הכניסה בהזמנה בלבד — באמצעות החשבון שהוגדר לך.</p>

          {expired && (
            <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800">
              החיבור פג לאחר 8 שעות — מטעמי אבטחה יש להתחבר מחדש.
            </div>
          )}

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
