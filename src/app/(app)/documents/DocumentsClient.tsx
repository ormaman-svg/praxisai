"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, FileText, Sparkles, Loader2, PenLine, BadgeCheck, Download, FileDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DOC_TYPE_HE } from "@/lib/types";
import SignaturePad from "@/components/SignaturePad";

type DocRow = {
  id: string; type: string; title: string; content: string;
  status: "draft" | "final"; created_at: string; ai_generated: boolean;
  signature_data: string | null; signed_by_name: string | null; signed_at: string | null;
  patients: { first_name: string; last_name: string } | null;
};

export default function DocumentsClient({
  clinicId, docs, patients, userName,
}: {
  clinicId: string;
  docs: DocRow[];
  patients: { id: string; first_name: string; last_name: string }[];
  userName: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ type: "bituach_leumi", patient_id: "", title: "", content: "", ai: false });
  const [viewDoc, setViewDoc] = useState<DocRow | null>(null);
  const [signing, setSigning] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "word" | null>(null);

  async function generateAI() {
    if (!form.patient_id) { setError("בחרו מטופל כדי לייצר מסמך עם AI."); return; }
    setGenerating(true);
    setError(null);
    const r = await fetch("/api/documents/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId: form.patient_id, type: form.type }),
    });
    setGenerating(false);
    if (!r.ok) {
      const d = await r.json().catch(() => null);
      setError(d?.error ?? "יצירת המסמך נכשלה — נסו שוב.");
      return;
    }
    const { title, content } = await r.json();
    setForm((f) => ({ ...f, title: f.title || title, content, ai: true }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("documents").insert({
      clinic_id: clinicId,
      patient_id: form.patient_id || null,
      type: form.type,
      title: form.title.trim() || DOC_TYPE_HE[form.type],
      content: form.content,
      ai_generated: form.ai,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) return setError("שמירת המסמך נכשלה.");
    setOpen(false);
    setForm({ type: "bituach_leumi", patient_id: "", title: "", content: "", ai: false });
    router.refresh();
  }

  async function signAndFinalize() {
    if (!viewDoc || !signature) return;
    setSaving(true);
    await supabase.from("documents").update({
      status: "final",
      signature_data: signature,
      signed_by_name: userName,
      signed_at: new Date().toISOString(),
    }).eq("id", viewDoc.id);
    setSaving(false);
    setSigning(false);
    setSignature(null);
    setViewDoc(null);
    router.refresh();
  }

  async function exportWord(doc: DocRow) {
    setExporting("word");
    const a = document.createElement("a");
    a.href = `/api/documents/export?id=${doc.id}&format=word`;
    a.download = `${doc.title}.doc`;
    a.click();
    setTimeout(() => setExporting(null), 800);
  }

  function exportPDF(doc: DocRow) {
    setExporting("pdf");
    const url = `/api/documents/export?id=${doc.id}&format=pdf-html`;
    const win = window.open(url, "_blank", "width=900,height=700");
    if (win) {
      win.addEventListener("load", () => {
        win.focus();
        win.print();
      });
    }
    setTimeout(() => setExporting(null), 1200);
  }

  function closeView() {
    setViewDoc(null);
    setSigning(false);
    setSignature(null);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">מסמכים</h1>
          <p className="mt-1 text-sm text-slate-500">מכתבים ודו&Prime;חות רפואיים — נוצרים ב‑AI מתוך תיק המטופל, עם חתימה דיגיטלית</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary"><Plus size={16} /> מסמך חדש</button>
      </div>

      <div className="card overflow-hidden">
        {docs.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm text-slate-400">אין עדיין מסמכים. צרו את הראשון.</div>
        ) : (
          <ul className="divide-y divide-line">
            {docs.map((d) => (
              <li key={d.id}>
                <button onClick={() => setViewDoc(d)} className="flex w-full items-center gap-4 px-5 py-4 text-right transition-colors hover:bg-slate-50">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand"><FileText size={17} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13.5px] font-semibold text-slate-800">{d.title}</span>
                      {d.ai_generated && (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-600">
                          <Sparkles size={10} /> AI
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {DOC_TYPE_HE[d.type] ?? d.type}
                      {d.patients ? ` · ${d.patients.first_name} ${d.patients.last_name}` : ""}
                      {" · "}
                      {new Date(d.created_at).toLocaleDateString("he-IL")}
                    </div>
                  </div>
                  {d.signed_at ? (
                    <span className="badge flex items-center gap-1 bg-emerald-50 text-emerald-600">
                      <BadgeCheck size={13} /> חתום
                    </span>
                  ) : (
                    <span className={`badge ${d.status === "final" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                      {d.status === "final" ? "סופי" : "טיוטה"}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Create modal ── */}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center glass-overlay p-4" onClick={() => setOpen(false)}>
          <div className="glass-panel w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">מסמך חדש</h2>
              <button onClick={() => setOpen(false)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <form onSubmit={save} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">סוג מסמך</label>
                  <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    {Object.entries(DOC_TYPE_HE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">מטופל</label>
                  <select className="input" value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
                    <option value="">ללא שיוך</option>
                    {patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                  </select>
                </div>
              </div>

              {/* AI generation */}
              <button
                type="button"
                onClick={generateAI}
                disabled={generating || !form.patient_id}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-violet-200 bg-gradient-to-l from-violet-50 to-brand-50 px-4 py-3 text-sm font-semibold text-violet-700 transition-all hover:border-violet-300 disabled:opacity-50"
              >
                {generating
                  ? <><Loader2 size={16} className="animate-spin" /> ה‑AI כותב את המסמך מתוך תיק המטופל…</>
                  : <><Sparkles size={16} /> יצירה אוטומטית עם AI מתוך היסטוריית הטיפולים</>}
              </button>
              {!form.patient_id && (
                <p className="-mt-2 text-center text-[11px] text-slate-400">בחרו מטופל כדי לאפשר יצירה עם AI</p>
              )}

              <div>
                <label className="label">כותרת</label>
                <input className="input" value={form.title} placeholder={DOC_TYPE_HE[form.type]} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="label">תוכן</label>
                <textarea rows={10} className="input resize-y leading-relaxed" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value, ai: false })} />
              </div>
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">{error}</div>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost">ביטול</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? "שומר…" : "שמירה כטיוטה"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── View / sign modal ── */}
      {viewDoc && (
        <div className="fixed inset-0 z-50 grid place-items-center glass-overlay p-4" onClick={closeView}>
          <div className="glass-panel flex max-h-[88vh] w-full max-w-2xl flex-col p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{viewDoc.title}</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {DOC_TYPE_HE[viewDoc.type] ?? viewDoc.type}
                  {viewDoc.patients ? ` · ${viewDoc.patients.first_name} ${viewDoc.patients.last_name}` : ""}
                  {" · "}
                  {new Date(viewDoc.created_at).toLocaleDateString("he-IL")}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => exportPDF(viewDoc)}
                  disabled={exporting !== null}
                  title="ייצוא PDF"
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-slate-600 border border-line hover:bg-slate-100 disabled:opacity-50 transition-colors"
                >
                  {exporting === "pdf" ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  PDF
                </button>
                <button
                  onClick={() => exportWord(viewDoc)}
                  disabled={exporting !== null}
                  title="ייצוא Word"
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-slate-600 border border-line hover:bg-slate-100 disabled:opacity-50 transition-colors"
                >
                  {exporting === "word" ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
                  Word
                </button>
                <button onClick={closeView} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-line bg-slate-50 p-5 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
              {viewDoc.content || <span className="text-slate-400">אין תוכן.</span>}
            </div>

            {/* Existing signature */}
            {viewDoc.signature_data && (
              <div className="mt-4 flex items-center gap-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={viewDoc.signature_data} alt="חתימה" className="h-12 rounded bg-white px-2" />
                <div className="text-[12px] text-emerald-700">
                  <div className="flex items-center gap-1 font-bold"><BadgeCheck size={14} /> נחתם דיגיטלית</div>
                  <div>{viewDoc.signed_by_name} · {viewDoc.signed_at ? new Date(viewDoc.signed_at).toLocaleString("he-IL") : ""}</div>
                </div>
              </div>
            )}

            {/* Signing flow */}
            {!viewDoc.signed_at && (
              signing ? (
                <div className="mt-4 space-y-3">
                  <p className="text-[13px] font-semibold text-slate-700">חתימת {userName} — החתימה תנעל את המסמך כסופי:</p>
                  <SignaturePad onChange={setSignature} />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setSigning(false); setSignature(null); }} className="btn-ghost">ביטול</button>
                    <button onClick={signAndFinalize} disabled={!signature || saving} className="btn-primary">
                      {saving ? <Loader2 size={15} className="animate-spin" /> : <BadgeCheck size={15} />} חתימה ונעילה
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex justify-end">
                  <button onClick={() => setSigning(true)} className="btn-primary">
                    <PenLine size={15} /> חתימה דיגיטלית וסיום
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
