import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Contratações por mês: uma série só (o título do card já diz o que é), barras azul-marinho e o mês atual em âmbar.
function MonthTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const month = payload[0].payload;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold capitalize text-slate-900">{month.fullLabel}</p>
      <p className="mt-0.5 text-slate-600">
        {month.total} {month.total === 1 ? "contratação" : "contratações"}
      </p>
    </div>
  );
}

export default function HiresChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 12, right: 8, left: -24, bottom: 0 }}>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" tick={{ fill: "#64748b", fontSize: 11 }} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
        <Tooltip cursor={{ fill: "#f1f5f9" }} content={<MonthTooltip />} />
        <Bar dataKey="total" name="Contratações" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
          {data.map((month) => (
            <Cell key={month.key} fill={month.current ? "#f7b31b" : "#2b3d69"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
