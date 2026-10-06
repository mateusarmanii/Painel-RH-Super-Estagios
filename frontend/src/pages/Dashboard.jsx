import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  GraduationCap,
  PieChart,
  RefreshCw,
  TrendingDown,
  Users,
  WifiOff,
} from "lucide-react";
import PanelCard from "../components/PanelCard.jsx";
import { kanbanStatusLabels, kanbanStatusOrder } from "../kanbanStatus.js";
import { hasNoOpenJob, toTalents } from "../regras.js";
import { plural } from "../text.js";
import { buttonPrimary, card } from "../ui.js";
import { API_URL as apiUrl } from "../api.js";

const FunnelChart = lazy(() => import("../components/FunnelChart.jsx"));
const CourseDonutChart = lazy(() => import("../components/CourseDonutChart.jsx"));

const metricCards = [
  { key: "openJobs", label: "Vagas abertas", icon: BriefcaseBusiness, detail: "Ativas agora", accent: "border-t-marinho-600" },
  { key: "candidatesInProcess", label: "Em processo", icon: Users, detail: "Candidaturas em andamento", accent: "border-t-ambar-400" },
  { key: "partnerCompanies", label: "Empresas parceiras", icon: Building2, detail: "Cadastradas", accent: "border-t-emerald-600" },
  { key: "scheduledInterviews", label: "Entrevistas", icon: CalendarDays, detail: "Agendadas", accent: "border-t-violet-600" },
];

const daysFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function formatDays(value) {
  if (value < 1) return "Menos de 1 dia";
  return `${daysFormat.format(value)} ${value === 1 ? "dia" : "dias"}`;
}

function formatInterviewDate(value) {
  if (!value) return "A definir";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

const chartFallback = (
  <div className="grid h-full min-h-40 place-items-center text-sm text-slate-500">A carregar gráfico...</div>
);

function DashboardSkeleton() {
  const block = `animate-pulse ${card}`;

  return (
    <div aria-busy="true" aria-label="A carregar o dashboard">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className={`${block} h-72`} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className={`${block} h-32 p-5`}>
              <div className="h-3 w-24 rounded bg-slate-200" />
              <div className="mt-4 h-8 w-16 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className={`${block} h-80 overflow-hidden`}>
            <div className="h-11 bg-ambar-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectionError({ message, onRetry }) {
  return (
    <div className={`${card} grid place-items-center px-6 py-16 text-center`}>
      <span className="grid size-12 place-items-center rounded-full bg-marinho-50 text-marinho-700">
        <WifiOff size={22} />
      </span>
      <h2 className="mt-4 text-base font-extrabold text-marinho-900">Não conseguimos carregar o dashboard</h2>
      <p className="mt-1 max-w-md text-sm text-slate-600">{message}</p>
      <button type="button" onClick={onRetry} className={`${buttonPrimary} mt-5`}>
        <RefreshCw size={16} /> Tentar novamente
      </button>
    </div>
  );
}

// Quadro de pendências, no estilo do "Olá, sua franquia tem" do painel interno.
function GreetingSummary({ items }) {
  return (
    <section className={`${card} overflow-hidden`} aria-labelledby="ola-rh">
      <header className="border-b border-slate-100 px-5 py-4">
        <h2 id="ola-rh" className="text-lg font-extrabold text-marinho-900">
          Olá, o RH tem
        </h2>
      </header>
      <ul className="divide-y divide-slate-100">
        {items.map(({ key, total, singular, pluralLabel, to, href, icon: Icon }) => {
          const content = (
            <>
              <span className="w-12 shrink-0 text-right text-3xl font-extrabold tabular-nums text-destaque">{total}</span>
              <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold text-marinho-900">
                <Icon size={16} className="shrink-0 text-marinho-500" />
                <span>{total === 1 ? singular : pluralLabel}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-slate-400 transition-colors group-hover:text-marinho-700" />
            </>
          );
          const className = "group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-ambar-50";
          return (
            <li key={key}>
              {to ? <Link to={to} className={className}>{content}</Link> : <a href={href} className={className}>{content}</a>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MetricCard({ label, value, detail, icon: Icon, accent, valueClassName = "text-3xl", className = "" }) {
  return (
    <article className={`${card} border-t-4 ${accent} p-4 sm:p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">{label}</p>
        <span className="hidden size-9 shrink-0 sm:grid place-items-center rounded-md bg-marinho-900 text-ambar-400">
          <Icon size={17} />
        </span>
      </div>
      <p className={`mt-2 font-extrabold tabular-nums text-marinho-900 ${valueClassName}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </article>
  );
}

function AlertJobsPanel({ jobs }) {
  return (
    <PanelCard
      id="vagas-em-alerta"
      title={`Vagas em alerta${jobs.length ? ` (${jobs.length})` : ""}`}
      subtitle="Abertas há mais de 10 dias sem nenhuma entrevista"
      icon={AlertTriangle}
      className="scroll-mt-24"
    >
      {jobs.length === 0 ? (
        <div className="flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-800">
          <CheckCircle2 size={20} className="shrink-0" />
          <span><strong className="font-bold">Nenhuma vaga parada.</strong> Todas as vagas abertas estão andando.</span>
        </div>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-y-auto">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link
                to={`/kanban/${job.id}`}
                className="group flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-slate-200 px-4 py-3 transition-colors hover:border-ambar-300 hover:bg-ambar-50"
              >
                <div className="min-w-0 flex-1 basis-48">
                  <p className="truncate text-sm font-bold text-marinho-900">{job.titulo}</p>
                  <p className="truncate text-xs text-slate-500">
                    {job.empresa} · Nº {job.codigo_vaga} · {plural(job.totalCandidaturas, "candidatura", "candidaturas")}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-extrabold tabular-nums text-destaque">
                  {plural(job.diasAberta, "dia", "dias")}
                </span>
                <ChevronRight size={18} className="shrink-0 text-slate-400 group-hover:text-marinho-700" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);

    try {
      const responses = await Promise.all(
        ["dashboard-metrics", "entrevistas", "candidatos", "empresas"].map((endpoint) => fetch(`${apiUrl}/${endpoint}`)),
      );
      const [result, interviews, students, companies] = await Promise.all(
        responses.map((response) => response.json().catch(() => ({}))),
      );
      const failed = responses.findIndex((response) => !response.ok);
      if (failed === 0) throw new Error(result.erro ?? "O servidor respondeu com erro. Tente novamente em instantes.");
      if (failed > 0) throw new Error("Não foi possível carregar todos os dados do dashboard.");

      setDashboard({
        ...result,
        // Mesmos nomes de etapa do Kanban.
        funnel: result.funnel
          .map((stage) => ({ ...stage, label: kanbanStatusLabels[stage.status] ?? stage.label }))
          .sort((a, b) => kanbanStatusOrder.indexOf(a.status) - kanbanStatusOrder.indexOf(b.status)),
        // /entrevistas já traz só as futuras, em ordem de data.
        upcomingInterviews: interviews.slice(0, 5),
        totalUpcomingInterviews: interviews.length,
        talentsCount: toTalents(students).length,
        companiesWithoutJobsCount: companies.filter(hasNoOpenJob).length,
      });
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
  const hiringDays = dashboard?.metrics.tempoMedioContratacaoDias;
  const hasHires = hiringDays !== null && hiringDays !== undefined;

  return (
    <section className="min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {dashboard && isLoading && <p className="mb-3 text-right text-xs text-slate-500">A atualizar...</p>}

        {!dashboard && isLoading && <DashboardSkeleton />}

        {!dashboard && !isLoading && error && <ConnectionError message={error} onRetry={loadDashboard} />}

        {dashboard && (
          <>
            {error && (
              <p role="alert" className="mb-5 flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                <WifiOff size={16} className="shrink-0" />
                <span className="flex-1">{error} Os números abaixo podem estar desatualizados.</span>
                <button type="button" onClick={loadDashboard} className="shrink-0 font-bold underline-offset-2 hover:underline">
                  Tentar novamente
                </button>
              </p>
            )}

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <GreetingSummary
                items={[
                  { key: "alertas", total: dashboard.vagasEmAlerta?.length ?? 0, singular: "vaga em alerta", pluralLabel: "vagas em alerta", href: "#vagas-em-alerta", icon: AlertTriangle },
                  { key: "entrevistas", total: dashboard.totalUpcomingInterviews, singular: "entrevista agendada", pluralLabel: "entrevistas agendadas", to: "/agenda", icon: CalendarDays },
                  { key: "talentos", total: dashboard.talentsCount, singular: "talento para reaproveitar", pluralLabel: "talentos para reaproveitar", to: "/banco-de-talentos", icon: GraduationCap },
                  { key: "empresas", total: dashboard.companiesWithoutJobsCount, singular: "empresa sem vaga aberta", pluralLabel: "empresas sem vaga aberta", to: "/empresas-sem-vaga", icon: TrendingDown },
                ]}
              />

              <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
                {metricCards.map(({ key, ...metric }) => (
                  <MetricCard key={key} {...metric} value={dashboard.metrics[key]} />
                ))}
                <MetricCard
                  label="Tempo médio de contratação"
                  icon={Clock}
                  accent="border-t-destaque"
                  className="col-span-2"
                  value={hasHires ? formatDays(hiringDays) : "Sem contratações ainda"}
                  valueClassName={hasHires && hiringDays >= 1 ? "text-3xl" : "text-lg"}
                  detail={hasHires ? `Base: ${plural(dashboard.metrics.totalContratacoes, "contratação", "contratações")}` : "Da candidatura à contratação"}
                />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
              <AlertJobsPanel jobs={dashboard.vagasEmAlerta ?? []} />

              <PanelCard title="Estudantes por curso" subtitle="Os 6 cursos com mais estudantes; os demais em “Outros”" icon={PieChart}>
                {(dashboard.distribuicaoPorCurso ?? []).length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-500">Ainda não há estudantes cadastrados.</p>
                ) : (
                  <Suspense fallback={chartFallback}>
                    <CourseDonutChart distribution={dashboard.distribuicaoPorCurso} />
                  </Suspense>
                )}
              </PanelCard>

              <PanelCard title="Funil de contratação" subtitle="Candidaturas por etapa e % do total do funil" icon={Users}>
                <div className="h-72 w-full">
                  {!hasFunnelData ? (
                    <div className="grid h-full place-items-center text-sm text-slate-500">Ainda não há candidaturas para exibir.</div>
                  ) : (
                    <Suspense fallback={chartFallback}>
                      <FunnelChart data={dashboard.funnel} />
                    </Suspense>
                  )}
                </div>
              </PanelCard>

              <PanelCard
                title="Próximas entrevistas"
                icon={CalendarDays}
                bodyClassName="p-0"
                action={
                  <Link to="/agenda" className="shrink-0 text-xs font-extrabold uppercase tracking-wide text-marinho-900 underline-offset-2 hover:underline">
                    Ver agenda
                  </Link>
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[30rem] text-left text-sm">
                    <thead className="bg-marinho-50 text-[11px] font-extrabold uppercase tracking-wider text-marinho-700">
                      <tr>
                        <th className="px-5 py-3">Estudante</th>
                        <th className="px-5 py-3">Vaga</th>
                        <th className="px-5 py-3">Data e hora</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dashboard.upcomingInterviews.map((interview) => (
                        <tr key={interview.id} className="hover:bg-slate-50">
                          <td className="px-5 py-3.5 font-bold text-marinho-900">{interview.estudante.nome_completo}</td>
                          <td className="px-5 py-3.5 text-slate-600">
                            <Link to={`/kanban/${interview.vaga.id}`} className="hover:text-marinho-700 hover:underline">
                              {interview.vaga.titulo}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">
                            {formatInterviewDate(interview.data_hora_entrevista)}
                          </td>
                        </tr>
                      ))}
                      {dashboard.upcomingInterviews.length === 0 && (
                        <tr>
                          <td colSpan="3" className="px-5 py-10 text-center text-slate-500">Nenhuma entrevista agendada.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </PanelCard>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
