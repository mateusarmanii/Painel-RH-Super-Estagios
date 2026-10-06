// Card de painel: branco, com faixa âmbar no cabeçalho (como o "Contratômetro" do painel interno).
export default function PanelCard({ title, subtitle, action, icon: Icon, className = "", bodyClassName = "p-5", children, id }) {
  return (
    <section id={id} className={`min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      <header className="flex items-center justify-between gap-3 bg-ambar-400 px-5 py-3 text-marinho-900">
        <div className="flex min-w-0 items-center gap-2">
          {Icon && <Icon size={17} className="shrink-0" />}
          <h2 className="truncate text-sm font-extrabold uppercase tracking-wide">{title}</h2>
        </div>
        {action}
      </header>
      {subtitle && <p className="border-b border-slate-100 px-5 py-2 text-xs text-slate-500">{subtitle}</p>}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
