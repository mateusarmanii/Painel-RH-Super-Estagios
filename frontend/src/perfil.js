// Regras do perfil do estudante: situação, vagas compatíveis, linha do tempo e alertas.
import { normalize } from "./text.js";
import { ageFrom } from "./estudante.js";
import { interviewStatus } from "./interviewStatus.js";

export const IN_PROCESS = ["ENVIADO_EMPRESA", "ENTREVISTA_AGENDADA", "AGUARDANDO_RETORNO"];

// Situação do estudante (também usada no filtro de Estudantes): contratado > em processo > disponível.
export function studentSituation(student) {
  const statuses = (student.aplicacoes ?? []).map((application) => application.status_kanban);
  if (statuses.includes("APROVADO")) return "CONTRATADO";
  if (statuses.some((status) => IN_PROCESS.includes(status))) return "EM_PROCESSO";
  return "DISPONIVEL";
}

export const situationLabels = { DISPONIVEL: "Disponível", EM_PROCESSO: "Em processo", CONTRATADO: "Contratado" };

// Vagas e cursos não têm um campo de área: a compatibilidade de curso procura palavras da área do curso
// no título e na descrição da vaga.
const areas = [
  { course: ["software", "computacao", "sistemas", "informatica", "dados", "tecnologia", "ti "], words: ["software", "sistemas", " ti", "ti ", "tecnologia", "desenvolvimento", "dados", "web", "suporte", "programacao", "computacao", "informatica"] },
  { course: ["direito"], words: ["direito", "juridic", "advocacia", "advogad", "trabalhista"] },
  { course: ["psicologia"], words: ["psicologia", "recursos humanos", " rh", "pessoas", "organizacional"] },
  { course: ["administra"], words: ["administra", "atendimento", "escritorio", "financeiro", "recursos humanos", " rh", "obras"] },
  { course: ["enfermagem", "saude", "medicina", "farmacia", "fisioterapia"], words: ["enfermagem", "saude", "clinica", "hospital"] },
  { course: ["marketing", "publicidade", "comunicacao", "jornalismo", "design"], words: ["marketing", "comunicacao", "publicidade", "midias", "design", "conteudo"] },
  { course: ["contab", "economia", "financ"], words: ["contab", "financeiro", "fiscal", "economia"] },
  { course: ["engenharia civil", "arquitetura"], words: ["engenharia civil", "obras", "construcao", "projetos"] },
  { course: ["pedagogia", "licenciatura", "letras"], words: ["pedagogia", "educacao", "ensino", "escola"] },
];

function courseWords(course) {
  const text = ` ${normalize(course)} `;
  const words = new Set(
    text.split(/[^a-z0-9]+/).filter((word) => word.length > 3 && !["curso", "bacharelado", "tecnologo", "engenharia"].includes(word)),
  );
  for (const area of areas) {
    if (area.course.some((key) => text.includes(key))) area.words.forEach((word) => words.add(word));
  }
  return [...words];
}

export function courseMatches(course, vaga) {
  if (!course) return false;
  const text = ` ${normalize(`${vaga.titulo} ${vaga.descricao ?? ""}`)} `;
  return courseWords(course).some((word) => text.includes(word));
}

// Turno da vaga x disponibilidade do estudante. null = não dá para saber (falta informação).
export function scheduleMatches(disponibilidade, turnoVaga) {
  if (!turnoVaga || !disponibilidade?.length) return null;
  if (turnoVaga === "INTEGRAL") return disponibilidade.includes("MANHA") && disponibilidade.includes("TARDE");
  return disponibilidade.includes(turnoVaga);
}

// Vagas abertas em que ele ainda não está, que batem com o curso e não conflitam com a disponibilidade.
// Ordem: curso e horário confirmados primeiro.
export function compatibleJobs(student, jobs) {
  const applied = new Set((student.aplicacoes ?? []).map((application) => application.vaga_id));
  return jobs
    .filter((job) => job.status === "ABERTA" && !applied.has(job.id))
    .map((job) => ({ job, course: courseMatches(student.curso, job), schedule: scheduleMatches(student.disponibilidade, job.turno) }))
    .filter((match) => match.course && match.schedule !== false)
    .sort((a, b) => Number(b.schedule === true) - Number(a.schedule === true) || a.job.titulo.localeCompare(b.job.titulo, "pt-BR"));
}

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
