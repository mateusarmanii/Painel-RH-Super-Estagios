import { useState } from "react";
import {
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronRight,
  Menu,
  UsersRound,
} from "lucide-react";
import Sidebar from "./components/Sidebar.jsx";

const dateLabel = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
}).format(new Date());

function App() {
  const [activeItem, setActiveItem] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const quickLinks = [
    { label: "Vagas", detail: "Acompanhe oportunidades", icon: BriefcaseBusiness },
    { label: "Empresas", detail: "Contas da sua franquia", icon: Building2 },
    { label: "Banco de Talentos", detail: "Perfis disponíveis", icon: UsersRound },
    { label: "Calendário", detail: "Entrevistas agendadas", icon: CalendarDays },
  ];

  function navigateTo(label) {
    setActiveItem(label);
    setSidebarOpen(false);
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <Sidebar
        activeItem={activeItem}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNavigate={navigateTo}
      />

      <div className="min-h-screen lg:pl-[264px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-line bg-white/90 px-5 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3">
            <button
              aria-label="Abrir navegação"
              className="inline-flex size-10 items-center justify-center rounded-lg border border-line text-ink transition hover:bg-paper lg:hidden"
              onClick={() => setSidebarOpen(true)}
              title="Abrir navegação"
              type="button"
            >
              <Menu aria-hidden="true" size={18} />
            </button>
            <div>
              <p className="text-xs font-medium text-muted">SUPER ESTÁGIOS</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">{activeItem}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <button
              aria-label="Notificações"
              className="relative inline-flex size-10 items-center justify-center rounded-lg text-muted transition hover:bg-paper hover:text-ink"
              title="Notificações"
              type="button"
            >
              <Bell aria-hidden="true" size={19} />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#e88768]" />
            </button>
            <div className="hidden h-8 w-px bg-line sm:block" />
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-[#e8efe5] text-xs font-bold text-forest">
                RH
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold leading-4 text-ink">Equipe RH</p>
                <p className="mt-1 text-xs leading-3 text-muted">Painel da franquia</p>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-8 sm:py-9 xl:px-10">
          {activeItem === "Dashboard" ? (
            <>
              <section className="flex min-h-[196px] flex-col justify-between gap-7 rounded-lg bg-forest px-6 py-7 text-white sm:flex-row sm:items-end sm:px-9 sm:py-8">
                <div>
                  <p className="mb-3 text-xs font-semibold text-leaf">PAINEL DA FRANQUIA</p>
                  <h1 className="max-w-2xl font-display text-3xl font-semibold leading-tight sm:text-4xl">
                    Bem-vindo ao Super Estágios
                  </h1>
                </div>
                <div className="flex w-fit items-center gap-2.5 rounded-md bg-white/10 px-3.5 py-2.5 text-sm text-white/90">
                  <CalendarDays aria-hidden="true" className="text-leaf" size={17} />
                  <span className="capitalize">{dateLabel}</span>
                </div>
              </section>

              <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(290px,0.7fr)]">
                <section className="rounded-lg border border-line bg-white p-5 sm:p-7">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-muted">NAVEGAÇÃO</p>
                      <h2 className="mt-1 font-display text-xl font-semibold text-ink">Acesso rápido</h2>
                    </div>
                    <ArrowUpRight aria-hidden="true" className="text-muted" size={19} />
                  </div>
                  <div className="divide-y divide-line">
                    {quickLinks.map(({ label, detail, icon: Icon }) => (
                      <button
                        className="group flex w-full items-center gap-3.5 py-3.5 text-left transition first:pt-1 last:pb-1 hover:translate-x-0.5"
                        key={label}
                        onClick={() => navigateTo(label)}
                        type="button"
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-paper text-forest transition group-hover:bg-leaf">
                          <Icon aria-hidden="true" size={19} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-ink">{label}</span>
                          <span className="mt-0.5 block text-xs text-muted">{detail}</span>
                        </span>
                        <ChevronRight aria-hidden="true" className="text-muted transition group-hover:translate-x-0.5 group-hover:text-forest" size={18} />
                      </button>
                    ))}
                  </div>
                </section>

                <section className="flex min-h-[340px] flex-col rounded-lg border border-line bg-white p-5 sm:p-7">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-muted">AGENDA</p>
                      <h2 className="mt-1 font-display text-xl font-semibold text-ink">Calendário</h2>
                    </div>
                    <button
                      aria-label="Abrir calendário"
                      className="inline-flex size-9 items-center justify-center rounded-lg border border-line text-muted transition hover:bg-paper hover:text-ink"
                      onClick={() => navigateTo("Calendário")}
                      title="Abrir calendário"
                      type="button"
                    >
                      <ArrowUpRight aria-hidden="true" size={17} />
                    </button>
                  </div>
                  <div className="flex flex-1 flex-col items-center justify-center py-9 text-center">
                    <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-[#f0f4e9] text-forest">
                      <CalendarDays aria-hidden="true" size={22} />
                    </div>
                    <p className="text-sm font-semibold text-ink">Sua agenda está pronta</p>
                    <p className="mt-1.5 max-w-[220px] text-xs leading-5 text-muted">
                      As entrevistas agendadas aparecerão nesta área.
                    </p>
                  </div>
                  <button
                    className="flex items-center justify-between border-t border-line pt-4 text-sm font-semibold text-forest transition hover:text-[#426d39]"
                    onClick={() => navigateTo("Calendário")}
                    type="button"
                  >
                    Ver calendário
                    <ChevronRight aria-hidden="true" size={17} />
                  </button>
                </section>
              </div>
            </>
          ) : (
            <section className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-line bg-white px-6 text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-lg bg-[#e8efe5] text-forest">
                {activeItem === "Vagas" && <BriefcaseBusiness aria-hidden="true" size={24} />}
                {activeItem === "Empresas" && <Building2 aria-hidden="true" size={24} />}
                {activeItem === "Banco de Talentos" && <UsersRound aria-hidden="true" size={24} />}
                {activeItem === "Calendário" && <CalendarDays aria-hidden="true" size={24} />}
              </div>
              <h1 className="font-display text-2xl font-semibold text-ink">{activeItem}</h1>
              <p className="mt-2 text-sm text-muted">Nenhum registro para exibir.</p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
