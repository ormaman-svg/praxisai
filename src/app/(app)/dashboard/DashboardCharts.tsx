"use client";

import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";

const BRAND_TEAL   = "#0D9488";
const ELECTRIC_BLUE = "#3B82F6";
const CHART_COLORS = [
  "#0D9488", "#3B82F6", "#8B5CF6", "#F59E0B", "#10B981", "#EC4899",
];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 shadow-card text-[12px]">
      <p className="font-semibold text-ink-900">{payload[0]?.value} טיפולים</p>
      <p className="text-ink-500">{label}</p>
    </div>
  );
}

function BarTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 shadow-card text-[12px]">
      <p className="font-semibold text-ink-900">{payload[0]?.payload?.name}</p>
      <p className="text-ink-500">{payload[0]?.value} טיפולים</p>
    </div>
  );
}

export default function DashboardCharts({
  chartData,
  typeData,
}: {
  chartData: { date: string; label: string; count: number }[];
  typeData:  { name: string; value: number }[];
}) {
  // Show every 5th label to avoid clutter
  const tickIndices = new Set(
    chartData
      .map((_, i) => i)
      .filter((i) => i % 5 === 0 || i === chartData.length - 1)
  );

  return (
    <div className="space-y-6">
      {/* Area chart */}
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={BRAND_TEAL}    stopOpacity={0.22} />
                <stop offset="100%" stopColor={BRAND_TEAL}    stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#94A3B8" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              tickFormatter={(_, i) => (tickIndices.has(i) ? chartData[i]?.label ?? "" : "")}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#94A3B8" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={28}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: BRAND_TEAL, strokeWidth: 1, strokeDasharray: "4 4" }} />
            <Area
              type="monotone"
              dataKey="count"
              stroke={BRAND_TEAL}
              strokeWidth={2}
              fill="url(#tealGrad)"
              dot={false}
              activeDot={{ r: 4, fill: BRAND_TEAL, stroke: "#fff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Type breakdown */}
      {typeData.length > 0 && (
        <div>
          <p className="section-label mb-3">סוגי טיפול החודש</p>
          <div style={{ height: 120 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData} margin={{ top: 0, right: 4, bottom: 0, left: -20 }} barSize={24}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#94A3B8" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94A3B8" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip content={<BarTooltip />} cursor={{ fill: "rgba(13,148,136,0.05)" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {typeData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
