"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Receipt, X, Send, Loader2, Check, Copy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Invoice = {
  id: string;
  amount_ils: number;
  description: string | null;
  status: "pending" | "paid" | "cancelled";
  stripe_payment_link: string | null;
  created_at: string;
  paid_at: string | null;
};

const STATUS: Record<string, { he: string; cls: string }> = {
  pending: { he: "ממתין", cls: "bg-amber-50 text-amber-600" },
  paid: { he: "שולם", cls: "bg-emerald-50 text-emerald-600" },
  cancelled: { he: "בוטל", cls: "bg-slate-100 text-slate-400" },
};

export default function InvoicesPanel({
  patientId, clinicId, patientFirstName, invoices,
}: {
  patientId: string;
  clinicId: string;
  patientFirstName: string;
  invoices: Invoice[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function create() {
    if (!amount || +amount <= 0) { setError("הזינו סכום תקין."); return; }
    setSaving(true);
    setError(null);
    const r = await fetch("/api/billing/patient-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patient_id: patientId, amount_ils: +amount, description }),
    });
    setSaving(false);
    const d = await r.json().catch(() => null);
    if (!r.ok) { setError(d?.error ?? "יצירת החשבונית נכשלה."); return; }
    setOpen(false); setAmount(""); setDescription("");
    router.refresh();
  }

  async function sendRequest(inv: Invoice) {
    await supabase.from("scheduled_messages").insert({
      clinic_id: clinicId, patient_id: patientId, template_key: "payment_request",
      template_vars: [patientFirstName, String(inv.amount_ils), inv.description ?? "טיפול", inv.stripe_payment_link ?? ""],
      scheduled_for: new Date().toISOString(),
    });
    setSentId(inv.id);
    setTimeout(() => setSentId(null), 2000);
  }

  function copyLink(inv: Invoice) {
    if (!inv.stripe_payment_link) return;
    navigator.clipboard.writeText(inv.stripe_payment_link);
    setCopiedId(inv.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <Receipt size={15} className="text-blue-500" /> חשבוניות ותשלומים
        </h2>
        <button onClick={() => setOpen(true)} className="text-[12.5px] font-semibold text-brand hover:underline">
          + חשבונית
        </button>
      </div>

      {invoices.length === 0 ? (
        <p className="py-4 text-center text-[12.5px] text-slate-400">אין עדיין חשבוניות.</p>
      ) : (
        <ul className="space-y-2">
          {invoices.map((inv) => (
            <li key={inv.id} className="rounded-lg border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-bold text-slate-900">{inv.amount_ils} ₪</span>
                <span className={`badge ${STATUS[inv.status].cls}`}>{STATUS[inv.status].he}</span>
              </div>
              {inv.description && <div className="mt-0.5 text-[12px] text-slate-500">{inv.description}</div>}
              {inv.status === "pending" && (
                <div className="mt-2 flex items-center gap-3">
                  <button onClick={() => sendRequest(inv)} className="flex items-center gap-1 text-[11.5px] font-semibold text-emerald-600 hover:underline">
                    {sentId === inv.id ? <><Check size={12} /> נשלח</> : <><Send size={12} /> שליחה למטופל</>}
                  </button>
                  {inv.stripe_payment_link && (
                    <button onClick={() => copyLink(inv)} className="flex items-center gap-1 text-[11.5px] font-semibold text-slate-500 hover:underline">
                      {copiedId === inv.id ? <><Check size={12} /> הועתק</> : <><Copy size={12} /> העתקת קישור</>}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">חשבונית חדשה</h2>
              <button onClick={() => setOpen(false)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">סכום (₪)</label>
                <input dir="ltr" type="number" className="input" placeholder="250" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <label className="label">תיאור</label>
                <input className="input" placeholder="טיפול פיזיותרפיה" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-[13px] text-red-700">{error}</div>}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setOpen(false)} className="btn-ghost">ביטול</button>
                <button onClick={create} disabled={saving} className="btn-primary">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : "יצירה"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
