// Regras do perfil do estudante: situação, linha do tempo e alertas.
// As vagas compatíveis vêm da API (GET /candidatos/:id/vagas-compativeis, regra em backend/src/compatibilidade.js).
import { ageFrom } from "./estudante.js";
import { interviewStatus } from "./interviewStatus.js";
import { IN_PROCESS_STATUSES } from "./kanbanStatus.js";

export const IN_PROCESS = IN_PROCESS_STATUSES;

// Situação do estudante (também usada no filtro de Estudantes): contratado > em processo > disponível.
export function studentSituation(student) {
  const statuses = (student.aplicacoes ?? []).map((application) => application.status_kanban);
  if (statuses.includes("APROVADO")) return "CONTRATADO";
  if (statuses.some((status) => IN_PROCESS.includes(status))) return "EM_PROCESSO";
  return "DISPONIVEL";
}

export const situationLabels = { DISPONIVEL: "Disponível", EM_PROCESSO: "Em processo", CONTRATADO: "Contratado" };

// Próxima entrevista ainda em aberto (aguardando ou confirmada).
export function nextInterview(applications, now = new Date()) {
  return applications
    .filter((application) => application.status_kanban === "ENTREVISTA_AGENDADA" && application.data_hora_entrevista)
    .filter((application) => ["AGUARDANDO", "CONFIRMADA"].includes(interviewStatus(application)))
    .filter((application) => new Date(application.data_hora_entrevista) >= now)
    .sort((a, b) => new Date(a.data_hora_entrevista) - new Date(b.data_hora_entrevista))[0] ?? null;
}

// Linha do tempo: um evento por acontecimento de cada candidatura, do mais recente para o mais antigo.
export function timeline(applications) {
  const events = [];
  for (const application of applications) {
    const base = { application, key: application.id };
    events.push({ ...base, type: "indicado", date: application.created_at, id: `${application.id}-indicado` });
    if (application.data_hora_entrevista) {
      events.push({
        ...base,
        type: "entrevista",
        date: application.data_hora_entrevista,
        status: interviewStatus(application) ?? "REALIZADA",
        id: `${application.id}-entrevista`,
      });
    }
    if (application.data_aprovacao) events.push({ ...base, type: "contratado", date: application.data_aprovacao, id: `${application.id}-contratado` });
    if (application.status_kanban === "RECUSADO") {
      events.push({ ...base, type: "dispensado", date: application.updated_at, id: `${application.id}-dispensado` });
    }
  }
  return events.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// Alertas: formatura em até 6 meses (ou já passada) e menor de 18 anos.
export function profileAlerts(student, today = new Date()) {
  const alerts = [];
  if (student.previsao_formatura) {
    const [year, month] = student.previsao_formatura.slice(0, 7).split("-").map(Number);
    const months = (year - today.getFullYear()) * 12 + (month - 1 - today.getMonth());
    if (months < 0) {
      alerts.push({ key: "formado", tone: "danger", text: "A previsão de formatura já passou: confirme se o estudante ainda tem matrícula ativa antes de indicar." });
    } else if (months <= 6) {
      alerts.push({
        key: "formatura",
        tone: "warning",
        text: months === 0
          ? "Forma neste mês: o estágio só vale com matrícula ativa — confira as datas antes de indicar."
          : `Forma em ${months} ${months === 1 ? "mês" : "meses"}: o estágio só vale com matrícula ativa — confira a duração da vaga.`,
      });
    }
  }
  const age = ageFrom(student.data_nascimento, today);
  if (age !== null && age < 18) {
    alerts.push({ key: "menor", tone: "warning", text: `Menor de idade (${age} anos): o termo de compromisso precisa da assinatura do responsável legal.` });
  }
  return alerts;
}
