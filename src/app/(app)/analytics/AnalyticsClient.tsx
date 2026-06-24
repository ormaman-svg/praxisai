"use client";

import { useMemo, useState } from "react";
import { Activity, FileText, TrendingDown, Users, UserPlus, CalendarClock, Crown } from "lucide-react";
import { TREATMENT_TYPE_HE } from "@/lib/types";
import { Line, Donut } from "@/components/charts";

type P = { id: string; first_name: string; last_name: string; kupah: string | null; status: string; created_at: string };
type T = { id: string; patient_id: string; therapist_id: string | null; treated_at: string; type: string; vas: number | null };
type M = { id: string; patient_id: string; kind: string; joint: string | null; movement: string | null; value: number; unit: string; recorded_at: string };
type D = { id: string; patient_id: string | null; created_at: string };

const BLUE = "#2563eb";

/* ---------- helpers ---------- */
function weekKey(dateISO: string) {
  const d = new Date(dateISO);
  const day = (d.getDay() + 1) % 7; // week starts Sunday (IL)
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
const weekLabel = (t: number) =>
  new Date(t).toLocaleDateString("he-IL", { day: "numeric", month: "short" });

/* ---------- chart primitives (SVG, RTL-safe via dir=ltr canvas) ---------- */
// Line and Donut imported from @/components/charts

function Bars({ data, color = BLUE }: { data: { label: string; value: number }[]; color?: string }) {
  const W = 520, H = 180, P = { t: 12, b: 26, s: 8 };
  const max = Math.max(...data.map((d) => d.value), 1);
  const bw = (W - P.s * 2) / data.length;
  return (
    <svg style={{ direction: "ltr" }} viewBox={`0 0 ${W} ${H}`} className="w-full">
      {data.map((d, i) => {
        const h = (d.value / max) * (H - P.t - P.b);
        const x = P.s + i * bw;
        return (
          <g key={i}>
            <rect x={x + bw * 0.18} y={H - P.b - h} width={bw * 0.64} height={Math.max(h, 2)} rx={5} fill={color} opacity={0.9} />
            {d.value > 0 && (
              <text x={x + bw / 2} y={H - P.b - h - 5} fontSize={10} fontWeight={600} fill="#475569" textAnchor="middle">{d.value}</text>
            )}
            <text x={x + bw / 2} y={H - 8} fontSize={9} fill="#94a3b8" textAnchor="middle">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- page ---------- */
export default function AnalyticsClient({
  patients, treatments, measurements, docs, therapists, isManager,
  scaleLabel, scaleImprovementLower, templateName,
}: {
  patients: P[]; treatments: T[]; measurements: M[]; docs: D[];
  therapists: { id: string; name: string }[]; isManager: boolean;
  scaleLabel: string; scaleImprovementLower: boolean; templateName: string;
}) {
  const [patientId, setPatientId] = useState<string>("");
  const [patientQ, setPatientQ] = useState("");
  const [patientOpen, setPatientOpen] = useState(false);

  const fT = useMemo(() => (patientId ? treatments.filter((t) => t.patient_id === patientId) : treatments), [patientId, treatments]);
  const fM = useMemo(() => (patientId ? measurements.filter((m) => m.patient_id === patientId) : measurements), [patientId, measurements]);
  const fD = useMemo(() => (patientId ? docs.filter((d) => d.patient_id === patientId) : docs), [patientId, docs]);

  /* KPIs */
  const monthAgo = Date.now() - 30 * 864e5;
  const tMonth = fT.filter((t) => new Date(t.treated_at).getTime() >= monthAgo).length;
  const vasValues = fT.filter((t) => t.vas !== null).map((t) => t.vas as number);
  const half = Math.floor(vasValues.length / 2);
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const vasRecent = avg(vasValues.slice(half));
  const vasDelta = vasValues.length >= 4 ? vasRecent - avg(vasValues.slice(0, half)) : 0;
  const activePatients = patientId ? 1 : patients.filter((p) => p.status === "active").length;

  /* weekly treatments — last 10 weeks */
  const weeklyBars = useMemo(() => {
    const now = weekKey(new Date().toISOString());
    const weeks = Array.from({ length: 10 }, (_, i) => now - (9 - i) * 7 * 864e5);
    const counts = new Map<number, number>();
    fT.forEach((t) => {
      const k = weekKey(t.treated_at);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    return weeks.map((w) => ({ label: weekLabel(w), value: counts.get(w) ?? 0 }));
  }, [fT]);

  /* VAS trend — per treatment (patient view) or weekly average (clinic view) */
  const vasLine = useMemo(() => {
    const withVas = fT.filter((t) => t.vas !== null);
    if (patientId) {
      return withVas.slice(-14).map((t) => ({
        label: new Date(t.treated_at).toLocaleDateString("he-IL", { day: "numeric", month: "short" }),
        value: t.vas as number,
      }));
    }
    const byWeek = new Map<number, number[]>();
    withVas.forEach((t) => {
      const k = weekKey(t.treated_at);
      byWeek.set(k, [...(byWeek.get(k) ?? []), t.vas as number]);
    });
    return Array.from(byWeek.entries()).sort((a, b) => a[0] - b[0]).slice(-10)
      .map(([k, vals]) => ({ label: weekLabel(k), value: Math.round(avg(vals) * 10) / 10 }));
  }, [fT, patientId]);

  /* treatment types donut */
  const typeDonut = useMemo(() => {
    const c = new Map<string, number>();
    fT.forEach((t) => c.set(t.type, (c.get(t.type) ?? 0) + 1));
    return Array.from(c.entries()).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ label: TREATMENT_TYPE_HE[k] ?? k, value: v }));
  }, [fT]);

  /* clinic view: patients by kupah · patient view: ROM progress */
  const kupahBars = useMemo(() => {
    const c = new Map<string, number>();
    patients.forEach((p) => c.set(p.kupah ?? "אחר", (c.get(p.kupah ?? "אחר") ?? 0) + 1));
    return Array.from(c.entries()).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  }, [patients]);

  const romSeries = useMemo(() => {
    const rom = fM.filter((m) => m.kind === "ROM");
    if (!rom.length) return null;
    // most-measured joint+movement
    const groups = new Map<string, M[]>();
    rom.forEach((m) => {
      const k = `${m.joint ?? ""} · ${m.movement ?? ""}`;
      groups.set(k, [...(groups.get(k) ?? []), m]);
    });
    const [key, items] = Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length)[0];
    const maxV = Math.max(...items.map((i) => i.value), 90);
    return {
      key,
      yMax: Math.ceil(maxV / 30) * 30,
      points: items.slice(-14).map((m) => ({
        label: new Date(m.recorded_at).toLocaleDateString("he-IL", { day: "numeric", month: "short" }),
        value: m.value,
      })),
    };
  }, [fM]);

  /* ── Manager dashboard: per-therapist comparison + operational KPIs ── */
  const therapistRows = useMemo(() => {
    if (!isManager) return [];
    return therapists.map((th) => {
      const tx = treatments.filter((t) => t.therapist_id === th.id);
      const pats = new Set(tx.map((t) => t.patient_id));
      const vas = tx.filter((t) => t.vas !== null).map((t) => t.vas as number);
      const h = Math.floor(vas.length / 2);
      const delta = vas.length >= 4 ? avg(vas.slice(h)) - avg(vas.slice(0, h)) : null;
      const month = tx.filter((t) => new Date(t.treated_at).getTime() >= monthAgo).length;
      return { ...th, total: tx.length, month, patients: pats.size, vasDelta: delta };
    }).sort((a, b) => b.total - a.total);
  }, [isManager, therapists, treatments, monthAgo]);

  const opsKpis = useMemo(() => {
    if (!isManager) return null;
    const newPatients = patients.filter((p) => new Date(p.created_at).getTime() >= monthAgo).length;
    const treatedPatients = new Set(treatments.map((t) => t.patient_id)).size;
    const perPatient = treatedPatients ? Math.round((treatments.length / treatedPatients) * 10) / 10 : 0;
    const dayCount = new Map<number, number>();
    treatments.forEach((t) => {
      const d = new Date(t.treated_at).getDay();
      dayCount.set(d, (dayCount.get(d) ?? 0) + 1);
    });
    const peak = Array.from(dayCount.entries()).sort((a, b) => b[1] - a[1])[0];
    const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
    return {
      newPatients,
      perPatient,
      peakDay: peak ? dayNames[peak[0]] : "—",
      topTherapist: therapistRows[0]?.name ?? "—",
    };
  }, [isManager, patients, treatments, monthAgo, therapistRows]);

  const isImprovement = scaleImprovementLower ? vasDelta <= 0 : vasDelta >= 0;
  const kpis = [
    { label: "טיפולים ב‑שלושים הימים האחרונים", value: tMonth, icon: Activity, tint: "bg-brand-50 text-brand" },
    {
      label: `${scaleLabel} ממוצע`,
      value: vasValues.length ? vasRecent.toFixed(1) : "—",
      sub: vasValues.length >= 4
        ? (isImprovement ? `${scaleImprovementLower ? "▼" : "▲"} ${Math.abs(vasDelta).toFixed(1)} שיפור` : `${scaleImprovementLower ? "▲" : "▼"} ${Math.abs(vasDelta).toFixed(1)} החמרה`)
        : undefined,
      subClass: isImprovement ? "text-emerald-600" : "text-red-500",
      icon: TrendingDown, tint: "bg-emerald-50 text-emerald-600",
    },
    { label: patientId ? "מטופל בסינון" : "מטופלים פעילים", value: activePatients, icon: Users, tint: "bg-violet-50 text-violet-600" },
    { label: "מסמכים שהופקו (6 ח׳)", value: fD.length, icon: FileText, tint: "bg-amber-50 text-amber-600" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">אנליטיקות</h1>
          <p className="mt-1 text-sm text-slate-500">מדדים ומגמות — 6 החודשים האחרונים · <span className="text-slate-400">{templateName}</span></p>
        </div>
        <div className="relative w-64">
          <label className="label">סינון לפי מטופל</label>
          <input
            className="input"
            placeholder="כל הקליניקה"
            value={patientQ}
            onFocus={() => setPatientOpen(true)}
            onChange={(e) => {
              setPatientQ(e.target.value);
              setPatientOpen(true);
              if (!e.target.value) setPatientId("");
            }}
            onBlur={() => setTimeout(() => setPatientOpen(false), 150)}
          />
          {patientOpen && (() => {
            const q = patientQ.trim();
            const matches = patients
              .filter((p) => !q || `${p.first_name} ${p.last_name}`.includes(q))
              .slice(0, 8);
            return (
              <ul className="absolute z-20 mt-1 w-full rounded-xl border border-line bg-white py-1 shadow-lg">
                {q && (
                  <li
                    className="cursor-pointer px-4 py-2 text-[13px] text-slate-500 hover:bg-slate-50"
                    onMouseDown={() => { setPatientId(""); setPatientQ(""); setPatientOpen(false); }}
                  >
                    כל הקליניקה
                  </li>
                )}
                {matches.map((p) => (
                  <li
                    key={p.id}
                    className="cursor-pointer px-4 py-2 text-[13px] text-slate-800 hover:bg-brand-50"
                    onMouseDown={() => { setPatientId(p.id); setPatientQ(`${p.first_name} ${p.last_name}`); setPatientOpen(false); }}
                  >
                    {p.first_name} {p.last_name}
                  </li>
                ))}
              </ul>
            );
          })()}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-5">
            <div className={`mb-3 grid h-9 w-9 place-items-center rounded-lg ${k.tint}`}><k.icon size={18} /></div>
            <div className="text-2xl font-bold text-slate-900">{k.value}</div>
            <div className="mt-0.5 text-[12.5px] text-slate-500">{k.label}</div>
            {k.sub && <div className={`mt-1 text-xs font-semibold ${k.subClass}`}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Manager dashboard ── */}
      {isManager && !patientId && opsKpis && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Crown size={16} className="text-amber-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">לוח בקרה מנהלי</h2>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="card p-5">
              <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-sky-50 text-sky-600"><UserPlus size={18} /></div>
              <div className="text-2xl font-bold text-slate-900">{opsKpis.newPatients}</div>
              <div className="mt-0.5 text-[12.5px] text-slate-500">מטופלים חדשים החודש</div>
            </div>
            <div className="card p-5">
              <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-rose-50 text-rose-600"><Activity size={18} /></div>
              <div className="text-2xl font-bold text-slate-900">{opsKpis.perPatient}</div>
              <div className="mt-0.5 text-[12.5px] text-slate-500">ממוצע טיפולים למטופל</div>
            </div>
            <div className="card p-5">
              <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-indigo-50 text-indigo-600"><CalendarClock size={18} /></div>
              <div className="text-2xl font-bold text-slate-900">{opsKpis.peakDay}</div>
              <div className="mt-0.5 text-[12.5px] text-slate-500">יום השיא בקליניקה</div>
            </div>
            <div className="card p-5">
              <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-amber-50 text-amber-600"><Crown size={18} /></div>
              <div className="truncate text-2xl font-bold text-slate-900">{opsKpis.topTherapist}</div>
              <div className="mt-0.5 text-[12.5px] text-slate-500">מוביל/ת בטיפולים (6 ח׳)</div>
            </div>
          </div>

          {therapistRows.length > 1 && (
            <div className="card overflow-hidden">
              <div className="border-b border-line px-5 py-3.5">
                <h3 className="text-sm font-bold text-slate-900">השוואת מטפלים — 6 החודשים האחרונים</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-[13px]">
                  <thead>
                    <tr className="border-b border-line bg-slate-50 text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">
                      <th className="px-5 py-2.5">מטפל/ת</th>
                      <th className="px-4 py-2.5">טיפולים</th>
                      <th className="px-4 py-2.5">ב‑שלושים ימים</th>
                      <th className="px-4 py-2.5">מטופלים</th>
                      <th className="px-4 py-2.5">מגמת {scaleLabel}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {therapistRows.map((r, i) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-semibold text-slate-800">
                          <span className="flex items-center gap-2">
                            {i === 0 && r.total > 0 && <Crown size={13} className="text-amber-500" />}
                            {r.name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{r.total}</td>
                        <td className="px-4 py-3 text-slate-600">{r.month}</td>
                        <td className="px-4 py-3 text-slate-600">{r.patients}</td>
                        <td className="px-4 py-3">
                          {r.vasDelta === null ? (
                            <span className="text-slate-300">—</span>
                          ) : (scaleImprovementLower ? r.vasDelta <= 0 : r.vasDelta >= 0) ? (
                            <span className="font-semibold text-emerald-600">{scaleImprovementLower ? "▼" : "▲"} {Math.abs(r.vasDelta).toFixed(1)} שיפור</span>
                          ) : (
                            <span className="font-semibold text-red-500">{scaleImprovementLower ? "▲" : "▼"} {Math.abs(r.vasDelta).toFixed(1)}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {fT.length === 0 ? (
        <div className="card px-6 py-14 text-center text-sm text-slate-400">
          אין נתוני טיפולים {patientId ? "למטופל זה" : "בקליניקה"} בתקופה — הגרפים יתמלאו עם התיעוד.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-bold text-slate-900">טיפולים לפי שבוע</h2>
            <Bars data={weeklyBars} />
          </div>

          <div className="card p-5">
            <h2 className="mb-3 text-sm font-bold text-slate-900">
              מגמת {scaleLabel} {patientId ? "(לפי טיפול)" : "(ממוצע שבועי)"}
            </h2>
            {vasLine.length >= 2 ? <Line points={vasLine} yMax={10} /> : (
              <p className="py-10 text-center text-[13px] text-slate-400">נדרשים לפחות שני תיעודי VAS.</p>
            )}
          </div>

          <div className="card p-5">
            <h2 className="mb-3 text-sm font-bold text-slate-900">התפלגות סוגי טיפול</h2>
            <Donut data={typeDonut} />
          </div>

          <div className="card p-5">
            {patientId ? (
              romSeries ? (
                <>
                  <h2 className="mb-3 text-sm font-bold text-slate-900">טווח תנועה (ROM) — {romSeries.key}</h2>
                  <Line points={romSeries.points} yMax={romSeries.yMax} suffix="°" />
                </>
              ) : (
                <>
                  <h2 className="mb-3 text-sm font-bold text-slate-900">טווח תנועה (ROM)</h2>
                  <p className="py-10 text-center text-[13px] text-slate-400">אין מדידות ROM למטופל זה.</p>
                </>
              )
            ) : (
              <>
                <h2 className="mb-3 text-sm font-bold text-slate-900">מטופלים לפי קופת חולים</h2>
                <Bars data={kupahBars} color="#8b5cf6" />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
