import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarCheck2,
  CheckCircle2,
  ChevronRight,
  Clock,
  GraduationCap,
  Info,
  Layers,
  MessageSquareX,
  Percent,
  PieChart,
  Printer,
  RefreshCw,
  Target,
  TrendingDown,
  UserRoundCheck,
  UserRoundPlus,
  Users,
  WifiOff,
} from "lucide-react";
import CompanyAvatar from "../components/CompanyAvatar.jsx";
import { kanbanStatusLabels, kanbanStatusOrder } from "../kanbanStatus.js";
import { plural } from "../text.js";
import { buttonPrimary, card } from "../ui.js";
import { apiFetch, OFFLINE_MESSAGE } from "../api.js";
import { addDays, startOfDay } from "../agenda/dates.js";
import DashPanel from "../dashboard/DashPanel.jsx";
import KpiCard from "../dashboard/KpiCard.jsx";
import FilterBar from "../dashboard/FilterBar.jsx";
import TrendPanel from "../dashboard/TrendPanel.jsx";
import FunnelPanel from "../dashboard/FunnelPanel.jsx";
import AgendaPanel from "../dashboard/AgendaPanel.jsx";
import CompanyRanking from "../dashboard/CompanyRanking.jsx";
import BarList, { PanelLink } from "../dashboard/BarList.jsx";
import { ChartFallback } from "../dashboard/ChartFallback.jsx";
import { compare, DEFAULT_PERIOD, formatDays, formatDecimal, formatKeyDate, formatRange, PERIODS, timeAgo } from "../dashboard/format.js";

const CourseDonutChart = lazy(() => import("../components/CourseDonutChart.jsx"));

// Atualiza sozinho a cada 5 minutos (só com a aba visível) e ao voltar para a aba depois disso.
const AUTO_REFRESH_MS = 5 * 60 * 1000;

function DashboardSkeleton() {
  const block = `animate-pulse ${card}`;
  return (
    <div aria-busy="true" aria-label="Carregando o dashboard" className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className={`${block} h-20`} />)}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className={`${block} h-36 p-5`}>
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="mt-4 h-8 w-16 rounded bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className={`${block} h-96 xl:col-span-2`} />
        <div className={`${block} h-96`} />
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

// Pendências do RH (o antigo "Olá, o RH tem"): cada uma leva para onde se resolve. Alerta > 0 fica em destaque.
function Pendencias({ items }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Pendências">
      {items.map(({ key, total, singular, pluralLabel, to, href, icon: Icon, urgent }) => {
        const highlight = urgent && total > 0;
        const content = (
          <>
            <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${highlight ? "bg-destaque text-white" : "bg-marinho-50 text-marinho-700"}`}>
              <Icon size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-2xl font-extrabold leading-none tabular-nums ${highlight ? "text-destaque" : "text-marinho-900"}`}>{total}</span>
              <span className="mt-1 block truncate text-xs font-semibold text-slate-600">{total === 1 ? singular : pluralLabel}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-slate-300 transition-colors group-hover:text-marinho-700" />
          </>
        );
        const className = `group flex items-center gap-3 superficie rounded-xl border bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ambar-400 ${
          highlight ? "border-rose-200" : "border-slate-200"
        }`;
        return (
          <li key={key}>
            {to ? <Link to={to} className={className}>{content}</Link> : <a href={href} className={className}>{content}</a>}
          </li>
        );
      })}
    </ul>
  );
}

// Meta mensal de contratações (Configurações → Geral; opcional). Conta o mês atual, com os mesmos filtros.
function GoalBar({ goal, done }) {
  const share = Math.min(1, done / goal);
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const expected = (today.getDate() / daysInMonth) * goal;
  const onTrack = done >= expected;
  return (
    <section className="flex flex-wrap items-center gap-4 superficie rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm" aria-label="Meta do mês">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-marinho-900 text-ambar-400"><Target size={18} /></span>
      <div className="min-w-0 flex-1 basis-60">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-bold text-marinho-900">Meta do mês: {done} de {goal} contratações</p>
          <p className={`text-xs font-semibold ${done >= goal ? "text-emerald-700" : onTrack ? "text-emerald-700" : "text-amber-700"}`}>
            {done >= goal ? "Meta batida!" : onTrack ? "No ritmo" : `Abaixo do ritmo (esperado ~${Math.round(expected)} até hoje)`}
          </p>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={done}>
          <div className={`h-full rounded-full ${done >= goal ? "bg-emerald-500" : "bg-marinho-600"}`} style={{ width: `${Math.max(2, share * 100)}%` }} />
        </div>
      </div>
    </section>
  );
}

function AlertJobsPanel({ jobs, className }) {
  return (
    <DashPanel
      id="vagas-em-alerta"
      title={`Vagas em alerta${jobs.length ? ` (${jobs.length})` : ""}`}
      subtitle="Abertas há mais de 10 dias sem ninguém em entrevista ou teste"
      icon={AlertTriangle}
      className={`scroll-mt-24 ${className}`}
      bodyClassName="p-3"
    >
      {jobs.length === 0 ? (
        <div className="m-2 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-800">
          <CheckCircle2 size={20} className="shrink-0" />
          <span><strong className="font-bold">Nenhuma vaga parada.</strong> Todas as vagas abertas estão andando.</span>
        </div>
      ) : (
        <ul className="max-h-[22rem] space-y-1 overflow-y-auto">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link to={`/kanban/${job.id}`} className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-ambar-50">
                <CompanyAvatar id={job.empresa_id} name={job.empresa} logoId={job.logo_arquivo_id} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-marinho-900">{job.titulo}</p>
                  <p className="truncate text-xs text-slate-500">
                    {job.empresa} · Nº {job.codigo_vaga} · {plural(job.totalCandidaturas, "candidatura", "candidaturas")}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold tabular-nums text-destaque">
                  {plural(job.diasAberta, "dia", "dias")}
                </span>
                <ChevronRight size={16} className="shrink-0 text-slate-300 group-hover:text-marinho-700" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashPanel>
  );
}

// Filtros na URL (?periodo=&de=&ate=&empresa=&area=): dá para recarregar a página ou mandar o link.
function readFilters(params) {
  const periodo = PERIODS.some((period) => period.value === params.get("periodo")) ? params.get("periodo") : DEFAULT_PERIOD;
  return {
    periodo,
    de: params.get("de"),
    ate: params.get("ate"),
    empresa: params.get("empresa"),
    area: params.get("area"),
  };
}

function queryFor(filters) {
  const query = new URLSearchParams();
  if (filters.periodo === "personalizado") {
    query.set("de", filters.de);
    query.set("ate", filters.ate);
  } else {
    query.set("periodo", filters.periodo);
  }
  if (filters.empresa) query.set("empresa", filters.empresa);
  if (filters.area) query.set("area", filters.area);
  return query.toString();
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  // "Personalizado" sem as duas datas ainda: mantém os números anteriores até aplicar.
  const ready = filters.periodo !== "personalizado" || Boolean(filters.de && filters.ate);
  const query = ready ? queryFor(filters) : null;

  const [dashboard, setDashboard] = useState(null);
  const [agenda, setAgenda] = useState({ today: null, upcoming: [], error: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const requestId = useRef(0);
  const lastQuery = useRef(null);

  const loadDashboard = useCallback(async () => {
    if (!query && lastQuery.current === null) return;
    const currentQuery = query ?? lastQuery.current;
    const id = ++requestId.current;
    setIsLoading(true);

    const today = startOfDay(new Date());
    const todayRange = new URLSearchParams({ inicio: today.toISOString(), fim: addDays(today, 1).toISOString() });

    try {
      const [metricsResponse, upcomingResponse, todayInterviewsResponse, todayEventsResponse] = await Promise.all([
        apiFetch(`/dashboard-metrics?${currentQuery}`),
        apiFetch("/entrevistas"),
        apiFetch(`/entrevistas?${todayRange}`),
        apiFetch(`/eventos?${todayRange}`),
      ]);
      const [metrics, upcoming, todayInterviews, todayEvents] = await Promise.all(
        [metricsResponse, upcomingResponse, todayInterviewsResponse, todayEventsResponse].map(readJson),
      );
      if (id !== requestId.current) return;
      if (!metricsResponse.ok) throw new Error(metrics.erro ?? "O servidor respondeu com erro. Tente novamente em instantes.");

      lastQuery.current = currentQuery;
      setDashboard({
        ...metrics,
        // Mesmos nomes de etapa do Kanban.
        funnel: metrics.funnel
          .map((stage) => ({ ...stage, label: kanbanStatusLabels[stage.status] ?? stage.label }))
          .sort((a, b) => kanbanStatusOrder.indexOf(a.status) - kanbanStatusOrder.indexOf(b.status)),
      });
      const agendaOk = upcomingResponse.ok && todayInterviewsResponse.ok && todayEventsResponse.ok;
      setAgenda({
        // Hoje: entrevistas que ainda estão na etapa Entrevista (as de candidaturas que já andaram saem) e eventos.
        today: agendaOk
          ? {
              interviews: todayInterviews.filter((interview) => interview.status_kanban === "ENTREVISTA_AGENDADA" && interview.status_exibido !== "CANCELADA"),
              events: todayEvents,
            }
          : null,
        // /entrevistas já traz só as futuras, em ordem de data.
        upcoming: upcomingResponse.ok ? upcoming : [],
        error: agendaOk ? "" : "Não foi possível carregar toda a agenda.",
      });
      setUpdatedAt(new Date());
      setError("");
    } catch (loadError) {
      if (id !== requestId.current) return;
      // apiFetch lança OfflineError (um TypeError) quando a API está fora do ar.
      setError(loadError instanceof TypeError ? OFFLINE_MESSAGE : loadError.message);
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, [query]);

  useEffect(() => {
    loadDashboard();
    window.addEventListener("dashboard:refresh", loadDashboard);
    return () => window.removeEventListener("dashboard:refresh", loadDashboard);
  }, [loadDashboard]);

  // Relógio do "Atualizado há..." e atualização automática.
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    if (!updatedAt) return undefined;
    const refreshIfStale = () => {
      if (document.visibilityState === "visible" && Date.now() - updatedAt.getTime() >= AUTO_REFRESH_MS) loadDashboard();
    };
    const timer = setInterval(refreshIfStale, 30 * 1000);
    document.addEventListener("visibilitychange", refreshIfStale);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfStale);
    };
  }, [updatedAt, loadDashboard]);

  const changeFilters = useCallback(
    (changes) =>
      setSearchParams((params) => {
        const next = new URLSearchParams(params);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        if (next.get("periodo") === DEFAULT_PERIOD) next.delete("periodo");
        if (next.get("periodo") !== "personalizado") {
          next.delete("de");
          next.delete("ate");
        }
        return next;
      }, { replace: true }),
    [setSearchParams],
  );

  const period = dashboard?.periodo;
  // Texto curto no card; o intervalo comparado aparece ao passar o mouse.
  const compareLabel = "vs. período anterior";
  const compareTitle = period ? `Período anterior: ${formatRange(period.anteriorDe, period.anteriorAte)}` : undefined;
  const spark = (key) => dashboard?.serie.map((point) => point[key]);
  const filterNames = dashboard && [
    filters.empresa && dashboard.opcoes.empresas.find((empresa) => empresa.id === filters.empresa)?.nome,
    filters.area && dashboard.opcoes.areas.find((area) => area.id === filters.area)?.nome,
  ].filter(Boolean);

  return (
    <section className="tela-glass min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-xl font-extrabold text-marinho-900 sm:text-2xl">Visão geral</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {period ? formatRange(period.de, period.ate) : "Carregando período..."}
              {filterNames?.length ? ` · ${filterNames.join(" · ")}` : ""}
            </p>
          </div>
          {dashboard && (
            <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-marinho-800 hover:bg-marinho-50 print:hidden">
              <Printer size={15} /> Imprimir / PDF
            </button>
          )}
        </div>

        {(dashboard || !isLoading) && (
          <div className="print:hidden">
          <FilterBar
            key={`${filters.de ?? ""}-${filters.ate ?? ""}`}
            filters={filters}
            onChange={changeFilters}
            options={dashboard?.opcoes ?? { empresas: [], areas: [] }}
            updatedLabel={updatedAt ? timeAgo(updatedAt, now) : "—"}
            isRefreshing={isLoading}
            onRefresh={loadDashboard}
          />
          </div>
        )}

        {!dashboard && isLoading && <DashboardSkeleton />}

        {!dashboard && !isLoading && error && <ConnectionError message={error} onRetry={loadDashboard} />}

        {dashboard && (
          <>
            {error && (
              <p role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                <WifiOff size={16} className="shrink-0" />
                <span className="flex-1">{error} Os números abaixo podem estar desatualizados.</span>
                <button type="button" onClick={loadDashboard} className="shrink-0 font-bold underline-offset-2 hover:underline">
                  Tentar novamente
                </button>
              </p>
            )}

            {period.datasAproximadas && (
              <p className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs text-sky-900">
                <Info size={15} className="mt-px shrink-0" />
                <span>
                  Datas anteriores a {formatKeyDate(period.datasReaisDesde)} não são exatas: os registros que já existiam receberam
                  essa data quando o sistema passou a guardá-las. Comparações com esse período são aproximadas.
                </span>
              </p>
            )}

            {dashboard.meta?.mensal && <GoalBar goal={dashboard.meta.mensal} done={dashboard.meta.contratacoesMes} />}

            <Pendencias
              items={[
                { key: "alertas", total: dashboard.pendencias.vagasEmAlerta, singular: "vaga em alerta", pluralLabel: "vagas em alerta", href: "#vagas-em-alerta", icon: AlertTriangle, urgent: true },
                { key: "hoje", total: dashboard.pendencias.entrevistasHoje, singular: "entrevista hoje", pluralLabel: "entrevistas hoje", to: "/calendario", icon: CalendarCheck2 },
                { key: "talentos", total: dashboard.pendencias.talentos, singular: "talento para reaproveitar", pluralLabel: "talentos para reaproveitar", to: "/banco-de-talentos", icon: GraduationCap },
                { key: "empresas", total: dashboard.pendencias.empresasSemVagaAberta, singular: "empresa sem vaga aberta", pluralLabel: "empresas sem vaga aberta", to: "/empresas-sem-vaga", icon: TrendingDown },
              ]}
            />

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <KpiCard
                label="Vagas abertas"
                icon={BriefcaseBusiness}
                value={dashboard.metrics.openJobs}
                detail={`${plural(period.novasVagas.atual, "vaga nova", "vagas novas")} no período`}
                spark={spark("vagas")}
                to={filters.empresa ? `/vagas?empresa=${filters.empresa}` : "/vagas"}
              />
              <KpiCard
                label="Em processo"
                icon={Users}
                value={dashboard.metrics.candidatesInProcess}
                detail="Candidaturas em andamento agora"
                to="/estudantes?situacao=EM_PROCESSO"
              />
              <KpiCard
                label="Candidaturas"
                icon={UserRoundPlus}
                value={period.candidaturas.atual}
                showDelta
                delta={compare(period.candidaturas.atual, period.candidaturas.anterior)}
                compareLabel={compareLabel}
                compareTitle={compareTitle}
                spark={spark("candidaturas")}
              />
              <KpiCard
                label="Contratações"
                icon={UserRoundCheck}
                value={period.contratacoes.atual}
                showDelta
                delta={compare(period.contratacoes.atual, period.contratacoes.anterior)}
                compareLabel={compareLabel}
                compareTitle={compareTitle}
                spark={spark("contratacoes")}
                to="/contratacoes"
              />
              <KpiCard
                label="Tempo médio de contratação"
                icon={Clock}
                value={formatDays(period.tempoMedioDias.atual) ?? "Sem contratações"}
                valueSize={period.tempoMedioDias.atual >= 1 ? "text-3xl" : "text-lg"}
                showDelta
                delta={compare(period.tempoMedioDias.atual, period.tempoMedioDias.anterior, { kind: "days", lowerIsBetter: true })}
                compareLabel={compareLabel}
                compareTitle={compareTitle}
                detail={`Desde sempre: ${formatDays(dashboard.metrics.tempoMedioContratacaoDias) ?? "—"}`}
              />
              <KpiCard
                label="Taxa de contratação"
                icon={Percent}
                value={period.taxaContratacao.atual === null ? "—" : `${formatDecimal(period.taxaContratacao.atual)}%`}
                showDelta
                delta={compare(period.taxaContratacao.atual, period.taxaContratacao.anterior, { kind: "points" })}
                compareLabel={compareLabel}
                compareTitle={compareTitle}
                detail="Das candidaturas do período"
              />
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              <TrendPanel serie={dashboard.serie} granularity={period.granularidade} className="xl:col-span-2" />
              <AgendaPanel
                today={agenda.today}
                upcoming={agenda.upcoming.slice(0, 6)}
                totalUpcoming={agenda.upcoming.length}
                error={agenda.error}
              />
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              <FunnelPanel
                funnel={dashboard.funnel}
                conversion={dashboard.conversao}
                exactCount={dashboard.conversaoExata}
                stageTimes={dashboard.tempoPorEtapa}
                className="xl:col-span-2"
              />
              <AlertJobsPanel jobs={dashboard.vagasEmAlerta} />
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              <CompanyRanking
                companies={dashboard.rankingEmpresas}
                totalCompanies={dashboard.metrics.partnerCompanies}
                selectedId={filters.empresa}
                onSelect={(empresa) => changeFilters({ empresa })}
                className="xl:col-span-2"
              />
              <DashPanel
                title="Motivos de dispensa"
                subtitle={`${plural(period.dispensas.atual, "dispensa", "dispensas")} no período`}
                icon={MessageSquareX}
                action={<PanelLink to="/banco-de-talentos">Banco de Talentos</PanelLink>}
              >
                {dashboard.motivosDispensa.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-500">Nenhuma dispensa no período.</p>
                ) : (
                  <>
                    <BarList
                      ariaLabel="Motivos de dispensa"
                      items={dashboard.motivosDispensa.map((motivo) => ({
                        key: motivo.categoria ?? motivo.texto,
                        label: motivo.texto,
                        total: motivo.total,
                        muted: motivo.outros,
                        hint: motivo.estimadas ? `${plural(motivo.estimadas, "classificada", "classificadas")} pelo texto do motivo` : undefined,
                      }))}
                    />
                    {dashboard.motivosDispensa.some((motivo) => motivo.estimadas) && (
                      <p className="mt-3 flex gap-1.5 text-xs text-slate-500">
                        <Info size={14} className="mt-px shrink-0" />
                        Motivos sem sugestão escolhida foram agrupados pelas palavras do texto.
                      </p>
                    )}
                  </>
                )}
              </DashPanel>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <DashPanel
                title="Estudantes por curso"
                subtitle={filterNames?.length ? "Quem se candidatou às vagas do filtro" : "Clique num curso para ver os estudantes"}
                icon={PieChart}
              >
                {dashboard.distribuicaoPorCurso.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-500">Nenhum estudante para exibir.</p>
                ) : (
                  <Suspense fallback={<ChartFallback />}>
                    <CourseDonutChart
                      distribution={dashboard.distribuicaoPorCurso}
                      onSelect={(curso) => navigate(`/estudantes?${new URLSearchParams({ curso })}`)}
                    />
                  </Suspense>
                )}
              </DashPanel>

              <DashPanel title="Vagas abertas por área" subtitle="Clique numa área para filtrar o Dashboard" icon={Layers}>
                {dashboard.vagasPorArea.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-500">Nenhuma vaga aberta.</p>
                ) : (
                  <BarList
                    ariaLabel="Vagas abertas por área"
                    mutedKey="nao-identificada"
                    items={dashboard.vagasPorArea.map((area) => ({
                      key: area.id,
                      label: area.nome,
                      total: area.total,
                      hint: filters.area === area.id ? "Tirar o filtro desta área" : `Filtrar por ${area.nome}`,
                      onClick: () => changeFilters({ area: filters.area === area.id ? null : area.id }),
                    }))}
                  />
                )}
              </DashPanel>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
