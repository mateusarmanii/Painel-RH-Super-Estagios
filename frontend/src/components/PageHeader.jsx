// O título da tela fica na barra superior (Layout); aqui vai só a descrição da página, quando houver.
export default function PageHeader({ subtitle, children }) {
  if (!subtitle && !children) return null;

  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
      {children}
    </div>
  );
}
