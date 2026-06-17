"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Copy, Check, Loader2, ExternalLink, Zap, QrCode, RefreshCw, Video } from "lucide-react";

type Initial = {
  wa_phone_number_id: string;
  wa_waba_id: string;
  hasAccessToken: boolean;
  reminder24h: boolean;
  reminder2h: boolean;
  green_id_instance: string;
  hasGreenToken: boolean;
  evolution_host: string;
  evolution_instance: string;
  hasEvolutionKey: boolean;
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

  // Green API (free, unofficial) state
  const [greenIdInstance, setGreenIdInstance] = useState(initial.green_id_instance);
  const [greenApiToken, setGreenApiToken] = useState("");
  const [greenWebhookUrl, setGreenWebhookUrl] = useState("");
  const [greenCopied, setGreenCopied] = useState(false);
  const [savingGreen, setSavingGreen] = useState(false);
  const [greenMsg, setGreenMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Evolution API (Baileys, free self-hosted) state
  const [evoHost, setEvoHost] = useState(initial.evolution_host);
  const [evoInstance, setEvoInstance] = useState(initial.evolution_instance);
  const [evoApiKey, setEvoApiKey] = useState("");
  const [evoWebhookUrl, setEvoWebhookUrl] = useState("");
  const [evoCopied, setEvoCopied] = useState(false);
  const [savingEvo, setSavingEvo] = useState(false);
  const [evoMsg, setEvoMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [evoState, setEvoState] = useState<"open" | "close" | "connecting" | null>(null);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);

  useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/whatsapp/webhook`);
    setGreenWebhookUrl(`${window.location.origin}/api/whatsapp/green`);
    setEvoWebhookUrl(`${window.location.origin}/api/whatsapp/evolution`);
  }, []);

  const greenConnected = !!initial.green_id_instance && initial.hasGreenToken;
  const evoConnected = !!initial.evolution_instance && initial.hasEvolutionKey;

  async function saveEvolution() {
    setSavingEvo(true);
    setEvoMsg(null);
    const patch: Record<string, unknown> = {
      evolution_host: evoHost.trim().replace(/\/$/, ""),
      evolution_instance: evoInstance.trim(),
    };
    if (evoApiKey.trim()) patch.evolution_api_key = evoApiKey.trim();
    const r = await fetch("/api/clinic/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSavingEvo(false);
    const d = await r.json().catch(() => null);
    if (!r.ok) { setEvoMsg({ kind: "err", text: d?.error ?? "השמירה נכשלה." }); return; }
    setEvoApiKey("");
    setEvoMsg({ kind: "ok", text: "פרטי Evolution API נשמרו. לחצו על 'טען QR' לחיבור." });
    router.refresh();
  }

  async function loadQr() {
    setLoadingQr(true);
    setQrBase64(null);
    try {
      const r = await fetch("/api/whatsapp/evolution/qr");
      const d = await r.json().catch(() => null);
      if (!r.ok) { setEvoMsg({ kind: "err", text: d?.error ?? "טעינת QR נכשלה." }); return; }
      setEvoState(d.state);
      setQrBase64(d.qrBase64 ?? null);
      if (d.state === "open") setEvoMsg({ kind: "ok", text: "מחובר! הוואטסאפ פעיל." });
    } catch {
      setEvoMsg({ kind: "err", text: "שגיאת רשת בטעינת QR." });
    } finally {
      setLoadingQr(false);
    }
  }

  function copyEvoWebhook() {
    navigator.clipboard.writeText(evoWebhookUrl);
    setEvoCopied(true);
    setTimeout(() => setEvoCopied(false), 1500);
  }

  async function saveGreen() {
    setSavingGreen(true);
    setGreenMsg(null);
    const patch: Record<string, unknown> = { green_id_instance: greenIdInstance.trim() };
    if (greenApiToken.trim()) patch.green_api_token = greenApiToken.trim();

    const r = await fetch("/api/clinic/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSavingGreen(false);
    const d = await r.json().catch(() => null);
    if (!r.ok) { setGreenMsg({ kind: "err", text: d?.error ?? "השמירה נכשלה." }); return; }
    setGreenApiToken("");
    setGreenMsg({ kind: "ok", text: "חיבור Green API נשמר. סרקו את ה-QR בקונסול והגדירו את ה-Webhook." });
    router.refresh();
  }

  function copyGreenWebhook() {
    navigator.clipboard.writeText(greenWebhookUrl);
    setGreenCopied(true);
    setTimeout(() => setGreenCopied(false), 1500);
  }

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

      {/* ── Evolution API (Baileys, free self-hosted, full media) ── */}
      <div className="card border-2 border-violet-200 bg-violet-50/30 p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-violet-100 text-violet-600">
            <Video size={18} />
          </div>
          <div className="flex-1">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              Evolution API (Baileys) — חינמי + וידאו מלא
              {evoConnected && <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10.5px] font-bold text-violet-700"><Check size={11} /> מוגדר</span>}
              {evoState === "open" && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700"><Check size={11} /> מחובר</span>}
            </h2>
            <p className="mt-0.5 text-[12px] text-slate-500">
              מבוסס Baileys (כמו Rio) — סריקת QR, ללא אישור Meta, תמיכה מלאה בוידאו/תמונות/קבצים.
            </p>
          </div>
        </div>

        <ol className="mb-4 space-y-2.5">
          {[
            { n: 1, t: <>הפעילו Evolution API על שרת חינמי: <a href="https://railway.app/template/evolution-api" target="_blank" rel="noopener" className="inline-flex items-center gap-0.5 font-semibold text-violet-700 hover:underline">Railway <ExternalLink size={11} /></a> או <a href="https://fly.io" target="_blank" rel="noopener" className="inline-flex items-center gap-0.5 font-semibold text-violet-700 hover:underline">Fly.io <ExternalLink size={11} /></a>.</> },
            { n: 2, t: <>צרו instance חדש בממשק Evolution (/instance/create) — קבלו שם instance ו-API key.</> },
            { n: 3, t: <>הכניסו את הפרטים למטה ולחצו "שמור". אחר כך לחצו "טען QR" וסרקו עם הטלפון.</> },
            { n: 4, t: <>בהגדרות ה-instance ב-Evolution, הגדירו Webhook URL לכתובת למטה + אפשרו events: <code className="rounded bg-slate-100 px-1 text-[11px]">messages.upsert</code>.</> },
          ].map((step) => (
            <li key={step.n} className="flex gap-3 text-[12.5px] leading-relaxed text-slate-600">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet-100 text-[11px] font-bold text-violet-700">{step.n}</span>
              <span>{step.t}</span>
            </li>
          ))}
        </ol>

        <div className="mb-3 grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label className="label">Evolution API URL</label>
            <input dir="ltr" className="input font-mono" placeholder="https://evo.my-server.com"
                   value={evoHost} onChange={(e) => setEvoHost(e.target.value)} />
          </div>
          <div>
            <label className="label">Instance Name</label>
            <input dir="ltr" className="input font-mono" placeholder="clinic_abc"
                   value={evoInstance} onChange={(e) => setEvoInstance(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">API Key</label>
            <input dir="ltr" type="password" className="input font-mono"
                   placeholder={initial.hasEvolutionKey ? "•••••••• (שמור — השאירו ריק כדי לא לשנות)" : "מה-/instance/create"}
                   value={evoApiKey} onChange={(e) => setEvoApiKey(e.target.value)} />
          </div>
        </div>

        {/* QR Code */}
        {evoConnected && (
          <div className="mb-3 flex flex-col items-center gap-3 rounded-xl border border-violet-100 bg-white p-4">
            {qrBase64 ? (
              <img src={qrBase64} alt="WhatsApp QR" className="h-48 w-48 rounded-lg" />
            ) : evoState === "open" ? (
              <p className="text-sm font-semibold text-emerald-600">הוואטסאפ מחובר ופעיל.</p>
            ) : (
              <p className="text-[12.5px] text-slate-400">לחצו "טען QR" לסריקה עם הוואטסאפ של הקליניקה.</p>
            )}
            <button onClick={loadQr} disabled={loadingQr}
                    className="btn-ghost !border !border-line text-[12.5px]">
              {loadingQr ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {evoState === "open" ? "בדוק סטטוס" : "טען QR"}
            </button>
          </div>
        )}

        <div className="mb-3">
          <label className="label">כתובת Webhook לEvolution API</label>
          <div className="mt-1.5 flex gap-2">
            <input readOnly dir="ltr" value={evoWebhookUrl} className="input flex-1 bg-white font-mono text-[12px]" />
            <button onClick={copyEvoWebhook} className="btn-ghost !border !border-line shrink-0">
              {evoCopied ? <><Check size={15} className="text-emerald-500" /> הועתק</> : <><Copy size={15} /> העתקה</>}
            </button>
          </div>
        </div>

        {evoMsg && (
          <div className={`mt-3 rounded-lg border px-4 py-2.5 text-[13px] font-semibold ${
            evoMsg.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
          }`}>
            {evoMsg.text}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button onClick={saveEvolution} disabled={savingEvo} className="btn-primary !bg-violet-600 hover:!bg-violet-700">
            {savingEvo ? <Loader2 size={15} className="animate-spin" /> : "שמור ו-QR"}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-line" />
        <span className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">או Green API (טקסט בלבד)</span>
        <div className="h-px flex-1 bg-line" />
      </div>

      {/* ── Quick connect: Green API (free, unofficial) ── */}
      <div className="card border-2 border-emerald-200 bg-emerald-50/30 p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-600">
            <Zap size={18} />
          </div>
          <div className="flex-1">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              חיבור מהיר — Green API (חינמי)
              {greenConnected && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700"><Check size={11} /> מוגדר</span>}
            </h2>
            <p className="mt-0.5 text-[12px] text-slate-500">חיבור לא רשמי בסריקת QR — ללא אימות Meta וללא אישור תבניות. מושלם לחיבור זריז ולדמו.</p>
          </div>
        </div>

        <ol className="mb-4 space-y-2.5">
          {[
            { n: 1, t: <>הירשמו בחינם ב-<a href="https://green-api.com" target="_blank" rel="noopener" className="inline-flex items-center gap-0.5 font-semibold text-emerald-700 hover:underline">green-api.com <ExternalLink size={11} /></a> וצרו Instance.</> },
            { n: 2, t: <>סרקו את ה-<strong>QR</strong> בקונסול עם הוואטסאפ של הקליניקה (<QrCode size={12} className="inline" /> כמו WhatsApp Web).</> },
            { n: 3, t: <>העתיקו <strong>idInstance</strong> ו-<strong>ApiTokenInstance</strong> מהקונסול והדביקו למטה.</> },
            { n: 4, t: <>בקונסול, תחת <strong>Settings → Webhooks</strong>, הדביקו את כתובת ה-Webhook למטה והפעילו <code className="rounded bg-slate-100 px-1 text-[11px]">incomingMessageReceived</code>.</> },
          ].map((step) => (
            <li key={step.n} className="flex gap-3 text-[12.5px] leading-relaxed text-slate-600">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700">{step.n}</span>
              <span>{step.t}</span>
            </li>
          ))}
        </ol>

        <div className="mb-3">
          <label className="label">כתובת Webhook ל-Green API</label>
          <div className="mt-1.5 flex gap-2">
            <input readOnly dir="ltr" value={greenWebhookUrl} className="input flex-1 bg-white font-mono text-[12px]" />
            <button onClick={copyGreenWebhook} className="btn-ghost !border !border-line shrink-0">
              {greenCopied ? <><Check size={15} className="text-emerald-500" /> הועתק</> : <><Copy size={15} /> העתקה</>}
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">idInstance</label>
            <input dir="ltr" className="input font-mono" placeholder="1101000001"
                   value={greenIdInstance} onChange={(e) => setGreenIdInstance(e.target.value)} />
          </div>
          <div>
            <label className="label">ApiTokenInstance</label>
            <input dir="ltr" type="password" className="input font-mono"
                   placeholder={initial.hasGreenToken ? "•••••••• (שמור — השאירו ריק כדי לא לשנות)" : "הדביקו את הטוקן"}
                   value={greenApiToken} onChange={(e) => setGreenApiToken(e.target.value)} />
          </div>
        </div>

        {greenMsg && (
          <div className={`mt-3 rounded-lg border px-4 py-2.5 text-[13px] font-semibold ${
            greenMsg.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
          }`}>
            {greenMsg.text}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button onClick={saveGreen} disabled={savingGreen} className="btn-primary !bg-emerald-600 hover:!bg-emerald-700">
            {savingGreen ? <Loader2 size={15} className="animate-spin" /> : "שמירת חיבור מהיר"}
          </button>
        </div>
      </div>

      {/* ── Official Meta Cloud API ── */}
      <div className="flex items-center gap-3 pt-2">
        <div className="h-px flex-1 bg-line" />
        <span className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">או חיבור רשמי דרך Meta</span>
        <div className="h-px flex-1 bg-line" />
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
