"use client";

import { useMemo, useState } from "react";
import { Clock, Banknote, CalendarDays, TrendingUp } from "lucide-react";

/* Interactive ROI calculator — the visitor moves sliders, savings update live.
   Assumption (shown to the user): with praxisAI documentation drops to ~2
   minutes of review per treatment. 22 working days per month.              */

const REVIEW_MINUTES = 2;
const WORK_DAYS = 22;

function Slider({
  label, value, min, max, step = 1, unit, onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number; unit: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[13px] font-semibold text-slate-300">{label}</span>
        <span className="font-display text-lg font-bold text-white">
          {value.toLocaleString("he-IL")}
          <span className="mr-1 text-xs font-normal text-slate-400">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        dir="ltr"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="roi-range w-full"
        style={{ "--pct": `${pct}%` } as React.CSSProperties}
        aria-label={label}
      />
    </div>
  );
}

export default function RoiCalculator() {
  const [perDay, setPerDay] = useState(12); // treatments per day
  const [docMin, setDocMin] = useState(12); // documentation minutes per treatment today
  const [hourly, setHourly] = useState(250); // value of one work hour (₪)

  const r = useMemo(() => {
    const savedPerTreatment = Math.max(docMin - REVIEW_MINUTES, 0);
    const minutesPerMonth = savedPerTreatment * perDay * WORK_DAYS;
    const hoursPerMonth = minutesPerMonth / 60;
    const moneyPerMonth = hoursPerMonth * hourly;
    const daysPerYear = (hoursPerMonth * 12) / 8;
    return {
      hoursPerMonth: Math.round(hoursPerMonth),
      moneyPerMonth: Math.round(moneyPerMonth / 50) * 50,
      moneyPerYear: Math.round((moneyPerMonth * 12) / 500) * 500,
      daysPerYear: Math.round(daysPerYear),
    };
  }, [perDay, docMin, hourly]);

  const results = [
    { icon: Clock, big: `${r.hoursPerMonth.toLocaleString("he-IL")} שעות`, small: "חוזרות לקליניקה בכל חודש" },
    { icon: Banknote, big: `₪${r.moneyPerMonth.toLocaleString("he-IL")}`, small: "שווי הזמן הנחסך — בחודש" },
    { icon: TrendingUp, big: `₪${r.moneyPerYear.toLocaleString("he-IL")}`, small: "שווי שנתי מצטבר" },
    { icon: CalendarDays, big: `${r.daysPerYear.toLocaleString("he-IL")} ימי עבודה`, small: "מתפנים בכל שנה" },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* inputs */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-7 backdrop-blur lg:col-span-2">
        <h3 className="mb-6 font-display text-lg font-bold text-white">הנתונים של הקליניקה שלכם</h3>
        <div className="space-y-7">
          <Slider label="טיפולים ביום" value={perDay} min={4} max={40} unit="טיפולים" onChange={setPerDay} />
          <Slider label="דקות תיעוד לטיפול (היום)" value={docMin} min={5} max={25} unit="דקות" onChange={setDocMin} />
          <Slider label="שווי שעת עבודה" value={hourly} min={100} max={600} step={10} unit="₪" onChange={setHourly} />
        </div>
        <p className="mt-7 border-t border-white/10 pt-4 text-[11.5px] leading-relaxed text-slate-400">
          החישוב מניח כ‑{REVIEW_MINUTES} דקות עיון ואישור לרשומה עם praxisAI, ו‑{WORK_DAYS} ימי
          עבודה בחודש. הערכה בלבד — התוצאה בפועל תלויה באופי הקליניקה.
        </p>
      </div>

      {/* results */}
      <div className="grid content-center gap-4 sm:grid-cols-2 lg:col-span-3">
        {results.map(({ icon: Icon, big, small }) => (
          <div
            key={small}
            className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[.07] to-white/[.02] p-6 backdrop-blur transition-transform duration-300 hover:-translate-y-1"
          >
            <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand to-violet-600 text-white shadow-glow">
              <Icon className="h-4.5 w-4.5" size={18} />
            </div>
            <div className="font-display text-2xl font-bold text-brand-100 sm:text-3xl" dir="rtl">{big}</div>
            <div className="mt-1.5 text-[13px] text-slate-300">{small}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
