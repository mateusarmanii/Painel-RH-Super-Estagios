import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Filter, Info } from "lucide-react";
import DashPanel, { Segmented } from "./DashPanel.jsx";
import Modal from "../components/Modal.jsx";
import { kanbanStatusBar, kanbanStatusLabels } from "../kanbanStatus.js";
import { ChartFallback } from "./ChartFallback.jsx";
import { formatDays, formatInteger, formatPercent } from "./format.js";

const FunnelChart = lazy(() => import("../components/FunnelChart.jsx"));
const sinceFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

// Lista de quem está na etapa clicada (as 50 mais recentes), com atalho para o Kanban da vaga.
function StageModal({ stage, onClose }) {
  return (
    <Modal isOpen={Boolean(stage)} title={stage ? `${stage.label} · ${stage.total}` : ""} onClose={onClose}>
      {stage && (
        <>
          {stage.itens.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Ninguém nesta etapa agora.</p>
          ) : (
            <ul className="-mx-2 divide-y divide-slate-100">
              {stage.itens.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link to={`/estudantes/${item.estudante.id}`} className="block truncate text-sm font-bold text-marinho-900 hover:underline">
                      {item.estudante.nome}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {item.vaga.titulo} · {item.vaga.empresa} · desde {sinceFormat.format(new Date(item.desde))}
                    </p>
                  </div>
                  <Link
                    to={`/kanban/${item.vaga.id}`}
                    className="inline-flex shrink-0 items-center gap-0.5 rounded-md px-2 py-1 text-xs font-bold text-marinho-700 hover:bg-marinho-50"
                  >
                    Kanban <ChevronRight size={14} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {stage.total > stage.itens.length && (
            <p className="mt-3 text-xs text-slate-500">Mostrando as {stage.itens.length} movimentações mais recentes de {stage.total}.</p>
          )}
        </>
      )}
    </Modal>
  );
}

// Conversão das candidaturas do período: quantas chegaram (ao menos) a cada etapa e quanto passou de uma para a outra.
function Conversion({ stages, exactCount }) {
  const start = stages[0]?.total ?? 0;
  if (!start) return <p className="grid h-64 place-items-center text-sm text-slate-500">Nenhuma candidatura nova no período.</p>;

  return (
    <div>
      <ol className="space-y-3">
        {stages.map((stage, index) => {
          const previous = index ? stages[index - 1].total : null;
          return (
            <li key={stage.status}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold text-slate-700">{kanbanStatusLabels[stage.status]}</span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-bold text-slate-900">{formatInteger(stage.total)}</span>
                  <span className="ml-1.5 text-xs text-slate-500">{formatPercent(stage.total / start)} do início</span>
                </span>
              </div>
              <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${kanbanStatusBar[stage.status]}`} style={{ width: `${Math.max(1.5, (stage.total / start) * 100)}%` }} />
              </div>
              {previous !== null && (
                <p className="mt-1 text-xs text-slate-500">
                  {previous ? `${formatPercent(stage.total / previous)} avançaram da etapa anterior` : "Ninguém na etapa anterior"}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-4 flex gap-1.5 text-xs text-slate-500">
        <Info size={14} className="mt-px shrink-0" />
        {exactCount >= start
          ? "Exata: todas as candidaturas do período têm o histórico de etapas completo."
          : `${formatInteger(exactCount)} de ${formatInteger(start)} candidaturas têm o histórico completo (gravado desde 02/11/2026). Nas demais, dispensados contam até a última etapa comprovada (entrevista, se tiveram data marcada).`}
      </p>
    </div>
  );
}

// Tempo médio em cada etapa (saídas no período, medidas pelo histórico de etapas).
function StageTimes({ stages }) {
  const measured = stages.filter((stage) => stage.mediaDias !== null);
  if (!measured.length) {
    return (
      <p className="grid h-64 place-items-center px-6 text-center text-sm text-slate-500">
        Ainda não há saídas de etapa registradas no período. O histórico de etapas começou a ser gravado em 02/11/2026.
      </p>
    );
  }
  const max = Math.max(...measured.map((stage) => stage.mediaDias), 1);
  const slowest = measured.reduce((a, b) => (b.mediaDias > a.mediaDias ? b : a));

  return (
    <div>
      <ol className="space-y-3">
        {stages.map((stage) => (
          <li key={stage.status}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold text-slate-700">{kanbanStatusLabels[stage.status]}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-bold text-slate-900">{formatDays(stage.mediaDias) ?? "—"}</span>
                <span className="ml-1.5 text-xs text-slate-500">{stage.amostras ? `${stage.amostras} ${stage.amostras === 1 ? "saída" : "saídas"}` : "sem dados"}</span>
              </span>
            </div>
            <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-slate-100">
              {stage.mediaDias !== null && (
                <div className={`h-full rounded-full ${kanbanStatusBar[stage.status]}`} style={{ width: `${Math.max(1.5, (stage.mediaDias / max) * 100)}%` }} />
              )}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 flex gap-1.5 text-xs text-slate-500">
        <Info size={14} className="mt-px shrink-0" />
        Etapa mais demorada no período: {kanbanStatusLabels[slowest.status]}. Conta o tempo entre entrar e sair de cada etapa.
      </p>
    </div>
  );
}

const subtitles = {
  agora: "Candidaturas em cada etapa agora. Clique numa etapa para ver quem está nela.",
  conversao: "Até onde chegaram as candidaturas criadas no período",
  tempo: "Quanto tempo, em média, as candidaturas ficam em cada etapa",
};

export default function FunnelPanel({ funnel, conversion, exactCount, stageTimes, className }) {
  const [view, setView] = useState("agora");
  const [selected, setSelected] = useState(null);
  const hasData = funnel.some((stage) => stage.total > 0);

  return (
    <DashPanel
      title="Funil de contratação"
      subtitle={subtitles[view]}
      icon={Filter}
      className={className}
      action={
        <Segmented
          label="Visão do funil"
          value={view}
          onChange={setView}
          options={[{ value: "agora", label: "Etapa atual" }, { value: "conversao", label: "Conversão" }, { value: "tempo", label: "Tempo por etapa" }]}
        />
      }
    >
      {view === "conversao" ? (
        <Conversion stages={conversion} exactCount={exactCount} />
      ) : view === "tempo" ? (
        <StageTimes stages={stageTimes} />
      ) : !hasData ? (
        <p className="grid h-64 place-items-center text-sm text-slate-500">Ainda não há candidaturas para exibir.</p>
      ) : (
        <>
          <div className="h-64 w-full">
            <Suspense fallback={<ChartFallback />}>
              <FunnelChart data={funnel} onSelect={setSelected} />
            </Suspense>
          </div>
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Abrir a lista de uma etapa">
            {funnel.map((stage) => (
              <li key={stage.status}>
                <button
                  type="button"
                  onClick={() => setSelected(stage)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:border-marinho-200 hover:bg-marinho-50"
                >
                  <span aria-hidden="true" className={`size-2 rounded-full ${kanbanStatusBar[stage.status]}`} />
                  {stage.label}
                  <span className="tabular-nums text-slate-900">{stage.total}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <StageModal stage={selected} onClose={() => setSelected(null)} />
    </DashPanel>
  );
}
