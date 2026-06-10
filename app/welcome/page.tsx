"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function WelcomePage() {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      setFullName((user.user_metadata?.full_name as string) ?? "");
      setReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function complete(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("הסיסמה חייבת להכיל לפחות 8 תווים.");
    if (password !== confirm) return setError("הסיסמאות אינן תואמות.");
    setLoading(true);
    setError(null);

    const { data: { user }, error: upErr } = await supabase.auth.updateUser({
      password,
      data: { full_name: fullName },
    });
    if (upErr || !user) {
      setError("שמירת הפרטים נכשלה. נסה שוב או בקש הזמנה חדשה.");
      setLoading(false);
      return;
    }
    await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
    router.push("/dashboard");
    router.refresh();
  }

  if (!ready) return <div className="min-h-screen grid place-items-center text-slate-400 text-sm">טוען…</div>;

  return (
    <div className="min-h-screen grid place-items-center bg-bg p-6">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-white font-bold">P</div>
          <span className="text-lg font-bold">praxisAI</span>
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-1">ברוכים הבאים 👋</h1>
        <p className="text-sm text-slate-500 mb-6">עוד צעד אחד — נגדיר את הפרופיל והסיסמה שלך.</p>

        <form onSubmit={complete} className="space-y-4">
          <div>
            <label className="label">שם מלא</label>
            <input required className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="ישראל ישראלי" />
          </div>
          <div>
            <label className="label">סיסמה חדשה</label>
            <input dir="ltr" type="password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="לפחות 8 תווים" />
          </div>
          <div>
            <label className="label">אימות סיסמה</label>
            <input dir="ltr" type="password" required className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>

          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-[13px] text-red-700">{error}</div>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "שומר…" : "סיום והתחלת עבודה"}
          </button>
        </form>
      </div>
    </div>
  );
}
