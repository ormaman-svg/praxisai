import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArrowRight } from "lucide-react";
import { DOC_TYPE_HE, TREATMENT_TYPE_HE } from "@/lib/types";
import { getClinicTemplate } from "@/lib/clinic-template-server";
import TreatmentForm from "./TreatmentForm";
import VasChart from "./VasChart";

export const dynamic = "force-dynamic";

export default async function PatientPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: patient } = await supabase.from("patients").select("*").eq("id", params.id).single();
  if (!patient) notFound();

  const [{ data: treatments }, { data: docs }, template] = await Promise.all([
    supabase.from("treatments")
      .select("*, profiles:therapist_id(full_name)")
      .eq("patient_id", patient.id).order("treated_at", { ascending: false }),
    supabase.from("documents").select("*").eq("patient_id", patient.id).order("created_at", { ascending: false }),
    getClinicTemplate(supabase, patient.clinic_id),
  ]);

  const vasSeries = (treatments ?? [])
    .filter((t) => t.vas !== null)
    .map((t) => ({ date: t.treated_at, value: t.vas as number }))
    .reverse();

  const age = patient.dob ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / 3.15576e10) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/patients" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 hover:text-brand">
        <ArrowRight size={15} /> כל המטופלים
      </Link>

      {/* Header card */}
      <div className="card flex flex-wrap items-center gap-5 p-6">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-xl font-bold text-brand">
          {patient.first_name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-slate-900">
            {patient.first_name} {patient.last_name}
            {patient.bituach_leumi_case && <span className="badge ms-2 bg-blue-50 text-blue-600 align-middle">ביטוח לאומי</span>}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {[age ? `גיל ${age}` : null, patient.kupah, patient.diagnosis].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <div className="text-sm text-slate-500" dir="ltr">{patient.phone ?? ""}</div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Treatments */}
        <div className="space-y-6 lg:col-span-2">
          <TreatmentForm patientId={patient.id} template={template} />

          <div className="card">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-sm font-bold text-slate-900">היסטוריית טיפולים ({treatments?.length ?? 0})</h2>
            </div>
            {(treatments?.length ?? 0) === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-400">אין עדיין טיפולים מתועדים למטופל זה.</div>
            ) : (
              <ul className="divide-y divide-line">
                {treatments!.map((t: any) => (
                  <li key={t.id} className="px-5 py-4">
                    <div className="mb-1.5 flex items-center gap-2.5">
                      <span className="badge bg-brand-50 text-brand">{TREATMENT_TYPE_HE[t.type] ?? t.type}</span>
                      {t.vas !== null && (
                        <span className={`badge ${t.vas >= 7 ? "bg-red-50 text-red-600" : t.vas >= 4 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}>VAS {t.vas}</span>
                      )}
                      <span className="ms-auto text-xs text-slate-400">
                        {new Date(t.treated_at).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" })}
                        {t.profiles?.full_name ? ` · ${t.profiles.full_name}` : ""}
                      </span>
                    </div>
                    {(t.note?.sections?.length || t.subjective || t.assessment || t.plan) && (
                      <div className="space-y-1 text-[13px] leading-relaxed text-slate-600">
                        {t.note?.sections?.length
                          ? t.note.sections.map((s: any) => (
                              <p key={s.key}>
                                <span className="font-semibold text-slate-700">{s.letter}:</span> {s.content}
                              </p>
                            ))
                          : (
                            <>
                              {t.subjective && <p><span className="font-semibold text-slate-700">S:</span> {t.subjective}</p>}
                              {t.objective && <p><span className="font-semibold text-slate-700">O:</span> {t.objective}</p>}
                              {t.assessment && <p><span className="font-semibold text-slate-700">A:</span> {t.assessment}</p>}
                              {t.plan && <p><span className="font-semibold text-slate-700">P:</span> {t.plan}</p>}
                            </>
                          )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Side column */}
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-bold text-slate-900">מגמת כאב (VAS)</h2>
            {vasSeries.length < 2 ? (
              <p className="text-[13px] text-slate-400">נדרשים לפחות שני טיפולים עם מדד VAS כדי להציג מגמה.</p>
            ) : (
              <VasChart data={vasSeries} />
            )}
          </div>

          <div className="card">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-sm font-bold text-slate-900">מסמכים</h2>
            </div>
            {(docs?.length ?? 0) === 0 ? (
              <div className="px-5 py-8 text-center text-[13px] text-slate-400">אין מסמכים למטופל זה.</div>
            ) : (
              <ul className="divide-y divide-line">
                {docs!.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-slate-800">{d.title}</div>
                      <div className="text-xs text-slate-400">{DOC_TYPE_HE[d.type] ?? d.type}</div>
                    </div>
                    <span className={`badge ${d.status === "final" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                      {d.status === "final" ? "סופי" : "טיוטה"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
