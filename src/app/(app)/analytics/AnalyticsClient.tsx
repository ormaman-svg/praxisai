"use client";

import { useMemo, useState } from "react";
import { Activity, FileText, TrendingDown, Users } from "lucide-react";
import { TREATMENT_TYPE_HE } from "@/lib/types";

type P = { id: string; first_name: string; last_name: string; kupah: string | null; status: string; created_at: string };
type T = { id: string; patient_id: string; treated_at: string; type: string; vas: number | null };
type M = { id: string; patient_id: string; kind: string; joint: string | null; movement: string | null; value: number; unit: string; recorded_at: string };
type D = { id: string; patient_id: string | null; created_at: string };

const BLUE = "#2563eb";
const PALETTE = ["#2563eb", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

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

function Line({ points, yMax = 10, suffix = "" }: { points: { label: string; value: number }[]; yMax?: number; suffix?: string }) {
  const W = 520, H = 190, P = { t: 14, b: 26, s: 30 };
  const xs = points.map((_, i) => P.s + (i * (W - P.s - 14)) / Math.max(points.length - 1, 1));
  const ys = points.map((p) => H - P.b - (p.value / yMax) * (H - P.t - P.b));
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const area = `${path} L${xs[xs.length - 1]},${H - P.b} L${xs[0]},${H - P.b} Z`;
  return (
    <svg style={{ direction: "ltr" }} viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0, yMax / 2, yMax].map((v) => {
        const y = H - P.b - (v / yMax) * (H - P.t - P.b);
        return (
          <g key={v}>
            <line x1={P.s} x2={W - 10} y1={y} y2={y} stroke="#e2e8f0" />
            <text x={P.s - 6} y={y + 3} fontSize={9} fill="#94a3b8" textAnchor="end">{v}{suffix}</text>
          </g>
        );
      })}
      <path d={area} fill={BLUE} opacity={0.07} />
      <path d={path} fill="none" stroke={BLUE} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {xs.map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={ys[i]} r={3.5} fill="#fff" stroke={BLUE} strokeWidth={2} />
          {(points.length <= 10 || i % 2 === 0) && (
            <text x={x} y={H - 8} fontSize={9} fill="#94a3b8" textAnchor="middle">{points[i].label}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

function Donut({ data }: { data: { label: string; value: number }[] }) {
  const total = data.reduce((a, b) => a + b.value, 0) || 1;
  const R = 56, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="flex items-center gap-6">
      <svg style={{ direction: "ltr" }} viewBox="0 0 160 160" className="h-36 w-36 shrink-0">
        <g transform="rotate(-90 80 80)">
          {data.map((d, i) => {
            const frac = d.value / total;
            const dash = `${frac * C} ${C}`;
            const offset = -acc * C;
            acc += frac;
            return (
              <circle key={i} cx={80} cy={80} r={R} fill="none" stroke={PALETTE[i % PALETTE.length]}
                      strokeWidth={22} strokeDasharray={dash} strokeDashoffset={offset} />
            );
          })}
        </g>
        <text x={80} y={76} fontSize={22} fontWeight={700} fill="#0f172a" textAnchor="middle">{total}</text>
        <text x={80} y={94} fontSize={9} fill="#94a3b8" textAnchor="middle">סה&Prime;כ</text>
      </svg>
      <ul className="space-y-1.5 text-[12.5px]">
        {data.map((d, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="text-slate-600">{d.label}</span>
            <span className="font-semibold text-slate-800">{d.value}</span>
            <span className="text-slate-400">({Math.round((d.value / total) * 100)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- page ---------- */
export default function AnalyticsClient({
  patients, treatments, measurements, docs,
}: { patients: P[]; treatments: T[]; measurements: M[]; docs: D[] }) {
  const [patientId, setPatientId] = useState<string>("");

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

  const kpis = [
    { label: "טיפולים ב‑30 הימים האחרונים", value: tMonth, icon: Activity, tint: "bg-brand-50 text-brand" },
    {
      label: "VAS ממוצע (מגמה)",
      value: vasValues.length ? vasRecent.toFixed(1) : "—",
      sub: vasValues.length >= 4 ? (vasDelta <= 0 ? `▼ ${Math.abs(vasDelta).toFixed(1)} שיפור` : `▲ ${vasDelta.toFixed(1)} החמרה`) : undefined,
      subClass: vasDelta <= 0 ? "text-emerald-600" : "text-red-500",
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
          <p className="mt-1 text-sm text-slate-500">מדדים ומגמות — 6 החודשים האחרונים, בזמן אמת מהמערכת.</p>
        </div>
        <div className="w-64">
          <label className="label">סינון לפי מטופל</label>
          <select className="input" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">כל הקליניקה</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
            ))}
          </select>
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
              מגמת כאב VAS {patientId ? "(לפי טיפול)" : "(ממוצע שבועי)"}
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
