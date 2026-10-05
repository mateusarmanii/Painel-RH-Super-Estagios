import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const percentFormat = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

function StageTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const stage = payload[0].payload;

  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-slate-900">{stage.label}</p>
      <p className="mt-0.5 text-slate-600">
        {stage.total} {stage.total === 1 ? "candidatura" : "candidaturas"} · {percentFormat.format(stage.share)} do total
      </p>
    </div>
  );
}

export default function FunnelChart({ data }) {
  // Porcentagem de cada etapa em relação à soma das etapas do funil.
  const total = data.reduce((sum, stage) => sum + stage.total, 0);
  const stages = data.map((stage) => ({
    ...stage,
    share: total ? stage.total / total : 0,
    caption: `${stage.total} · ${percentFormat.format(total ? stage.total / total : 0)}`,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={stages} margin={{ top: 24, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "#475569", fontSize: 12 }}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "#64748b", fontSize: 12 }}
        />
        <Tooltip cursor={{ fill: "#f1f5f9" }} content={<StageTooltip />} />
        <Bar
          dataKey="total"
          name="Candidaturas"
          fill="#0369a1"
          radius={[4, 4, 0, 0]}
          maxBarSize={54}
          isAnimationActive={false}
        >
          {/* Texto próprio para o rótulo não quebrar linha em barras estreitas. */}
          <LabelList
            dataKey="caption"
            content={({ x, y, width, value }) => (
              <text x={x + width / 2} y={y - 8} textAnchor="middle" fill="#334155" fontSize={12}>
                {value}
              </text>
            )}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
