import { lazy, Suspense, useMemo, useState } from "react";
import { LineChart as LineChartIcon } from "lucide-react";
import DashPanel, { Segmented } from "./DashPanel.jsx";
import { formatInteger, seriesLabels, SERIES } from "./format.js";
import { ChartFallback } from "./ChartFallback.jsx";

const TrendChart = lazy(() => import("./TrendChart.jsx"));

const granularityText = { dia: "por dia", semana: "por semana", mes: "por mês" };

// Evolução no período: a legenda liga e desliga cada série; "Tabela" mostra os mesmos números em texto.
export default function TrendPanel({ serie, granularity, className }) {
  const [visible, setVisible] = useState(["candidaturas", "contratacoes"]);
  const [view, setView] = useState("grafico");
  const data = useMemo(
    () => serie.map((point) => {
      const labels = seriesLabels(point, granularity);
      return { ...point, shortLabel: labels.short, fullLabel: labels.full };
    }),
    [serie, granularity],
  );
  const shown = SERIES.filter((item) => visible.includes(item.key));
  const totals = Object.fromEntries(SERIES.map((item) => [item.key, serie.reduce((sum, point) => sum + point[item.key], 0)]));

  function toggle(key) {
    setVisible((current) => (current.includes(key) ? (current.length > 1 ? current.filter((item) => item !== key) : current) : [...current, key]));
  }

  return (
    <DashPanel
      title="Evolução no período"
      subtitle={`Movimento ${granularityText[granularity]}`}
      icon={LineChartIcon}
      className={className}
      action={
        <Segmented
          label="Forma de exibição"
          value={view}
          onChange={setView}
          options={[{ value: "grafico", label: "Gráfico" }, { value: "tabela", label: "Tabela" }]}
        />
      }
    >
      <ul className="mb-4 flex flex-wrap gap-2" aria-label="Séries do gráfico (clique para mostrar ou esconder)">
        {SERIES.map((item) => {
          const active = visible.includes(item.key);
          return (
            <li key={item.key}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => toggle(item.key)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ambar-400 ${
                  active ? "border-slate-300 bg-white text-marinho-900 shadow-sm" : "border-dashed border-slate-200 bg-slate-50 text-slate-400"
                }`}
              >
                <span aria-hidden="true" className="h-0.5 w-4 rounded" style={{ backgroundColor: active ? item.color : "#cbd5e1" }} />
                <span className="font-semibold">{item.label}</span>
                <span className="font-bold tabular-nums">{formatInteger(totals[item.key])}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {view === "grafico" ? (
        <div className="h-64 w-full sm:h-72">
          <Suspense fallback={<ChartFallback />}>
            <TrendChart data={data} series={shown} />
          </Suspense>
        </div>
      ) : (
        <div className="max-h-72 overflow-auto rounded-lg border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs font-bold text-slate-500">
              <tr>
                <th className="px-3 py-2">Data</th>
                {SERIES.map((item) => <th key={item.key} className="px-3 py-2 text-right">{item.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {data.map((point) => (
                <tr key={point.chave}>
                  <td className="px-3 py-1.5 capitalize text-slate-700">{point.fullLabel}</td>
                  {SERIES.map((item) => <td key={item.key} className="px-3 py-1.5 text-right text-slate-900">{point[item.key]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashPanel>
  );
}
