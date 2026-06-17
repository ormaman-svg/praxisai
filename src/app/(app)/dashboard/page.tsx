import { createClient } from "@/lib/supabase/server";
import { getActiveClinicId } from "@/lib/clinic";
import { Users, Activity, FileText, UserPlus } from "lucide-react";
import Link from "next/link";
import { TREATMENT_TYPE_HE } from "@/lib/types";

export const dynamic = "force-dynamic";

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

  const [patients, treatmentsWeek, docsDraft, members, recent] = await Promise.all([
    supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("status", "active"),
    supabase.from("treatments").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).gte("treated_at", weekAgo),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("status", "draft"),
    supabase.from("clinic_members").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("status", "active"),
    supabase.from("treatments")
      .select("id, treated_at, type, vas, patient_id, patients(first_name,last_name), profiles:therapist_id(full_name)")
      .eq("clinic_id", clinicId).order("treated_at", { ascending: false }).limit(6),
  ]);

  const stats = [
    { label: "מטופלים פעילים", value: patients.count ?? 0, icon: Users, tint: "bg-brand-50 text-brand" },
    { label: "טיפולים בשבוע האחרון", value: treatmentsWeek.count ?? 0, icon: Activity, tint: "bg-emerald-50 text-emerald-600" },
    { label: "מסמכים בטיוטה", value: docsDraft.count ?? 0, icon: FileText, tint: "bg-amber-50 text-amber-600" },
    { label: "חברי צוות", value: members.count ?? 0, icon: UserPlus, tint: "bg-violet-50 text-violet-600" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">לוח בקרה</h1>
        <p className="mt-1 text-sm text-slate-500">תמונת מצב של הקליניקה — נתונים חיים מהמערכת.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, tint }) => (
          <div key={label} className="card p-5">
            <div className={`mb-3 grid h-9 w-9 place-items-center rounded-lg ${tint}`}>
              <Icon size={18} />
            </div>
            <div className="text-2xl font-bold text-slate-900">{value}</div>
            <div className="mt-0.5 text-[13px] text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-sm font-bold text-slate-900">טיפולים אחרונים</h2>
          <Link href="/patients" className="text-[13px] font-semibold text-brand hover:text-brand-700">לכל המטופלים ←</Link>
        </div>
        {(recent.data?.length ?? 0) === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">
            אין עדיין טיפולים מתועדים. הוסיפו מטופל ראשון כדי להתחיל.
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {recent.data!.map((t: any) => (
              <li key={t.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand">
                  {t.patients?.first_name?.charAt(0) ?? "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-slate-800">
                    {t.patient_id ? (
                      <Link href={`/patients/${t.patient_id}`} className="hover:text-brand">
                        {t.patients ? `${t.patients.first_name} ${t.patients.last_name}` : "מטופל"}
                      </Link>
                    ) : (
                      t.patients ? `${t.patients.first_name} ${t.patients.last_name}` : "מטופל"
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {TREATMENT_TYPE_HE[t.type] ?? t.type}
                    {t.profiles?.full_name ? ` · ${t.profiles.full_name}` : ""}
                  </div>
                </div>
                {t.vas !== null && (
                  <span className={`badge ${t.vas >= 7 ? "bg-red-50 text-red-600" : t.vas >= 4 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}>
                    VAS {t.vas}
                  </span>
                )}
                <time className="text-xs text-slate-400">
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
