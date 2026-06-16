"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import type { Membership } from "@/lib/types";
import { ROLE_HE } from "@/lib/types";

export default function ClinicSwitcher({
  memberships, activeClinicId,
}: { memberships: Membership[]; activeClinicId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = memberships.find((m) => m.clinic_id === activeClinicId);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function switchTo(clinicId: string) {
    if (clinicId === activeClinicId) return setOpen(false);
    setBusy(true);
    await fetch("/api/clinic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinicId }),
    });
    setOpen(false);
    setBusy(false);
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.06] px-3 py-2.5 text-start transition-all hover:bg-white/[0.10]"
      >
        <Building2 size={15} className="shrink-0 text-violet-400" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-white">{active?.clinics?.name ?? "קליניקה"}</div>
          <div className="text-[11px] text-slate-500">{active ? ROLE_HE[active.role] : ""}</div>
        </div>
        {memberships.length > 1 && <ChevronsUpDown size={13} className="shrink-0 text-slate-600" />}
      </button>

      {open && memberships.length > 1 && (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-white/[0.08] bg-navy-800 shadow-pop">
          {memberships.map((m) => (
            <button
              key={m.clinic_id}
              disabled={busy}
              onClick={() => switchTo(m.clinic_id)}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-start transition-colors hover:bg-white/[0.05] disabled:opacity-50"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-white">{m.clinics?.name}</div>
                <div className="text-[11px] text-slate-500">{ROLE_HE[m.role]}</div>
              </div>
              {m.clinic_id === activeClinicId && <Check size={13} className="text-violet-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
