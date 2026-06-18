"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2, RefreshCw, Wifi, WifiOff } from "lucide-react";

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

  const hasEvolution = !!initial.evolution_instance && initial.hasEvolutionKey;
  const hasAny = hasEvolution || (!!initial.green_id_instance && initial.hasGreenToken) || (!!initial.wa_phone_number_id && initial.hasAccessToken);

  // QR / connection state
  const [evoState, setEvoState] = useState<"open" | "close" | "connecting" | null>(null);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrDebug, setQrDebug] = useState<string | null>(null);

  // Advanced settings (collapsed by default)
  const [showAdvanced, setShowAdvanced] = useState(!hasAny);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Evolution fields
  const [evoHost, setEvoHost] = useState(initial.evolution_host);
  const [evoInstance, setEvoInstance] = useState(initial.evolution_instance);
  const [evoApiKey, setEvoApiKey] = useState("");

  // Green API fields (kept for backward compat, hidden by default)
  const [greenIdInstance, setGreenIdInstance] = useState(initial.green_id_instance);
  const [greenApiToken, setGreenApiToken] = useState("");

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ensures the one-time session reset only fires once per page visit.
  const resetTriedRef = useRef(false);

  async function loadQr(reset = false) {
    setLoadingQr(true);
    setQrError(null);
    setQrDebug(null);
    try {
      const r = await fetch(`/api/whatsapp/evolution/qr${reset ? "?reset=1" : ""}`);
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        setQrError(d?.error ?? "טעינת QR נכשלה.");
        return;
      }
      setEvoState(d.state);
      setQrBase64(d.qrBase64 ?? null);

      // Stuck without a QR? Clear the stale session once, then let polling
      // pick up the freshly generated QR.
      if (!d.qrBase64 && d.state !== "open" && !resetTriedRef.current) {
        resetTriedRef.current = true;
        setQrDebug("מאתחל חיבור... ה-QR יופיע בעוד מספר שניות.");
        await loadQr(true);
        return;
      }

      if (!d.qrBase64 && d.state !== "open" && d.debug) {
        setQrDebug(`סטטוס Evolution: ${d.debug.status} · ${JSON.stringify(d.debug.raw).slice(0, 300)}`);
      }
    } catch {
      setQrError("שגיאת רשת.");
    } finally {
      setLoadingQr(false);
    }
  }

  // Explicit user-triggered reset of the WhatsApp session.
  async function resetSession() {
    resetTriedRef.current = true;
    await loadQr(true);
  }

  // Auto-load QR on mount if credentials exist; poll every 8s until connected
  useEffect(() => {
    if (!hasEvolution) return;
    loadQr();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasEvolution) return;
    if (evoState === "open") {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }
    pollingRef.current = setInterval(() => loadQr(false), 5000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evoState, hasEvolution]);

  async function saveEvolution() {
    setSaving(true);
    setSaveMsg(null);
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
    const d = await r.json().catch(() => null);
    if (!r.ok) {
      setSaving(false);
      setSaveMsg({ kind: "err", text: d?.error ?? "השמירה נכשלה." });
      return;
    }
    setEvoApiKey("");

    const setup = await fetch("/api/whatsapp/evolution/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin: window.location.origin }),
    });
    const sd = await setup.json().catch(() => null);
    if (!setup.ok) {
      setSaving(false);
      setSaveMsg({ kind: "err", text: sd?.error ?? "Webhook לא הוגדר — בדוק URL ו-API Key." });
      return;
    }

    setSaving(false);
    setSaveMsg({ kind: "ok", text: "נשמר בהצלחה." });
    router.refresh();
    await loadQr();
  }

  async function saveGreen() {
    setSaving(true);
    setSaveMsg(null);
    const patch: Record<string, unknown> = { green_id_instance: greenIdInstance.trim() };
    if (greenApiToken.trim()) patch.green_api_token = greenApiToken.trim();
    const r = await fetch("/api/clinic/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    const d = await r.json().catch(() => null);
    if (!r.ok) { setSaveMsg({ kind: "err", text: d?.error ?? "השמירה נכשלה." }); return; }
    setGreenApiToken("");
    setSaveMsg({ kind: "ok", text: "Green API נשמר. הגדירו Webhook בקונסול." });
    router.refresh();
  }

  const connected = evoState === "open";

  // QR image roughly fills the card width on all viewports.
  const qrBoxClass = "aspect-square w-full max-w-[420px]";

  return (
    <div className="mx-auto max-w-xl space-y-6 py-6">
      {/* Status + QR */}
      <div className="flex flex-col items-center gap-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        {/* Status badge */}
        <div className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold ${
          connected
            ? "bg-emerald-50 text-emerald-700"
            : hasAny
              ? "bg-amber-50 text-amber-700"
              : "bg-slate-100 text-slate-500"
        }`}>
          {connected
            ? <><Check size={16} /> מחובר</>
            : hasAny
              ? <><WifiOff size={16} /> לא מחובר</>
              : <><Wifi size={16} /> לא מוגדר</>
          }
        </div>

        {/* QR display */}
        {hasEvolution && (
          <div className="flex w-full flex-col items-center gap-4">
            {loadingQr && !qrBase64 && (
              <div className={`${qrBoxClass} grid place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50`}>
                <Loader2 size={40} className="animate-spin text-slate-300" />
              </div>
            )}

            {!loadingQr && connected && (
              <div className={`${qrBoxClass} grid place-items-center rounded-2xl bg-emerald-50`}>
                <div className="text-center">
                  <Check size={64} className="mx-auto text-emerald-500" />
                  <p className="mt-3 text-base font-semibold text-emerald-700">WhatsApp פעיל</p>
                </div>
              </div>
            )}

            {!loadingQr && !connected && qrBase64 && (
              <img src={qrBase64} alt="WhatsApp QR" className={`${qrBoxClass} rounded-2xl border border-slate-100 shadow-sm`} />
            )}

            {!loadingQr && !connected && !qrBase64 && (
              <div className={`${qrBoxClass} grid place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50`}>
                <p className="px-6 text-center text-sm text-slate-400">
                  {qrError ?? "לחצו \"טען QR\" כדי להציג קוד לסריקה"}
                </p>
              </div>
            )}

            {!connected && qrBase64 && (
              <p className="text-center text-sm text-slate-500">
                פתחו WhatsApp בטלפון של הקליניקה ← מכשירים מקושרים ← סריקת קוד QR
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => loadQr(false)}
                disabled={loadingQr}
                className="btn-ghost !border !border-line flex items-center gap-1.5 text-sm"
              >
                {loadingQr ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {connected ? "בדוק סטטוס" : "טען QR"}
              </button>
              {!connected && (
                <button
                  onClick={resetSession}
                  disabled={loadingQr}
                  className="btn-ghost !border !border-line flex items-center gap-1.5 text-sm text-slate-500"
                >
                  אתחל חיבור מחדש
                </button>
              )}
            </div>

            {qrDebug && (
              <p dir="ltr" className="max-w-full break-all rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-400">
                {qrDebug}
              </p>
            )}
          </div>
        )}

        {!hasAny && (
          <p className="text-center text-sm text-slate-400">
            הגדירו חיבור WhatsApp בהגדרות למטה כדי שתופיע כאן קוד QR לסריקה.
          </p>
        )}
      </div>

      {/* Advanced settings (collapsed) */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-3.5 text-[13px] font-semibold text-slate-600 hover:text-slate-900"
        >
          <span>הגדרות מתקדמות</span>
          <ChevronDown size={16} className={`transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`} />
        </button>

        {showAdvanced && (
          <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-6">
            {/* Evolution API section */}
            <div className="space-y-3">
              <h3 className="text-[11.5px] font-bold uppercase tracking-wider text-slate-400">Evolution API (Baileys)</h3>
              <div>
                <label className="label">Evolution API URL</label>
                <input dir="ltr" className="input font-mono" placeholder="https://evo.my-server.com"
                       value={evoHost} onChange={(e) => setEvoHost(e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Instance Name</label>
                  <input dir="ltr" className="input font-mono" placeholder="clinic_abc"
                         value={evoInstance} onChange={(e) => setEvoInstance(e.target.value)} />
                </div>
                <div>
                  <label className="label">API Key</label>
                  <input dir="ltr" type="password" className="input font-mono"
                         placeholder={initial.hasEvolutionKey ? "••••••••" : "API Key"}
                         value={evoApiKey} onChange={(e) => setEvoApiKey(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={saveEvolution} disabled={saving} className="btn-primary !bg-violet-600 hover:!bg-violet-700 text-[13px]">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : "שמור"}
                </button>
              </div>
            </div>

            {/* Green API section */}
            <div className="space-y-3 border-t border-slate-100 pt-5">
              <h3 className="text-[11.5px] font-bold uppercase tracking-wider text-slate-400">Green API (חלופה)</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">idInstance</label>
                  <input dir="ltr" className="input font-mono" placeholder="1101000001"
                         value={greenIdInstance} onChange={(e) => setGreenIdInstance(e.target.value)} />
                </div>
                <div>
                  <label className="label">ApiTokenInstance</label>
                  <input dir="ltr" type="password" className="input font-mono"
                         placeholder={initial.hasGreenToken ? "••••••••" : "טוקן"}
                         value={greenApiToken} onChange={(e) => setGreenApiToken(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={saveGreen} disabled={saving} className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 text-[13px]">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : "שמור"}
                </button>
              </div>
            </div>

            {saveMsg && (
              <div className={`rounded-lg border px-4 py-2.5 text-[13px] font-semibold ${
                saveMsg.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
              }`}>
                {saveMsg.text}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
