// Shared server-safe SVG chart primitives — no "use client" needed.
const BLUE = "#2563eb";
const PALETTE = ["#2563eb", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

export function Line({
  points,
  yMax = 10,
  suffix = "",
  color = BLUE,
}: {
  points: { label: string; value: number }[];
  yMax?: number;
  suffix?: string;
  color?: string;
}) {
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
            <text x={P.s - 6} y={y + 3} fontSize={9} fill="#94a3b8" textAnchor="end">
              {v}{suffix}
            </text>
          </g>
        );
      })}
      <path d={area} fill={color} opacity={0.07} />
      <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {xs.map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={ys[i]} r={3.5} fill="#fff" stroke={color} strokeWidth={2} />
          {(points.length <= 10 || i % 2 === 0) && (
            <text x={x} y={H - 8} fontSize={9} fill="#94a3b8" textAnchor="middle">
              {points[i].label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export function Donut({ data }: { data: { label: string; value: number }[] }) {
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
              <circle
                key={i}
                cx={80}
                cy={80}
                r={R}
                fill="none"
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth={22}
                strokeDasharray={dash}
                strokeDashoffset={offset}
              />
            );
          })}
        </g>
        <text x={80} y={76} fontSize={22} fontWeight={700} fill="#0f172a" textAnchor="middle">
          {total}
        </text>
        <text x={80} y={94} fontSize={9} fill="#94a3b8" textAnchor="middle">
          סה&Prime;כ
        </text>
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
