import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Pencil, Send, Trash2, UserRound } from "lucide-react";
import CandidaturaHistory from "../components/CandidaturaHistory.jsx";
import EntityList from "../components/EntityList.jsx";
import { IndicateDialog } from "../components/IndicateForm.jsx";
import Modal from "../components/Modal.jsx";
import { kanbanStatusLabels } from "../kanbanStatus.js";
import { formatPhone } from "../text.js";
import { availabilityText, formatDate, formatMonthYear, studyShiftLabel } from "../estudante.js";

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
      { header: "Telefone", value: (estudante) => formatPhone(estudante.telefone) },
      { header: "E-mail", value: (estudante) => estudante.email },
      { header: "Turno de estudo", value: (estudante) => studyShiftLabel(estudante) },
      { header: "Disponibilidade", value: (estudante) => availabilityText(estudante.disponibilidade) },
      { header: "Semestre atual", value: (estudante) => estudante.semestre_atual },
      { header: "Previsão de formatura", value: (estudante) => formatMonthYear(estudante.previsao_formatura) },
      { header: "Data de nascimento", value: (estudante) => formatDate(estudante.data_nascimento) },
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
function renderEstudante(estudante) {
  return (
    <>
      <div className="mb-5 flex flex-wrap gap-1.5 pr-10">
        {studyShiftLabel(estudante) && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600" title="Turno de estudo">
            {studyShiftLabel(estudante)}
          </span>
        )}
        {estudante.semestre_atual && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {estudante.semestre_atual}º semestre
          </span>
        )}
      </div>
      <h2 className="pr-10 text-lg font-semibold leading-6">
<Link
          to={`/estudantes/${estudante.id}`}
          title="Ver perfil"
          className="text-left text-marinho-900 underline-offset-2 hover:text-marinho-600 hover:underline"
        >
          {estudante.nome_completo}
        </Link>
      </h2>
      <p className="mt-2 text-sm text-slate-600">{estudante.curso}</p>
      <p className="text-sm text-slate-500">{estudante.instituicao_ensino}</p>
      {(estudante.disponibilidade?.length > 0 || estudante.previsao_formatura) && (
        <p className="mt-2 text-xs text-slate-500">
          {estudante.disponibilidade?.length > 0 && <>Disponível: <span className="font-semibold text-slate-700">{availabilityText(estudante.disponibilidade)}</span></>}
          {estudante.disponibilidade?.length > 0 && estudante.previsao_formatura && " · "}
          {estudante.previsao_formatura && <>Forma em <span className="font-semibold text-slate-700">{formatMonthYear(estudante.previsao_formatura)}</span></>}
        </p>
      )}
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

export function EstudantesPage() {
  const navigate = useNavigate();
  const [indicating, setIndicating] = useState(null);
  const getMenuItems = useCallback(
    (estudante, { edit, remove }) => [
      { key: "profile", label: "Ver perfil", icon: UserRound, onClick: () => navigate(`/estudantes/${estudante.id}`) },
      { key: "edit", label: "Editar", icon: Pencil, onClick: edit },
      { key: "indicate", label: "Indicar para vaga", icon: Send, onClick: () => setIndicating(estudante) },
      { key: "delete", label: "Excluir", icon: Trash2, danger: true, onClick: remove },
    ],
    [navigate],
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
        renderItem={renderEstudante}
        getMenuItems={getMenuItems}
      />
      <Modal isOpen={Boolean(indicating)} title="Indicar para vaga" onClose={() => setIndicating(null)}>
        {indicating && (
          <IndicateDialog studentId={indicating.id} onDone={() => setIndicating(null)} onCancel={() => setIndicating(null)} />
        )}
      </Modal>
    </>
  );
}
