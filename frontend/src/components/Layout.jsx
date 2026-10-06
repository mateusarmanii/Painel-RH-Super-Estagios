import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import CreationForm from "./CreationForm.jsx";
import Modal from "./Modal.jsx";
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  GraduationCap,
  LayoutDashboard,
  Menu,
  Search,
  Users,
  UserRoundCheck,
  X,
} from "lucide-react";
import { API_URL as apiUrl } from "../api.js";

const navigationItems = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Vagas", path: "/vagas", icon: BriefcaseBusiness },
  { label: "Agenda de Entrevistas", path: "/agenda", icon: CalendarDays },
  { label: "Empresas", path: "/empresas", icon: Building2 },
  { label: "Empresas sem vaga", path: "/empresas-sem-vaga", icon: Building2 },
  { label: "Estudantes", path: "/estudantes", icon: GraduationCap },
  { label: "Banco de Talentos", path: "/banco-de-talentos", icon: Users },
  { label: "Contratações Efetivas", path: "/contratacoes", icon: UserRoundCheck },
];

export default function Layout({ children }) {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isEmpresaModalOpen, setIsEmpresaModalOpen] = useState(false);
  const [isVagaModalOpen, setIsVagaModalOpen] = useState(false);
  const [isEstudanteModalOpen, setIsEstudanteModalOpen] = useState(false);
  const [numeroVaga, setNumeroVaga] = useState("");

  // Busca do topo: abre o Kanban da vaga com o número informado.
  async function handleSearch(event) {
    event.preventDefault();
    const codigo = numeroVaga.trim();
    if (!codigo) return;

    try {
      const response = await fetch(`${apiUrl}/vagas`);
      if (!response.ok) throw new Error("Não foi possível buscar as vagas.");
      const vaga = (await response.json()).find((item) => item.codigo_vaga === codigo);
      if (!vaga) {
        toast.error(`Nenhuma vaga com o Nº ${codigo}.`);
        return;
      }
      setNumeroVaga("");
      navigate(`/kanban/${vaga.id}`);
    } catch (searchError) {
      toast.error(
        searchError instanceof TypeError
          ? "O servidor não respondeu. Verifique se a API está rodando."
          : searchError.message,
      );
    }
  }

  const actions = [
    { label: "Empresa", icon: Building2, onClick: () => setIsEmpresaModalOpen(true) },
    { label: "Vaga", icon: BriefcaseBusiness, onClick: () => setIsVagaModalOpen(true) },
    { label: "Estudante", icon: GraduationCap, onClick: () => setIsEstudanteModalOpen(true) },
  ];

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 shadow-sm sm:gap-5 sm:px-6">
        <button
          type="button"
          aria-label="Abrir menu"
          title="Abrir menu"
          onClick={() => setIsSidebarOpen(true)}
          className="grid size-10 shrink-0 place-items-center rounded-md text-slate-700 transition-colors hover:bg-slate-200"
        >
          <Menu size={21} />
        </button>

        <form onSubmit={handleSearch} className="mx-auto flex min-w-0 max-w-md flex-1">
          <label htmlFor="buscar-vaga" className="sr-only">
            Buscar vaga por número
          </label>
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 focus-within:border-sky-700 focus-within:ring-2 focus-within:ring-sky-700/15">
            <Search size={17} className="shrink-0 text-slate-500" />
            <input
              id="buscar-vaga"
              value={numeroVaga}
              onChange={(event) => setNumeroVaga(event.target.value)}
              placeholder="Buscar vaga por Nº"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500"
            />
          </div>
        </form>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {actions.map(({ label, icon: Icon, onClick }) => (
            <button
              key={label}
              type="button"
              aria-label={`Adicionar ${label.toLowerCase()}`}
              title={`Adicionar ${label.toLowerCase()}`}
              onClick={onClick}
              className="inline-flex size-10 items-center justify-center gap-2 rounded-md bg-sky-800 px-2 text-white transition-colors hover:bg-sky-900 sm:h-10 sm:w-auto sm:px-3"
            >
              <Icon size={17} />
              <span className="hidden text-sm sm:inline">+ {label}</span>
            </button>
          ))}
        </div>
      </header>

      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 cursor-default bg-slate-950/40 backdrop-blur-[2px]"
        />
      )}

      <aside
        aria-label="Menu principal"
        aria-hidden={!isSidebarOpen}
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-white/10 bg-slate-900/95 text-slate-100 shadow-2xl backdrop-blur-sm transition-transform duration-300 ease-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <span className="text-sm font-semibold text-white">Navegação</span>
          <button
            type="button"
            aria-label="Fechar menu"
            title="Fechar menu"
            onClick={() => setIsSidebarOpen(false)}
            className="grid size-9 place-items-center rounded-md text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="space-y-1 p-3">
          {navigationItems.map(({ label, path, icon: Icon }) => (
            <Link
              key={label}
              to={path}
              onClick={() => setIsSidebarOpen(false)}
              className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm text-slate-200 transition-all duration-300 hover:bg-slate-800 hover:text-amber-400 active:scale-[0.98]"
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <main className="min-h-screen pt-16">{children}</main>

      <Modal
        isOpen={isEmpresaModalOpen}
        title="Adicionar empresa"
        onClose={() => setIsEmpresaModalOpen(false)}
      >
        <CreationForm type="empresa" onSuccess={() => setIsEmpresaModalOpen(false)} />
      </Modal>

      <Modal
        isOpen={isVagaModalOpen}
        title="Adicionar vaga"
        onClose={() => setIsVagaModalOpen(false)}
      >
        <CreationForm type="vaga" onSuccess={() => setIsVagaModalOpen(false)} />
      </Modal>

      <Modal
        isOpen={isEstudanteModalOpen}
        title="Adicionar estudante"
        onClose={() => setIsEstudanteModalOpen(false)}
      >
        <CreationForm type="estudante" onSuccess={() => setIsEstudanteModalOpen(false)} />
      </Modal>
    </>
  );
}