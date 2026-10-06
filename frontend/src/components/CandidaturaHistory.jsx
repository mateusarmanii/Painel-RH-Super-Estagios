import { Link } from "react-router-dom";
import { dateTimeFormat, kanbanStatusLabels, kanbanStatusStyles } from "../kanbanStatus.js";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

// Histórico de candidaturas do estudante (vaga, etapa, entrevista, motivo da dispensa).
export default function CandidaturaHistory({ aplicacoes = [] }) {
  return (
    <section className="mt-6 border-t border-slate-200 pt-5" aria-labelledby="historico-candidaturas">
      <h3 id="historico-candidaturas" className="text-sm font-semibold text-marinho-900">
        Histórico de candidaturas
      </h3>

      {aplicacoes.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Este estudante ainda não tem candidaturas.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {aplicacoes.map((aplicacao) => (
            <li key={aplicacao.id} className="rounded-md border border-slate-200 p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    to={`/kanban/${aplicacao.vaga_id}`}
                    className="font-medium text-slate-900 underline-offset-2 hover:text-marinho-700 hover:underline"
                  >
                    {aplicacao.vaga?.titulo ?? "Vaga"}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {aplicacao.vaga?.empresa?.nome} · Nº {aplicacao.vaga?.codigo_vaga}
                    {aplicacao.created_at && ` · desde ${dateFormat.format(new Date(aplicacao.created_at))}`}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${kanbanStatusStyles[aplicacao.status_kanban]}`}>
                  {kanbanStatusLabels[aplicacao.status_kanban]}
                </span>
              </div>

              <dl className="mt-2 space-y-1 text-xs text-slate-600">
                {aplicacao.data_hora_entrevista && (
                  <div className="flex gap-1">
                    <dt className="font-medium text-slate-700">Entrevista:</dt>
                    <dd>{dateTimeFormat.format(new Date(aplicacao.data_hora_entrevista))}</dd>
                  </div>
                )}
                {aplicacao.data_aprovacao && (
                  <div className="flex gap-1">
                    <dt className="font-medium text-slate-700">Contratado em:</dt>
                    <dd>{dateFormat.format(new Date(aplicacao.data_aprovacao))}</dd>
                  </div>
                )}
                {aplicacao.motivo_recusa && (
                  <div className="flex gap-1">
                    <dt className="shrink-0 font-medium text-slate-700">Motivo da dispensa:</dt>
                    <dd className="min-w-0 break-words">{aplicacao.motivo_recusa}</dd>
                  </div>
                )}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
