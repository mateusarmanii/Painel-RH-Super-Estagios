import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

// Paleta categórica validada (ordem fixa, nunca reciclada); "Outros" usa cinza neutro.
const courseColors = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"];
const otherColor = "#94a3b8";
const MAX_COURSES = 6;

const percentFormat = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

// Mantém os 6 maiores cursos e soma o restante em "Outros".
function toSlices(distribution) {
  const top = distribution.slice(0, MAX_COURSES).map((item, index) => ({
    name: item.curso,
    total: item.total,
    color: courseColors[index],
  }));
  const rest = distribution.slice(MAX_COURSES);

  if (rest.length > 0) {
    top.push({
      name: `Outros (${rest.length} ${rest.length === 1 ? "curso" : "cursos"})`,
      total: rest.reduce((sum, item) => sum + item.total, 0),
      color: otherColor,
      other: true,
    });
  }

  return top;
}

function SliceTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload;

  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-marinho-900">{slice.name}</p>
      <p className="mt-0.5 text-slate-600">
        {slice.total} {slice.total === 1 ? "estudante" : "estudantes"} · {percentFormat.format(slice.total / total)}
      </p>
    </div>
  );
}

// onSelect(curso): clique numa fatia ou na legenda (o Dashboard abre Estudantes filtrado pelo curso). "Outros" não abre.
export default function CourseDonutChart({ distribution, onSelect }) {
  const slices = toSlices(distribution);
  const total = slices.reduce((sum, slice) => sum + slice.total, 0);
  const select = (slice) => onSelect && !slice.other && onSelect(slice.name);

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <div className="relative size-52 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="total"
              nameKey="name"
              innerRadius="62%"
              outerRadius="96%"
              startAngle={90}
              endAngle={-270}
              stroke="#ffffff"
              strokeWidth={2}
              cornerRadius={3}
              isAnimationActive={false}
              onClick={(slice) => select(slice.payload ?? slice)}
            >
              {slices.map((slice) => (
                <Cell key={slice.name} fill={slice.color} cursor={onSelect && !slice.other ? "pointer" : undefined} />
              ))}
            </Pie>
            <Tooltip content={<SliceTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <span className="text-3xl font-semibold tabular-nums text-marinho-900">{total}</span>
          <span className="text-xs text-slate-500">{total === 1 ? "estudante" : "estudantes"}</span>
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-0.5 text-sm" aria-label="Legenda: estudantes por curso">
        {slices.map((slice) => {
          const content = (
            <>
              <span aria-hidden="true" className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: slice.color }} />
              <span className="min-w-0 flex-1 truncate text-slate-700" title={slice.name}>{slice.name}</span>
              <span className="shrink-0 tabular-nums font-medium text-slate-900">{slice.total}</span>
              <span className="w-10 shrink-0 text-right tabular-nums text-slate-500">
                {percentFormat.format(slice.total / total)}
              </span>
            </>
          );
          return (
            <li key={slice.name}>
              {onSelect && !slice.other ? (
                <button
                  type="button"
                  onClick={() => select(slice)}
                  title={`Ver estudantes de ${slice.name}`}
                  className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ambar-400"
                >
                  {content}
                </button>
              ) : (
                <div className="flex items-center gap-2.5 px-1.5 py-1">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
