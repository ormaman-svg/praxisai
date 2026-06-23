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
      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-200 ease-out-expo ${
        active
          ? "text-white"
          : "text-slate-400 hover:text-slate-100"
      }`}
    >
      {/* active background */}
      {active && (
        <span className="absolute inset-0 rounded-xl bg-gradient-to-l from-violet-600/25 to-indigo-600/15 ring-1 ring-inset ring-violet-400/20" />
      )}
      {/* active accent bar on the inline-start edge */}
      {active && (
        <span className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-gradient-to-b from-violet-400 to-indigo-400" />
      )}
      {/* hover background (only when not active) */}
      {!active && (
        <span className="absolute inset-0 rounded-xl bg-white/0 transition-colors duration-200 group-hover:bg-white/[0.04]" />
      )}
      <Icon
        size={17.5}
        strokeWidth={active ? 2.3 : 2}
        className={`relative z-10 shrink-0 transition-colors duration-200 ${
          active ? "text-violet-300" : "text-slate-500 group-hover:text-slate-300"
        }`}
      />
      <span className="relative z-10">{label}</span>
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
    <aside className="sticky top-0 flex h-screen w-[268px] shrink-0 flex-col overflow-hidden bg-navy">
      {/* subtle depth: top brand glow + inner hairline on the content edge */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-violet-600/[0.07] via-transparent to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 start-0 w-px bg-white/[0.06]" />

      {/* Logo */}
      <div className="relative flex items-center gap-3 px-5 pb-5 pt-6">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-glow ring-1 ring-white/10">
          <Logo size={18} className="text-white" />
        </div>
        <span className="font-display text-[18px] font-bold tracking-tight text-white">
          praxis<span className="text-violet-400">AI</span>
        </span>
      </div>

      {/* Clinic switcher */}
      <div className="relative px-3 pb-3">
        <ClinicSwitcher memberships={memberships} activeClinicId={activeClinicId} />
      </div>

      {/* Clinic type badge */}
      {clinicTypeLabel && (
        <div className="relative px-4 pb-3">
          <div
            className="flex items-center gap-2 rounded-lg border border-violet-400/[0.14] bg-violet-500/[0.07] px-2.5 py-1.5"
            title={`סוג קליניקה: ${clinicTypeLabel}`}
          >
            <span className="text-sm leading-none">{clinicTypeIcon ?? "🩺"}</span>
            <span className="truncate text-[11.5px] font-semibold text-violet-200/90">{clinicTypeLabel}</span>
          </div>
        </div>
      )}

      <div className="relative mx-4 mb-3 h-px bg-white/[0.06]" />

      {/* Nav */}
      <nav className="relative flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {NAV.map(({ href, label, icon }) => (
          <NavLink key={href} href={href} label={label} icon={icon} active={pathname.startsWith(href)} />
        ))}

        {isAdmin && (
          <>
            <div className="mb-1.5 mt-6 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">ניהול</div>
            <NavLink href="/admin/users"        label="משתמשים והרשאות" icon={ShieldCheck}    active={pathname.startsWith("/admin/users")} />
            <NavLink href="/settings/whatsapp"  label="חיבור WhatsApp"  icon={MessageCircle}  active={pathname.startsWith("/settings/whatsapp")} />
            <NavLink href="/settings/billing"   label="חיוב ומנוי"     icon={CreditCard}     active={pathname.startsWith("/settings/billing")} />
          </>
        )}

        {isSuperAdmin && (
          <>
            <div className="mb-1.5 mt-6 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">Super Admin</div>
            <NavLink href="/admin/clinics"      label="קליניקות"        icon={Building2}  active={pathname.startsWith("/admin/clinics")} />
            <NavLink href="/settings/template"  label="סוג הקליניקה"   icon={Settings}   active={pathname.startsWith("/settings/template")} />
          </>
        )}
      </nav>

      {/* User card */}
      <div className="relative border-t border-white/[0.06] p-3">
        <div className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.04]">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white ring-1 ring-white/10">
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
