// Painel do Dashboard: branco, título discreto (o âmbar fica para o que pede atenção).
export default function DashPanel({ id, title, subtitle, icon: Icon, action, className = "", bodyClassName = "p-5", children }) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-titulo` : undefined}
      className={`flex min-w-0 flex-col overflow-hidden superficie rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-marinho-50 text-marinho-700">
              <Icon size={16} />
            </span>
          )}
          <div className="min-w-0">
            <h2 id={id ? `${id}-titulo` : undefined} className="text-sm font-extrabold text-marinho-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className={`flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

// Botões de alternância (abas pequenas) usados nos cabeçalhos dos painéis.
export function Segmented({ label, options, value, onChange, size = "sm" }) {
  const padding = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap rounded-lg bg-slate-100 p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`rounded-md font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ambar-400 ${padding} ${
              active ? "bg-white text-marinho-900 shadow-sm" : "text-slate-600 hover:text-marinho-900"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
