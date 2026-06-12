"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, CreditCard, Users, UserRound, Sparkles } from "lucide-react";
import { PLAN_HE, type Subscription, type SubscriptionPlan } from "@/lib/types";

const PLANS: {
  id: SubscriptionPlan;
  price: string;
  priceSub: string;
  tagline: string;
  features: string[];
  highlight?: boolean;
}[] = [
  {
    id: "free",
    price: "₪0",
    priceSub: "לתמיד",
    tagline: "להתנסות וקליניקות קטנות",
    features: ["מטפל/ת אחד", "עד 25 מטופלים", "20 תיעודי AI בחודש", "מסמכים בסיסיים"],
  },
  {
    id: "pro",
    price: "₪299",
    priceSub: "למטפל / לחודש",
    tagline: "לקליניקות בצמיחה",
    highlight: true,
    features: [
      "מטפלים ללא הגבלה",
      "מטופלים ללא הגבלה",
      "תיעוד AI ללא הגבלה",
      "יצירת מסמכים ב‑AI",
      "חתימה דיגיטלית",
      "יומן תורים",
      "אנליטיקות מלאות",
    ],
  },
  {
    id: "clinic",
    price: "₪199",
    priceSub: "למטפל / לחודש · מ‑5 מטפלים",
    tagline: "לרשתות ומרפאות גדולות",
    features: [
      "כל יכולות Pro",
      "ניהול רב‑סניפי",
      "תמיכה בעדיפות גבוהה",
      "הדרכת צוות אישית",
      "SLA ואבטחה מורחבת",
    ],
  },
];

export default function BillingClient({
  clinicName, subscription, memberCount, patientCount,
}: {
  clinicName: string;
  subscription: Subscription | null;
  memberCount: number;
  patientCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<SubscriptionPlan | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const currentPlan: SubscriptionPlan = subscription?.plan ?? "free";

  async function choose(plan: SubscriptionPlan) {
    if (plan === currentPlan) return;
    setBusy(plan);
    setMsg(null);
    const r = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    setBusy(null);
    const d = await r.json().catch(() => null);
    if (!r.ok) { setMsg({ kind: "err", text: d?.error ?? "הפעולה נכשלה — נסו שוב." }); return; }
    if (d?.checkout_url) { window.location.href = d.checkout_url; return; }
    setMsg({ kind: "ok", text: d?.message ?? "התוכנית עודכנה בהצלחה." });
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">חיוב ומנוי</h1>
        <p className="mt-1 text-sm text-slate-500">
          ניהול תוכנית המנוי של <strong>{clinicName}</strong>
        </p>
      </div>

      {/* Current state */}
      <div className="card flex flex-wrap items-center gap-6 p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand"><CreditCard size={19} /></div>
          <div>
            <div className="text-[13px] font-bold text-slate-900">
              תוכנית {PLAN_HE[currentPlan]}
              {subscription?.status === "trial" && <span className="mr-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-600">תקופת ניסיון</span>}
              {subscription?.status === "active" && <span className="mr-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-600">פעיל</span>}
            </div>
            {subscription?.current_period_end && (
              <div className="text-[11.5px] text-slate-400">חידוש: {new Date(subscription.current_period_end).toLocaleDateString("he-IL")}</div>
            )}
          </div>
        </div>
        <div className="ms-auto flex gap-6 text-[12.5px] text-slate-500">
          <span className="flex items-center gap-1.5"><Users size={14} className="text-slate-400" /> {memberCount} אנשי צוות</span>
          <span className="flex items-center gap-1.5"><UserRound size={14} className="text-slate-400" /> {patientCount} מטופלים</span>
        </div>
      </div>

      {msg && (
        <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${
          msg.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
        }`}>
          {msg.text}
        </div>
      )}

      {/* Plans */}
      <div className="grid gap-5 md:grid-cols-3">
        {PLANS.map((p) => {
          const isCurrent = p.id === currentPlan;
          return (
            <div
              key={p.id}
              className={`card relative flex flex-col p-6 ${p.highlight ? "ring-2 ring-brand" : ""}`}
            >
              {p.highlight && (
                <span className="absolute -top-3 right-5 flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-[10.5px] font-bold text-white">
                  <Sparkles size={11} /> הכי פופולרי
                </span>
              )}
              <h3 className="text-base font-bold text-slate-900">{PLAN_HE[p.id]}</h3>
              <p className="mt-0.5 text-[12px] text-slate-400">{p.tagline}</p>
              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="text-3xl font-bold text-slate-900">{p.price}</span>
                <span className="text-[11.5px] text-slate-400">{p.priceSub}</span>
              </div>
              <ul className="mt-5 flex-1 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[12.5px] text-slate-600">
                    <Check size={14} className="mt-0.5 shrink-0 text-emerald-500" strokeWidth={3} /> {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => choose(p.id)}
                disabled={isCurrent || busy !== null}
                className={`mt-6 w-full ${isCurrent ? "btn-ghost cursor-default opacity-60" : p.highlight ? "btn-primary" : "btn-ghost !border !border-line"}`}
              >
                {busy === p.id ? <Loader2 size={15} className="animate-spin" /> : isCurrent ? "התוכנית הנוכחית" : `מעבר ל‑${PLAN_HE[p.id]}`}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-center text-[11.5px] text-slate-400">
        התשלום מאובטח ומעובד באמצעות Stripe · ניתן לבטל בכל עת · המחירים אינם כוללים מע&Prime;מ
      </p>
    </div>
  );
}
