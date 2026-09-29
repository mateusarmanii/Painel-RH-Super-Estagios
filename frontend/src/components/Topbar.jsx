import { Bell, Clock3, LogOut, Menu } from "lucide-react";

function Topbar({ activeItem, onLogout, onMenuClick }) {
  return (
    <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between bg-white px-5 shadow-sm sm:px-8">
      <div className="flex items-center gap-3">
        <button
          aria-label="Abrir navegação"
          className="inline-flex size-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 lg:hidden"
          onClick={onMenuClick}
          title="Abrir navegação"
          type="button"
        >
          <Menu aria-hidden="true" size={19} />
        </button>
        <div>
          <p className="text-xs font-medium text-slate-500">SUPER ESTÁGIOS</p>
          <p className="mt-0.5 text-sm font-semibold text-brand-dark">{activeItem}</p>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <button
          aria-label="Registrar ponto"
          className="inline-flex size-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-amber-50 hover:text-amber-700"
          title="Registrar ponto"
          type="button"
        >
          <Clock3 aria-hidden="true" size={19} />
        </button>
        <button
          aria-label="Notificações"
          className="relative inline-flex size-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-amber-50 hover:text-amber-700"
          title="Notificações"
          type="button"
        >
          <Bell aria-hidden="true" size={19} />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-brand-gold" />
        </button>
        <div className="mx-2 hidden h-8 w-px bg-slate-200 sm:block" />
        <button
          aria-label="Sair"
          className="inline-flex size-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-red-50 hover:text-red-700"
          onClick={onLogout}
          title="Sair"
          type="button"
        >
          <LogOut aria-hidden="true" size={19} />
        </button>
      </div>
    </header>
  );
}

export default Topbar;