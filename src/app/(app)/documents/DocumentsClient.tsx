"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, X, FileText, Sparkles, Loader2, PenLine, BadgeCheck, Download, FileDown, ArrowUpLeft, Search, Filter } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DOC_TYPE_HE } from "@/lib/types";
import SignaturePad from "@/components/SignaturePad";

type DocRow = {
  id: string; type: string; title: string; content: string;
  status: "draft" | "final"; created_at: string; ai_generated: boolean;
  signature_data: string | null; signed_by_name: string | null; signed_at: string | null;
  patient_id: string | null;
  patients: { first_name: string; last_name: string } | null;
};

/* ── Document type icon (colored circle + letter) ── */
function DocIcon({ type }: { type: string }) {
  const colors: Record<string, string> = {
    bituach_leumi: "bg-blue-50 text-blue-600",
    referral: "bg-violet-50 text-violet-600",
    discharge: "bg-emerald-50 text-emerald-600",
    summary: "bg-amber-50 text-amber-600",
  };
  const cls = colors[type] ?? "bg-brand-50 text-brand";
  return (
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${cls}`}>
      <FileText size={18} />
    </span>
  );
}

/* ── Status badge ── */
function StatusBadge({ doc }: { doc: DocRow }) {
  if (doc.signed_at) {
    return (
      <span className="badge badge-success flex items-center gap-1">
        <BadgeCheck size={12} /> חתום
      </span>
    );
  }
  if (doc.status === "final") {
    return <span className="badge badge-success">סופי</span>;
  }
  return <span className="badge badge-warning">טיוטה</span>;
}

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
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "draft" | "final" | "signed">("all");

  /* ── Filtered docs ── */
  const filtered = docs.filter((d) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      d.title.toLowerCase().includes(q) ||
      (d.patients ? `${d.patients.first_name} ${d.patients.last_name}`.toLowerCase().includes(q) : false) ||
      (DOC_TYPE_HE[d.type] ?? d.type).toLowerCase().includes(q);
    const matchStatus =
      filterStatus === "all" ||
      (filterStatus === "signed" && !!d.signed_at) ||
      (filterStatus === "final" && d.status === "final" && !d.signed_at) ||
      (filterStatus === "draft" && d.status === "draft");
    return matchSearch && matchStatus;
  });

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
    window.open(`/api/documents/export?id=${doc.id}&format=pdf-html&print=1`, "_blank", "noopener");
    setTimeout(() => setExporting(null), 1200);
  }

  function closeView() {
    setViewDoc(null);
    setSigning(false);
    setSignature(null);
  }

  const statusTabs: { key: typeof filterStatus; label: string }[] = [
    { key: "all", label: "הכל" },
    { key: "draft", label: "טיוטות" },
    { key: "final", label: "סופי" },
    { key: "signed", label: "חתום" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">ניהול</p>
          <h1 className="page-title">מסמכים</h1>
          <p className="mt-1 text-sm text-ink-400">מכתבים ודו&Prime;חות רפואיים — נוצרים ב‑AI מתוך תיק המטופל, עם חתימה דיגיטלית</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary gap-2">
          <Plus size={16} /> מסמך חדש
        </button>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute end-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
          <input
            className="input w-full pe-9"
            placeholder="חיפוש לפי שם, מטופל, סוג…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-line bg-white p-1">
          <Filter size={13} className="ms-1.5 text-ink-400" />
          {statusTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilterStatus(t.key)}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                filterStatus === t.key
                  ? "bg-brand text-white shadow-sm"
                  : "text-ink-500 hover:bg-ink-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Document grid */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><FileText size={28} /></div>
          <p className="mt-3 text-[13px] text-ink-400">
            {docs.length === 0 ? "אין עדיין מסמכים. צרו את הראשון." : "לא נמצאו מסמכים תואמים לחיפוש."}
          </p>
          {docs.length === 0 && (
            <button onClick={() => setOpen(true)} className="btn-primary btn-sm mt-4 gap-1.5">
              <Plus size={14} /> מסמך חדש
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => (
            <button
              key={d.id}
              onClick={() => setViewDoc(d)}
              className="card card-hover p-5 text-start flex flex-col gap-3"
            >
              {/* Top row: icon + status */}
              <div className="flex items-start justify-between gap-3">
                <DocIcon type={d.type} />
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {d.ai_generated && (
                    <span className="badge flex items-center gap-1 bg-violet-50 text-violet-600">
                      <Sparkles size={10} /> AI
                    </span>
                  )}
                  <StatusBadge doc={d} />
                </div>
              </div>

              {/* Title */}
              <div>
                <p className="truncate text-[14px] font-semibold text-ink-900 leading-snug">{d.title}</p>
                <p className="mt-0.5 text-[12px] text-ink-400">{DOC_TYPE_HE[d.type] ?? d.type}</p>
              </div>

              {/* Footer: patient + date */}
              <div className="mt-auto flex items-center justify-between gap-2 pt-2 border-t border-line">
                <span className="truncate text-[12px] text-ink-500">
                  {d.patients ? `${d.patients.first_name} ${d.patients.last_name}` : "ללא מטופל"}
                </span>
                <span className="shrink-0 text-[11px] text-ink-300">
                  {new Date(d.created_at).toLocaleDateString("he-IL")}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Create modal ── */}
      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2 className="section-title">מסמך חדש</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100"><X size={18} /></button>
            </div>
            <form onSubmit={save} className="modal-body space-y-4">
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
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-gradient-to-l from-violet-50 to-brand-50 px-4 py-3 text-[13px] font-semibold text-violet-700 transition-all hover:border-violet-300 hover:shadow-sm disabled:opacity-50"
              >
                {generating
                  ? <><Loader2 size={16} className="animate-spin" /> ה‑AI כותב את המסמך מתוך תיק המטופל…</>
                  : <><Sparkles size={16} /> יצירה אוטומטית עם AI מתוך היסטוריית הטיפולים</>}
              </button>
              {!form.patient_id && (
                <p className="-mt-2 text-center text-[11px] text-ink-400">בחרו מטופל כדי לאפשר יצירה עם AI</p>
              )}

              <div>
                <label className="label">כותרת</label>
                <input className="input" value={form.title} placeholder={DOC_TYPE_HE[form.type]} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="label">תוכן</label>
                <textarea rows={10} className="input resize-y leading-relaxed" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value, ai: false })} />
              </div>
              {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">{error}</div>}
            </form>
            <div className="modal-foot">
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost">ביטול</button>
              <button onClick={save} disabled={saving} className="btn-primary">{saving ? "שומר…" : "שמירה כטיוטה"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── View / sign modal ── */}
      {viewDoc && (
        <div className="overlay" onClick={closeView}>
          <div className="modal modal-lg flex max-h-[88vh] flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="modal-head">
              <div className="flex items-start gap-3 min-w-0">
                <DocIcon type={viewDoc.type} />
                <div className="min-w-0">
                  <h2 className="section-title truncate">{viewDoc.title}</h2>
                  <p className="mt-0.5 text-[12px] text-ink-400">
                    {DOC_TYPE_HE[viewDoc.type] ?? viewDoc.type}
                    {viewDoc.patients && (
                      <>
                        {" · "}
                        {viewDoc.patient_id ? (
                          <Link href={`/patients/${viewDoc.patient_id}`} className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">
                            {viewDoc.patients.first_name} {viewDoc.patients.last_name}
                            <ArrowUpLeft size={11} />
                          </Link>
                        ) : (
                          `${viewDoc.patients.first_name} ${viewDoc.patients.last_name}`
                        )}
                      </>
                    )}
                    {" · "}
                    {new Date(viewDoc.created_at).toLocaleDateString("he-IL")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => exportPDF(viewDoc)}
                  disabled={exporting !== null}
                  title="ייצוא PDF"
                  className="btn-ghost btn-sm gap-1.5"
                >
                  {exporting === "pdf" ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  PDF
                </button>
                <button
                  onClick={() => exportWord(viewDoc)}
                  disabled={exporting !== null}
                  title="ייצוא Word"
                  className="btn-ghost btn-sm gap-1.5"
                >
                  {exporting === "word" ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
                  Word
                </button>
                <button onClick={closeView} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100"><X size={18} /></button>
              </div>
            </div>

            {/* Content */}
            <div className="modal-body min-h-0 flex-1 overflow-y-auto">
              <div className="rounded-xl border border-line bg-slate-50 p-5 text-[13.5px] leading-relaxed text-ink-700 whitespace-pre-wrap min-h-[200px]">
                {viewDoc.content || <span className="text-ink-300">אין תוכן.</span>}
              </div>

              {/* Existing signature */}
              {viewDoc.signature_data && (
                <div className="mt-4 flex items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
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
                    <p className="text-[13px] font-semibold text-ink-700">חתימת {userName} — החתימה תנעל את המסמך כסופי:</p>
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
                    <button onClick={() => setSigning(true)} className="btn-primary gap-2">
                      <PenLine size={15} /> חתימה דיגיטלית וסיום
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
