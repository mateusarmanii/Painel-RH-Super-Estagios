import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatInteger } from "./format.js";

// Evolução no período: uma linha por série visível, num eixo só (todas são contagens).
function TrendTooltip({ active, payload, series }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="min-w-40 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-semibold capitalize text-slate-900">{point.fullLabel}</p>
      {series.map((item) => (
        <p key={item.key} className="flex items-center gap-2 py-0.5 text-slate-600">
          <span aria-hidden="true" className="h-0.5 w-3 rounded" style={{ backgroundColor: item.color }} />
          <span className="flex-1">{item.label}</span>
          <span className="font-semibold tabular-nums text-slate-900">{formatInteger(point[item.key])}</span>
        </p>
      ))}
    </div>
  );
}

export default function TrendChart({ data, series }) {
  const showDots = data.length <= 16;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="shortLabel" tickLine={false} axisLine={false} minTickGap={16} tick={{ fill: "#64748b", fontSize: 11 }} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
        <Tooltip cursor={{ stroke: "#94a3b8", strokeDasharray: "3 3" }} content={<TrendTooltip series={series} />} />
        {series.map((item) => (
          <Line
            key={item.key}
            dataKey={item.key}
            name={item.label}
            type="monotone"
            stroke={item.color}
            strokeWidth={2}
            dot={showDots ? { r: 3, strokeWidth: 2, stroke: "#ffffff", fill: item.color } : false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "#ffffff" }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
