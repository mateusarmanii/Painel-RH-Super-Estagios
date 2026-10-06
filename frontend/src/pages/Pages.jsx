import { useCallback, useState } from "react";
import { Pencil, Send, Trash2, UserRound } from "lucide-react";
import CandidaturaHistory from "../components/CandidaturaHistory.jsx";
import EntityList from "../components/EntityList.jsx";
import { IndicateDialog } from "../components/IndicateForm.jsx";
import Modal from "../components/Modal.jsx";
import StudentQuickProfile from "../components/StudentQuickProfile.jsx";
import { kanbanStatusLabels } from "../kanbanStatus.js";


const horarioLabels = { MANHA: "Manhã", TARDE: "Tarde", NOITE: "Noite" };

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
