import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Activity, Clock, BarChart2, Ruler, Printer, FileText, ExternalLink, IdCard, Phone, Stethoscope, Building2, TrendingUp, PieChart, FolderOpen, Files } from "lucide-react";
import { DOC_TYPE_HE, TREATMENT_TYPE_HE } from "@/lib/types";
import { getClinicTemplate } from "@/lib/clinic-template-server";
import { getHomeProgramConfig } from "@/lib/clinic-templates";
import { Donut } from "@/components/charts";
import { BackLink } from "@/components/PageHeader";
import TreatmentForm from "./TreatmentForm";
import VasChart from "./VasChart";
import RomChart from "./RomChart";
import PromChart from "./PromChart";
import HepPanel from "./HepPanel";
import InvoicesPanel from "./InvoicesPanel";
import CopilotPanel from "./CopilotPanel";
import EditPatientButton from "./EditPatientButton";

export const dynamic = "force-dynamic";

export default async function PatientPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: patient } = await supabase.from("patients").select("*").eq("id", params.id).single();
  if (!patient) notFound();

  const { data: therapistRows } = await supabase
    .from("clinic_members")
    .select("user_id, profiles(full_name)")
    .eq("clinic_id", patient.clinic_id)
    .eq("status", "active");
  const therapists = (therapistRows ?? []).map((m) => ({
    id: m.user_id,
    name: (m.profiles as unknown as { full_name: string } | null)?.full_name ?? "—",
  }));

  const [{ data: treatments }, { data: docs }, { data: measurements }, { data: rawPrograms }, { data: invoices }, template, { data: copilotCache }] = await Promise.all([
    supabase.from("treatments")
      .select("*, profiles:therapist_id(full_name)")
      .eq("patient_id", patient.id).order("treated_at", { ascending: false }),
    supabase.from("documents").select("*").eq("patient_id", patient.id).order("created_at", { ascending: false }),
    supabase.from("measurements").select("*").eq("patient_id", patient.id).order("recorded_at", { ascending: true }),
    supabase.from("exercise_programs")
      .select("id, title, instructions, active, program_items(id, name, sets, reps, hold_sec, frequency, video_url, description, sort_order), hep_logs(logged_at, completed, pain_score)")
      .eq("patient_id", patient.id).eq("active", true).order("created_at", { ascending: false }),
    supabase.from("patient_invoices").select("*").eq("patient_id", patient.id).order("created_at", { ascending: false }),
    getClinicTemplate(supabase, patient.clinic_id),
    supabase.from("copilot_insights").select("flags, suggestions, generated_at, treatment_count").eq("patient_id", patient.id).maybeSingle(),
  ]);

  // Shape HEP programs: sort items, attach the latest log.
  const programs = (rawPrograms ?? []).map((p: any) => ({
    id: p.id,
    title: p.title,
    instructions: p.instructions,
    active: p.active,
    program_items: (p.program_items ?? []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    lastLog: (p.hep_logs ?? []).sort((a: any, b: any) => +new Date(b.logged_at) - +new Date(a.logged_at))[0] ?? null,
  }));

  // Home program (HEP) is only relevant to some professions.
  const homeProgram = getHomeProgramConfig(template.profession);

  // Most recent treatment's plan text — seeds AI HEP generation.
  const latest: any = treatments?.[0];
  const lastPlan = latest?.plan
    || (latest?.note?.sections ?? []).map((s: any) => s.content).filter(Boolean).join(" ")
    || "";

  const vasSeries = (treatments ?? [])
    .filter((t) => t.vas !== null)
    .map((t) => ({ date: t.treated_at, value: t.vas as number }))
    .reverse();

  // Group PROM measurements by scale_label for separate charts
  const promByScale = new Map<string, { date: string; value: number }[]>();
  for (const m of (measurements ?? []).filter((m) => m.kind === "PROM")) {
    const label = (m as any).scale_label ?? "PROM";
    if (!promByScale.has(label)) promByScale.set(label, []);
    promByScale.get(label)!.push({ date: m.recorded_at, value: Number(m.value) });
  }

  const copilotInsights = copilotCache
    ? { ...copilotCache, cached: true }
    : null;

  const age = patient.dob ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / 3.15576e10) : null;

  // KPI calculations
  const totalTreatments = treatments?.length ?? 0;
  const lastTreatment = treatments?.[0]?.treated_at ?? null;
  const daysSinceLast = lastTreatment
    ? Math.floor((Date.now() - new Date(lastTreatment).getTime()) / 864e5)
    : null;

  const vasValues = template.has_scale
    ? (treatments ?? []).filter((t) => t.vas !== null).map((t) => t.vas as number)
    : [];
  const avgVas = vasValues.length
    ? Math.round((vasValues.reduce((a, b) => a + b, 0) / vasValues.length) * 10) / 10
    : null;

  const totalMeasurements = measurements?.length ?? 0;

  // Treatment type donut
  const typeDonut = (() => {
    const c = new Map<string, number>();
    (treatments ?? []).forEach((t) => c.set(t.type, (c.get(t.type) ?? 0) + 1));
    return Array.from(c.entries()).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ label: TREATMENT_TYPE_HE[k] ?? k, value: v }));
  })();

  const kpis = [
    {
      icon: Activity,
      value: totalTreatments,
      label: "סה״כ טיפולים",
      tint: "bg-brand-50 text-brand",
      ring: "ring-brand-100",
    },
    {
      icon: Clock,
      value: daysSinceLast === null ? "—" : daysSinceLast === 0 ? "היום" : daysSinceLast,
      label: "ימים מאז הטיפול האחרון",
      tint: "bg-amber-50 text-amber-600",
      ring: "ring-amber-100",
    },
    {
      icon: BarChart2,
      value: template.has_scale && avgVas !== null ? avgVas : "—",
      label: template.has_scale ? `ממוצע ${template.scale_label}` : "מדד תוצאה",
      tint: "bg-emerald-50 text-emerald-600",
      ring: "ring-emerald-100",
    },
    {
      icon: Ruler,
      value: totalMeasurements,
      label: "מדידות (ROM)",
      tint: "bg-accent-50 text-accent-600",
      ring: "ring-accent-100",
    },
  ];

  const statusMeta: Record<string, { he: string; badge: string; dot: string }> = {
    active:     { he: "פעיל",   badge: "badge-green", dot: "bg-emerald-500" },
    on_hold:    { he: "בהמתנה", badge: "badge-amber", dot: "bg-amber-500" },
    discharged: { he: "שוחרר",  badge: "badge-gray",  dot: "bg-ink-300" },
  };
  const status = statusMeta[patient.status] ?? statusMeta.active;

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      <BackLink href="/patients" label="כל המטופלים" />

      {/* Patient header */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-start gap-5 p-6">
          <span className="avatar h-16 w-16 text-2xl shadow-glow">
            {patient.first_name.charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="page-title">{patient.first_name} {patient.last_name}</h1>
              <span className={`badge ${status.badge}`}>
                <span className={`dot ${status.dot}`} /> {status.he}
              </span>
              {patient.bituach_leumi_case && <span className="badge badge-accent">ביטוח לאומי</span>}
            </div>
            {/* Key facts as chips */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {age !== null && (
                <span className="chip">גיל {age}</span>
              )}
              {patient.kupah && (
                <span className="chip"><Building2 size={13} className="text-ink-400" /> {patient.kupah}</span>
              )}
              {patient.national_id && (
                <span className="chip"><IdCard size={13} className="text-ink-400" /> <span dir="ltr">{patient.national_id}</span></span>
              )}
              {patient.phone && (
                <span className="chip"><Phone size={13} className="text-ink-400" /> <span dir="ltr">{patient.phone}</span></span>
              )}
              {patient.diagnosis && (
                <span className="chip"><Stethoscope size={13} className="text-ink-400" /> {patient.diagnosis}</span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <EditPatientButton patient={patient} therapists={therapists} />
            <a
              href={`/api/reports/referrer?patient_id=${patient.id}&type=referrer&print=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost btn-sm"
              title="ייצא דוח תוצאות לגורם המפנה"
            >
              <FileText size={14} /> דוח גורם מפנה
            </a>
            {patient.bituach_leumi_case && (
              <a
                href={`/api/reports/referrer?patient_id=${patient.id}&type=bituach_leumi&print=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-sm inline-flex items-center justify-center gap-2 rounded-lg border border-accent-200 bg-accent-50 font-semibold text-accent-700 transition-colors hover:bg-accent-100"
                title="ייצא דוח ביטוח לאומי"
              >
                <ExternalLink size={13} /> ביטוח לאומי
              </a>
            )}
          </div>
        </div>

        {/* KPI strip — inset into the header card */}
        <div className="grid grid-cols-2 divide-line border-t border-line sm:grid-cols-4 sm:divide-x sm:divide-x-reverse">
          {kpis.map((k) => (
            <div key={k.label} className="flex items-center gap-3 px-5 py-4">
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ${k.tint} ${k.ring}`}>
                <k.icon size={18} />
              </div>
              <div className="min-w-0">
                <div className="stat-number">{k.value}</div>
                <div className="mt-0.5 truncate text-[12px] text-ink-500">{k.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Treatments */}
        <div className="space-y-6 lg:col-span-2">
          <TreatmentForm patientId={patient.id} template={template} />

          <div className="card overflow-hidden">
            <div className="card-head">
              <h2 className="section-title flex items-center gap-2">
                <Activity size={15} className="text-brand" /> היסטוריית טיפולים
              </h2>
              <span className="badge badge-gray">{treatments?.length ?? 0}</span>
            </div>
            {(treatments?.length ?? 0) === 0 ? (
              <div className="empty">
                <div className="empty-icon"><Activity size={24} /></div>
                <div className="text-sm text-ink-500">אין עדיין טיפולים מתועדים למטופל זה.</div>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {treatments!.map((t: any) => (
                  <li key={t.id} className="px-5 py-4 transition-colors hover:bg-surface-2">
                    <div className="mb-2 flex items-center gap-2.5">
                      <span className="badge badge-brand">{TREATMENT_TYPE_HE[t.type] ?? t.type}</span>
                      {t.vas !== null && template.has_scale && (
                        <span className={`badge ${t.vas >= 7 ? "badge-red" : t.vas >= 4 ? "badge-amber" : "badge-green"}`}>
                          {template.scale_label} {t.vas}
                        </span>
                      )}
                      <span className="ms-auto text-xs text-ink-400">
                        {new Date(t.treated_at).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" })}
                        {t.profiles?.full_name ? ` · ${t.profiles.full_name}` : ""}
                      </span>
                    </div>
                    {(t.note?.sections?.length || t.subjective || t.assessment || t.plan) && (
                      <div className="space-y-1 text-[13px] leading-relaxed text-ink-600">
                        {t.note?.sections?.length
                          ? t.note.sections.map((s: any) => (
                              <p key={s.key}>
                                <span className="font-semibold text-ink-800">{s.letter}:</span> {s.content}
                              </p>
                            ))
                          : (
                            <>
                              {t.subjective && <p><span className="font-semibold text-ink-800">S:</span> {t.subjective}</p>}
                              {t.objective && <p><span className="font-semibold text-ink-800">O:</span> {t.objective}</p>}
                              {t.assessment && <p><span className="font-semibold text-ink-800">A:</span> {t.assessment}</p>}
                              {t.plan && <p><span className="font-semibold text-ink-800">P:</span> {t.plan}</p>}
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
          {/* Outcome scale trend */}
          {template.has_scale && vasSeries.length >= 2 && (
            <div className="card overflow-hidden">
              <div className="card-head">
                <h2 className="section-title flex items-center gap-2">
                  <TrendingUp size={15} className="text-accent-600" /> {template.scale_label} — מגמה
                </h2>
              </div>
              <div className="card-body">
                <VasChart
                  data={vasSeries}
                  scaleLabel={template.scale_label}
                  improvementLower={template.scale_improvement_lower}
                />
              </div>
            </div>
          )}

          {/* ROM progression */}
          {(measurements ?? []).some((m) => m.kind === "ROM") && (
            <div className="card overflow-hidden">
              <div className="card-head">
                <h2 className="section-title flex items-center gap-2">
                  <Ruler size={15} className="text-accent-600" /> טווח תנועה (ROM)
                </h2>
              </div>
              <div className="card-body">
                <RomChart measurements={measurements ?? []} />
              </div>
            </div>
          )}

          {/* PROM trends — one card per scale */}
          {Array.from(promByScale.entries()).map(([label, series]) =>
            series.length >= 2 ? (
              <div key={label} className="card overflow-hidden">
                <div className="card-head">
                  <h2 className="section-title flex items-center gap-2">
                    <TrendingUp size={15} className="text-accent-600" /> {label} — מגמה
                  </h2>
                </div>
                <div className="card-body">
                  <PromChart data={series} scaleLabel={label} improvementLower={false} />
                </div>
              </div>
            ) : null
          )}

          {/* Treatment type distribution */}
          {typeDonut.length >= 2 && (
            <div className="card overflow-hidden">
              <div className="card-head">
                <h2 className="section-title flex items-center gap-2">
                  <PieChart size={15} className="text-brand" /> התפלגות סוגי טיפול
                </h2>
              </div>
              <div className="card-body">
                <Donut data={typeDonut} />
              </div>
            </div>
          )}

          {/* Home program (HEP) — only for professions where it's relevant */}
          {homeProgram && (
            <HepPanel
              patientId={patient.id}
              clinicId={patient.clinic_id}
              patientFirstName={patient.first_name}
              lastPlan={lastPlan}
              programs={programs}
              config={homeProgram}
            />
          )}

          {/* AI Clinical Co-pilot */}
          <CopilotPanel patientId={patient.id} initialInsights={copilotInsights} />

          {/* Patient invoices */}
          <InvoicesPanel
            patientId={patient.id}
            clinicId={patient.clinic_id}
            patientFirstName={patient.first_name}
            invoices={invoices ?? []}
          />

          {/* Documents */}
          <div className="card overflow-hidden">
            <div className="card-head">
              <h2 className="section-title flex items-center gap-2">
                <Files size={15} className="text-ink-500" /> מסמכים
              </h2>
              {(docs?.length ?? 0) > 0 && <span className="badge badge-gray">{docs!.length}</span>}
            </div>
            {(docs?.length ?? 0) === 0 ? (
              <div className="empty">
                <div className="empty-icon"><FolderOpen size={24} /></div>
                <div className="text-[13px] text-ink-500">אין מסמכים למטופל זה.</div>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {docs!.map((d) => (
                  <li key={d.id}>
                    <a
                      href={`/api/documents/export?id=${d.id}&format=pdf-html&print=1`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2"
                      title="פתיחת מסמך להדפסה / PDF"
                    >
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-3 text-ink-500 transition-colors group-hover:bg-brand-50 group-hover:text-brand">
                        <FileText size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[13px] font-semibold text-ink-800 group-hover:text-brand">{d.title}</span>
                          <Printer size={12} className="shrink-0 text-ink-400 transition-colors group-hover:text-brand" />
                        </div>
                        <div className="text-xs text-ink-400">{DOC_TYPE_HE[d.type] ?? d.type}</div>
                      </div>
                      <span className={`badge ${d.status === "final" ? "badge-green" : "badge-amber"}`}>
                        {d.status === "final" ? "סופי" : "טיוטה"}
                      </span>
                    </a>
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
