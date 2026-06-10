"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, FileText, BarChart3, LogOut, Mic, MessageSquare, ShieldCheck, Building2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ClinicSwitcher from "./ClinicSwitcher";
import Logo from "./Logo";
import type { Membership, MemberRole } from "@/lib/types";
import { ROLE_HE } from "@/lib/types";

const SUPER_ADMIN = "or.maman@gmail.com";

const NAV = [
  { href: "/dashboard", label: "לוח בקרה", icon: LayoutDashboard },
  { href: "/patients", label: "מטופלים", icon: Users },
  { href: "/scribe", label: "תיעוד AI", icon: Mic },
  { href: "/chat", label: "צ'אט AI", icon: MessageSquare },
  { href: "/analytics", label: "אנליטיקות", icon: BarChart3 },
  { href: "/documents", label: "מסמכים", icon: FileText },
];

export default function Sidebar({
  memberships, activeClinicId, role, userName, userEmail,
}: {
  memberships: Membership[];
  activeClinicId: string;
  role: MemberRole;
  userName: string;
  userEmail: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = role === "owner" || role === "admin";
  const isSuperAdmin = userEmail === SUPER_ADMIN;

  async function signOut() {
    await createClient().auth.signOut();
    document.cookie = "praxis_session_start=; Max-Age=0; path=/";
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-navy text-slate-300">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <Logo size={32} className="text-brand shrink-0" />
        <span className="font-display text-lg font-bold tracking-tight text-white">praxisAI</span>
      </div>

      {/* Clinic switcher */}
      <div className="px-3 pb-4">
        <ClinicSwitcher memberships={memberships} activeClinicId={activeClinicId} />
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors ${
                active ? "bg-brand text-white" : "hover:bg-navy-700 hover:text-white"
              }`}
            >
              <Icon size={17} strokeWidth={2} />
              <span>{label}</span>
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className="mt-5 mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">ניהול</div>
            <Link
              href="/admin/users"
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors ${
                pathname.startsWith("/admin/users") ? "bg-brand text-white" : "hover:bg-navy-700 hover:text-white"
              }`}
            >
              <ShieldCheck size={17} strokeWidth={2} />
              משתמשים והרשאות
            </Link>
          </>
        )}

        {isSuperAdmin && (
          <>
            <div className="mt-5 mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Super Admin</div>
            <Link
              href="/admin/clinics"
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors ${
                pathname.startsWith("/admin/clinics") ? "bg-brand text-white" : "hover:bg-navy-700 hover:text-white"
              }`}
            >
              <Building2 size={17} strokeWidth={2} />
              קליניקות
            </Link>
          </>
        )}
      </nav>

      {/* User card */}
      <div className="border-t border-navy-700 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy-700 text-sm font-bold text-white">
            {userName.trim().charAt(0) || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-white">{userName}</div>
            <div className="truncate text-[11px] text-slate-400">{ROLE_HE[role]} · {userEmail}</div>
          </div>
          <button onClick={signOut} title="התנתקות" className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-navy-700 hover:text-white">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
