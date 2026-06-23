"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ChevronLeft, Plus, X, CalendarDays, Clock, StickyNote, Trash2, Check, Ban, UserX, ArrowUpLeft, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import { APPT_STATUS_HE, type Appointment, type AppointmentStatus } from "@/lib/types";

type PatientLite = { id: string; first_name: string; last_name: string };
type TherapistLite = { id: string; name: string };

const DAY_START = 8;   // 08:00
const DAY_END = 20;    // 20:00
const SLOT_MIN = 30;

// Appointment chip styling per status — uses the design-system badge tones.
const STATUS_STYLE: Record<AppointmentStatus, string> = {
  scheduled: "border-brand-200 bg-brand-50 text-brand-700 hover:border-brand-300 hover:bg-brand-100",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100",
  cancelled: "border-line bg-surface-3 text-ink-400 line-through hover:bg-ink-100",
  no_show:   "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100",
};

// Solid status dots for the legend and view modal.
const STATUS_DOT: Record<AppointmentStatus, string> = {
  scheduled: "bg-brand-500",
  completed: "bg-emerald-500",
  cancelled: "bg-ink-300",
  no_show:   "bg-amber-500",
};

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay()); // Sunday — Israeli week
  x.setHours(0, 0, 0, 0);
  return x;
}
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 864e5);
const hhmm = (d: Date) => d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function ScheduleClient({
  clinicId, userId, appointments, patients, therapists,
}: {
  clinicId: string;
  userId: string;
  appointments: Appointment[];
  patients: PatientLite[];
  therapists: TherapistLite[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [therapistFilter, setTherapistFilter] = useState("");
  const [modal, setModal] = useState<{ mode: "create"; startsAt: Date } | { mode: "view"; appt: Appointment } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ patient_id: "", therapist_id: "", starts_at: "", duration: 45, notes: "" });

  const patientName = useMemo(() => {
    const m = new Map(patients.map((p) => [p.id, `${p.first_name} ${p.last_name}`]));
    return (id: string) => m.get(id) ?? "מטופל";
  }, [patients]);
  const therapistName = useMemo(() => {
    const m = new Map(therapists.map((t) => [t.id, t.name]));
    return (id: string | null) => (id ? m.get(id) ?? "" : "");
  }, [therapists]);

  const days = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)); // Sun–Fri
  const visible = useMemo(
    () => appointments.filter((a) => !therapistFilter || a.therapist_id === therapistFilter),
    [appointments, therapistFilter],
  );

  function apptsForDay(day: Date) {
    const from = day.getTime(), to = from + 864e5;
    return visible.filter((a) => {
      const t = new Date(a.starts_at).getTime();
      return t >= from && t < to;
    });
  }

  function openCreate(day: Date, hour: number, half: boolean) {
    const start = new Date(day);
    start.setHours(hour, half ? 30 : 0, 0, 0);
    setForm({ patient_id: "", therapist_id: userId, starts_at: toLocalInput(start), duration: 45, notes: "" });
    setError(null);
    setModal({ mode: "create", startsAt: start });
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patient_id) { setError("בחרו מטופל."); return; }
    setSaving(true);
    setError(null);
    const starts = new Date(form.starts_at);
    const ends = new Date(starts.getTime() + form.duration * 60000);
    const { data: appt, error } = await supabase.from("appointments").insert({
      clinic_id: clinicId,
      patient_id: form.patient_id,
      therapist_id: form.therapist_id || null,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      notes: form.notes.trim() || null,
      created_by: userId,
    }).select("id").single();
    setSaving(false);
    if (error) { setError("שמירת התור נכשלה — נסו שוב."); return; }

    // Schedule WhatsApp reminders if appointment was created
    if (appt?.id) {
      const therapist = therapists.find((t) => t.id === form.therapist_id);
      const patient = patients.find((p) => p.id === form.patient_id);
      const timeStr = starts.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
      const rem24h = new Date(starts.getTime() - 24 * 60 * 60_000).toISOString();
      const rem2h = new Date(starts.getTime() - 2 * 60 * 60_000).toISOString();

      // Fire-and-forget — failures are non-blocking
      Promise.all([
        supabase.from("scheduled_messages").insert({
          clinic_id: clinicId,
          patient_id: form.patient_id,
          appointment_id: appt.id,
          template_key: "reminder_24h",
          template_vars: [patient?.first_name ?? "", timeStr, therapist?.name ?? "המטפל/ת"],
          scheduled_for: rem24h,
        }),
        supabase.from("scheduled_messages").insert({
          clinic_id: clinicId,
          patient_id: form.patient_id,
          appointment_id: appt.id,
          template_key: "reminder_2h",
          template_vars: [patient?.first_name ?? "", timeStr],
          scheduled_for: rem2h,
        }),
      ]).catch(() => {});
    }

    setModal(null);
    router.refresh();
  }

  async function setStatus(id: string, status: AppointmentStatus) {
    await supabase.from("appointments").update({ status }).eq("id", id);
    setModal(null);
    router.refresh();
  }

  async function remove(id: string) {
    await supabase.from("appointments").delete().eq("id", id);
    setModal(null);
    router.refresh();
  }

  const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekLabel = `${weekStart.toLocaleDateString("he-IL", { day: "numeric", month: "short" })} – ${addDays(weekStart, 5).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" })}`;
  const isCurrentWeek = weekStart.getTime() === startOfWeek(new Date()).getTime();
  const weekCount = visible.filter((a) => {
    const t = new Date(a.starts_at).getTime();
    return t >= weekStart.getTime() && t < addDays(weekStart, 6).getTime();
  }).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-in">
      <PageHeader
        icon={CalendarDays}
        eyebrow="יומן"
        title="יומן תורים"
        subtitle="תזמון, מעקב והשלמת תורים — לחצו על משבצת ריקה לקביעת תור."
      >
        <button onClick={() => openCreate(today, 9, false)} className="btn-primary">
          <Plus size={16} /> תור חדש
        </button>
      </PageHeader>

      {/* Toolbar: filter + week navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {therapists.length > 1 && (
            <select
              className="select w-auto min-w-44"
              value={therapistFilter}
              onChange={(e) => setTherapistFilter(e.target.value)}
              aria-label="סינון לפי מטפל/ת"
            >
              <option value="">כל הצוות</option>
              {therapists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink-700 shadow-xs">
            <CalendarDays size={15} className="text-brand-600" />
            {weekLabel}
            <span className="badge badge-brand ms-0.5">{weekCount} תורים</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="segment">
            <button data-active={true}>שבוע</button>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1 shadow-xs">
            {/* RTL: previous week sits on the start (right) edge → ChevronRight */}
            <button onClick={() => setWeekStart((w) => addDays(w, -7))} className="btn-icon" title="שבוע קודם">
              <ChevronRight size={17} />
            </button>
            <button
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              data-active={isCurrentWeek}
              className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-3 hover:text-ink-900 data-[active=true]:bg-brand-50 data-[active=true]:text-brand-700"
            >
              היום
            </button>
            <button onClick={() => setWeekStart((w) => addDays(w, 7))} className="btn-icon" title="שבוע הבא">
              <ChevronLeft size={17} />
            </button>
          </div>
        </div>
      </div>

      {/* Week grid */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[820px]">
            {/* Day headers */}
            <div className="grid border-b border-line bg-surface-2" style={{ gridTemplateColumns: "60px repeat(6, 1fr)" }}>
              <div className="flex items-end justify-center pb-2.5 pt-3">
                <Clock size={14} className="text-ink-300" />
              </div>
              {days.map((d) => {
                const isToday = d.getTime() === today.getTime();
                return (
                  <div
                    key={d.toISOString()}
                    className={`relative border-s border-line-soft px-2 py-3 text-center ${isToday ? "bg-brand-50/70" : ""}`}
                  >
                    <div className={`text-[12px] font-bold ${isToday ? "text-brand-700" : "text-ink-700"}`}>
                      {d.toLocaleDateString("he-IL", { weekday: "short" })}
                    </div>
                    <div className={`mt-0.5 inline-grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[12px] font-semibold ${isToday ? "bg-brand-gradient text-white shadow-glow" : "text-ink-400"}`}>
                      {d.toLocaleDateString("he-IL", { day: "numeric" })}
                    </div>
                    {isToday && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-500" />}
                  </div>
                );
              })}
            </div>

            {/* Hour rows */}
            {hours.map((h) => (
              <div key={h} className="grid border-b border-line-soft last:border-b-0" style={{ gridTemplateColumns: "60px repeat(6, 1fr)" }}>
                <div className="py-1.5 pe-2.5 text-end text-[10.5px] font-medium tabular-nums text-ink-400">{String(h).padStart(2, "0")}:00</div>
                {days.map((d) => {
                  const isToday = d.getTime() === today.getTime();
                  const slotAppts = apptsForDay(d).filter((a) => new Date(a.starts_at).getHours() === h);
                  return (
                    <div key={d.toISOString()} className={`relative min-h-[60px] border-s border-line-soft ${isToday ? "bg-brand-50/30" : ""}`}>
                      {/* invisible click targets for the two half-hours */}
                      <button className="absolute inset-x-0 top-0 h-1/2 transition-colors hover:bg-brand-50/60" onClick={() => openCreate(d, h, false)} title="קביעת תור" />
                      <button className="absolute inset-x-0 bottom-0 h-1/2 transition-colors hover:bg-brand-50/60" onClick={() => openCreate(d, h, true)} title="קביעת תור" />
                      <div className="pointer-events-none relative z-10 space-y-1 p-1">
                        {slotAppts.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => setModal({ mode: "view", appt: a })}
                            className={`pointer-events-auto block w-full rounded-lg border px-2 py-1.5 text-right text-[11px] font-semibold leading-tight shadow-xs transition-all hover:shadow-card ${STATUS_STYLE[a.status]}`}
                          >
                            <span className="block truncate">{patientName(a.patient_id)}</span>
                            <span className="mt-0.5 block text-[10px] font-medium tabular-nums opacity-75">
                              {hhmm(new Date(a.starts_at))}–{hhmm(new Date(a.ends_at))}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-[12px] font-medium text-ink-500">
        {(Object.keys(APPT_STATUS_HE) as AppointmentStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`dot h-2 w-2 ${STATUS_DOT[s]}`} />
            {APPT_STATUS_HE[s]}
          </span>
        ))}
      </div>

      {/* ── Create modal ── */}
      {modal?.mode === "create" && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-glow">
                  <CalendarDays size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-ink-900">תור חדש</h2>
                  <p className="text-[12.5px] text-ink-500">
                    {modal.startsAt.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                </div>
              </div>
              <button onClick={() => setModal(null)} className="btn-icon"><X size={18} /></button>
            </div>
            <form onSubmit={create} className="space-y-4">
              <div>
                <label className="label">מטופל/ת</label>
                <select className="select" value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
                  <option value="">בחרו מטופל…</option>
                  {patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                </select>
              </div>
              {therapists.length > 1 && (
                <div>
                  <label className="label">מטפל/ת</label>
                  <select className="select" value={form.therapist_id} onChange={(e) => setForm({ ...form, therapist_id: e.target.value })}>
                    {therapists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">מועד</label>
                  <input dir="ltr" type="datetime-local" className="input" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
                </div>
                <div>
                  <label className="label">משך (דקות)</label>
                  <select className="select" value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}>
                    {[30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} דקות</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">הערות</label>
                <input className="input" value={form.notes} placeholder="לא חובה" onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">{error}</div>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setModal(null)} className="btn-ghost">ביטול</button>
                <button type="submit" disabled={saving} className="btn-primary"><Plus size={15} /> {saving ? "שומר…" : "קביעת תור"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── View / manage modal ── */}
      {modal?.mode === "view" && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="avatar h-11 w-11 text-[15px]">{patientName(modal.appt.patient_id).charAt(0)}</span>
                <div>
                  {modal.appt.patient_id ? (
                    <Link
                      href={`/patients/${modal.appt.patient_id}`}
                      className="group inline-flex items-center gap-1.5 text-lg font-bold text-ink-900 transition-colors hover:text-brand-700"
                    >
                      {patientName(modal.appt.patient_id)}
                      <ArrowUpLeft size={15} className="text-ink-400 transition-colors group-hover:text-brand-700" />
                    </Link>
                  ) : (
                    <h2 className="text-lg font-bold text-ink-900">{patientName(modal.appt.patient_id)}</h2>
                  )}
                  <span className={`badge mt-1 ${
                    modal.appt.status === "scheduled" ? "badge-brand" :
                    modal.appt.status === "completed" ? "badge-green" :
                    modal.appt.status === "no_show" ? "badge-amber" : "badge-gray"
                  }`}>
                    <span className={`dot ${STATUS_DOT[modal.appt.status]}`} />
                    {APPT_STATUS_HE[modal.appt.status]}
                  </span>
                </div>
              </div>
              <button onClick={() => setModal(null)} className="btn-icon"><X size={18} /></button>
            </div>

            <div className="space-y-3 rounded-2xl border border-line bg-surface-2 p-4 text-sm">
              <div className="flex items-center gap-2.5 text-ink-700">
                <Clock size={15} className="shrink-0 text-ink-400" />
                <span>
                  {new Date(modal.appt.starts_at).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}
                  {" · "}
                  <span className="font-semibold text-ink-900 tabular-nums">
                    {hhmm(new Date(modal.appt.starts_at))}–{hhmm(new Date(modal.appt.ends_at))}
                  </span>
                </span>
              </div>
              {modal.appt.therapist_id && (
                <div className="flex items-center gap-2.5 text-ink-700">
                  <User size={15} className="shrink-0 text-ink-400" />
                  <span>{therapistName(modal.appt.therapist_id)}</span>
                </div>
              )}
              {modal.appt.notes && (
                <div className="flex items-start gap-2.5 text-ink-600">
                  <StickyNote size={15} className="mt-0.5 shrink-0 text-ink-400" />
                  <span>{modal.appt.notes}</span>
                </div>
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              {modal.appt.status === "scheduled" && (
                <>
                  <button onClick={() => setStatus(modal.appt.id, "completed")} className="btn-primary !bg-none !bg-emerald-600 hover:!bg-emerald-700 !shadow-none">
                    <Check size={15} /> התקיים
                  </button>
                  <button onClick={() => setStatus(modal.appt.id, "no_show")} className="btn-ghost !border-amber-200 !text-amber-700 hover:!bg-amber-50">
                    <UserX size={15} /> לא הגיע
                  </button>
                  <button onClick={() => setStatus(modal.appt.id, "cancelled")} className="btn-ghost">
                    <Ban size={15} /> ביטול תור
                  </button>
                </>
              )}
              {modal.appt.status !== "scheduled" && (
                <button onClick={() => setStatus(modal.appt.id, "scheduled")} className="btn-ghost">החזרה למתוכנן</button>
              )}
              <button onClick={() => remove(modal.appt.id)} className="btn-ghost !text-red-600 hover:!bg-red-50 hover:!border-red-200">
                <Trash2 size={15} /> מחיקה
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
