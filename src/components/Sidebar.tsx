"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, FileText, BarChart3, LogOut, Mic, MessageSquare,
  ShieldCheck, Building2, Settings, CalendarDays, CreditCard, Inbox, MessageCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ClinicSwitcher from "./ClinicSwitcher";
import Logo from "./Logo";
import type { Membership, MemberRole } from "@/lib/types";
import { ROLE_HE } from "@/lib/types";
import { isSuperAdminEmail } from "@/lib/super-admins";

const NAV = [
  { href: "/dashboard", label: "לוח בקרה",      icon: LayoutDashboard },
  { href: "/schedule",  label: "יומן תורים",    icon: CalendarDays },
  { href: "/inbox",     label: "תיבת הודעות",   icon: Inbox },
  { href: "/patients",  label: "מטופלים",        icon: Users },
  { href: "/scribe",    label: "תיעוד AI",       icon: Mic },
  { href: "/chat",      label: "צ'אט AI",        icon: MessageSquare },
  { href: "/analytics", label: "אנליטיקות",      icon: BarChart3 },
  { href: "/documents", label: "מסמכים",         icon: FileText },
];

function NavLink({ href, label, icon: Icon, active }: {
  href: string; label: string; icon: React.ElementType; active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-[13.5px] font-medium transition-all duration-150 ${
        active
          ? "border-violet-400/[0.18] bg-violet-500/[0.12] text-white"
          : "border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
      }`}
    >
      <Icon size={17} strokeWidth={active ? 2.2 : 2} className={active ? "text-violet-400" : ""} />
      <span>{label}</span>
    </Link>
  );
}

export default function Sidebar({
  memberships, activeClinicId, role, userName, userEmail, clinicTypeIcon, clinicTypeLabel,
}: {
  memberships: Membership[];
  activeClinicId: string;
  role: MemberRole;
  userName: string;
  userEmail: string;
  clinicTypeIcon?: string;
  clinicTypeLabel?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = role === "owner" || role === "admin";
  const isSuperAdmin = isSuperAdminEmail(userEmail);

  async function signOut() {
    await createClient().auth.signOut();
    document.cookie = "praxis_session_start=; Max-Age=0; path=/";
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-navy">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-glow">
          <Logo size={17} className="text-white" />
        </div>
        <span className="font-display text-[17px] font-bold tracking-tight text-white">
          praxis<span className="text-violet-400">AI</span>
        </span>
      </div>

      {/* Clinic switcher */}
      <div className="px-3 pb-3">
        <ClinicSwitcher memberships={memberships} activeClinicId={activeClinicId} />
      </div>

      {/* Clinic type badge */}
      {clinicTypeLabel && (
        <div className="px-4 pb-3">
          <div
            className="flex items-center gap-2 rounded-lg border border-violet-400/[0.15] bg-violet-500/[0.08] px-2.5 py-1.5"
            title={`סוג קליניקה: ${clinicTypeLabel}`}
          >
            <span className="text-sm leading-none">{clinicTypeIcon ?? "🩺"}</span>
            <span className="truncate text-[11.5px] font-semibold text-violet-200">{clinicTypeLabel}</span>
          </div>
        </div>
      )}

      <div className="mx-4 mb-3 h-px bg-white/[0.06]" />

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {NAV.map(({ href, label, icon }) => (
          <NavLink key={href} href={href} label={label} icon={icon} active={pathname.startsWith(href)} />
        ))}

        {isAdmin && (
          <>
            <div className="mb-1.5 mt-5 px-3 text-[10.5px] font-semibold uppercase tracking-widest text-slate-600">ניהול</div>
            <NavLink href="/admin/users"        label="משתמשים והרשאות" icon={ShieldCheck}    active={pathname.startsWith("/admin/users")} />
            <NavLink href="/settings/whatsapp"  label="חיבור WhatsApp"  icon={MessageCircle}  active={pathname.startsWith("/settings/whatsapp")} />
            <NavLink href="/settings/billing"   label="חיוב ומנוי"     icon={CreditCard}     active={pathname.startsWith("/settings/billing")} />
          </>
        )}

        {isSuperAdmin && (
          <>
            <div className="mb-1.5 mt-5 px-3 text-[10.5px] font-semibold uppercase tracking-widest text-slate-600">Super Admin</div>
            <NavLink href="/admin/clinics"      label="קליניקות"        icon={Building2}  active={pathname.startsWith("/admin/clinics")} />
            <NavLink href="/settings/template"  label="סוג הקליניקה"   icon={Settings}   active={pathname.startsWith("/settings/template")} />
          </>
        )}
      </nav>

      {/* User card */}
      <div className="border-t border-white/[0.06] p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-sm font-bold text-white">
            {userName.trim().charAt(0) || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-white">{userName}</div>
            <div className="truncate text-[11px] text-slate-500">{ROLE_HE[role]}</div>
          </div>
          <button
            onClick={signOut}
            title="התנתקות"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/[0.08] hover:text-violet-300"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
