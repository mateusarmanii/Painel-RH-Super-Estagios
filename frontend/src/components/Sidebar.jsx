import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  GraduationCap,
  LayoutDashboard,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

const navigationItems = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Vagas", icon: BriefcaseBusiness },
  { label: "Empresas", icon: Building2 },
  { label: "Banco de Talentos", icon: UsersRound },
  { label: "Calendário", icon: CalendarDays },
];

function Sidebar({ activeItem, isOpen, onClose, onNavigate }) {
  return (
    <>
      {isOpen && (
        <button
          aria-label="Fechar navegação"
          className="fixed inset-0 z-30 bg-brand-dark/50 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
          type="button"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-brand-dark text-white transition-transform duration-200 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-white/10 px-5 pb-5 pt-6">
          <div className="flex items-center justify-between">
            <div aria-label="SUPER ESTÁGIOS - RECRUTAMENTO E SELEÇÃO" className="flex min-w-0 items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-blue-400/15 text-blue-300">
                <GraduationCap aria-hidden="true" size={20} strokeWidth={2.1} />
              </div>
              <div className="min-w-0">
                <p className="font-display text-[10px] font-extrabold leading-4 text-white">SUPER ESTÁGIOS -</p>
                <p className="text-[9px] font-bold leading-3 text-blue-300">RECRUTAMENTO E SELEÇÃO</p>
              </div>
            </div>
          <button
            aria-label="Fechar navegação"
              className="inline-flex size-9 items-center justify-center rounded-lg text-gray-300 transition hover:bg-blue-400/15 hover:text-blue-200 lg:hidden"
            onClick={onClose}
            title="Fechar navegação"
            type="button"
          >
            <X aria-hidden="true" size={19} />
          </button>
          </div>
          <div className="mt-6">
            <p className="text-[11px] font-bold text-brand-gold">PAINEL DA FRANQUIA</p>
            <p className="mt-1.5 text-sm font-medium text-brand-gold">Belo Horizonte - Castelo</p>
          </div>
        </div>

        <div className="border-b border-white/10 px-5 py-5">
          <p className="mb-3 text-[10px] font-bold text-gray-400">PERFIL</p>
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-gray-200">
              <UserRound aria-hidden="true" size={21} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">Usuário da Franquia</p>
              <p className="mt-1 text-xs text-gray-300">Operacional</p>
            </div>
          </div>
        </div>

        <nav aria-label="Navegação principal" className="flex-1 px-4 py-6">
          <p className="mb-3 px-3 text-[10px] font-bold text-gray-400">MENU</p>
          <div className="space-y-1.5">
            {navigationItems.map(({ label, icon: Icon }) => {
              const isActive = activeItem === label;
              return (
                <button
                  aria-current={isActive ? "page" : undefined}
                  className={`group flex min-h-11 w-full items-center gap-3 border-l-4 px-3 text-left text-[13px] font-medium transition ${
                    isActive
                      ? "border-brand-gold bg-white/[0.06] text-brand-gold"
                      : "border-transparent text-gray-300 hover:bg-blue-400/10 hover:text-blue-100"
                  }`}
                  key={label}
                  onClick={() => onNavigate(label)}
                  type="button"
                >
                  <Icon
                    aria-hidden="true"
                    className={isActive ? "text-brand-gold" : "text-gray-300 group-hover:text-blue-200"}
                    size={18}
                    strokeWidth={1.9}
                  />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-white/10 px-6 py-4">
          <p className="text-[10px] text-gray-400">SUPER ESTÁGIOS · 2026</p>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;