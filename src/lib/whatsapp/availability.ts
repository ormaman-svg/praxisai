// Calendar availability for the WhatsApp booking agent.
// Computes real free slots from clinic working hours minus existing appointments,
// in Israel local time, so the bot can offer concrete times and book them.

import type { SupabaseClient } from "@supabase/supabase-js";

const TZ = "Asia/Jerusalem";

export type BookingConfig = {
  days: number[];       // JS getDay(): 0=Sun … 6=Sat. Default Sun–Thu.
  startHour: number;    // first slot start hour (local), e.g. 8
  endHour: number;      // last slot must END by this hour (local), e.g. 18
  slotMinutes: number;  // appointment length / grid, e.g. 45
  minLeadMinutes: number; // earliest bookable from "now", e.g. 120
};

export const DEFAULT_BOOKING_CONFIG: BookingConfig = {
  days: [0, 1, 2, 3, 4], // Sunday–Thursday
  startHour: 8,
  endHour: 18,
  slotMinutes: 45,
  minLeadMinutes: 120,
};

export function getBookingConfig(settings: Record<string, unknown> | null | undefined): BookingConfig {
  const s = settings ?? {};
  const num = (v: unknown, d: number) => (typeof v === "number" && !isNaN(v) ? v : d);
  const days = Array.isArray(s.booking_days) && s.booking_days.length
    ? (s.booking_days as number[])
    : DEFAULT_BOOKING_CONFIG.days;
  return {
    days,
    startHour: num(s.booking_start_hour, DEFAULT_BOOKING_CONFIG.startHour),
    endHour: num(s.booking_end_hour, DEFAULT_BOOKING_CONFIG.endHour),
    slotMinutes: num(s.booking_slot_minutes, DEFAULT_BOOKING_CONFIG.slotMinutes),
    minLeadMinutes: num(s.booking_min_lead_minutes, DEFAULT_BOOKING_CONFIG.minLeadMinutes),
  };
}

// Milliseconds offset of a timezone at a given instant (handles DST).
function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = dtf.formatToParts(date).reduce<Record<string, string>>((a, x) => { a[x.type] = x.value; return a; }, {});
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour === 24 ? 0 : +p.hour, +p.minute, +p.second);
  return asUTC - date.getTime();
}

// Convert an Israel wall-clock time to a UTC Date.
function wallToUTC(y: number, mo: number, d: number, h: number, mi: number): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0);
  const off = tzOffsetMs(new Date(guess), TZ);
  return new Date(guess - off);
}

// Israel local Y/M/D/weekday for a given instant.
function israelParts(date: Date): { y: number; mo: number; d: number; dow: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
  });
  const p = dtf.formatToParts(date).reduce<Record<string, string>>((a, x) => { a[x.type] = x.value; return a; }, {});
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { y: +p.year, mo: +p.month, d: +p.day, dow: dowMap[p.weekday] ?? 0 };
}

export function formatSlotHebrew(startsAt: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: TZ, weekday: "long", day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(startsAt);
}

export type Slot = { startsAt: Date; endsAt: Date; therapistId: string | null; therapistName: string };
export type Therapist = { id: string; name: string };

type ApptRow = { starts_at: string; ends_at: string; therapist_id: string | null };

// Returns up to `limit` free slots starting from `from`, scanning `lookaheadDays`.
export async function computeAvailableSlots(
  supabase: SupabaseClient,
  clinicId: string,
  therapists: Therapist[],
  config: BookingConfig,
  opts: { from?: Date; lookaheadDays?: number; limit?: number } = {}
): Promise<Slot[]> {
  const now = new Date();
  const from = opts.from ?? now;
  const lookaheadDays = opts.lookaheadDays ?? 21;
  const limit = opts.limit ?? 5;
  const earliest = new Date(now.getTime() + config.minLeadMinutes * 60_000);

  const windowEnd = new Date(from.getTime() + lookaheadDays * 864e5);
  const { data: appts } = await supabase
    .from("appointments")
    .select("starts_at, ends_at, therapist_id")
    .eq("clinic_id", clinicId)
    .eq("status", "scheduled")
    .gte("starts_at", from.toISOString())
    .lte("starts_at", windowEnd.toISOString());
  const booked = (appts ?? []) as ApptRow[];

  // If no named therapists, treat the clinic as a single bookable resource.
  const resources: Therapist[] = therapists.length ? therapists : [{ id: "", name: "" }];

  const slotFreeFor = (start: Date, end: Date, therapistId: string): boolean => {
    for (const a of booked) {
      const aStart = new Date(a.starts_at).getTime();
      const aEnd = new Date(a.ends_at).getTime();
      const overlaps = aStart < end.getTime() && aEnd > start.getTime();
      if (!overlaps) continue;
      // A null-therapist appointment blocks everyone; otherwise only its therapist.
      if (a.therapist_id === null || a.therapist_id === therapistId) return false;
    }
    return true;
  };

  const out: Slot[] = [];
  for (let dayOffset = 0; dayOffset <= lookaheadDays && out.length < limit; dayOffset++) {
    const dayInstant = new Date(from.getTime() + dayOffset * 864e5);
    const { y, mo, d, dow } = israelParts(dayInstant);
    if (!config.days.includes(dow)) continue;

    // Continuous slot grid for the day: startHour:00, +slotMinutes each,
    // until a slot would end after endHour:00.
    const dayStartMin = config.startHour * 60;
    const dayEndMin = config.endHour * 60;
    for (let m = dayStartMin; m + config.slotMinutes <= dayEndMin && out.length < limit; m += config.slotMinutes) {
      const h = Math.floor(m / 60);
      const mi = m % 60;
      const start = wallToUTC(y, mo, d, h, mi);
      const end = new Date(start.getTime() + config.slotMinutes * 60_000);
      if (start < earliest) continue;

      const freeRes = resources.find((r) => slotFreeFor(start, end, r.id));
      if (freeRes) {
        out.push({ startsAt: start, endsAt: end, therapistId: freeRes.id || null, therapistName: freeRes.name });
      }
    }
  }
  return out;
}
