import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronDown,
  GraduationCap,
  LayoutDashboard,
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
          className="fixed inset-0 z-30 bg-[#10251f]/50 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
          type="button"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col bg-ink text-white transition-transform duration-200 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[88px] items-center justify-between border-b border-white/10 px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-leaf text-ink">
              <GraduationCap aria-hidden="true" size={22} strokeWidth={2.2} />
            </div>
            <div>
              <p className="font-display text-[15px] font-bold leading-5 text-white">Super Estágios</p>
              <p className="mt-0.5 text-[11px] text-white/55">Gestão de talentos</p>
            </div>
          </div>
          <button
            aria-label="Fechar navegação"
            className="inline-flex size-9 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white lg:hidden"
            onClick={onClose}
            title="Fechar navegação"
            type="button"
          >
            <X aria-hidden="true" size={19} />
          </button>
        </div>

        <nav aria-label="Navegação principal" className="flex-1 px-4 py-7">
          <p className="mb-3 px-3 text-[10px] font-bold text-white/40">GESTÃO</p>
          <div className="space-y-1">
            {navigationItems.map(({ label, icon: Icon }) => {
              const isActive = activeItem === label;
              return (
                <button
                  aria-current={isActive ? "page" : undefined}
                  className={`group relative flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] font-medium transition ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-white/65 hover:bg-white/[0.06] hover:text-white"
                  }`}
                  key={label}
                  onClick={() => onNavigate(label)}
                  type="button"
                >
                  {isActive && <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r bg-leaf" />}
                  <Icon
                    aria-hidden="true"
                    className={isActive ? "text-leaf" : "text-white/55 group-hover:text-white/90"}
                    size={18}
                    strokeWidth={1.9}
                  />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-white/10 p-4">
          <button
            className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition hover:bg-white/[0.06]"
            type="button"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#37594d] text-xs font-bold text-leaf">
              RH
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-white">Equipe RH</span>
              <span className="mt-1 block truncate text-[11px] text-white/50">Painel da franquia</span>
            </span>
            <ChevronDown aria-hidden="true" className="text-white/45" size={16} />
          </button>
          <p className="px-2 pb-1 pt-3 text-[10px] text-white/35">SUPER ESTÁGIOS · 2026</p>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;