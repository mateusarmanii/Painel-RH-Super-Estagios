import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  RefreshCw,
  Users,
  WifiOff,
} from "lucide-react";

const FunnelChart = lazy(() => import("../components/FunnelChart.jsx"));
const CourseDonutChart = lazy(() => import("../components/CourseDonutChart.jsx"));

const metricCards = [
  {
    key: "openJobs",
    label: "Vagas abertas",
    icon: BriefcaseBusiness,
    iconStyle: "bg-sky-100 text-sky-800",
    detail: "Ativas agora",
  },
  {
    key: "candidatesInProcess",
    label: "Estudantes em processo",
    icon: Users,
    iconStyle: "bg-amber-100 text-amber-800",
    detail: "Em acompanhamento",
  },
  {
    key: "partnerCompanies",
    label: "Empresas parceiras",
    icon: Building2,
    iconStyle: "bg-emerald-100 text-emerald-800",
    detail: "Parceiras ativas",
  },
  {
    key: "scheduledInterviews",
    label: "Entrevistas agendadas",
    icon: CalendarDays,
    iconStyle: "bg-rose-100 text-rose-800",
    detail: "Agendadas",
  },
];

const daysFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function formatDays(value) {
  if (value < 1) return "Menos de 1 dia";
  return `${daysFormat.format(value)} ${value === 1 ? "dia" : "dias"}`;
}

function plural(total, singular, pluralForm) {
  return `${total} ${total === 1 ? singular : pluralForm}`;
}

function formatInterviewDate(value) {
  if (!value) return "A definir";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function Panel({ title, subtitle, children, className = "" }) {
  return (
    <section className={`min-w-0 rounded-md border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <header className="mb-5">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

const chartFallback = (
  <div className="grid h-full min-h-40 place-items-center text-sm text-slate-500">A carregar gráfico...</div>
);

function DashboardSkeleton() {
  const block = "animate-pulse rounded-md border border-slate-200 bg-white shadow-sm";

  return (
    <div aria-busy="true" aria-label="A carregar o dashboard">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className={`${block} h-36 p-5`}>
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="mt-4 h-8 w-16 rounded bg-slate-200" />
            <div className="mt-5 h-5 w-28 rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className={`${block} h-80`} />
        <div className={`${block} h-80`} />
        <div className={`${block} h-80`} />
        <div className={`${block} h-80`} />
      </div>
    </div>
  );
}

function ConnectionError({ message, onRetry }) {
  return (
    <div className="grid place-items-center rounded-md border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
      <span className="grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500">
        <WifiOff size={22} />
      </span>
      <h2 className="mt-4 text-base font-semibold text-slate-900">Não conseguimos carregar o dashboard</h2>
      <p className="mt-1 max-w-md text-sm text-slate-600">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-sky-800 px-4 text-sm font-medium text-white transition-colors hover:bg-sky-900"
      >
        <RefreshCw size={16} /> Tentar novamente
      </button>
    </div>
  );
}

function HiringTimeCard({ days, totalHires }) {
  const hasHires = days !== null && days !== undefined;

  return (
    <article className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-slate-600">Tempo médio de contratação</p>
          {hasHires ? (
            <p className={`mt-3 font-semibold tabular-nums text-slate-900 ${days < 1 ? "text-xl" : "text-3xl"}`}>
              {formatDays(days)}
            </p>
          ) : (
            <p className="mt-4 text-base font-medium text-slate-500">Sem contratações ainda</p>
          )}
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-violet-100 text-violet-800">
          <Clock size={19} />
        </span>
      </div>
      <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
        <Activity size={13} />
        {hasHires ? `Base: ${plural(totalHires, "contratação", "contratações")}` : "Da candidatura à contratação"}
      </span>
    </article>
  );
}

function AlertJobsPanel({ jobs }) {
  if (jobs.length === 0) {
    return (
      <Panel title="Vagas em alerta" subtitle="Abertas há mais de 10 dias sem entrevista">
        <div className="flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-800">
          <CheckCircle2 size={20} className="shrink-0" />
          <span><strong className="font-semibold">Nenhuma vaga parada.</strong> Todas as vagas abertas estão andando.</span>
        </div>
      </Panel>
    );
  }

  return (
    <section className="min-w-0 rounded-md border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
      <header className="mb-4 flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-amber-100 text-amber-700">
          <AlertTriangle size={18} />
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Vagas em alerta <span className="text-amber-700">({jobs.length})</span>
          </h2>
          <p className="mt-1 text-sm text-slate-600">Abertas há mais de 10 dias sem nenhuma entrevista</p>
        </div>
      </header>

      <ul className="max-h-80 space-y-2 overflow-y-auto">
        {jobs.map((job) => (
          <li key={job.id}>
            <Link
              to={`/kanban/${job.id}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-amber-200 bg-white px-4 py-3 transition-colors hover:border-amber-300 hover:bg-amber-50"
            >
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate text-sm font-semibold text-slate-900">{job.titulo}</p>
                <p className="truncate text-xs text-slate-500">{job.empresa} · Nº {job.codigo_vaga}</p>
              </div>
              <span className="shrink-0 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                {plural(job.diasAberta, "dia", "dias")} em aberto
              </span>
              <span className="shrink-0 text-xs text-slate-600">
                {plural(job.totalCandidaturas, "candidatura", "candidaturas")}
              </span>
              <span aria-hidden="true" className="shrink-0 text-sky-800">&rarr;</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:3333/dashboard-metrics");
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.erro ?? "O servidor respondeu com erro. Tente novamente em instantes.");
      setDashboard(result);
      setError("");
    } catch (loadError) {
      // fetch lança TypeError quando a API está fora do ar.
      setError(
        loadError instanceof TypeError
          ? "O servidor não respondeu. Verifique se a API está rodando e tente novamente."
          : loadError.message,
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    window.addEventListener("dashboard:refresh", loadDashboard);
    return () => window.removeEventListener("dashboard:refresh", loadDashboard);
  }, [loadDashboard]);

  const hasFunnelData = dashboard?.funnel.some((stage) => stage.total > 0);

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-sky-800">Super Estágios</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Dashboard</h1>
          </div>
          {dashboard && isLoading && <span className="text-sm text-slate-500">A atualizar...</span>}
        </header>

        {!dashboard && isLoading && <DashboardSkeleton />}

        {!dashboard && !isLoading && error && <ConnectionError message={error} onRetry={loadDashboard} />}

        {dashboard && (
          <>
            {error && (
              <p role="alert" className="mb-5 flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                <WifiOff size={16} className="shrink-0" />
                <span className="flex-1">{error} Os números abaixo podem estar desatualizados.</span>
                <button type="button" onClick={loadDashboard} className="shrink-0 font-semibold underline-offset-2 hover:underline">
                  Tentar novamente
                </button>
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {metricCards.map(({ key, label, icon: Icon, iconStyle, detail }) => (
                <article
                  key={key}
                  className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-600">{label}</p>
                      <p className="mt-3 text-3xl font-semibold tabular-nums text-slate-900">
                        {dashboard.metrics[key]}
                      </p>
                    </div>
                    <span className={`grid size-10 shrink-0 place-items-center rounded-md ${iconStyle}`}>
                      <Icon size={19} />
                    </span>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    <Activity size={13} /> {detail}
                  </span>
                </article>
              ))}
              <HiringTimeCard
                days={dashboard.metrics.tempoMedioContratacaoDias}
                totalHires={dashboard.metrics.totalContratacoes}
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
              <AlertJobsPanel jobs={dashboard.vagasEmAlerta ?? []} />

              <Panel title="Estudantes por curso" subtitle="Os 6 cursos com mais estudantes; os demais em “Outros”">
                {(dashboard.distribuicaoPorCurso ?? []).length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-500">Ainda não há estudantes cadastrados.</p>
                ) : (
                  <Suspense fallback={chartFallback}>
                    <CourseDonutChart distribution={dashboard.distribuicaoPorCurso} />
                  </Suspense>
                )}
              </Panel>

              <Panel title="Funil de contratação" subtitle="Candidaturas por etapa e % do total do funil">
                <div className="h-72 w-full">
                  {!hasFunnelData ? (
                    <div className="grid h-full place-items-center text-sm text-slate-500">
                      Ainda não há candidaturas para exibir.
                    </div>
                  ) : (
                    <Suspense fallback={chartFallback}>
                      <FunnelChart data={dashboard.funnel} />
                    </Suspense>
                  )}
                </div>
              </Panel>

              <section className="min-w-0 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
                <header className="border-b border-slate-200 px-5 py-5">
                  <h2 className="text-base font-semibold text-slate-900">Próximas entrevistas</h2>
                  <p className="mt-1 text-sm text-slate-500">Até cinco horários agendados</p>
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[30rem] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-5 py-3 font-medium">Estudante</th>
                        <th className="px-5 py-3 font-medium">Vaga</th>
                        <th className="px-5 py-3 font-medium">Data e hora</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dashboard.recentInterviews.map((interview) => (
                        <tr key={interview.id}>
                          <td className="px-5 py-4 font-medium text-slate-800">{interview.estudante}</td>
                          <td className="px-5 py-4 text-slate-600">{interview.vaga}</td>
                          <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                            {formatInterviewDate(interview.data_hora)}
                          </td>
                        </tr>
                      ))}
                      {dashboard.recentInterviews.length === 0 && (
                        <tr>
                          <td colSpan="3" className="px-5 py-10 text-center text-slate-500">
                            Nenhuma entrevista agendada.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
