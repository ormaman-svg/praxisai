"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Users, FileText, BarChart3, LogOut, Mic, MessageSquare,
  ShieldCheck, Building2, Settings, CalendarDays, CreditCard, Inbox, MessageCircle, Globe,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ClinicSwitcher from "./ClinicSwitcher";
import Logo from "./Logo";
import type { Membership, MemberRole } from "@/lib/types";
import { isSuperAdminEmail } from "@/lib/super-admins";
import { useLang } from "@/lib/i18n/context";
import { useT } from "@/lib/i18n/use-translation";
import { LANG_META, type Lang } from "@/lib/i18n/translations";

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

const LANGS = Object.entries(LANG_META) as [Lang, typeof LANG_META[Lang]][];

function LanguagePicker() {
  const { lang, setLang } = useLang();
  const t = useT();
  const [open, setOpen] = useState(false);
  const current = LANG_META[lang];

  return (
    <div className="relative px-3 pb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[12.5px] font-medium text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-slate-200"
        title={t.common.language}
      >
        <Globe size={14} className="shrink-0 text-slate-500" />
        <span className="flex-1 text-start">{current.label}</span>
        <span className="text-base leading-none">{current.flag}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full start-0 z-20 mb-1.5 w-full overflow-hidden rounded-xl border border-white/[0.1] bg-[#15161f] shadow-pop">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
              {t.common.language}
            </div>
            {LANGS.map(([code, meta]) => (
              <button
                key={code}
                onClick={() => { setLang(code); setOpen(false); }}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-[13px] transition-colors ${
                  code === lang
                    ? "bg-violet-500/[0.15] font-semibold text-violet-200"
                    : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                }`}
                dir={meta.dir}
              >
                <span className="text-base leading-none">{meta.flag}</span>
                <span className="flex-1 text-start">{meta.label}</span>
                {code === lang && <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />}
              </button>
            ))}
          </div>
        </>
      )}
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
  const t = useT();
  const isAdmin = role === "owner" || role === "admin";
  const isSuperAdmin = isSuperAdminEmail(userEmail);

  const NAV = [
    { href: "/dashboard", label: t.nav.dashboard,  icon: LayoutDashboard },
    { href: "/schedule",  label: t.nav.schedule,   icon: CalendarDays },
    { href: "/inbox",     label: t.nav.inbox,      icon: Inbox },
    { href: "/patients",  label: t.nav.patients,   icon: Users },
    { href: "/scribe",    label: t.nav.scribe,     icon: Mic },
    { href: "/chat",      label: t.nav.chat,       icon: MessageSquare },
    { href: "/analytics", label: t.nav.analytics,  icon: BarChart3 },
    { href: "/documents", label: t.nav.documents,  icon: FileText },
  ];

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
            <div className="mb-1.5 mt-5 px-3 text-[10.5px] font-semibold uppercase tracking-widest text-slate-600">
              {t.adminSection.title}
            </div>
            <NavLink href="/admin/users"        label={t.adminSection.users}    icon={ShieldCheck}    active={pathname.startsWith("/admin/users")} />
            <NavLink href="/settings/whatsapp"  label={t.adminSection.whatsapp} icon={MessageCircle}  active={pathname.startsWith("/settings/whatsapp")} />
            <NavLink href="/settings/billing"   label={t.adminSection.billing}  icon={CreditCard}     active={pathname.startsWith("/settings/billing")} />
          </>
        )}

        {isSuperAdmin && (
          <>
            <div className="mb-1.5 mt-5 px-3 text-[10.5px] font-semibold uppercase tracking-widest text-slate-600">Super Admin</div>
            <NavLink href="/admin/clinics"      label={t.superAdminSection.clinics}   icon={Building2}  active={pathname.startsWith("/admin/clinics")} />
            <NavLink href="/settings/template"  label={t.superAdminSection.template}  icon={Settings}   active={pathname.startsWith("/settings/template")} />
          </>
        )}
      </nav>

      {/* Language picker */}
      <LanguagePicker />

      {/* User card */}
      <div className="border-t border-white/[0.06] p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-sm font-bold text-white">
            {userName.trim().charAt(0) || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-white">{userName}</div>
            <div className="truncate text-[11px] text-slate-500">{t.roles[role]}</div>
          </div>
          <button
            onClick={signOut}
            title={t.common.signOut}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/[0.08] hover:text-violet-300"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
