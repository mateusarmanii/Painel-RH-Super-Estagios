import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";

// Mini linha com a evolução no período (decorativa: os números estão no gráfico de evolução).
function Sparkline({ values }) {
  if (!values?.length || values.length < 2) return null;
  const max = Math.max(...values, 1);
  const width = 100;
  const height = 28;
  const step = width / (values.length - 1);
  const points = values.map((value, index) => `${(index * step).toFixed(2)},${(height - 2 - (value / max) * (height - 4)).toFixed(2)}`);

  return (
    <svg aria-hidden="true" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="mt-3 h-7 w-full overflow-visible">
      <polygon points={`0,${height} ${points.join(" ")} ${width},${height}`} fill="#2b3d69" fillOpacity="0.07" />
      <polyline points={points.join(" ")} fill="none" stroke="#2b3d69" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Variação: seta + texto; verde quando melhorou, vermelho quando piorou (nunca só a cor).
function Delta({ delta, compareLabel, compareTitle }) {
  if (!delta) return <p className="mt-1 text-xs text-slate-400">Sem base para comparar</p>;
  const Icon = delta.direction === "up" ? ArrowUpRight : delta.direction === "down" ? ArrowDownRight : Minus;
  const tone = delta.good === null ? "bg-slate-100 text-slate-600" : delta.good ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700";
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500">
      <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-bold tabular-nums ${tone}`}>
        <Icon size={13} aria-hidden="true" />
        {delta.direction === "flat" ? "Igual" : delta.text}
      </span>
      <span title={compareTitle}>{compareLabel}</span>
    </p>
  );
}

// Valor com texto ("17,5 dias"): o Liquid Glass usa um tamanho menor, para não quebrar a linha.
const valorComTexto = (value) => /\p{L}/u.test(String(value));

export default function KpiCard({ label, value, detail, icon: Icon, delta, showDelta = false, compareLabel, compareTitle, spark, to, valueSize = "text-3xl" }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold text-slate-500">{label}</p>
        {Icon && (
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-marinho-900 text-ambar-400">
            <Icon size={15} />
          </span>
        )}
      </div>
      <p className={`kpi-valor ${valorComTexto(value) ? "kpi-valor-texto" : ""} mt-1 font-extrabold tabular-nums tracking-tight text-marinho-900 ${valueSize}`}>{value}</p>
      {showDelta ? <Delta delta={delta} compareLabel={compareLabel} compareTitle={compareTitle} /> : <p className="mt-1 text-xs text-slate-500">{detail}</p>}
      {showDelta && detail && <p className="mt-0.5 text-xs text-slate-400">{detail}</p>}
      <Sparkline values={spark} />
      {to && (
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-marinho-700 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          Ver detalhes <ArrowRight size={12} />
        </span>
      )}
    </>
  );
  const className = "group flex min-w-0 flex-col superficie rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";

  if (!to) return <article className={className}>{body}</article>;
  return (
    <Link
      to={to}
      className={`${className} transition hover:-translate-y-0.5 hover:border-marinho-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ambar-400`}
    >
      {body}
    </Link>
  );
}
