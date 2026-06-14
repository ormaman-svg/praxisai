"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Copy, Check, Loader2, ExternalLink } from "lucide-react";

type Initial = {
  wa_phone_number_id: string;
  wa_waba_id: string;
  hasAccessToken: boolean;
  reminder24h: boolean;
  reminder2h: boolean;
};

export default function WhatsAppClient({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [phoneNumberId, setPhoneNumberId] = useState(initial.wa_phone_number_id);
  const [wabaId, setWabaId] = useState(initial.wa_waba_id);
  const [accessToken, setAccessToken] = useState("");
  const [reminder24h, setReminder24h] = useState(initial.reminder24h);
  const [reminder2h, setReminder2h] = useState(initial.reminder2h);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/whatsapp/webhook`);
  }, []);

  const connected = !!initial.wa_phone_number_id && initial.hasAccessToken;

  async function save() {
    setSaving(true);
    setMsg(null);
    const patch: Record<string, unknown> = {
      wa_phone_number_id: phoneNumberId.trim(),
      wa_waba_id: wabaId.trim(),
      wa_reminder_24h: reminder24h,
      wa_reminder_2h: reminder2h,
    };
    // Only overwrite the token if the admin typed a new one
    if (accessToken.trim()) patch.wa_access_token = accessToken.trim();

    const r = await fetch("/api/clinic/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    const d = await r.json().catch(() => null);
    if (!r.ok) { setMsg({ kind: "err", text: d?.error ?? "השמירה נכשלה." }); return; }
    setAccessToken("");
    setMsg({ kind: "ok", text: "ההגדרות נשמרו בהצלחה." });
    router.refresh();
  }

  function copyWebhook() {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
          <MessageCircle size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">חיבור WhatsApp</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {connected
              ? <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600"><Check size={14} /> מחובר ופעיל</span>
              : "חיבור ישיר מול WhatsApp Cloud API הרשמי של Meta — ללא דמי מנוי למתווך"}
          </p>
        </div>
      </div>

      {/* Step-by-step guide */}
      <div className="card p-6">
        <h2 className="mb-4 text-sm font-bold text-slate-900">איך מחברים — 5 צעדים</h2>
        <ol className="space-y-4">
          {[
            { n: 1, t: "צרו אפליקציה ב-Meta for Developers", d: <>היכנסו ל-<a href="https://developers.facebook.com/apps" target="_blank" rel="noopener" className="inline-flex items-center gap-0.5 font-semibold text-brand hover:underline">developers.facebook.com <ExternalLink size={11} /></a>, צרו אפליקציה מסוג Business והוסיפו את מוצר <strong>WhatsApp</strong>.</> },
            { n: 2, t: "העתיקו Phone Number ID ו-WABA ID", d: "במסך WhatsApp → API Setup תמצאו את ה-Phone Number ID ואת ה-WhatsApp Business Account ID. הדביקו אותם בטופס למטה." },
            { n: 3, t: "צרו Permanent Access Token", d: "ב-Business Settings → System Users צרו משתמש מערכת והנפיקו טוקן קבוע עם ההרשאות whatsapp_business_messaging ו-whatsapp_business_management. הדביקו אותו למטה." },
            { n: 4, t: "הגדירו את ה-Webhook", d: <>תחת WhatsApp → Configuration הדביקו את כתובת ה-Callback למטה, הזינו את ה-<strong>Verify Token</strong> (אותו ערך כמו משתנה הסביבה <code className="rounded bg-slate-100 px-1 text-[11px]">WA_VERIFY_TOKEN</code>), והירשמו לשדה <strong>messages</strong>.</> },
            { n: 5, t: "אשרו App Secret ותבניות", d: <>שמרו את ה-App Secret (Settings → Basic) כמשתנה הסביבה <code className="rounded bg-slate-100 px-1 text-[11px]">WA_APP_SECRET</code>, ושלחו את תבניות ההודעה לאישור Meta (עד 24 שעות).</> },
          ].map((step) => (
            <li key={step.n} className="flex gap-3.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50 text-[13px] font-bold text-brand">{step.n}</span>
              <div>
                <div className="text-[13.5px] font-semibold text-slate-800">{step.t}</div>
                <div className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">{step.d}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Webhook URL */}
      <div className="card p-6">
        <label className="label">כתובת ה-Webhook / Callback URL (להדביק ב-Meta)</label>
        <div className="mt-1.5 flex gap-2">
          <input readOnly dir="ltr" value={webhookUrl} className="input flex-1 bg-slate-50 font-mono text-[12.5px]" />
          <button onClick={copyWebhook} className="btn-ghost !border !border-line shrink-0">
            {copied ? <><Check size={15} className="text-emerald-500" /> הועתק</> : <><Copy size={15} /> העתקה</>}
          </button>
        </div>
      </div>

      {/* Credentials form */}
      <div className="card p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-900">פרטי חיבור</h2>

        <div>
          <label className="label">Phone Number ID</label>
          <input dir="ltr" className="input font-mono" placeholder="לדוגמה: 123456789012345"
                 value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} />
        </div>

        <div>
          <label className="label">WhatsApp Business Account ID (WABA ID)</label>
          <input dir="ltr" className="input font-mono" placeholder="לדוגמה: 987654321098765"
                 value={wabaId} onChange={(e) => setWabaId(e.target.value)} />
        </div>

        <div>
          <label className="label">Permanent Access Token</label>
          <input dir="ltr" type="password" className="input font-mono"
                 placeholder={initial.hasAccessToken ? "•••••••••• (שמור — השאירו ריק כדי לא לשנות)" : "הדביקו את הטוקן הקבוע מ-Meta"}
                 value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
          <p className="mt-1 text-[11.5px] text-slate-400">הטוקן נשמר מוצפן ומשמש רק את השרת לשליחת הודעות.</p>
        </div>

        <div className="border-t border-line pt-4 space-y-2.5">
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-slate-500">תזכורות אוטומטיות</h3>
          <label className="flex items-center gap-2.5 text-[13.5px] text-slate-700">
            <input type="checkbox" className="h-4 w-4 rounded border-line text-brand focus:ring-brand/30"
                   checked={reminder24h} onChange={(e) => setReminder24h(e.target.checked)} />
            שליחת תזכורת 24 שעות לפני התור
          </label>
          <label className="flex items-center gap-2.5 text-[13.5px] text-slate-700">
            <input type="checkbox" className="h-4 w-4 rounded border-line text-brand focus:ring-brand/30"
                   checked={reminder2h} onChange={(e) => setReminder2h(e.target.checked)} />
            שליחת תזכורת שעתיים לפני התור
          </label>
        </div>

        {msg && (
          <div className={`rounded-lg border px-4 py-2.5 text-[13px] font-semibold ${
            msg.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
          }`}>
            {msg.text}
          </div>
        )}

        <div className="flex justify-end">
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? <Loader2 size={15} className="animate-spin" /> : "שמירת חיבור"}
          </button>
        </div>
      </div>
    </div>
  );
}
