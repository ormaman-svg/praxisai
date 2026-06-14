import { Line } from "@/components/charts";

type Measurement = {
  kind: string;
  joint: string | null;
  movement: string | null;
  value: number;
  recorded_at: string;
};

const COLORS = ["#2563eb", "#10b981", "#8b5cf6"];

export default function RomChart({ measurements }: { measurements: Measurement[] }) {
  const rom = measurements.filter((m) => m.kind === "ROM");
  if (!rom.length) return null;

  // Group by "joint · movement"
  const groups = new Map<string, Measurement[]>();
  rom.forEach((m) => {
    const k = [m.joint, m.movement].filter(Boolean).join(" · ");
    groups.set(k, [...(groups.get(k) ?? []), m]);
  });

  // Top 3 by count
  const topGroups = Array.from(groups.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3);

  return (
    <div className="space-y-5">
      {topGroups.map(([key, items], idx) => {
        const maxV = Math.max(...items.map((i) => i.value), 90);
        const yMax = Math.ceil(maxV / 30) * 30;
        const points = items.slice(-12).map((m) => ({
          label: new Date(m.recorded_at).toLocaleDateString("he-IL", { day: "numeric", month: "short" }),
          value: m.value,
        }));
        return (
          <div key={key}>
            <p className="mb-1.5 text-xs font-semibold text-slate-600">{key}</p>
            <Line points={points} yMax={yMax} suffix="°" color={COLORS[idx % COLORS.length]} />
          </div>
        );
      })}
    </div>
  );
}
