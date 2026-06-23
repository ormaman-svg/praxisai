"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, FileText, BarChart3, LogOut, Mic, MessageSquare,
  ShieldCheck, Building2, Settings, CalendarDays, CreditCard, Inbox,
  MessageCircle, ChevronRight, Stethoscope,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ClinicSwitcher from "./ClinicSwitcher";
import Logo from "./Logo";
import type { Membership, MemberRole } from "@/lib/types";
import { ROLE_HE } from "@/lib/types";
import { isSuperAdminEmail } from "@/lib/super-admins";

const NAV_MAIN = [
  { href: "/dashboard", label: "לוח בקרה",     icon: LayoutDashboard },
  { href: "/schedule",  label: "יומן",           icon: CalendarDays },
  { href: "/inbox",     label: "הודעות",         icon: Inbox },
  { href: "/patients",  label: "מטופלים",        icon: Users },
  { href: "/scribe",    label: "תיעוד AI",       icon: Mic },
  { href: "/chat",      label: "עוזר AI",        icon: MessageSquare },
  { href: "/analytics", label: "נתונים",         icon: BarChart3 },
  { href: "/documents", label: "מסמכים",         icon: FileText },
];

const NAV_ADMIN = [
  { href: "/admin/users",       label: "משתמשים",     icon: ShieldCheck },
  { href: "/settings/whatsapp", label: "WhatsApp",    icon: MessageCircle },
  { href: "/settings/billing",  label: "חיוב",        icon: CreditCard },
];

const NAV_SUPER = [
  { href: "/admin/clinics",     label: "קליניקות",    icon: Building2 },
  { href: "/settings/template", label: "תבניות",      icon: Settings },
];

function NavItem({
  href, label, icon: Icon, active,
}: { href: string; label: string; icon: React.ElementType; active: boolean }) {
  return (
    <Link
      href={href}
      className={`
        group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium
        transition-all duration-150 relative
        ${active
          ? "text-white"
          : "text-slate-400 hover:text-white"
        }
      `}
    >
      {active && (
        <span className="absolute inset-0 rounded-xl bg-white/[0.09]" />
      )}
      {active && (
        <span className="absolute start-0 inset-y-[6px] w-[3px] rounded-full bg-brand" />
      )}
      <Icon
        size={17}
        strokeWidth={active ? 2.2 : 1.8}
        className={`relative shrink-0 transition-colors duration-150 ${
          active ? "text-brand-300" : "text-slate-500 group-hover:text-slate-300"
        }`}
      />
      <span className="relative">{label}</span>
      {active && (
        <ChevronRight size={13} className="relative ms-auto text-brand-400/60" />
      )}
    </Link>
  );
}

function NavGroup({ label }: { label: string }) {
  return (
    <div className="mx-3 mt-5 mb-1.5 flex items-center gap-2">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-slate-600">
        {label}
      </span>
      <div className="flex-1 h-px bg-white/[0.05]" />
    </div>
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

  const initials = userName
    .trim()
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  return (
    <aside
      className="sticky top-0 flex h-screen w-[256px] shrink-0 flex-col overflow-hidden"
      style={{ background: "linear-gradient(180deg, #111827 0%, #0C111D 100%)" }}
    >
      {/* Subtle top accent */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-brand-500/40 to-transparent" />

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <div
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
          style={{ background: "linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)" }}
        >
          <Logo size={16} className="text-white" />
        </div>
        <span className="text-[17px] font-bold tracking-tight text-white">
          praxis<span className="text-brand-400">AI</span>
        </span>
      </div>

      {/* Clinic switcher */}
      <div className="px-3 pb-3">
        <ClinicSwitcher memberships={memberships} activeClinicId={activeClinicId} />
      </div>

      {/* Clinic type */}
      {clinicTypeLabel && (
        <div className="mx-3 mb-3 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5">
          <span className="text-sm leading-none">{clinicTypeIcon ?? "🩺"}</span>
          <span className="truncate text-[12px] font-medium text-slate-400">{clinicTypeLabel}</span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {NAV_MAIN.map(({ href, label, icon }) => (
          <NavItem
            key={href}
            href={href}
            label={label}
            icon={icon}
            active={pathname === href || pathname.startsWith(href + "/")}
          />
        ))}

        {isAdmin && (
          <>
            <NavGroup label="ניהול" />
            {NAV_ADMIN.map(({ href, label, icon }) => (
              <NavItem
                key={href}
                href={href}
                label={label}
                icon={icon}
                active={pathname.startsWith(href)}
              />
            ))}
          </>
        )}

        {isSuperAdmin && (
          <>
            <NavGroup label="Super" />
            {NAV_SUPER.map(({ href, label, icon }) => (
              <NavItem
                key={href}
                href={href}
                label={label}
                icon={icon}
                active={pathname.startsWith(href)}
              />
            ))}
          </>
        )}
      </nav>

      {/* User */}
      <div
        className="p-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-white/[0.04]">
          {/* Avatar */}
          <div
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[13px] font-bold text-white"
            style={{ background: "linear-gradient(135deg, #14B8A6 0%, #3B82F6 100%)" }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-white">{userName}</div>
            <div className="truncate text-[11px] text-slate-500">{ROLE_HE[role]}</div>
          </div>
          <button
            onClick={signOut}
            title="התנתקות"
            className="rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-white/[0.08] hover:text-slate-300"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
