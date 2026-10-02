import { lazy, Suspense, useEffect, useState } from "react";
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Activity,
  Users,
} from "lucide-react";

const FunnelChart = lazy(() => import("../components/FunnelChart.jsx"));

const emptyDashboard = {
  metrics: {
    openJobs: 0,
    candidatesInProcess: 0,
    partnerCompanies: 0,
    scheduledInterviews: 0,
  },
  funnel: [],
  recentInterviews: [],
};

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

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;

    async function loadDashboard() {
      setIsLoading(true);
      setError("");

      try {
        const response = await fetch("http://localhost:3333/dashboard-metrics");
        const result = await response.json();
        if (!response.ok) throw new Error(result.erro ?? "Não foi possível carregar o dashboard.");
        if (isCurrent) setDashboard(result);
      } catch (loadError) {
        if (isCurrent) setError(loadError.message);
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    loadDashboard();
    window.addEventListener("dashboard:refresh", loadDashboard);

    return () => {
      isCurrent = false;
      window.removeEventListener("dashboard:refresh", loadDashboard);
    };
  }, []);

  function formatInterviewDate(value) {
    if (!value) return "A definir";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7">
          <p className="text-sm font-medium text-sky-800">Super Estágios</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Dashboard</h1>
        </header>

        {error && <p role="alert" className="mb-5 text-sm text-rose-700">{error}</p>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map(({ key, label, icon: Icon, iconStyle, detail }) => (
            <article
              key={key}
              className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-600">{label}</p>
                  <p className="mt-3 text-3xl font-semibold tabular-nums text-slate-900">
                    {isLoading ? "..." : dashboard.metrics[key]}
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
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
          <section className="min-w-0 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <header className="mb-5">
              <h2 className="text-base font-semibold text-slate-900">Funil de contratação</h2>
              <p className="mt-1 text-sm text-slate-500">Candidaturas por etapa</p>
            </header>
            <div className="h-72 w-full">
              {!isLoading && dashboard.funnel.length === 0 ? (
                <div className="grid h-full place-items-center text-sm text-slate-500">
                  Ainda não há candidaturas para exibir.
                </div>
              ) : (
                <Suspense fallback={<div className="grid h-full place-items-center text-sm text-slate-500">A carregar gráfico...</div>}>
                  <FunnelChart data={dashboard.funnel} />
                </Suspense>
              )}
            </div>
          </section>

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
                  {!isLoading && dashboard.recentInterviews.length === 0 && (
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
      </div>
    </section>
  );
}