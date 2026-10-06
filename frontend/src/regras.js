// Regras de negócio usadas em mais de uma tela (listas e quadro "Olá, o RH tem" do Dashboard).

const IN_PROCESS = new Set(["ENVIADO_EMPRESA", "AGUARDANDO_RETORNO", "ENTREVISTA_AGENDADA"]);

// Regras do Banco de Talentos:
// - entra quem tem ao menos uma candidatura RECUSADO;
// - quem já foi contratado (APROVADO em qualquer vaga) fica de fora;
// - quem ainda está em processo em outra vaga ganha a etiqueta "Em processo".
// A data da dispensa é o updated_at da candidatura (enquanto RECUSADO, a última alteração é a dispensa).
export function toTalents(students) {
  return students
    .filter((student) => {
      const statuses = (student.aplicacoes ?? []).map((application) => application.status_kanban);
      return statuses.includes("RECUSADO") && !statuses.includes("APROVADO");
    })
    .map((student) => {
      const applications = student.aplicacoes ?? [];
      const lastDismissal = applications
        .filter((application) => application.status_kanban === "RECUSADO")
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
      return {
        ...student,
        lastDismissal,
        inProcess: applications.filter((application) => IN_PROCESS.has(application.status_kanban)),
      };
    })
    .sort((a, b) => new Date(b.lastDismissal.updated_at) - new Date(a.lastDismissal.updated_at));
}

// Empresas sem nenhuma vaga ABERTA (inclui as que nunca tiveram vaga) — candidatas a contato comercial.
export const hasNoOpenJob = (empresa) => !(empresa.vagas ?? []).some((vaga) => vaga.status === "ABERTA");
