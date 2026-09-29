import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronRight,
  UsersRound,
} from "lucide-react";
import Card from "./components/Card.jsx";
import DashboardMetrics from "./components/DashboardMetrics.jsx";
import Layout from "./components/Layout.jsx";
import LoginPage from "./components/LoginPage.jsx";

const navigationItems = [
  { label: "Vagas", detail: "Acompanhe oportunidades", icon: BriefcaseBusiness },
  { label: "Empresas", detail: "Contas da sua franquia", icon: Building2 },
  { label: "Banco de Talentos", detail: "Perfis disponíveis", icon: UsersRound },
  { label: "Calendário", detail: "Entrevistas agendadas", icon: CalendarDays },
];

const dateLabel = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
}).format(new Date());

function App() {
  const [activeItem, setActiveItem] = useState("Dashboard");
  const [accessToken, setAccessToken] = useState(() => window.localStorage.getItem("accessToken"));

  function logout() {
    window.localStorage.removeItem("accessToken");
    setAccessToken(null);
  }

  if (!accessToken) {
    return <LoginPage onAuthenticated={setAccessToken} />;
  }

  return (
    <Layout activeItem={activeItem} onLogout={logout} onNavigate={setActiveItem}>
      {activeItem === "Dashboard" ? (
        <>
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold text-brand-blue">PAINEL DA FRANQUIA</p>
              <h1 className="font-display text-3xl font-semibold leading-tight text-brand-dark sm:text-4xl">
                Bem-vindo ao Super Estágios
              </h1>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-600">
              <CalendarDays aria-hidden="true" className="text-brand-blue" size={17} />
              <span className="capitalize">{dateLabel}</span>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(290px,0.7fr)]">
            <Card title="Acesso rápido">
              <div className="divide-y divide-slate-100">
                {navigationItems.map(({ label, detail, icon: Icon }) => (
                  <button
                    className="group flex w-full items-center gap-3.5 py-3.5 text-left transition first:pt-1 last:pb-1 hover:translate-x-0.5"
                    key={label}
                    onClick={() => setActiveItem(label)}
                    type="button"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue-light text-brand-blue transition group-hover:bg-blue-100">
                      <Icon aria-hidden="true" size={19} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-800">{label}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{detail}</span>
                    </span>
                    <ChevronRight aria-hidden="true" className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand-blue" size={18} />
                  </button>
                ))}
              </div>
            </Card>

            <Card
              title="Calendário"
              headerAction={(
                <button
                  aria-label="Abrir calendário"
                  className="inline-flex size-8 items-center justify-center rounded-md text-slate-800 transition hover:bg-black/10"
                  onClick={() => setActiveItem("Calendário")}
                  title="Abrir calendário"
                  type="button"
                >
                  <ArrowUpRight aria-hidden="true" size={17} />
                </button>
              )}
            >
              <div className="flex min-h-[230px] flex-col items-center justify-center py-7 text-center">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-brand-blue-light text-brand-blue">
                  <CalendarDays aria-hidden="true" size={22} />
                </div>
                <p className="text-sm font-semibold text-slate-800">Sua agenda está pronta</p>
                <p className="mt-1.5 max-w-[220px] text-xs leading-5 text-slate-500">
                  As entrevistas agendadas aparecerão nesta área.
                </p>
                <button
                  className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-brand-blue transition hover:text-blue-800"
                  onClick={() => setActiveItem("Calendário")}
                  type="button"
                >
                  Ver calendário <ChevronRight aria-hidden="true" size={16} />
                </button>
              </div>
            </Card>
          </div>
          <DashboardMetrics onSessionExpired={setAccessToken} />
        </>
      ) : (
        <>
          <button
            className="mb-5 inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-brand-dark"
            onClick={() => setActiveItem("Dashboard")}
            type="button"
          >
            <ArrowLeft aria-hidden="true" size={17} />
            Voltar ao Dashboard
          </button>
          <Card title={activeItem}>
            <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
              <p className="text-sm font-semibold text-slate-800">Nenhum registro para exibir.</p>
            </div>
          </Card>
        </>
      )}
    </Layout>
  );
}

export default App;
