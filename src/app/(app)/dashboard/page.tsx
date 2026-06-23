import { createClient } from "@/lib/supabase/server";
import { getActiveClinicId } from "@/lib/clinic";
import { Users, Activity, FileText, UserPlus, ArrowLeft, Mic, CalendarDays, Plus } from "lucide-react";
import Link from "next/link";
import { TREATMENT_TYPE_HE } from "@/lib/types";

export const dynamic = "force-dynamic";

function greeting(): string {
  // Israel time-of-day greeting
  const h = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Jerusalem" }).format(new Date())
  );
  if (h < 12) return "בוקר טוב";
  if (h < 17) return "צהריים טובים";
  if (h < 21) return "ערב טוב";
  return "לילה טוב";
}

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // resolve active clinic (cookie → fallback to first membership)
  let clinicId = getActiveClinicId();
  if (!clinicId) {
    const { data: m } = await supabase
      .from("clinic_members").select("clinic_id").eq("user_id", user!.id).eq("status", "active").limit(1).single();
    clinicId = m?.clinic_id ?? null;
  }
  if (!clinicId) return null;

  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();

  const [profile, patients, treatmentsWeek, docsDraft, members, recent] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user!.id).single(),
    supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("status", "active"),
    supabase.from("treatments").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).gte("treated_at", weekAgo),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("status", "draft"),
    supabase.from("clinic_members").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("status", "active"),
    supabase.from("treatments")
      .select("id, treated_at, type, vas, patient_id, patients(first_name,last_name), profiles:therapist_id(full_name)")
      .eq("clinic_id", clinicId).order("treated_at", { ascending: false }).limit(6),
  ]);

  const firstName = (profile.data?.full_name ?? "").trim().split(" ")[0];

  const stats = [
    { label: "מטופלים פעילים", value: patients.count ?? 0, icon: Users, tint: "bg-brand-50 text-brand", ring: "ring-brand-100", href: "/patients" },
    { label: "טיפולים השבוע", value: treatmentsWeek.count ?? 0, icon: Activity, tint: "bg-emerald-50 text-emerald-600", ring: "ring-emerald-100", href: "/analytics" },
    { label: "מסמכים בטיוטה", value: docsDraft.count ?? 0, icon: FileText, tint: "bg-amber-50 text-amber-600", ring: "ring-amber-100", href: "/documents" },
    { label: "חברי צוות", value: members.count ?? 0, icon: UserPlus, tint: "bg-violet-50 text-violet-600", ring: "ring-violet-100", href: "/admin/users" },
  ];

  const actions = [
    { label: "מטופל חדש", desc: "פתיחת תיק", icon: Plus, href: "/patients" },
    { label: "תיעוד טיפול", desc: "הקלטה עם AI", icon: Mic, href: "/scribe" },
    { label: "יומן תורים", desc: "הצגת השבוע", icon: CalendarDays, href: "/schedule" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-7 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">
            {greeting()}{firstName ? <span className="text-gradient">, {firstName}</span> : ""} 👋
          </h1>
          <p className="page-subtitle">תמונת מצב של הקליניקה — נתונים חיים מהמערכת.</p>
        </div>
        <Link href="/scribe" className="btn-primary">
          <Mic size={16} /> תיעוד טיפול חדש
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, tint, ring, href }) => (
          <Link key={label} href={href} className="card card-hover group p-5">
            <div className={`mb-3.5 grid h-10 w-10 place-items-center rounded-xl ring-1 ${tint} ${ring}`}>
              <Icon size={19} />
            </div>
            <div className="text-[28px] font-bold leading-none tracking-tight text-ink-900">{value}</div>
            <div className="mt-1.5 flex items-center gap-1 text-[13px] text-ink-500">
              {label}
              <ArrowLeft size={13} className="opacity-0 -translate-x-1 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-hover:text-brand" />
            </div>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {actions.map(({ label, desc, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="card card-hover group flex items-center gap-3.5 p-4"
          >
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-glow transition-transform duration-200 group-hover:scale-105">
              <Icon size={19} />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-bold text-ink-900">{label}</div>
              <div className="text-[12px] text-ink-500">{desc}</div>
            </div>
            <ArrowLeft size={16} className="ms-auto text-ink-300 transition-all duration-200 group-hover:-translate-x-0.5 group-hover:text-brand" />
          </Link>
        ))}
      </div>

      {/* Recent treatments */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="section-title">טיפולים אחרונים</h2>
          <Link href="/patients" className="group inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:text-brand-700">
            לכל המטופלים
            <ArrowLeft size={14} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
          </Link>
        </div>
        {(recent.data?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand">
              <Activity size={22} />
            </div>
            <div className="text-sm text-ink-500">אין עדיין טיפולים מתועדים.</div>
            <Link href="/patients" className="btn-ghost btn-sm">הוספת מטופל ראשון</Link>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {recent.data!.map((t: any) => (
              <li key={t.id} className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-2">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-100 to-violet-100 text-xs font-bold text-brand-700">
                  {t.patients?.first_name?.charAt(0) ?? "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-ink-800">
                    {t.patient_id ? (
                      <Link href={`/patients/${t.patient_id}`} className="hover:text-brand">
                        {t.patients ? `${t.patients.first_name} ${t.patients.last_name}` : "מטופל"}
                      </Link>
                    ) : (
                      t.patients ? `${t.patients.first_name} ${t.patients.last_name}` : "מטופל"
                    )}
                  </div>
                  <div className="text-xs text-ink-500">
                    {TREATMENT_TYPE_HE[t.type] ?? t.type}
                    {t.profiles?.full_name ? ` · ${t.profiles.full_name}` : ""}
                  </div>
                </div>
                {t.vas !== null && (
                  <span className={`badge ${t.vas >= 7 ? "bg-red-50 text-red-600" : t.vas >= 4 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}>
                    VAS {t.vas}
                  </span>
                )}
                <time className="w-16 text-end text-xs text-ink-400">
                  {new Date(t.treated_at).toLocaleDateString("he-IL", { day: "numeric", month: "short" })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
