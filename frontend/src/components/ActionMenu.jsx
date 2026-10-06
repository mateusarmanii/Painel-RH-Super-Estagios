import { useState } from "react";
import { ChevronDown, MoreHorizontal } from "lucide-react";

// Menu "⋯" dos cards (Kanban, Estudantes, Banco de Talentos).
// Celular: folha que sobe de baixo (não é cortada pelo card). Telas maiores: menu suspenso.
// Cada item: { key, label, icon, onClick?, href?, danger?, disabled?, hint?, submenu?: [{ key, label, onClick }] }
export default function ActionMenu({ label, title, items, wrapperProps }) {
  const [isOpen, setIsOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState(null);

  function close() {
    setIsOpen(false);
    setOpenSubmenu(null);
  }

  function run(onClick) {
    close();
    onClick?.();
  }

  const itemClass = (danger) =>
    `flex w-full items-center gap-2.5 whitespace-nowrap px-4 py-3 text-left text-sm font-semibold transition-colors sm:px-3 sm:py-2 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent ${
      danger ? "text-rose-700 hover:bg-rose-50" : "text-marinho-900 hover:bg-marinho-50"
    }`;
  const iconClass = (danger) => (danger ? "text-rose-600" : "text-marinho-600");

  return (
    <div className="relative shrink-0" {...wrapperProps}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title="Ações"
        onClick={() => setIsOpen((open) => !open)}
        className="grid size-8 place-items-center rounded-md text-slate-500 transition-colors hover:bg-marinho-50 hover:text-marinho-900"
      >
        <MoreHorizontal size={18} />
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Fechar ações"
            onClick={close}
            className="fixed inset-0 z-40 cursor-default bg-marinho-950/40 sm:z-10 sm:bg-transparent"
          />
          <div
            role="menu"
            className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-xl border border-slate-200 bg-white pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:z-20 sm:mt-1 sm:max-h-none sm:w-64 sm:rounded-md sm:pb-1 sm:shadow-lg"
          >
            {title && (
              <p className="truncate border-b border-slate-100 px-4 pb-2 pt-2 text-xs font-extrabold uppercase tracking-wide text-slate-500 sm:hidden">
                {title}
              </p>
            )}
            {items.map((item) => {
              const Icon = item.icon;
              const content = (
                <>
                  {Icon && <Icon size={16} className={item.disabled ? "" : iconClass(item.danger)} />}
                  {item.label}
                  {item.hint && <span className="ml-auto text-[10px] font-bold uppercase text-slate-400">{item.hint}</span>}
                  {item.submenu && (
                    <ChevronDown size={15} className={`ml-auto transition-transform ${openSubmenu === item.key ? "rotate-180" : ""}`} />
                  )}
                </>
              );

              if (item.href) {
                return (
                  <a
                    key={item.key}
                    role="menuitem"
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={close}
                    className={itemClass(item.danger)}
                  >
                    {content}
                  </a>
                );
              }

              return (
                <div key={item.key}>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    title={item.disabled ? item.disabledReason : undefined}
                    aria-expanded={item.submenu ? openSubmenu === item.key : undefined}
                    onClick={() =>
                      item.submenu ? setOpenSubmenu((key) => (key === item.key ? null : item.key)) : run(item.onClick)
                    }
                    className={itemClass(item.danger)}
                  >
                    {content}
                  </button>
                  {item.submenu && openSubmenu === item.key && (
                    <div className="border-y border-slate-100 bg-slate-50 py-1">
                      {item.submenu.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          role="menuitem"
                          onClick={() => run(option.onClick)}
                          className="flex w-full items-center gap-2 py-3 pl-11 pr-3 text-left text-sm text-slate-700 transition-colors hover:bg-white hover:text-marinho-900 sm:py-2 sm:pl-9"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
