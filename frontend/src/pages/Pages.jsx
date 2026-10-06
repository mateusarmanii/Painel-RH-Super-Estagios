import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { BriefcaseBusiness, KanbanSquare, Pencil, Send, Trash2, UserRound, X } from "lucide-react";
import { API_URL as apiUrl } from "../api.js";
import CandidaturaHistory from "../components/CandidaturaHistory.jsx";
import EntityList from "../components/EntityList.jsx";
import { IndicateDialog } from "../components/IndicateForm.jsx";
import Modal from "../components/Modal.jsx";
import StudentQuickProfile from "../components/StudentQuickProfile.jsx";
import { statusLabels, statusStyles } from "../vagaStatus.js";
import { kanbanStatusLabels } from "../kanbanStatus.js";
import { csvDate, csvDecimal } from "../csv.js";
import { hasNoOpenJob } from "../regras.js";

const horarioLabels = { MANHA: "Manhã", TARDE: "Tarde", NOITE: "Noite" };

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const vagaConfig = {
  getSearchText: (vaga) => `${vaga.titulo} ${vaga.codigo_vaga}`,
  getName: (vaga) => vaga.titulo,
  csvExport: {
    filename: "vagas",
    columns: [
      { header: "Nº", value: (vaga) => vaga.codigo_vaga },
      { header: "Título", value: (vaga) => vaga.titulo },
      { header: "Empresa", value: (vaga) => vaga.empresa?.nome },
      { header: "Status", value: (vaga) => statusLabels[vaga.status] },
      { header: "Bolsa-auxílio (R$)", value: (vaga) => csvDecimal(vaga.valor) },
      { header: "Criada em", value: (vaga) => csvDate(vaga.created_at) },
      { header: "Descrição", value: (vaga) => vaga.descricao },
    ],
  },
  renderItem: (vaga) => (
    <>
      <div className="mb-5 flex items-start gap-3 pr-10">
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[vaga.status]}`}
        >
          {statusLabels[vaga.status]}
        </span>
        <span className="py-1 text-xs text-slate-500">Nº {vaga.codigo_vaga}</span>
      </div>
      <h2 className="text-lg font-semibold leading-6 text-marinho-900">{vaga.titulo}</h2>
      <p className="mt-2 text-sm text-slate-600">{vaga.empresa?.nome}</p>
      <p className="mt-1 text-sm text-slate-500">{currency.format(vaga.valor)}</p>
      <Link
        to={`/kanban/${vaga.id}`}
        className="mt-auto pt-6 text-left text-sm font-semibold text-marinho-700 transition-colors hover:text-marinho-900"
      >
        Abrir Kanban <span aria-hidden="true">&rarr;</span>
      </Link>
    </>
  ),
};

const empresaConfig = {
  getSearchText: (empresa) => empresa.nome,
  getName: (empresa) => empresa.nome,
  renderItem: (empresa) => (
    <>
      <span className="mb-5 self-start rounded-full bg-marinho-50 px-2.5 py-1 text-xs font-semibold text-marinho-700">
        {empresa.setor}
      </span>
      <h2 className="pr-10 text-lg font-semibold leading-6 text-marinho-900">{empresa.nome}</h2>
      <dl className="mt-auto space-y-1 pt-6 text-sm text-slate-600">
        <div><dt className="sr-only">Contato</dt><dd>{empresa.nome_contato}</dd></div>
        <div><dt className="sr-only">Telefone</dt><dd>{empresa.telefone_contato}</dd></div>
        {empresa.email_contato && (
          <div><dt className="sr-only">E-mail</dt><dd className="break-all">{empresa.email_contato}</dd></div>
        )}
      </dl>
    </>
  ),
};

const estudanteConfig = {
  getSearchText: (estudante) => estudante.nome_completo,
  getName: (estudante) => estudante.nome_completo,
  renderEditExtra: (estudante) => <CandidaturaHistory aplicacoes={estudante.aplicacoes} />,
  csvExport: {
    filename: "estudantes",
    columns: [
      { header: "Nome", value: (estudante) => estudante.nome_completo },
      { header: "Curso", value: (estudante) => estudante.curso },
      { header: "Instituição de ensino", value: (estudante) => estudante.instituicao_ensino },
      { header: "Telefone", value: (estudante) => estudante.telefone },
      { header: "E-mail", value: (estudante) => estudante.email },
      { header: "Horário de estudo", value: (estudante) => horarioLabels[estudante.horario_estudo] },
      { header: "Endereço", value: (estudante) => estudante.endereco },
      { header: "Currículo", value: (estudante) => estudante.link_curriculo },
      { header: "Candidaturas", value: (estudante) => estudante.aplicacoes?.length ?? 0 },
      {
        header: "Vagas e etapas",
        value: (estudante) =>
          (estudante.aplicacoes ?? [])
            .map((aplicacao) => `${aplicacao.vaga?.titulo ?? "Vaga"}: ${kanbanStatusLabels[aplicacao.status_kanban]}`)
            .join(" | "),
      },
      { header: "Anotações do recrutador", value: (estudante) => estudante.anotacoes_recrutador },
    ],
  },
};

// Card do estudante; o nome abre o perfil.
function renderEstudante(estudante, onOpenProfile) {
  return (
    <>
      <span className="mb-5 self-start rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
        {horarioLabels[estudante.horario_estudo]}
      </span>
      <h2 className="pr-10 text-lg font-semibold leading-6">
        <button
          type="button"
          onClick={onOpenProfile}
          title="Ver perfil"
          className="text-left text-marinho-900 underline-offset-2 hover:text-marinho-600 hover:underline"
        >
          {estudante.nome_completo}
        </button>
      </h2>
      <p className="mt-2 text-sm text-slate-600">{estudante.curso}</p>
      <p className="text-sm text-slate-500">{estudante.instituicao_ensino}</p>
      {estudante.anotacoes_recrutador && (
        <p className="mt-3 line-clamp-2 border-l-2 border-amber-300 pl-2 text-sm italic text-slate-600">
          {estudante.anotacoes_recrutador}
        </p>
      )}
      <p className="mt-auto pt-6 text-sm text-slate-500">
        {estudante.aplicacoes?.length ?? 0}{" "}
        {estudante.aplicacoes?.length === 1 ? "candidatura" : "candidaturas"}
      </p>
    </>
  );
}

function getVagaMenuItems(vaga, { edit, remove }, navigate) {
  return [
    { key: "kanban", label: "Abrir Kanban", icon: KanbanSquare, onClick: () => navigate(`/kanban/${vaga.id}`) },
    { key: "edit", label: "Editar", icon: Pencil, onClick: edit },
    { key: "delete", label: "Excluir", icon: Trash2, danger: true, onClick: remove },
  ];
}

function getEmpresaMenuItems(empresa, { edit, remove }, navigate) {
  return [
    {
      key: "jobs",
      label: "Ver vagas da empresa",
      icon: BriefcaseBusiness,
      onClick: () => navigate(`/vagas?empresa=${empresa.id}`, { state: { empresaNome: empresa.nome } }),
    },
    { key: "edit", label: "Editar", icon: Pencil, onClick: edit },
    { key: "delete", label: "Excluir", icon: Trash2, danger: true, onClick: remove },
  ];
}

// "Ver vagas da empresa" chega aqui com ?empresa=<id>; o filtro aparece como etiqueta removível.
export function VagasPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const empresaId = searchParams.get("empresa");
  const [fetchedNames, setFetchedNames] = useState({});
  const empresaNome = location.state?.empresaNome ?? fetchedNames[empresaId];

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
  const getMenuItems = useCallback((vaga, actions) => getVagaMenuItems(vaga, actions, navigate), [navigate]);

  return (
    <EntityList
      key={empresaId ?? "todas"}
      type="vaga"
      endpoint="vagas"
      entityLabel={{ singular: "vaga", plural: "vagas", article: "a" }}
      searchPlaceholder="Buscar vaga por título ou Nº"
      emptyMessage={empresaId ? "Esta empresa ainda não tem vagas cadastradas." : "Nenhuma vaga cadastrada."}
      {...vagaConfig}
      filterItems={empresaId ? filterItems : undefined}
      subtitle={
        empresaId && (
          <span className="inline-flex items-center gap-1 rounded-full border border-marinho-200 bg-marinho-50 py-1 pl-3 pr-1 text-sm font-semibold text-marinho-800">
            Empresa: {empresaNome ?? "selecionada"}
            <Link
              to="/vagas"
              aria-label="Remover filtro de empresa"
              title="Ver todas as vagas"
              className="grid size-6 place-items-center rounded-full text-marinho-600 transition-colors hover:bg-marinho-100 hover:text-marinho-900"
            >
              <X size={14} />
            </Link>
          </span>
        )
      }
      getMenuItems={getMenuItems}
    />
  );
}

export function EmpresasPage() {
  const navigate = useNavigate();
  const getMenuItems = useCallback((empresa, actions) => getEmpresaMenuItems(empresa, actions, navigate), [navigate]);

  return (
    <EntityList
      type="empresa"
      endpoint="empresas"
      entityLabel={{ singular: "empresa", plural: "empresas", article: "a" }}
      searchPlaceholder="Buscar empresa por nome"
      emptyMessage="Nenhuma empresa cadastrada."
      {...empresaConfig}
      getMenuItems={getMenuItems}
    />
  );
}

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });


const empresaSemVagaConfig = {
  ...empresaConfig,
  renderItem: (empresa) => {
    const lastJob = empresa.vagas?.[0];
    return (
      <>
        <span className="mb-5 self-start rounded-full bg-marinho-50 px-2.5 py-1 text-xs font-semibold text-marinho-700">
          {empresa.setor}
        </span>
        <h2 className="pr-10 text-lg font-semibold leading-6 text-marinho-900">{empresa.nome}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {lastJob ? (
            <>
              Última vaga: <span className="font-medium text-slate-800">{lastJob.titulo}</span>
              <span className="text-slate-500"> · {statusLabels[lastJob.status]} · {dateFormat.format(new Date(lastJob.created_at))}</span>
            </>
          ) : (
            <span className="text-slate-500">Nunca teve vaga cadastrada</span>
          )}
        </p>
        <dl className="mt-auto space-y-1 pt-6 text-sm text-slate-600">
          <div><dt className="sr-only">Contato</dt><dd>{empresa.nome_contato}</dd></div>
          <div><dt className="sr-only">Telefone</dt><dd>{empresa.telefone_contato}</dd></div>
          {empresa.email_contato && (
            <div><dt className="sr-only">E-mail</dt><dd className="break-all">{empresa.email_contato}</dd></div>
          )}
        </dl>
      </>
    );
  },
  csvExport: {
    filename: "empresas-sem-vaga",
    columns: [
      { header: "Empresa", value: (empresa) => empresa.nome },
      { header: "Setor", value: (empresa) => empresa.setor },
      { header: "Contato", value: (empresa) => empresa.nome_contato },
      { header: "Telefone", value: (empresa) => empresa.telefone_contato },
      { header: "E-mail", value: (empresa) => empresa.email_contato },
      { header: "Vagas anteriores", value: (empresa) => empresa.vagas?.length ?? 0 },
      { header: "Última vaga", value: (empresa) => empresa.vagas?.[0]?.titulo },
      { header: "Criada em", value: (empresa) => csvDate(empresa.vagas?.[0]?.created_at) },
    ],
  },
};

export function EmpresasSemVagaPage() {
  const navigate = useNavigate();
  const getMenuItems = useCallback((empresa, actions) => getEmpresaMenuItems(empresa, actions, navigate), [navigate]);

  return (
    <EntityList
      subtitle="Empresas parceiras sem nenhuma vaga aberta no momento — boas candidatas a um novo contato"
      type="empresa"
      endpoint="empresas"
      entityLabel={{ singular: "empresa", plural: "empresas", article: "a" }}
      searchPlaceholder="Buscar empresa por nome"
      emptyMessage="Todas as empresas têm ao menos uma vaga aberta."
      filterItems={hasNoOpenJob}
      {...empresaSemVagaConfig}
      getMenuItems={getMenuItems}
    />
  );
}

export function EstudantesPage() {
  const [profileId, setProfileId] = useState(null);
  const [indicating, setIndicating] = useState(null);

  const renderItem = useCallback((estudante) => renderEstudante(estudante, () => setProfileId(estudante.id)), []);
  const getMenuItems = useCallback(
    (estudante, { edit, remove }) => [
      { key: "profile", label: "Ver perfil", icon: UserRound, onClick: () => setProfileId(estudante.id) },
      { key: "edit", label: "Editar", icon: Pencil, onClick: edit },
      { key: "indicate", label: "Indicar para vaga", icon: Send, onClick: () => setIndicating(estudante) },
      { key: "delete", label: "Excluir", icon: Trash2, danger: true, onClick: remove },
    ],
    [],
  );

  return (
    <>
      <EntityList
        type="estudante"
        endpoint="candidatos"
        entityLabel={{ singular: "estudante", plural: "estudantes", article: "o" }}
        searchPlaceholder="Buscar estudante por nome"
        emptyMessage="Nenhum estudante cadastrado."
        {...estudanteConfig}
        renderItem={renderItem}
        getMenuItems={getMenuItems}
      />
      <Modal isOpen={Boolean(profileId)} title="Perfil do estudante" onClose={() => setProfileId(null)}>
        {profileId && <StudentQuickProfile studentId={profileId} onClose={() => setProfileId(null)} />}
      </Modal>
      <Modal isOpen={Boolean(indicating)} title="Indicar para vaga" onClose={() => setIndicating(null)}>
        {indicating && (
          <IndicateDialog studentId={indicating.id} onDone={() => setIndicating(null)} onCancel={() => setIndicating(null)} />
        )}
      </Modal>
    </>
  );
}
