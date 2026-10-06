import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, KanbanSquare, LayoutGrid, Pencil, Rows3, Trash2, Users } from "lucide-react";
import CompanyAvatar from "../components/CompanyAvatar.jsx";
import EntityList from "../components/EntityList.jsx";
import { statusLabels } from "../vagaStatus.js";
import { kanbanStatusBar, kanbanStatusOrder } from "../kanbanStatus.js";
import { csvDate, csvDecimal } from "../csv.js";
import { normalize, plural } from "../text.js";
import { buttonPrimary, buttonSecondary } from "../ui.js";
import { API_URL as apiUrl } from "../api.js";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// Turno da vaga (chega na Frente 2; até lá a etiqueta não aparece).
const turnoLabels = { MANHA: "Manhã", TARDE: "Tarde", INTEGRAL: "Integral" };

// Texto do mini funil: só as etapas com alguém, na ordem do Kanban.
const funnelWords = {
  ENVIADO_EMPRESA: ["enviado", "enviados"],
  ENTREVISTA_AGENDADA: ["entrevista", "entrevista"],
  AGUARDANDO_RETORNO: ["em análise", "em análise"],
  APROVADO: ["contratado", "contratados"],
  RECUSADO: ["dispensado", "dispensados"],
};

const tagBase = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold";

// Em alerta primeiro; depois as abertas; dentro de cada grupo, as mais recentes.
function compareVagas(a, b) {
  return (
    Number(Boolean(b.resumo?.em_alerta)) - Number(Boolean(a.resumo?.em_alerta)) ||
    Number(b.status === "ABERTA") - Number(a.status === "ABERTA") ||
    new Date(b.created_at) - new Date(a.created_at)
  );
}

function AgeTag({ vaga }) {
  if (vaga.status !== "ABERTA") {
    return <span className={`${tagBase} bg-slate-100 text-slate-600`}>{statusLabels[vaga.status]}</span>;
  }
  const days = vaga.resumo?.dias_aberta ?? 0;
  const text = days === 0 ? "Aberta hoje" : `${plural(days, "dia", "dias")} em aberto`;
  if (vaga.resumo?.em_alerta) {
    return (
      <span className={`${tagBase} bg-rose-50 text-destaque ring-1 ring-rose-200`} title="Mais de 10 dias sem ninguém em entrevista">
        <AlertTriangle size={13} /> {text} · sem entrevista
      </span>
    );
  }
  if (days <= 10) return <span className={`${tagBase} bg-emerald-50 text-emerald-700`}>{text}</span>;
  return <span className={`${tagBase} bg-slate-100 text-slate-600`}>{text}</span>;
}

function MiniFunnel({ resumo }) {
  const total = resumo?.total ?? 0;
  const stages = kanbanStatusOrder.filter((status) => resumo?.por_etapa?.[status]);

  return (
    <div className="mb-5 mt-5">
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        {stages.map((status) => (
          <span
            key={status}
            className={kanbanStatusBar[status]}
            style={{ width: `${(resumo.por_etapa[status] / total) * 100}%` }}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-600">
        {total === 0
          ? "Nenhum candidato ainda"
          : stages
              .map((status) => {
                const count = resumo.por_etapa[status];
                return `${count} ${funnelWords[status][count === 1 ? 0 : 1]}`;
              })
              .join(" · ")}
      </p>
    </div>
  );
}

function renderVaga(vaga) {
  const total = vaga.resumo?.total ?? 0;
  return (
    <>
      <div className="flex items-center gap-3 pr-10">
        <CompanyAvatar id={vaga.empresa_id} name={vaga.empresa?.nome} />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-800">{vaga.empresa?.nome}</p>
          <p className="truncate text-xs text-slate-500">
            Nº {vaga.codigo_vaga}
            {vaga.empresa?.setor && ` · ${vaga.empresa.setor}`}
          </p>
        </div>
      </div>

      <h2 className="mt-4 text-xl font-extrabold leading-snug text-marinho-900">{vaga.titulo}</h2>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className={`${tagBase} bg-marinho-50 text-marinho-800`}>{currency.format(vaga.valor)}</span>
        {vaga.turno && <span className={`${tagBase} bg-marinho-50 text-marinho-800`}>{turnoLabels[vaga.turno] ?? vaga.turno}</span>}
        <AgeTag vaga={vaga} />
      </div>

      <MiniFunnel resumo={vaga.resumo} />

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600">
          <Users size={15} className="text-slate-400" /> {plural(total, "candidato", "candidatos")}
        </span>
        <Link to={`/kanban/${vaga.id}`} className={`${buttonPrimary} h-9 px-3`}>
          <KanbanSquare size={16} /> Abrir Kanban
        </Link>
      </div>
    </>
  );
}

const csvExport = {
  filename: "vagas",
  columns: [
    { header: "Nº", value: (vaga) => vaga.codigo_vaga },
    { header: "Título", value: (vaga) => vaga.titulo },
    { header: "Empresa", value: (vaga) => vaga.empresa?.nome },
    { header: "Status", value: (vaga) => statusLabels[vaga.status] },
    { header: "Bolsa-auxílio (R$)", value: (vaga) => csvDecimal(vaga.valor) },
    { header: "Candidatos", value: (vaga) => vaga.resumo?.total ?? 0 },
    { header: "Criada em", value: (vaga) => csvDate(vaga.created_at) },
    { header: "Descrição", value: (vaga) => vaga.descricao },
  ],
};

// Blocos por empresa, em ordem alfabética (ignorando "[DEMO]" etc.); dentro de cada bloco, a ordem dos cards.
function groupByEmpresa(vagas) {
  const groups = new Map();
  for (const vaga of vagas) {
    const group = groups.get(vaga.empresa_id) ?? { key: vaga.empresa_id, empresa: vaga.empresa, items: [] };
    group.items.push(vaga);
    groups.set(vaga.empresa_id, group);
  }
  const sortName = (name) => normalize((name ?? "").replace(/^\s*\[[^\]]*\]\s*/, ""));
  return [...groups.values()]
    .sort((a, b) => sortName(a.empresa?.nome).localeCompare(sortName(b.empresa?.nome), "pt-BR"))
    .map((group) => ({
      ...group,
      label: group.empresa?.nome,
      title: (
        <>
          <CompanyAvatar id={group.key} name={group.empresa?.nome} size="sm" />
          <h2 className="min-w-0 truncate text-base font-extrabold text-marinho-900">{group.empresa?.nome}</h2>
          <span className="shrink-0 text-sm text-slate-500">{plural(group.items.length, "vaga", "vagas")}</span>
        </>
      ),
    }));
}

function ViewToggle({ view, onChange }) {
  const options = [
    { value: "cards", label: "Cards", icon: LayoutGrid },
    { value: "empresa", label: "Agrupar por empresa", icon: Rows3 },
  ];
  return (
    <div role="group" aria-label="Forma de exibir" className="inline-flex h-10 shrink-0 rounded-md border border-slate-300 bg-white p-0.5">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          onClick={() => onChange(value)}
          className={`inline-flex items-center gap-1.5 rounded px-3 text-sm font-semibold transition-colors ${
            view === value ? "bg-marinho-900 text-white" : "text-marinho-800 hover:bg-marinho-50"
          }`}
        >
          <Icon size={15} /> {label}
        </button>
      ))}
    </div>
  );
}

function CountHeader({ items, isLoading }) {
  const open = items.filter((vaga) => vaga.status === "ABERTA").length;
  const alerts = items.filter((vaga) => vaga.resumo?.em_alerta).length;
  return (
    <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <p className="text-lg text-slate-700">
        <strong className="text-2xl font-extrabold text-marinho-900">{isLoading ? "…" : open}</strong>{" "}
        {open === 1 ? "vaga aberta" : "vagas abertas"}
      </p>
      {!isLoading && alerts > 0 && (
        <p className="inline-flex items-center gap-1 text-sm font-bold text-destaque">
          <AlertTriangle size={15} /> {plural(alerts, "em alerta", "em alerta")}
        </p>
      )}
    </div>
  );
}

function EmpresaHeader({ empresaId, empresaNome, items, isLoading }) {
  const open = items.filter((vaga) => vaga.status === "ABERTA").length;
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex min-w-0 items-center gap-4">
        <CompanyAvatar id={empresaId} name={empresaNome ?? ""} size="lg" />
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold leading-tight text-marinho-900 sm:text-2xl">
            Vagas de {empresaNome ?? "…"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {isLoading ? "A carregar…" : `${plural(open, "vaga aberta", "vagas abertas")} · ${plural(items.length, "vaga", "vagas")} no total`}
          </p>
        </div>
      </div>
      <Link to="/vagas" className={buttonSecondary}>
        <ArrowLeft size={16} /> Ver todas as vagas
      </Link>
    </div>
  );
}

function readView() {
  try {
    return localStorage.getItem("vagasVisao") === "empresa" ? "empresa" : "cards";
  } catch {
    return "cards";
  }
}

// "Ver vagas" das Empresas chega aqui com ?empresa=<id>.
export default function VagasPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const empresaId = searchParams.get("empresa");
  const [fetchedNames, setFetchedNames] = useState({});
  const empresaNome = location.state?.empresaNome ?? fetchedNames[empresaId];
  const [view, setView] = useState(readView);

  useEffect(() => {
    try {
      localStorage.setItem("vagasVisao", view);
    } catch {
      // Sem acesso ao armazenamento local: só não lembra a preferência.
    }
  }, [view]);

  // Link aberto direto (sem o nome no estado da navegação): busca o nome da empresa.
  useEffect(() => {
    if (!empresaId || empresaNome) return;
    fetch(`${apiUrl}/empresas`)
      .then((response) => (response.ok ? response.json() : []))
      .then((empresas) => {
        const empresa = empresas.find((item) => item.id === empresaId);
        if (empresa) setFetchedNames((names) => ({ ...names, [empresaId]: empresa.nome }));
      })
      .catch(() => {});
  }, [empresaId, empresaNome]);

  const filterItems = useCallback((vaga) => vaga.empresa_id === empresaId, [empresaId]);
  const getMenuItems = useCallback(
    (vaga, { edit, remove }) => [
      { key: "kanban", label: "Abrir Kanban", icon: KanbanSquare, onClick: () => navigate(`/kanban/${vaga.id}`) },
      { key: "edit", label: "Editar", icon: Pencil, onClick: edit },
      { key: "delete", label: "Excluir", icon: Trash2, danger: true, onClick: remove },
    ],
    [navigate],
  );
  const renderHeader = useCallback(
    ({ items, isLoading }) =>
      empresaId ? (
        <EmpresaHeader empresaId={empresaId} empresaNome={empresaNome} items={items} isLoading={isLoading} />
      ) : (
        <CountHeader items={items} isLoading={isLoading} />
      ),
    [empresaId, empresaNome],
  );

  return (
    <EntityList
      key={empresaId ?? "todas"}
      type="vaga"
      endpoint="vagas"
      entityLabel={{ singular: "vaga", plural: "vagas", article: "a" }}
      searchPlaceholder="Buscar vaga por título, Nº ou empresa"
      emptyMessage={empresaId ? "Esta empresa ainda não tem vagas cadastradas." : "Nenhuma vaga cadastrada."}
      getSearchText={getSearchText}
      getName={getName}
      csvExport={csvExport}
      renderItem={renderVaga}
      filterItems={empresaId ? filterItems : undefined}
      sortItems={compareVagas}
      renderHeader={renderHeader}
      toolbarExtra={!empresaId && <ViewToggle view={view} onChange={setView} />}
      groupItems={!empresaId && view === "empresa" ? groupByEmpresa : undefined}
      getMenuItems={getMenuItems}
    />
  );
}

function getSearchText(vaga) {
  return `${vaga.titulo} ${vaga.codigo_vaga} ${vaga.empresa?.nome ?? ""}`;
}

function getName(vaga) {
  return vaga.titulo;
}
