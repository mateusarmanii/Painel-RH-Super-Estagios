import { Download, Search } from "lucide-react";

// Barra das listas: busca, filtros extras (children) e "Exportar CSV".
export default function ListToolbar({ id, search, onSearchChange, placeholder, onExport, exportDisabled, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <div className="flex min-w-0 max-w-md flex-1 basis-64 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 focus-within:border-marinho-600 focus-within:ring-2 focus-within:ring-ambar-400/40">
        <Search size={17} className="shrink-0 text-slate-500" />
        <label htmlFor={`buscar-${id}`} className="sr-only">{placeholder}</label>
        <input
          id={`buscar-${id}`}
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
          className="h-10 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500"
        />
      </div>
      {children}
      {onExport && (
        <button
          type="button"
          onClick={onExport}
          disabled={exportDisabled}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-marinho-800 transition-colors hover:bg-marinho-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={16} /> Exportar CSV
        </button>
      )}
    </div>
  );
}
