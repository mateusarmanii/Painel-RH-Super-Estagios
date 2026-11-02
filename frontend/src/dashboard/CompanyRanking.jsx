import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, Building2, ChevronsUpDown, Filter } from "lucide-react";
import DashPanel from "./DashPanel.jsx";
import CompanyAvatar from "../components/CompanyAvatar.jsx";
import { formatDays } from "./format.js";

const VISIBLE = 8;

const columns = [
  { key: "vagasAbertas", label: "Vagas abertas" },
  { key: "candidaturas", label: "Candidaturas" },
  { key: "contratacoes", label: "Contratações" },
  { key: "tempoMedioDias", label: "Tempo médio", lowerFirst: true },
];

// Ranking de empresas: clique no título da coluna para ordenar; no nome, para filtrar o Dashboard pela empresa.
export default function CompanyRanking({ companies, totalCompanies, selectedId, onSelect, className }) {
  const [sort, setSort] = useState({ key: "contratacoes", desc: true });
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(() => {
    const value = (company) => company[sort.key];
    return [...companies].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      // Sem contratação (tempo médio vazio) vai sempre para o fim.
      if (va === null && vb !== null) return 1;
      if (vb === null && va !== null) return -1;
      return (sort.desc ? vb - va : va - vb) || b.contratacoes - a.contratacoes || a.nome.localeCompare(b.nome, "pt-BR");
    });
  }, [companies, sort]);
  const rows = expanded ? sorted : sorted.slice(0, VISIBLE);

  function sortBy(column) {
    setSort((current) =>
      current.key === column.key ? { key: column.key, desc: !current.desc } : { key: column.key, desc: !column.lowerFirst },
    );
  }

  return (
    <DashPanel
      title="Empresas"
      subtitle={`${companies.length} com movimento ou vaga aberta · ${totalCompanies} parceiras`}
      icon={Building2}
      className={className}
      bodyClassName="p-0"
    >
      {companies.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-slate-500">Nenhuma empresa com vaga aberta ou movimento no período.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-2.5">Empresa</th>
                  {columns.map((column) => {
                    const active = sort.key === column.key;
                    const Icon = !active ? ChevronsUpDown : sort.desc ? ArrowDown : ArrowUp;
                    return (
                      <th key={column.key} scope="col" aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"} className="px-3 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => sortBy(column)}
                          className={`inline-flex items-center gap-1 rounded px-1 py-1 hover:text-marinho-900 ${active ? "text-marinho-900" : ""}`}
                        >
                          {column.label} <Icon size={13} />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((company) => (
                  <tr key={company.id} className={`group ${company.id === selectedId ? "bg-ambar-50" : "hover:bg-slate-50"}`}>
                    <td className="px-5 py-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <CompanyAvatar id={company.id} name={company.nome} logoId={company.logo_arquivo_id} size="sm" />
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => onSelect(company.id === selectedId ? null : company.id)}
                            title={company.id === selectedId ? "Tirar o filtro desta empresa" : "Filtrar o Dashboard por esta empresa"}
                            className="flex max-w-56 items-center gap-1 truncate text-left font-bold text-marinho-900 hover:underline"
                          >
                            <span className="truncate">{company.nome}</span>
                            <Filter size={12} className="shrink-0 text-slate-400 opacity-0 group-hover:opacity-100" />
                          </button>
                          <Link to={`/vagas?empresa=${company.id}`} className="text-xs text-slate-500 hover:text-marinho-700 hover:underline">
                            Ver vagas
                          </Link>
                        </div>
                        {company.emAlerta > 0 && (
                          <span className="shrink-0 rounded-full bg-ambar-100 px-2 py-0.5 text-[11px] font-bold text-ambar-600" title="Vagas em alerta">
                            {company.emAlerta} em alerta
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{company.vagasAbertas}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{company.candidaturas}</td>
                    <td className="px-4 py-2.5 text-right font-bold tabular-nums text-marinho-900">{company.contratacoes}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-slate-700">
                      {formatDays(company.tempoMedioDias) ?? <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sorted.length > VISIBLE && (
            <div className="border-t border-slate-100 px-5 py-2.5 text-center">
              <button type="button" onClick={() => setExpanded((value) => !value)} className="text-xs font-bold text-marinho-700 hover:underline">
                {expanded ? "Mostrar menos" : `Ver todas (${sorted.length})`}
              </button>
            </div>
          )}
        </>
      )}
    </DashPanel>
  );
}
