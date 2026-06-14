"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Search, X, Upload, AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Patient } from "@/lib/types";

const KUPOT = ["כללית", "מכבי", "מאוחדת", "לאומית", "פרטי"];

export default function PatientsClient({
  clinicId, initialPatients, therapists, canDelete,
}: {
  clinicId: string;
  initialPatients: Patient[];
  therapists: { id: string; name: string }[];
  canDelete?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── bulk selection & delete ── */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.id)));
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase.from("patients").delete().in("id", Array.from(selected));
    setDeleting(false);
    if (error) {
      setDeleteError("המחיקה נכשלה: " + error.message);
      return;
    }
    setSelected(new Set());
    setConfirmDelete(false);
    router.refresh();
  }

  /* ── CSV import state ── */
  type CsvRow = Record<string, string>;
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [colMap, setColMap] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ inserted: number } | { error: string } | null>(null);
  const [form, setForm] = useState({
    first_name: "", last_name: "", national_id: "", phone: "", email: "",
    kupah: "כללית", diagnosis: "", dob: "", primary_therapist_id: "", bituach_leumi_case: false,
  });

  const filtered = useMemo(() => {
    const s = q.trim();
    if (!s) return initialPatients;
    return initialPatients.filter((p) =>
      `${p.first_name} ${p.last_name} ${p.national_id ?? ""} ${p.phone ?? ""}`.includes(s)
    );
  }, [q, initialPatients]);

  /* ── CSV helpers ── */
  function parseCSV(text: string): { headers: string[]; rows: CsvRow[] } {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return { headers: [], rows: [] };
    const split = (line: string) =>
      line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
    const headers = split(lines[0]);
    const rows = lines.slice(1).map((l) => {
      const vals = split(l);
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
    });
    return { headers, rows };
  }

  function guessColMap(headers: string[]): Record<string, string> {
    const lower = (s: string) => s.toLowerCase();
    const guess = (targets: string[]) =>
      headers.find((h) => targets.some((t) => lower(h).includes(t))) ?? "";
    return {
      first_name: guess(["first", "שם פרטי", "פרטי", "fname"]),
      last_name: guess(["last", "שם משפחה", "משפחה", "lname", "family"]),
      national_id: guess(["national", "ת.ז", "תז", "id", "מספר"]),
      phone: guess(["phone", "טלפון", "mobile", "cell"]),
      email: guess(["email", "אימייל", "מייל"]),
      dob: guess(["birth", "dob", "לידה", "תאריך"]),
      kupah: guess(["kupah", "קופה", "insur"]),
      diagnosis: guess(["diagno", "אבחנה", "diagnosis", "chief"]),
    };
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers, rows } = parseCSV(text);
      setCsvHeaders(headers);
      setCsvRows(rows);
      setColMap(guessColMap(headers));
      setImportResult(null);
    };
    reader.readAsText(file, "UTF-8");
  }

  async function runImport() {
    const patients = csvRows
      .filter((r) => (colMap.first_name ? r[colMap.first_name] : "") && (colMap.last_name ? r[colMap.last_name] : ""))
      .map((r) => ({
        first_name: colMap.first_name ? r[colMap.first_name] : "",
        last_name: colMap.last_name ? r[colMap.last_name] : "",
        national_id: colMap.national_id ? r[colMap.national_id] || null : null,
        phone: colMap.phone ? r[colMap.phone] || null : null,
        email: colMap.email ? r[colMap.email] || null : null,
        dob: colMap.dob ? r[colMap.dob] || null : null,
        kupah: colMap.kupah ? r[colMap.kupah] || null : null,
        diagnosis: colMap.diagnosis ? r[colMap.diagnosis] || null : null,
      }));
    if (!patients.length) return;
    setImporting(true);
    const res = await fetch("/api/patients/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patients }),
    });
    setImporting(false);
    const d = await res.json().catch(() => null);
    setImportResult(d);
    if (res.ok) router.refresh();
  }

  function closeImport() {
    setImportOpen(false);
    setCsvRows([]);
    setCsvHeaders([]);
    setColMap({});
    setImportResult(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await supabase.from("patients").insert({
      clinic_id: clinicId,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      national_id: form.national_id || null,
      phone: form.phone || null,
      email: form.email || null,
      kupah: form.kupah,
      diagnosis: form.diagnosis || null,
      dob: form.dob || null,
      primary_therapist_id: form.primary_therapist_id || null,
      bituach_leumi_case: form.bituach_leumi_case,
    });
    setSaving(false);
    if (error) return setError("שמירת המטופל נכשלה. בדקו את הפרטים ונסו שוב.");
    setOpen(false);
    setForm({ first_name: "", last_name: "", national_id: "", phone: "", email: "", kupah: "כללית", diagnosis: "", dob: "", primary_therapist_id: "", bituach_leumi_case: false });
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">מטופלים</h1>
          <p className="mt-1 text-sm text-slate-500">{initialPatients.length} מטופלים בקליניקה</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setImportOpen(true)} className="btn-ghost !border !border-line">
            <Upload size={16} /> ייבוא מ‑CRM
          </button>
          <button onClick={() => setOpen(true)} className="btn-primary">
            <Plus size={16} /> מטופל חדש
          </button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input pe-10" placeholder="חיפוש לפי שם, ת&Prime;ז או טלפון…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {/* Bulk action bar */}
      {canDelete && selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
          <span className="flex-1 text-sm font-semibold text-red-700">{selected.size} מטופלים נבחרו</span>
          <button onClick={() => setSelected(new Set())} className="text-xs text-red-500 hover:text-red-700">ביטול בחירה</button>
          <button
            onClick={() => { setDeleteError(null); setConfirmDelete(true); }}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            <Trash2 size={13} /> מחיקת {selected.size} מטופלים
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm text-slate-400">
            {initialPatients.length === 0 ? "אין עדיין מטופלים — הוסיפו את הראשון." : "לא נמצאו תוצאות לחיפוש."}
          </div>
        ) : (
          <table className="w-full text-start">
            <thead>
              <tr className="border-b border-line bg-slate-50 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                {canDelete && (
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onChange={toggleAll}
                    />
                  </th>
                )}
                <th className="px-5 py-3 text-start">שם</th>
                <th className="px-5 py-3 text-start">קופה</th>
                <th className="px-5 py-3 text-start">אבחנה</th>
                <th className="px-5 py-3 text-start">טלפון</th>
                <th className="px-5 py-3 text-start">סטטוס</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-[13.5px]">
              {filtered.map((p) => (
                <tr key={p.id} className={`transition-colors hover:bg-slate-50 ${selected.has(p.id) ? "bg-red-50/50" : ""}`}>
                  {canDelete && (
                    <td className="w-10 px-4 py-3.5">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
                        checked={selected.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                      />
                    </td>
                  )}
                  <td className="px-5 py-3.5">
                    <Link href={`/patients/${p.id}`} className="font-semibold text-slate-800 hover:text-brand">
                      {p.first_name} {p.last_name}
                    </Link>
                    {p.bituach_leumi_case && <span className="badge ms-2 bg-blue-50 text-blue-600">ביטוח לאומי</span>}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{p.kupah ?? "—"}</td>
                  <td className="max-w-[220px] truncate px-5 py-3.5 text-slate-600">{p.diagnosis ?? "—"}</td>
                  <td className="px-5 py-3.5 text-slate-600" dir="ltr">{p.phone ?? "—"}</td>
                  <td className="px-5 py-3.5">
                    <span className={`badge ${p.status === "active" ? "bg-emerald-50 text-emerald-600" : p.status === "on_hold" ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"}`}>
                      {p.status === "active" ? "פעיל" : p.status === "on_hold" ? "בהמתנה" : "שוחרר"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add patient modal */}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">מטופל חדש</h2>
              <button onClick={() => setOpen(false)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <form onSubmit={save} className="grid grid-cols-2 gap-4">
              <div><label className="label">שם פרטי *</label>
                <input required className="input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
              <div><label className="label">שם משפחה *</label>
                <input required className="input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
              <div><label className="label">ת&Prime;ז</label>
                <input dir="ltr" className="input" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} /></div>
              <div><label className="label">תאריך לידה</label>
                <input dir="ltr" type="date" className="input" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></div>
              <div><label className="label">טלפון</label>
                <input dir="ltr" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><label className="label">קופת חולים</label>
                <select className="input" value={form.kupah} onChange={(e) => setForm({ ...form, kupah: e.target.value })}>
                  {KUPOT.map((k) => <option key={k}>{k}</option>)}
                </select></div>
              <div className="col-span-2"><label className="label">אבחנה</label>
                <input className="input" placeholder="למשל: כאב כתף ימין, s/p ניתוח" value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} /></div>
              <div><label className="label">מטפל/ת אחראי/ת</label>
                <select className="input" value={form.primary_therapist_id} onChange={(e) => setForm({ ...form, primary_therapist_id: e.target.value })}>
                  <option value="">ללא</option>
                  {therapists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select></div>
              <label className="col-span-2 flex items-center gap-2.5 text-sm text-slate-700 sm:col-span-1 sm:self-end sm:pb-2.5">
                <input type="checkbox" className="h-4 w-4 rounded border-line text-brand focus:ring-brand/30"
                       checked={form.bituach_leumi_case} onChange={(e) => setForm({ ...form, bituach_leumi_case: e.target.checked })} />
                תיק ביטוח לאומי
              </label>

              {error && <div className="col-span-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">{error}</div>}

              <div className="col-span-2 mt-1 flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost">ביטול</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? "שומר…" : "שמירת מטופל"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => !deleting && setConfirmDelete(false)}>
          <div className="card w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-100">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">מחיקת {selected.size} מטופלים</h2>
                <p className="mt-0.5 text-[13px] text-slate-500">פעולה זו אינה הפיכה</p>
              </div>
            </div>
            <p className="mb-5 text-[13px] leading-relaxed text-slate-600">
              כל הטיפולים, המדידות והפגישות של המטופלים הנבחרים יימחקו לצמיתות.
              מסמכים שנוצרו יישארו קיימים ללא שיוך.
            </p>
            {deleteError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">{deleteError}</div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)} disabled={deleting} className="btn-ghost">ביטול</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? "מוחק…" : `מחיקת ${selected.size} מטופלים`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CSV Import modal ── */}
      {importOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={closeImport}>
          <div className="card flex max-h-[88vh] w-full max-w-3xl flex-col p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">ייבוא מטופלים מ‑CRM</h2>
                <p className="mt-0.5 text-xs text-slate-500">העלו קובץ CSV מהמערכת הקיימת — המערכת תזהה את השדות אוטומטית</p>
              </div>
              <button onClick={closeImport} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>

            {importResult && "inserted" in importResult ? (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <CheckCircle2 size={48} className="text-emerald-500" />
                <div>
                  <div className="text-xl font-bold text-slate-900">הייבוא הצליח!</div>
                  <div className="mt-1 text-sm text-slate-500">{importResult.inserted} מטופלים נוספו לקליניקה.</div>
                </div>
                <button onClick={closeImport} className="btn-primary mt-2">סגירה</button>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto space-y-5">
                {/* File upload */}
                <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 px-6 py-8 transition-colors hover:border-brand hover:bg-brand-50/30">
                  <Upload size={28} className="text-slate-400" />
                  <div className="text-center">
                    <div className="text-[13.5px] font-semibold text-slate-700">לחצו לבחירת קובץ CSV</div>
                    <div className="mt-0.5 text-[11.5px] text-slate-400">ייצאו את רשימת המטופלים מהמערכת הקיימת, שמרו כ‑CSV ותעלו כאן</div>
                  </div>
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
                </label>

                {importResult && "error" in importResult && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                    <AlertCircle size={15} className="mt-0.5 shrink-0" /> {importResult.error}
                  </div>
                )}

                {csvRows.length > 0 && (
                  <>
                    <div>
                      <h3 className="mb-3 text-[12px] font-bold uppercase tracking-wider text-slate-500">מיפוי עמודות</h3>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {(["first_name", "last_name", "national_id", "phone", "email", "dob", "kupah", "diagnosis"] as const).map((field) => {
                          const labels: Record<string, string> = {
                            first_name: "שם פרטי *", last_name: "שם משפחה *",
                            national_id: "ת.ז", phone: "טלפון", email: "אימייל",
                            dob: "תאריך לידה", kupah: "קופה", diagnosis: "אבחנה",
                          };
                          return (
                            <div key={field}>
                              <label className="label">{labels[field]}</label>
                              <select
                                className="input"
                                value={colMap[field] ?? ""}
                                onChange={(e) => setColMap({ ...colMap, [field]: e.target.value })}
                              >
                                <option value="">— לא ממופה —</option>
                                {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Preview */}
                    <div>
                      <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-slate-500">
                        תצוגה מקדימה — {csvRows.length} שורות
                      </h3>
                      <div className="max-h-48 overflow-auto rounded-lg border border-line">
                        <table className="w-full text-[11.5px]">
                          <thead className="sticky top-0 bg-slate-50 text-[11px] font-semibold text-slate-500">
                            <tr>
                              <th className="px-3 py-2 text-right">שם פרטי</th>
                              <th className="px-3 py-2 text-right">שם משפחה</th>
                              <th className="px-3 py-2 text-right">ת.ז</th>
                              <th className="px-3 py-2 text-right">טלפון</th>
                              <th className="px-3 py-2 text-right">אבחנה</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {csvRows.slice(0, 10).map((row, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                <td className="px-3 py-1.5">{colMap.first_name ? row[colMap.first_name] : "—"}</td>
                                <td className="px-3 py-1.5">{colMap.last_name ? row[colMap.last_name] : "—"}</td>
                                <td className="px-3 py-1.5 font-mono">{colMap.national_id ? row[colMap.national_id] || "—" : "—"}</td>
                                <td className="px-3 py-1.5 font-mono">{colMap.phone ? row[colMap.phone] || "—" : "—"}</td>
                                <td className="max-w-[140px] truncate px-3 py-1.5 text-slate-500">{colMap.diagnosis ? row[colMap.diagnosis] || "—" : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {csvRows.length > 10 && (
                          <div className="border-t border-line px-3 py-2 text-center text-[11px] text-slate-400">
                            ו‑{csvRows.length - 10} שורות נוספות…
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pb-1">
                      <button onClick={closeImport} className="btn-ghost">ביטול</button>
                      <button
                        onClick={runImport}
                        disabled={importing || !colMap.first_name || !colMap.last_name}
                        className="btn-primary"
                      >
                        {importing
                          ? "מייבא…"
                          : `ייבוא ${csvRows.filter((r) => colMap.first_name ? r[colMap.first_name] : false).length} מטופלים`}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
