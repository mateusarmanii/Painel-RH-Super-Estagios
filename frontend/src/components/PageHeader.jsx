// Cabeçalho padrão das páginas (mesmo estilo do Dashboard e da Agenda).
export default function PageHeader({ title, subtitle }) {
  return (
    <header className="mb-7">
      <p className="text-sm font-medium text-sky-800">Super Estágios</p>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </header>
  );
}
