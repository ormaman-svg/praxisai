"use client";

// Global WhatsApp message notifier — lives in the app layout so it fires
// regardless of which page is open. Shows a toast + plays a soft chime.
// Skips the toast when the user is already on /inbox (InboxClient handles it there).

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MessageCircle, X } from "lucide-react";

type Toast = { convId: string; label: string };

function playChime() {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
    gain.connect(ctx.destination);
    [880, 1100].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + 0.9);
    });
  } catch {}
}

export default function GlobalInboxNotifier({ clinicId }: { clinicId: string }) {
  const pathname = usePathname();
  const [toast, setToast] = useState<Toast | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`global_inbox_${clinicId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `clinic_id=eq.${clinicId}`,
        },
        (payload) => {
          const c = payload.new as {
            id: string; last_message_at: string | null;
            display_name: string | null; wa_contact: string | null;
          };
          const old = payload.old as { last_message_at?: string | null };

          // Only fire when a new inbound message advances the timestamp
          if (!c.last_message_at || c.last_message_at === old?.last_message_at) return;

          // Skip if the user is already watching the inbox
          if (pathname.startsWith("/inbox")) return;

          const label = c.display_name ?? c.wa_contact ?? "פונה חדש";
          playChime();
          setToast({ convId: c.id, label });
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => setToast(null), 7000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [clinicId, pathname]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-5 start-5 z-[200] flex items-start gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3.5 shadow-xl animate-[slideUp_0.25s_ease-out]">
      <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-100">
        <MessageCircle size={17} className="text-emerald-600" />
      </div>
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold text-slate-800">הודעה חדשה מ‑WhatsApp</p>
        <p className="truncate text-[12px] text-slate-500">{toast.label}</p>
        <Link
          href="/inbox"
          onClick={() => setToast(null)}
          className="mt-1 inline-block text-[12px] font-semibold text-emerald-600 hover:underline"
        >
          לתיבת ההודעות ←
        </Link>
      </div>
      <button
        onClick={() => setToast(null)}
        className="ms-1 mt-0.5 rounded-md p-1 text-slate-400 hover:bg-slate-100"
      >
        <X size={14} />
      </button>
    </div>
  );
}
