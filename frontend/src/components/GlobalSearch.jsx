import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { BriefcaseBusiness, Building2, GraduationCap, Search } from "lucide-react";
import { apiFetch, OFFLINE_MESSAGE } from "../api.js";

// Busca do topo: estudantes (nome, e-mail, final do telefone), empresas e vagas (título ou Nº).
// Enter com um Nº de vaga continua abrindo o Kanban dela, como antes.
export default function GlobalSearch({ id, onDone }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const requestId = useRef(0);

  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) {
      setResults(null);
      return undefined;
    }
    const current = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const response = await apiFetch(`/busca?${new URLSearchParams({ q: query })}`);
        const body = await response.json().catch(() => null);
        if (current === requestId.current && response.ok) setResults(body);
      } catch {
        // Falha na busca rápida: o Enter ainda tenta pelo Nº.
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [term]);

  const items = results
    ? [
        ...results.vagas.map((vaga) => ({ key: `v-${vaga.id}`, icon: BriefcaseBusiness, title: vaga.titulo, detail: `Vaga Nº ${vaga.codigo_vaga} · ${vaga.empresa.nome}`, to: `/kanban/${vaga.id}` })),
        ...results.estudantes.map((estudante) => ({ key: `e-${estudante.id}`, icon: GraduationCap, title: estudante.nome_completo, detail: `Estudante · ${estudante.curso}`, to: `/estudantes/${estudante.id}` })),
        ...results.empresas.map((empresa) => ({ key: `c-${empresa.id}`, icon: Building2, title: empresa.nome, detail: "Empresa · ver vagas", to: `/vagas?empresa=${empresa.id}` })),
      ]
    : [];

  function go(to) {
    setTerm("");
    setResults(null);
    setIsOpen(false);
    onDone?.();
    navigate(to);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (active >= 0 && items[active]) return go(items[active].to);
    const codigo = term.trim();
    if (!codigo) return undefined;
    if (items.length === 1) return go(items[0].to);
    try {
      const response = await apiFetch("/vagas");
      if (!response.ok) throw new Error("Não foi possível buscar as vagas.");
      const vaga = (await response.json()).find((item) => item.codigo_vaga === codigo);
      if (vaga) return go(`/kanban/${vaga.id}`);
      if (!items.length) toast.error(`Nada encontrado para “${codigo}”.`);
      else setIsOpen(true);
    } catch (searchError) {
      toast.error(searchError instanceof TypeError ? OFFLINE_MESSAGE : searchError.message);
    }
    return undefined;
  }

  function handleKeyDown(event) {
    if (!items.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActive((index) => (index + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index <= 0 ? items.length - 1 : index - 1));
    } else if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  const showList = isOpen && term.trim().length >= 2 && results;

  return (
    <form onSubmit={handleSubmit} className="relative flex min-w-0 flex-1" role="search">
      <label htmlFor={id} className="sr-only">Buscar estudante, empresa ou vaga</label>
      <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 focus-within:border-marinho-600 focus-within:ring-2 focus-within:ring-ambar-400/40">
        <Search size={17} className="shrink-0 text-slate-500" />
        <input
          id={id}
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setIsOpen(true);
            setActive(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar estudante, empresa ou vaga (Nº)"
          role="combobox"
          aria-expanded={Boolean(showList)}
          aria-controls={`${id}-resultados`}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500"
        />
      </div>
      {showList && (
        <ul id={`${id}-resultados`} role="listbox" className="absolute inset-x-0 top-11 z-40 max-h-96 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {items.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-500">Nada encontrado.</li>
          ) : (
            items.map((item, index) => {
              const Icon = item.icon;
              return (
                <li key={item.key} role="option" aria-selected={index === active}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => go(item.to)}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-left ${index === active ? "bg-ambar-50" : "hover:bg-slate-50"}`}
                  >
                    <Icon size={16} className="shrink-0 text-marinho-500" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-marinho-900">{item.title}</span>
                      <span className="block truncate text-xs text-slate-500">{item.detail}</span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </form>
  );
}
