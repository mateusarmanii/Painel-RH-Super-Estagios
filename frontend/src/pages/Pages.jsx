import { Link } from "react-router-dom";
import CandidaturaHistory from "../components/CandidaturaHistory.jsx";
import EntityList from "../components/EntityList.jsx";
import { statusLabels, statusStyles } from "../vagaStatus.js";
import { kanbanStatusLabels } from "../kanbanStatus.js";
import { csvDate, csvDecimal } from "../csv.js";

function PlaceholderPage({ title }) {
  return (
    <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50 px-4">
      <h1 className="text-center text-3xl font-semibold text-slate-900">{title}</h1>
    </section>
  );
}

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
      <div className="mb-5 flex items-start gap-3 pr-20">
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[vaga.status]}`}
        >
          {statusLabels[vaga.status]}
        </span>
        <span className="py-1 text-xs text-slate-500">Nº {vaga.codigo_vaga}</span>
      </div>
      <h2 className="text-lg font-semibold leading-6 text-slate-900">{vaga.titulo}</h2>
      <p className="mt-2 text-sm text-slate-600">{vaga.empresa?.nome}</p>
      <p className="mt-1 text-sm text-slate-500">{currency.format(vaga.valor)}</p>
      <Link
        to={`/kanban/${vaga.id}`}
        className="mt-auto pt-6 text-left text-sm font-semibold text-sky-800 transition-colors hover:text-sky-950"
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
      <span className="mb-5 self-start rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800">
        {empresa.setor}
      </span>
      <h2 className="pr-20 text-lg font-semibold leading-6 text-slate-900">{empresa.nome}</h2>
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
    filename: "banco-de-talentos",
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
  renderItem: (estudante) => (
    <>
      <span className="mb-5 self-start rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
        {horarioLabels[estudante.horario_estudo]}
      </span>
      <h2 className="pr-20 text-lg font-semibold leading-6 text-slate-900">{estudante.nome_completo}</h2>
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
  ),
};

export function VagasPage() {
  return (
    <EntityList
      title="Vagas"
      type="vaga"
      endpoint="vagas"
      entityLabel={{ singular: "vaga", plural: "vagas", article: "a" }}
      searchPlaceholder="Buscar vaga por título ou Nº"
      emptyMessage="Nenhuma vaga cadastrada."
      {...vagaConfig}
    />
  );
}

export function EmpresasPage() {
  return (
    <EntityList
      title="Empresas"
      type="empresa"
      endpoint="empresas"
      entityLabel={{ singular: "empresa", plural: "empresas", article: "a" }}
      searchPlaceholder="Buscar empresa por nome"
      emptyMessage="Nenhuma empresa cadastrada."
      {...empresaConfig}
    />
  );
}

export function EmpresasSemVagaPage() {
  return <PlaceholderPage title="Empresas sem vaga" />;
}

export function BancoDeTalentosPage() {
  return (
    <EntityList
      title="Banco de Talentos"
      type="estudante"
      endpoint="candidatos"
      entityLabel={{ singular: "estudante", plural: "estudantes", article: "o" }}
      searchPlaceholder="Buscar estudante por nome"
      emptyMessage="Nenhum estudante cadastrado."
      {...estudanteConfig}
    />
  );
}
