import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveClinicId } from "@/lib/clinic";
import { SUPER_ADMIN_EMAIL } from "@/lib/auth-gate";
import Sidebar from "@/components/Sidebar";
import OnboardingCenter, { type OnboardingStep } from "@/components/onboarding/OnboardingCenter";
import type { Membership } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("clinic_members")
      .select("*, clinics(*)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at"),
  ]);

  let list = (memberships ?? []) as Membership[];

  // Super admin can hop into any clinic, even ones they don't belong to.
  // Synthesize membership-like entries for the rest so the switcher lists them.
  if (isSuperAdmin) {
    const admin = createAdminClient();
    const { data: allClinics } = await admin
      .from("clinics")
      .select("id, name, slug, logo_url")
      .order("created_at");
    const ownIds = new Set(list.map((m) => m.clinic_id));
    const synthetic = (allClinics ?? [])
      .filter((c) => !ownIds.has(c.id))
      .map((c) => ({
        id: `super-${c.id}`,
        clinic_id: c.id,
        user_id: user.id,
        role: "admin" as const,
        status: "active" as const,
        created_at: new Date().toISOString(),
        clinics: c,
      })) as Membership[];
    list = [...list, ...synthetic];
  }

  if (list.length === 0) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="card max-w-md p-8 text-center">
          <h1 className="text-lg font-bold text-slate-900 mb-2">אין שיוך לקליניקה</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            החשבון שלך פעיל אך אינו משויך לאף קליניקה. פנה למנהל הקליניקה לקבלת הזמנה.
          </p>
        </div>
      </div>
    );
  }

  const cookieClinic = getActiveClinicId();
  const active = list.find((m) => m.clinic_id === cookieClinic) ?? list[0];

  // Live progress for the onboarding center — cheap head-count queries.
  const cid = active.clinic_id;
  const isManager = ["owner", "admin"].includes(active.role);
  const [patients, treatments, docs, members, invites] = await Promise.all([
    supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", cid),
    supabase.from("treatments").select("id", { count: "exact", head: true }).eq("clinic_id", cid),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("clinic_id", cid),
    supabase.from("clinic_members").select("id", { count: "exact", head: true }).eq("clinic_id", cid).eq("status", "active"),
    supabase.from("invitations").select("id", { count: "exact", head: true }).eq("clinic_id", cid),
  ]);

  const onboardingSteps: OnboardingStep[] = [
    {
      key: "patient",
      label: "הוספת מטופל ראשון",
      desc: "פותחים תיק — שם, טלפון ותלונה עיקרית",
      href: "/patients",
      done: (patients.count ?? 0) > 0,
    },
    {
      key: "scribe",
      label: "תיעוד טיפול ראשון עם AI",
      desc: "מקליטים — וה‑AI כותב את רשומת ה‑SOAP",
      href: "/scribe",
      done: (treatments.count ?? 0) > 0,
    },
    {
      key: "document",
      label: "הפקת מסמך ראשון",
      desc: "הפניה, דוח או מכתב — בלחיצה אחת",
      href: "/documents",
      done: (docs.count ?? 0) > 0,
    },
    ...(isManager
      ? [{
          key: "team",
          label: "הזמנת איש צוות",
          desc: "מזמינים מטפל או מנהל במייל",
          href: "/admin/users",
          done: (members.count ?? 0) > 1 || (invites.count ?? 0) > 0,
        }]
      : []),
  ];

  return (
    // dir=rtl on <html> → first flex child renders on the RIGHT
    <div className="flex min-h-screen">
      <Sidebar
        memberships={list}
        activeClinicId={active.clinic_id}
        role={active.role}
        userName={profile?.full_name || user.email || ""}
        userEmail={user.email ?? ""}
      />
      <main className="flex-1 min-w-0 p-6 lg:p-8">{children}</main>
      <OnboardingCenter steps={onboardingSteps} />
    </div>
  );
}
