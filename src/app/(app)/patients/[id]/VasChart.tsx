// Server-safe SVG sparkline for VAS trend (0–10, lower is better)
export default function VasChart({ data }: { data: { date: string; value: number }[] }) {
  const W = 260, H = 110, P = 14;
  const xs = data.map((_, i) => P + (i * (W - 2 * P)) / Math.max(data.length - 1, 1));
  const ys = data.map((d) => H - P - (d.value / 10) * (H - 2 * P));
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const last = data[data.length - 1].value;
  const first = data[0].value;
  const improving = last < first;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="מגמת VAS">
        {[0, 5, 10].map((v) => {
          const y = H - P - (v / 10) * (H - 2 * P);
          return (
            <g key={v}>
              <line x1={P} x2={W - P} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
              <text x={W - P + 2} y={y + 3} fontSize={8} fill="#94a3b8">{v}</text>
            </g>
          );
        })}
        <path d={path} fill="none" stroke="#2563eb" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {xs.map((x, i) => <circle key={i} cx={x} cy={ys[i]} r={3} fill="#2563eb" />)}
      </svg>
      <p className={`mt-1 text-xs font-semibold ${improving ? "text-emerald-600" : "text-amber-600"}`}>
        {improving ? `שיפור: ${first} → ${last}` : `נוכחי: VAS ${last}`}
      </p>
    </div>
  );
}
