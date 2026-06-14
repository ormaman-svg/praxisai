"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronLeft, Plus, X, CalendarDays, Trash2, Check, Ban, UserX } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { APPT_STATUS_HE, type Appointment, type AppointmentStatus } from "@/lib/types";

type PatientLite = { id: string; first_name: string; last_name: string };
type TherapistLite = { id: string; name: string };

const DAY_START = 8;   // 08:00
const DAY_END = 20;    // 20:00
const SLOT_MIN = 30;

const STATUS_STYLE: Record<AppointmentStatus, string> = {
  scheduled: "border-brand/40 bg-brand-50 text-brand hover:bg-brand-100",
  completed: "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
  cancelled: "border-slate-200 bg-slate-50 text-slate-400 line-through hover:bg-slate-100",
  no_show:   "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100",
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
    const { error } = await supabase.from("appointments").insert({
      clinic_id: clinicId,
      patient_id: form.patient_id,
      therapist_id: form.therapist_id || null,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      notes: form.notes.trim() || null,
      created_by: userId,
    });
    setSaving(false);
    if (error) { setError("שמירת התור נכשלה — נסו שוב."); return; }
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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">יומן תורים</h1>
          <p className="mt-1 text-sm text-slate-500">תזמון, מעקב והשלמת תורים — לחצו על משבצת ריקה לקביעת תור.</p>
        </div>
        <div className="flex items-end gap-3">
          {therapists.length > 1 && (
            <div className="w-44">
              <label className="label">מטפל/ת</label>
              <select className="input" value={therapistFilter} onChange={(e) => setTherapistFilter(e.target.value)}>
                <option value="">כל הצוות</option>
                {therapists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-center gap-1 rounded-lg border border-line bg-white p-1">
            <button onClick={() => setWeekStart((w) => addDays(w, -7))} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" title="שבוע קודם">
              <ChevronRight size={16} />
            </button>
            <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="rounded-md px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">
              היום
            </button>
            <button onClick={() => setWeekStart((w) => addDays(w, 7))} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" title="שבוע הבא">
              <ChevronLeft size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <CalendarDays size={16} className="text-brand" /> {weekLabel}
      </div>

      {/* Week grid */}
      <div className="card overflow-x-auto">
        <div className="min-w-[760px]">
          {/* Day headers */}
          <div className="grid border-b border-line" style={{ gridTemplateColumns: "52px repeat(6, 1fr)" }}>
            <div />
            {days.map((d) => {
              const isToday = d.getTime() === today.getTime();
              return (
                <div key={d.toISOString()} className={`border-r border-line px-2 py-2.5 text-center ${isToday ? "bg-brand-50" : ""}`}>
                  <div className={`text-[12px] font-bold ${isToday ? "text-brand" : "text-slate-700"}`}>
                    {d.toLocaleDateString("he-IL", { weekday: "short" })}
                  </div>
                  <div className={`text-[11px] ${isToday ? "text-brand" : "text-slate-400"}`}>
                    {d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hour rows */}
          {hours.map((h) => (
            <div key={h} className="grid border-b border-line last:border-b-0" style={{ gridTemplateColumns: "52px repeat(6, 1fr)" }}>
              <div className="py-1 pe-2 text-end text-[10.5px] text-slate-400">{String(h).padStart(2, "0")}:00</div>
              {days.map((d) => {
                const slotAppts = apptsForDay(d).filter((a) => new Date(a.starts_at).getHours() === h);
                return (
                  <div key={d.toISOString()} className="relative min-h-[58px] border-r border-line">
                    {/* invisible click targets for the two half-hours */}
                    <button className="absolute inset-x-0 top-0 h-1/2 hover:bg-slate-50/80" onClick={() => openCreate(d, h, false)} title="קביעת תור" />
                    <button className="absolute inset-x-0 bottom-0 h-1/2 hover:bg-slate-50/80" onClick={() => openCreate(d, h, true)} title="קביעת תור" />
                    <div className="relative z-10 space-y-1 p-1 pointer-events-none">
                      {slotAppts.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => setModal({ mode: "view", appt: a })}
                          className={`pointer-events-auto block w-full rounded-md border px-1.5 py-1 text-right text-[11px] font-semibold leading-tight transition-colors ${STATUS_STYLE[a.status]}`}
                        >
                          <span className="block truncate">{patientName(a.patient_id)}</span>
                          <span className="block text-[10px] font-normal opacity-75">
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

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-[11.5px] text-slate-500">
        {(Object.keys(APPT_STATUS_HE) as AppointmentStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full border ${STATUS_STYLE[s].split(" ").slice(0, 2).join(" ")}`} />
            {APPT_STATUS_HE[s]}
          </span>
        ))}
      </div>

      {/* ── Create modal ── */}
      {modal?.mode === "create" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => setModal(null)}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">תור חדש</h2>
              <button onClick={() => setModal(null)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <form onSubmit={create} className="space-y-4">
              <div>
                <label className="label">מטופל/ת</label>
                <select className="input" value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
                  <option value="">בחרו מטופל…</option>
                  {patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                </select>
              </div>
              {therapists.length > 1 && (
                <div>
                  <label className="label">מטפל/ת</label>
                  <select className="input" value={form.therapist_id} onChange={(e) => setForm({ ...form, therapist_id: e.target.value })}>
                    {therapists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">מועד</label>
                  <input type="datetime-local" className="input" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
                </div>
                <div>
                  <label className="label">משך (דקות)</label>
                  <select className="input" value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}>
                    {[30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} דקות</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">הערות</label>
                <input className="input" value={form.notes} placeholder="לא חובה" onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">{error}</div>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setModal(null)} className="btn-ghost">ביטול</button>
                <button type="submit" disabled={saving} className="btn-primary"><Plus size={15} /> {saving ? "שומר…" : "קביעת תור"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── View / manage modal ── */}
      {modal?.mode === "view" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => setModal(null)}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">{patientName(modal.appt.patient_id)}</h2>
              <button onClick={() => setModal(null)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="space-y-1.5 text-sm text-slate-600">
              <p>
                {new Date(modal.appt.starts_at).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}
                {" · "}
                {hhmm(new Date(modal.appt.starts_at))}–{hhmm(new Date(modal.appt.ends_at))}
              </p>
              {modal.appt.therapist_id && <p>מטפל/ת: {therapistName(modal.appt.therapist_id)}</p>}
              {modal.appt.notes && <p className="text-slate-500">{modal.appt.notes}</p>}
              <p>
                סטטוס: <span className="font-semibold text-slate-800">{APPT_STATUS_HE[modal.appt.status]}</span>
              </p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {modal.appt.status === "scheduled" && (
                <>
                  <button onClick={() => setStatus(modal.appt.id, "completed")} className="btn-primary !bg-emerald-600 hover:!bg-emerald-700">
                    <Check size={15} /> התקיים
                  </button>
                  <button onClick={() => setStatus(modal.appt.id, "no_show")} className="btn-ghost !border !border-amber-200 !text-amber-700">
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
              <button onClick={() => remove(modal.appt.id)} className="btn-ghost !text-red-600">
                <Trash2 size={15} /> מחיקה
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
