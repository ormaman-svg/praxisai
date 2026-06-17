// PROM (Patient-Reported Outcome Measure) trend chart — server-safe SVG sparkline.
// Shows WhatsApp-collected weekly scores over time with improvement indicator.
export default function PromChart({
  data,
  scaleLabel = "PROM",
  improvementLower = false,
}: {
  data: { date: string; value: number; label?: string }[];
  scaleLabel?: string;
  improvementLower?: boolean;
}) {
  if (data.length < 2) return null;

  const W = 260, H = 110, P = 14;
  const maxVal = Math.max(...data.map((d) => d.value), 10);
  const xs = data.map((_, i) => P + (i * (W - 2 * P)) / Math.max(data.length - 1, 1));
  const ys = data.map((d) => H - P - (d.value / maxVal) * (H - 2 * P));
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");

  const last = data[data.length - 1].value;
  const first = data[0].value;
  const improving = improvementLower ? last < first : last > first;
  const stable = last === first;

  const tickVals = maxVal === 10 ? [0, 5, 10] : [0, Math.round(maxVal / 2), maxVal];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`מגמת ${scaleLabel}`}>
        {tickVals.map((v) => {
          const y = H - P - (v / maxVal) * (H - 2 * P);
          return (
            <g key={v}>
              <line x1={P} x2={W - P} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
              <text x={W - P + 2} y={y + 3} fontSize={8} fill="#94a3b8">{v}</text>
            </g>
          );
        })}
        {/* Fill gradient */}
        <defs>
          <linearGradient id="prom-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${path} L${xs[xs.length - 1]},${H - P} L${xs[0]},${H - P} Z`}
          fill="url(#prom-fill)"
        />
        <path d={path} fill="none" stroke="#7c3aed" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {xs.map((x, i) => (
          <circle key={i} cx={x} cy={ys[i]} r={3} fill="#7c3aed" />
        ))}
      </svg>
      <p className={`mt-1 text-xs font-semibold ${stable ? "text-slate-500" : improving ? "text-emerald-600" : "text-amber-600"}`}>
        {stable
          ? `יציב: ${scaleLabel} ${last}`
          : improving
          ? <>שיפור: <span dir="ltr">{first} → {last}</span></>
          : <>ירידה: <span dir="ltr">{first} → {last}</span></>}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-400">
        {data.length} מדידות · {new Date(data[0].date).toLocaleDateString("he-IL")} עד {new Date(data[data.length - 1].date).toLocaleDateString("he-IL")}
      </p>
    </div>
  );
}
