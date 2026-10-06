import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { BarChart3, CalendarCheck2, Clock, Trophy, UserRoundCheck } from "lucide-react";
import ListToolbar from "../components/ListToolbar.jsx";
import CompanyAvatar from "../components/CompanyAvatar.jsx";
import EmptyState from "../components/EmptyState.jsx";
import LoadError from "../components/LoadError.jsx";
import { csvDate, downloadCsv, toCsv, todayForFilename } from "../csv.js";
import { formatPhone, getInitials, normalize, plural } from "../text.js";
import { card } from "../ui.js";
import { API_URL as apiUrl } from "../api.js";

const HiresChart = lazy(() => import("../components/HiresChart.jsx"));

const DIA_MS = 24 * 60 * 60 * 1000;
const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric" });
const monthShort = new Intl.DateTimeFormat("pt-BR", { month: "short" });
const monthLong = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long" });
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

const periods = [
  { value: "mes", label: "Este mês" },
  { value: "3m", label: "Últimos 3 meses" },
  { value: "6m", label: "Últimos 6 meses" },
  { value: "12m", label: "Últimos 12 meses" },
  { value: "ano", label: "Este ano" },
  { value: "tudo", label: "Todo o período" },
];

// Início do período (meses inteiros, contando o atual).
function periodStart(period, now = new Date()) {
  const months = { mes: 0, "3m": 2, "6m": 5, "12m": 11 };
  if (period === "ano") return new Date(now.getFullYear(), 0, 1);
  if (period === "tudo") return null;
  return new Date(now.getFullYear(), now.getMonth() - months[period], 1);
}

const hireDate = (hire) => new Date(hire.data_aprovacao ?? hire.updated_at);

function daysToHire(hire) {
  if (!hire.data_aprovacao || !hire.created_at) return null;
  return Math.max(0, Math.round((new Date(hire.data_aprovacao) - new Date(hire.created_at)) / DIA_MS));
}

// Uma linha por candidatura em APROVADO, da contratação mais recente para a mais antiga.
function toHires(students) {
  return students
    .flatMap((student) =>
      (student.aplicacoes ?? [])
        .filter((application) => application.status_kanban === "APROVADO")
        .map((application) => ({ ...application, estudante: student })),
    )
    .sort((a, b) => hireDate(b) - hireDate(a));
}

// Média em dias entre a candidatura e a contratação (mesma conta do Dashboard).
function averageDays(hires) {
  const valid = hires.filter((hire) => hire.data_aprovacao && hire.created_at);
  if (!valid.length) return null;
  return valid.reduce((total, hire) => total + (new Date(hire.data_aprovacao) - new Date(hire.created_at)), 0) / valid.length / DIA_MS;
}

// Quem mais contratou (empresa ou, com uma empresa filtrada, a vaga).
function topBy(hires, keyOf, labelOf) {
  const counts = new Map();
  for (const hire of hires) {
    const key = keyOf(hire);
    const current = counts.get(key) ?? { key, label: labelOf(hire), hire, total: 0 };
    current.total += 1;
    counts.set(key, current);
  }
  return [...counts.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "pt-BR"))[0] ?? null;
}

// Barras dos últimos 12 meses (ou desde a primeira contratação, em "Todo o período", até 24 meses).
function monthlySeries(hires, period, now = new Date()) {
  const first = hires.length ? hires.reduce((min, hire) => (hireDate(hire) < min ? hireDate(hire) : min), now) : now;
  const monthsBack =
    period === "tudo"
      ? Math.min(23, Math.max(11, (now.getFullYear() - first.getFullYear()) * 12 + now.getMonth() - first.getMonth()))
      : 11;
  return Array.from({ length: monthsBack + 1 }, (_, index) => {
    const start = new Date(now.getFullYear(), now.getMonth() - monthsBack + index, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const label = monthShort.format(start).replace(".", "");
    return {
      key: `${start.getFullYear()}-${start.getMonth()}`,
      label: start.getMonth() === 0 ? `${label}/${String(start.getFullYear()).slice(2)}` : label,
      fullLabel: monthLong.format(start),
      current: index === monthsBack,
      total: hires.filter((hire) => hireDate(hire) >= start && hireDate(hire) < end).length,
    };
  });
}

const csvColumns = [
  { header: "Estudante", value: (hire) => hire.estudante.nome_completo },
  { header: "Curso", value: (hire) => hire.estudante.curso },
  { header: "Instituição de ensino", value: (hire) => hire.estudante.instituicao_ensino },
  { header: "Telefone", value: (hire) => formatPhone(hire.estudante.telefone) },
  { header: "E-mail", value: (hire) => hire.estudante.email },
  { header: "Vaga", value: (hire) => hire.vaga?.titulo },
  { header: "Nº da vaga", value: (hire) => hire.vaga?.codigo_vaga },
  { header: "Empresa", value: (hire) => hire.vaga?.empresa?.nome },
  { header: "Contratado em", value: (hire) => csvDate(hire.data_aprovacao) },
  { header: "Dias até a contratação", value: (hire) => daysToHire(hire) ?? "" },
];

function StatCard({ icon: Icon, label, children, caption }) {
  return (
    <div className={`${card} p-4`}>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
        <Icon size={16} className="text-marinho-600" /> {label}
      </p>
      <div className="mt-1 min-h-9">{children}</div>
      {caption && <p className="mt-0.5 text-xs text-slate-500">{caption}</p>}
    </div>
  );
}

const selectClass =
  "h-10 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-marinho-600 focus:ring-2 focus:ring-ambar-400/40";

export default function ContratacoesPage() {
  const navigate = useNavigate();
  const [hires, setHires] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("12m");
  const [companyId, setCompanyId] = useState("");

  const loadHires = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/candidatos`);
      if (!response.ok) throw new Error("Não foi possível carregar as contratações.");
      setHires(toHires(await response.json()));
      setLoadError("");
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHires();
    window.addEventListener("dashboard:refresh", loadHires);
    return () => window.removeEventListener("dashboard:refresh", loadHires);
  }, [loadHires]);

  const companies = useMemo(() => {
    const map = new Map();
    for (const hire of hires) if (hire.vaga?.empresa) map.set(hire.vaga.empresa.id, hire.vaga.empresa);
    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [hires]);

  // A empresa filtra tudo; o período filtra a lista, o tempo médio e "quem mais contratou".
  const ofCompany = useMemo(
    () => (companyId ? hires.filter((hire) => hire.vaga?.empresa?.id === companyId) : hires),
    [hires, companyId],
  );
  const start = periodStart(period);
  const inPeriod = start ? ofCompany.filter((hire) => hireDate(hire) >= start) : ofCompany;
  const term = normalize(search);
  const listed = term
    ? inPeriod.filter((hire) =>
        normalize(`${hire.estudante.nome_completo} ${hire.estudante.curso} ${hire.vaga?.titulo} ${hire.vaga?.empresa?.nome}`).includes(term),
      )
    : inPeriod;

  const now = new Date();
  const thisMonth = ofCompany.filter((hire) => hireDate(hire) >= new Date(now.getFullYear(), now.getMonth(), 1)).length;
  const lastMonth = ofCompany.filter((hire) => {
    const date = hireDate(hire);
    return date >= new Date(now.getFullYear(), now.getMonth() - 1, 1) && date < new Date(now.getFullYear(), now.getMonth(), 1);
  }).length;
  const sixMonths = ofCompany.filter((hire) => hireDate(hire) >= new Date(now.getFullYear(), now.getMonth() - 5, 1)).length;
  const average = averageDays(inPeriod);
  const top = companyId
    ? topBy(inPeriod, (hire) => hire.vaga_id, (hire) => hire.vaga?.titulo ?? "Vaga")
    : topBy(inPeriod, (hire) => hire.vaga?.empresa?.id, (hire) => hire.vaga?.empresa?.nome ?? "Empresa");
  const periodLabel = periods.find((option) => option.value === period).label.toLowerCase();
  const series = useMemo(() => monthlySeries(ofCompany, period), [ofCompany, period]);
  const previousMonth = monthName.format(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  function handleExport() {
    downloadCsv(`contratacoes-${todayForFilename()}.csv`, toCsv(listed, csvColumns));
    toast.success(`${plural(listed.length, "contratação exportada", "contratações exportadas")}.`);
  }

  const openProfile = (hire) => navigate(`/estudantes/${hire.estudante.id}`);

  if (loadError) {
    return (
      <section className="min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-7xl">
          <LoadError
            title="Não conseguimos carregar as contratações"
            message={loadError}
            onRetry={() => {
              setIsLoading(true);
              loadHires();
            }}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy={isLoading}>
          <StatCard
            icon={CalendarCheck2}
            label="Este mês"
            caption={isLoading ? "" : thisMonth === lastMonth ? `igual a ${previousMonth}` : `${thisMonth > lastMonth ? "+" : ""}${thisMonth - lastMonth} em relação a ${previousMonth}`}
          >
            <p className="text-3xl font-extrabold text-marinho-900">{isLoading ? "…" : thisMonth}</p>
          </StatCard>
          <StatCard icon={BarChart3} label="Últimos 6 meses" caption={`desde ${monthLong.format(new Date(now.getFullYear(), now.getMonth() - 5, 1))}`}>
            <p className="text-3xl font-extrabold text-marinho-900">{isLoading ? "…" : sixMonths}</p>
          </StatCard>
          <StatCard icon={Clock} label="Tempo médio" caption={`da candidatura à contratação · ${periodLabel}`}>
            <p className="text-3xl font-extrabold text-marinho-900">
              {isLoading ? "…" : average === null ? "—" : `${decimal.format(average)} ${Math.round(average) === 1 ? "dia" : "dias"}`}
            </p>
          </StatCard>
          <StatCard
            icon={Trophy}
            label={companyId ? "Vaga que mais contratou" : "Quem mais contratou"}
            caption={top ? `${plural(top.total, "contratação", "contratações")} · ${periodLabel}` : periodLabel}
          >
            {isLoading ? (
              <p className="text-3xl font-extrabold text-marinho-900">…</p>
            ) : top ? (
              <p className="flex min-w-0 items-center gap-2 pt-1">
                {!companyId && (
                  <CompanyAvatar id={top.hire.vaga?.empresa?.id} name={top.label} logoUrl={top.hire.vaga?.empresa?.logo_url} size="sm" />
                )}
                <span className="line-clamp-2 text-sm font-extrabold leading-tight text-marinho-900">{top.label}</span>
              </p>
            ) : (
              <p className="text-3xl font-extrabold text-marinho-900">—</p>
            )}
          </StatCard>
        </div>

        <div className={`${card} p-4 sm:p-5`}>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-marinho-900">Contratações por mês</h2>
            <p className="text-xs text-slate-500">
              {companyId ? companies.find((company) => company.id === companyId)?.nome : "Todas as empresas"} · mês atual em destaque
            </p>
          </div>
          <div className="h-56">
            {isLoading ? (
              <div className="h-full animate-pulse rounded-md bg-slate-50" />
            ) : (
              <Suspense fallback={<div className="h-full animate-pulse rounded-md bg-slate-50" />}>
                <HiresChart data={series} />
              </Suspense>
            )}
          </div>
        </div>

        <ListToolbar
          id="contratacoes"
          search={search}
          onSearchChange={setSearch}
          placeholder="Buscar por estudante, curso, vaga ou empresa"
          onExport={handleExport}
          exportDisabled={isLoading || listed.length === 0}
        >
          <label htmlFor="contratacoes-periodo" className="sr-only">Período</label>
          <select id="contratacoes-periodo" value={period} onChange={(event) => setPeriod(event.target.value)} className={`${selectClass} flex-1 basis-40 sm:flex-none`}>
            {periods.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <label htmlFor="contratacoes-empresa" className="sr-only">Empresa</label>
          <select id="contratacoes-empresa" value={companyId} onChange={(event) => setCompanyId(event.target.value)} className={`${selectClass} flex-1 basis-48 sm:flex-none`}>
            <option value="">Todas as empresas</option>
            {companies.map((company) => <option key={company.id} value={company.id}>{company.nome}</option>)}
          </select>
        </ListToolbar>

        {isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-md border border-slate-200 bg-white" />
            ))}
          </div>
        ) : listed.length === 0 ? (
          <EmptyState
            icon={UserRoundCheck}
            title={
              hires.length === 0
                ? "Nenhuma contratação ainda"
                : search.trim()
                  ? `Nenhuma contratação encontrada para "${search.trim()}"`
                  : "Nenhuma contratação nesse período"
            }
            description={
              hires.length === 0
                ? 'Quando um candidato for movido para "Contratado" no Kanban, ele aparece aqui.'
                : "Tente outro período ou outra empresa."
            }
          />
        ) : (
          <div className={`${card} overflow-hidden`}>
            <p className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600 sm:px-5">
              <strong className="font-extrabold text-marinho-900">{plural(listed.length, "contratação", "contratações")}</strong> · {periodLabel}, da
              mais recente para a mais antiga
            </p>
            <ul className="divide-y divide-slate-100">
              {listed.map((hire) => {
                const days = daysToHire(hire);
                return (
                  <li key={hire.id}>
                    {/* A linha toda abre o perfil; pelo teclado, o link do nome faz o mesmo. */}
                    <div
                      onClick={() => openProfile(hire)}
                      className="grid cursor-pointer grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 px-4 py-3.5 transition-colors hover:bg-marinho-50/50 focus-visible:bg-marinho-50 focus-visible:outline-none sm:px-5 md:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1.2fr)_12rem]"
                    >
                      <span className="grid size-10 place-items-center rounded-full bg-emerald-50 text-xs font-extrabold text-emerald-800">
                        {getInitials(hire.estudante.nome_completo)}
                      </span>
                      <div className="min-w-0">
                        <Link
                          to={`/estudantes/${hire.estudante.id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="block truncate text-sm font-bold text-marinho-900 hover:underline"
                        >
                          {hire.estudante.nome_completo}
                        </Link>
                        <p className="truncate text-xs text-slate-500">{hire.estudante.curso}</p>
                      </div>
                      <div className="col-span-2 flex min-w-0 items-center gap-2.5 md:col-span-1">
                        <CompanyAvatar id={hire.vaga?.empresa?.id} name={hire.vaga?.empresa?.nome ?? ""} logoUrl={hire.vaga?.empresa?.logo_url} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">{hire.vaga?.titulo}</p>
                          <p className="truncate text-xs text-slate-500">
                            {hire.vaga?.empresa?.nome} · Nº {hire.vaga?.codigo_vaga}
                          </p>
                        </div>
                      </div>
                      <div className="col-span-2 text-left md:col-span-1 md:text-right">
                        <p className="text-sm font-semibold text-emerald-700">
                          {hire.data_aprovacao ? dateFormat.format(new Date(hire.data_aprovacao)) : "—"}
                        </p>
                        {days !== null && (
                          <p className="text-xs text-slate-500">{days < 1 ? "no mesmo dia da candidatura" : `${plural(days, "dia", "dias")} após a candidatura`}</p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
