import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import CreationForm from "./CreationForm.jsx";
import Modal from "./Modal.jsx";
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronDown,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Users,
  UserRoundCheck,
  X,
} from "lucide-react";
import { apiFetch, OFFLINE_MESSAGE } from "../api.js";
import { buttonPrimary } from "../ui.js";

const navigationItems = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Vagas", path: "/vagas", icon: BriefcaseBusiness, also: ["/kanban"] },
  { label: "Agenda de Entrevistas", path: "/agenda", icon: CalendarDays },
  { label: "Empresas", path: "/empresas", icon: Building2 },
  { label: "Empresas sem vaga", path: "/empresas-sem-vaga", icon: Building2 },
  { label: "Estudantes", path: "/estudantes", icon: GraduationCap },
  { label: "Banco de Talentos", path: "/banco-de-talentos", icon: Users },
  { label: "Contratações Efetivas", path: "/contratacoes", icon: UserRoundCheck },
];

// Título mostrado na barra superior de cada tela.
const pageTitles = [
  ["/kanban", "Kanban da vaga"],
  ["/vagas", "Vagas"],
  ["/agenda", "Agenda de entrevistas"],
  ["/empresas-sem-vaga", "Empresas sem vaga"],
  ["/empresas", "Empresas"],
  ["/estudantes/", "Perfil do estudante"],
  ["/estudantes", "Estudantes"],
  ["/banco-de-talentos", "Banco de Talentos"],
  ["/contratacoes", "Contratações efetivas"],
];

function pageTitle(pathname) {
  if (pathname === "/") return "Dashboard";
  return pageTitles.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "Super Estágios";
}

function isActive(item, pathname) {
  if (item.path === "/") return pathname === "/";
  return [item.path, ...(item.also ?? [])].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function VagaSearch({ id, onDone }) {
  const navigate = useNavigate();
  const [numeroVaga, setNumeroVaga] = useState("");

  // Abre o Kanban da vaga com o número informado.
  async function handleSearch(event) {
    event.preventDefault();
    const codigo = numeroVaga.trim();
    if (!codigo) return;

    try {
      const response = await apiFetch("/vagas");
      if (!response.ok) throw new Error("Não foi possível buscar as vagas.");
      const vaga = (await response.json()).find((item) => item.codigo_vaga === codigo);
      if (!vaga) {
        toast.error(`Nenhuma vaga com o Nº ${codigo}.`);
        return;
      }
      setNumeroVaga("");
      onDone?.();
      navigate(`/kanban/${vaga.id}`);
    } catch (searchError) {
      toast.error(
        searchError instanceof TypeError ? OFFLINE_MESSAGE : searchError.message,
      );
    }
  }

  return (
    <form onSubmit={handleSearch} className="flex min-w-0 flex-1">
      <label htmlFor={id} className="sr-only">Buscar vaga por número</label>
      <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 focus-within:border-marinho-600 focus-within:ring-2 focus-within:ring-ambar-400/40">
        <Search size={17} className="shrink-0 text-slate-500" />
        <input
          id={id}
          value={numeroVaga}
          onChange={(event) => setNumeroVaga(event.target.value)}
          placeholder="Buscar vaga por Nº"
          inputMode="numeric"
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500"
        />
      </div>
    </form>
  );
}

export default function Layout({ children, user, onLogout }) {
  const { pathname } = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // No notebook o menu fica recolhido (só ícones) e expande ao passar o mouse; "fixar" o mantém aberto.
  const [isPinned, setIsPinned] = useState(() => {
    try {
      return localStorage.getItem("menuLateralFixo") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("menuLateralFixo", isPinned ? "1" : "0");
    } catch {
      // Sem acesso ao armazenamento local: só não lembra a preferência.
    }
  }, [isPinned]);

  // Classes que escondem textos com o menu recolhido (só no notebook; no celular a gaveta mostra tudo).
  const whenExpanded = isPinned ? "" : "lg:hidden lg:group-hover/menu:inline";
  const whenExpandedBlock = isPinned ? "" : "lg:hidden lg:group-hover/menu:block";
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);
  const [creating, setCreating] = useState(null);

  // Fecha a gaveta do menu ao trocar de tela.
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  const creationTypes = [
    { type: "empresa", label: "Empresa", title: "Adicionar empresa", icon: Building2 },
    { type: "vaga", label: "Vaga", title: "Adicionar vaga", icon: BriefcaseBusiness },
    { type: "estudante", label: "Estudante", title: "Adicionar estudante", icon: GraduationCap },
  ];
  const creatingType = creationTypes.find((item) => item.type === creating);

  return (
    <>
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 cursor-default bg-marinho-950/50 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        aria-label="Menu principal"
        className={`group/menu fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col overflow-x-hidden bg-marinho-900 text-slate-200 shadow-2xl transition-[transform,width] duration-200 ease-out lg:translate-x-0 ${
          isPinned ? "lg:w-64 lg:shadow-none" : "lg:w-16 lg:shadow-none lg:hover:w-64 lg:hover:shadow-2xl"
        } ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-[4.5rem] shrink-0 items-start justify-between gap-3 px-5 pt-5 lg:px-3">
          <span
            aria-hidden="true"
            className={`${isPinned ? "hidden" : "hidden lg:grid lg:group-hover/menu:hidden"} size-10 place-items-center rounded-md bg-ambar-400 text-sm font-extrabold text-marinho-900`}
          >
            SE
          </span>
          <div className={`whitespace-nowrap lg:px-2 ${whenExpandedBlock}`}>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-ambar-400">Painel de RH</p>
            <p className="mt-1 text-lg font-extrabold text-white">Super Estágios</p>
          </div>
          <button
            type="button"
            aria-label="Fechar menu"
            title="Fechar menu"
            onClick={() => setIsSidebarOpen(false)}
            className="grid size-9 place-items-center rounded-md text-slate-300 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X size={19} />
          </button>
        </div>

        {/* No celular a busca por Nº fica dentro do menu. */}
        {pathname !== "/vagas" && (
          <div className="px-4 pb-4 md:hidden">
            <VagaSearch id="buscar-vaga-menu" onDone={() => setIsSidebarOpen(false)} />
          </div>
        )}

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-6">
          {navigationItems.map((item) => {
            const active = isActive(item, pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                to={item.path}
                aria-current={active ? "page" : undefined}
                title={item.label}
                className={`flex w-full items-center gap-3 whitespace-nowrap rounded-md border-l-4 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide transition-colors ${
                  active
                    ? "border-ambar-400 bg-white/10 text-ambar-400"
                    : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={17} className="shrink-0" />
                <span className={whenExpanded}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mx-3 mb-4 border-t border-white/10 pt-3 lg:mb-1">
          {user && (
            <p className={`truncate px-4 pb-1 text-xs text-slate-400 ${whenExpandedBlock}`} title={user.email}>
              Logado como <span className="font-bold text-slate-200">{user.nome}</span>
            </p>
          )}
          <button
            type="button"
            onClick={onLogout}
            title="Sair"
            className="flex w-full items-center gap-3 whitespace-nowrap rounded-md border-l-4 border-transparent px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut size={17} className="shrink-0" />
            <span className={whenExpanded}>Sair</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsPinned((pinned) => !pinned)}
          aria-pressed={isPinned}
          title={isPinned ? "Recolher menu" : "Fixar menu aberto"}
          className="mx-3 mb-4 hidden items-center gap-3 whitespace-nowrap rounded-md border-l-4 border-transparent px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-400 transition-colors hover:bg-white/5 hover:text-white lg:flex"
        >
          {isPinned ? <PanelLeftClose size={17} className="shrink-0" /> : <PanelLeftOpen size={17} className="shrink-0" />}
          <span className={whenExpanded}>{isPinned ? "Recolher menu" : "Fixar menu aberto"}</span>
        </button>
      </aside>

      <header className={`fixed inset-x-0 top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-3 shadow-sm transition-[left] duration-200 sm:px-6 ${isPinned ? "lg:left-64" : "lg:left-16"}`}>
        <button
          type="button"
          aria-label="Abrir menu"
          title="Abrir menu"
          onClick={() => setIsSidebarOpen(true)}
          className="grid size-10 shrink-0 place-items-center rounded-md text-marinho-900 transition-colors hover:bg-marinho-50 lg:hidden"
        >
          <Menu size={21} />
        </button>

        <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold text-marinho-900 sm:text-xl md:flex-none">
          {pageTitle(pathname)}
        </h1>

        {/* Na tela de Vagas a busca da própria página já procura por título e Nº. */}
        <div className="mx-auto hidden w-full max-w-sm md:flex">
          {pathname !== "/vagas" && <VagaSearch id="buscar-vaga" />}
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={isNewMenuOpen}
            onClick={() => setIsNewMenuOpen((open) => !open)}
            className={`${buttonPrimary} px-3 sm:px-4`}
          >
            <Plus size={17} />
            <span className="hidden sm:inline">Novo cadastro</span>
            <ChevronDown size={15} className="hidden sm:block" />
          </button>

          {isNewMenuOpen && (
            <>
              <button
                type="button"
                aria-label="Fechar opções"
                onClick={() => setIsNewMenuOpen(false)}
                className="fixed inset-0 z-10 cursor-default"
              />
              <div role="menu" className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                {creationTypes.map(({ type, label, icon: Icon }) => (
                  <button
                    key={type}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setCreating(type);
                      setIsNewMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-marinho-900 transition-colors hover:bg-ambar-50"
                  >
                    <Icon size={17} className="text-marinho-600" /> {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </header>

      <main className={`min-h-screen pt-16 transition-[padding] duration-200 ${isPinned ? "lg:pl-64" : "lg:pl-16"}`}>{children}</main>

      <Modal isOpen={Boolean(creatingType)} title={creatingType?.title} onClose={() => setCreating(null)}>
        {creatingType && (
          <CreationForm key={creatingType.type} type={creatingType.type} onSuccess={() => setCreating(null)} />
        )}
      </Modal>
    </>
  );
}
