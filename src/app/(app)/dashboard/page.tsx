import { createClient } from "@/lib/supabase/server";
import { getActiveClinicId } from "@/lib/clinic";
import {
  Users, Activity, FileText, UserPlus, ArrowUpRight, Mic,
  CalendarDays, Plus, TrendingUp, Clock, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { TREATMENT_TYPE_HE } from "@/lib/types";
import DashboardCharts from "./DashboardCharts";

export const dynamic = "force-dynamic";

function greeting(): string {
  const h = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric", hour12: false, timeZone: "Asia/Jerusalem",
    }).format(new Date())
  );
  if (h < 5)  return "לילה טוב";
  if (h < 12) return "בוקר טוב";
  if (h < 17) return "צהריים טובים";
  if (h < 21) return "ערב טוב";
  return "לילה טוב";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let clinicId = getActiveClinicId();
  if (!clinicId) {
    const { data: m } = await supabase
      .from("clinic_members").select("clinic_id")
      .eq("user_id", user!.id).eq("status", "active").limit(1).single();
    clinicId = m?.clinic_id ?? null;
  }
  if (!clinicId) return null;

  const now = new Date();
  const weekAgo       = new Date(now.getTime() -  7 * 86400000).toISOString();
  const monthAgo      = new Date(now.getTime() - 30 * 86400000).toISOString();
  const prevWeekStart = new Date(now.getTime() - 14 * 86400000).toISOString();

  const [
    profile, patients, treatmentsWeek, treatmentsPrevWeek,
    docsDraft, members, recent, treatmentsMonth,
  ] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user!.id).single(),
    supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("status", "active"),
    supabase.from("treatments").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).gte("treated_at", weekAgo),
    supabase.from("treatments").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId)
      .gte("treated_at", prevWeekStart).lt("treated_at", weekAgo),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("status", "draft"),
    supabase.from("clinic_members").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("status", "active"),
    supabase.from("treatments")
      .select("id, treated_at, type, vas, patient_id, patients(first_name,last_name), profiles:therapist_id(full_name)")
      .eq("clinic_id", clinicId).order("treated_at", { ascending: false }).limit(8),
    supabase.from("treatments")
      .select("treated_at, type")
      .eq("clinic_id", clinicId)
      .gte("treated_at", monthAgo)
      .order("treated_at", { ascending: true }),
  ]);

  const firstName = (profile.data?.full_name ?? "").trim().split(" ")[0];

  const weekCount = treatmentsWeek.count ?? 0;
  const prevWeekCount = treatmentsPrevWeek.count ?? 0;
  const weekDelta = prevWeekCount > 0
    ? Math.round(((weekCount - prevWeekCount) / prevWeekCount) * 100)
    : null;

  // 30-day daily chart
  const dailyMap: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    dailyMap[d.toISOString().slice(0, 10)] = 0;
  }
  (treatmentsMonth.data ?? []).forEach((t: any) => {
    const k = t.treated_at.slice(0, 10);
    if (k in dailyMap) dailyMap[k]++;
  });
  const chartData = Object.entries(dailyMap).map(([date, count]) => ({
    date,
    label: new Date(date).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" }),
    count,
  }));

  // Treatment type breakdown
  const typeMap: Record<string, number> = {};
  (treatmentsMonth.data ?? []).forEach((t: any) => {
    const label = TREATMENT_TYPE_HE[t.type] ?? t.type ?? "אחר";
    typeMap[label] = (typeMap[label] ?? 0) + 1;
  });
  const typeData = Object.entries(typeMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));

  const stats = [
    { label: "מטופלים פעילים", value: patients.count ?? 0,    icon: Users,    color: "bg-brand-50 text-brand-700",     href: "/patients",   trend: null },
    { label: "טיפולים השבוע",  value: weekCount,              icon: Activity, color: "bg-electric-50 text-electric-700",href: "/analytics",  trend: weekDelta },
    { label: "מסמכים בטיוטה",  value: docsDraft.count ?? 0,  icon: FileText, color: "bg-amber-50 text-amber-600",      href: "/documents",  trend: null },
    { label: "חברי צוות",      value: members.count ?? 0,     icon: UserPlus, color: "bg-violet-50 text-violet-600",    href: "/admin/users",trend: null },
  ];

  const actions = [
    { label: "מטופל חדש",   desc: "פתיחת תיק",        icon: Plus,         href: "/patients",  color: "bg-brand-50 text-brand-600" },
    { label: "תיעוד AI",    desc: "הקלטה + SOAP",      icon: Mic,          href: "/scribe",    color: "bg-electric-50 text-electric-600" },
    { label: "יומן תורים", desc: "תצוגת השבוע",       icon: CalendarDays, href: "/schedule",  color: "bg-violet-50 text-violet-600" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-slide-up">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">לוח בקרה</p>
          <h1 className="page-title">
            {greeting()}{firstName ? (
              <>, <span className="text-gradient">{firstName}</span></>
            ) : ""}
          </h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString("he-IL", {
              weekday: "long", day: "numeric", month: "long",
            })}
          </p>
        </div>
        <Link href="/scribe" className="btn-primary">
          <Mic size={16} /> תיעוד טיפול חדש
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color, href, trend }) => (
          <Link key={label} href={href} className="card card-hover group block p-5">
            <div className="flex items-start justify-between">
              <div className={`grid h-10 w-10 place-items-center rounded-2xl ${color}`}>
                <Icon size={19} />
              </div>
              <ArrowUpRight
                size={15}
                className="text-ink-200 opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:text-brand"
              />
            </div>
            <div className="mt-4">
              <div className="stat-number">{value}</div>
              <div className="mt-1.5 flex items-center justify-between gap-1">
                <span className="text-[13px] text-ink-500">{label}</span>
                {trend !== null && (
                  <span className={trend >= 0 ? "trend-up" : "trend-down"}>
                    <TrendingUp size={11} />
                    {trend >= 0 ? "+" : ""}{trend}%
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Charts + Actions */}
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="card overflow-hidden">
          <div className="card-head">
            <div>
              <p className="section-label">30 ימים אחרונים</p>
              <h2 className="section-title mt-0.5">טיפולים לפי יום</h2>
            </div>
            <span className="badge-brand">
              {(treatmentsMonth.data ?? []).length} סה&Prime;כ
            </span>
          </div>
          <div className="p-4 pt-2">
            <DashboardCharts chartData={chartData} typeData={typeData} />
          </div>
        </div>

        {/* Quick actions */}
        <div className="card p-5 flex flex-col">
          <p className="section-label">קיצורי דרך</p>
          <h2 className="section-title mt-0.5 mb-4">פעולות מהירות</h2>
          <div className="flex flex-col gap-2 flex-1">
            {actions.map(({ label, desc, icon: Icon, href, color }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-center gap-3 rounded-2xl border border-line p-3.5 transition-all duration-200 hover:border-brand-200 hover:bg-brand-50/20"
              >
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${color}`}>
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-ink-900">{label}</div>
                  <div className="text-[12px] text-ink-500">{desc}</div>
                </div>
                <ChevronRight size={14} className="shrink-0 text-ink-300 transition-transform group-hover:-translate-x-0.5 group-hover:text-brand" />
              </Link>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-line flex items-center gap-2 text-[12px] text-ink-400">
            <Clock size={12} />
            <span>עודכן {fmtDate(now.toISOString())}</span>
          </div>
        </div>
      </div>

      {/* Recent treatments table */}
      <div className="card overflow-hidden">
        <div className="card-head">
          <div>
            <p className="section-label">פעילות אחרונה</p>
            <h2 className="section-title mt-0.5">טיפולים אחרונים</h2>
          </div>
          <Link href="/patients" className="btn-ghost btn-sm">
            כל המטופלים <ChevronRight size={14} className="opacity-60" />
          </Link>
        </div>

        {(recent.data?.length ?? 0) === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Activity size={24} /></div>
            <div>
              <p className="font-semibold text-ink-800">אין עדיין טיפולים</p>
              <p className="text-sm text-ink-500 mt-1">הוסף מטופל והתחל לתעד טיפולים</p>
            </div>
            <Link href="/patients" className="btn-ghost btn-sm">הוספת מטופל ראשון</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>מטופל</th>
                  <th>סוג טיפול</th>
                  <th>מטפל</th>
                  <th className="text-center">VAS</th>
                  <th className="text-end">תאריך</th>
                </tr>
              </thead>
              <tbody>
                {(recent.data ?? []).map((t: any) => (
                  <tr key={t.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[12px] font-bold text-white"
                          style={{ background: "linear-gradient(135deg,#14B8A6,#3B82F6)" }}
                        >
                          {t.patients?.first_name?.charAt(0) ?? "?"}
                        </div>
                        {t.patient_id ? (
                          <Link
                            href={`/patients/${t.patient_id}`}
                            className="font-semibold text-ink-900 hover:text-brand transition-colors"
                          >
                            {t.patients ? `${t.patients.first_name} ${t.patients.last_name}` : "מטופל"}
                          </Link>
                        ) : (
                          <span className="font-semibold text-ink-900">
                            {t.patients ? `${t.patients.first_name} ${t.patients.last_name}` : "מטופל"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-ink-600">{TREATMENT_TYPE_HE[t.type] ?? t.type}</td>
                    <td className="text-ink-500 text-[13px]">{t.profiles?.full_name ?? "—"}</td>
                    <td className="text-center">
                      {t.vas !== null ? (
                        <span className={`badge ${
                          t.vas >= 7 ? "badge-danger" :
                          t.vas >= 4 ? "badge-warning" :
                          "badge-success"
                        }`}>
                          {t.vas}
                        </span>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                    <td className="text-end text-[13px] text-ink-400">{fmtDate(t.treated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
