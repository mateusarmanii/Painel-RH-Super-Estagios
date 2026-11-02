import { useState } from "react";
import { Building2, CalendarRange, Layers, RefreshCw, X } from "lucide-react";
import { inputBase } from "../ui.js";
import { PERIODS } from "./format.js";

const selectClass = `${inputBase} h-9 cursor-pointer pr-8 sm:w-56`;

// Filtros do Dashboard, numa linha acima dos números: período, empresa e área. Tudo vai para a URL.
export default function FilterBar({ filters, onChange, options, updatedLabel, isRefreshing, onRefresh }) {
  const [draft, setDraft] = useState({ de: filters.de ?? "", ate: filters.ate ?? "" });
  const custom = filters.periodo === "personalizado";
  const hasFilters = Boolean(filters.empresa || filters.area);
  const validDraft = draft.de && draft.ate && draft.de <= draft.ate;

  function choosePeriod(periodo) {
    if (periodo === "personalizado") {
      onChange({ periodo, de: draft.de || null, ate: draft.ate || null });
      return;
    }
    onChange({ periodo, de: null, ate: null });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="group" aria-label="Período" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:pb-0">
          {PERIODS.map((period) => {
            const active = filters.periodo === period.value;
            return (
              <button
                key={period.value}
                type="button"
                aria-pressed={active}
                onClick={() => choosePeriod(period.value)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ambar-400 ${
                  active ? "bg-marinho-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-marinho-900"
                }`}
              >
                {period.label}
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 text-xs text-slate-500 lg:justify-end">
          <span aria-live="polite">{isRefreshing ? "Atualizando…" : `Atualizado ${updatedLabel}`}</span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Atualizar agora"
            aria-label="Atualizar agora"
            className="grid size-8 place-items-center rounded-lg border border-slate-200 text-marinho-800 transition-colors hover:bg-marinho-50 disabled:opacity-50"
          >
            <RefreshCw size={15} className={isRefreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {custom && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (validDraft) onChange({ periodo: "personalizado", ...draft });
          }}
        >
          <CalendarRange size={16} className="mb-2.5 text-slate-400" aria-hidden="true" />
          <label className="text-xs font-semibold text-slate-600">
            De
            <input type="date" value={draft.de} max={draft.ate || undefined} onChange={(e) => setDraft((d) => ({ ...d, de: e.target.value }))} className={`${inputBase} mt-1 h-9 w-40`} />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Até
            <input type="date" value={draft.ate} min={draft.de || undefined} onChange={(e) => setDraft((d) => ({ ...d, ate: e.target.value }))} className={`${inputBase} mt-1 h-9 w-40`} />
          </label>
          <button
            type="submit"
            disabled={!validDraft}
            className="h-9 rounded-md bg-ambar-400 px-4 text-sm font-bold text-marinho-900 hover:bg-ambar-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Aplicar
          </button>
          {!filters.de && <p className="mb-2 text-xs text-slate-500">Escolha as duas datas para aplicar.</p>}
        </form>
      )}

      <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:flex-wrap sm:items-center">
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <Building2 size={15} className="text-slate-400" aria-hidden="true" />
          <span className="sr-only">Empresa</span>
          <select value={filters.empresa ?? ""} onChange={(e) => onChange({ empresa: e.target.value || null })} className={selectClass}>
            <option value="">Todas as empresas</option>
            {options.empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nome}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <Layers size={15} className="text-slate-400" aria-hidden="true" />
          <span className="sr-only">Área da vaga</span>
          <select value={filters.area ?? ""} onChange={(e) => onChange({ area: e.target.value || null })} className={selectClass}>
            <option value="">Todas as áreas</option>
            {options.areas.map((area) => <option key={area.id} value={area.id}>{area.nome}</option>)}
          </select>
        </label>
        {hasFilters && (
          <button
            type="button"
            onClick={() => onChange({ empresa: null, area: null })}
            className="inline-flex h-9 items-center gap-1 self-start rounded-md px-2 text-sm font-semibold text-marinho-700 hover:bg-marinho-50 sm:self-auto"
          >
            <X size={15} /> Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}
