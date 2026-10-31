// Regras do perfil do estudante: situação, vagas compatíveis, linha do tempo e alertas.
import { normalize } from "./text.js";
import { ageFrom, studyShift } from "./estudante.js";
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

// Vagas e cursos não têm um campo de área: a compatibilidade de curso procura palavras da área do curso
// no título e na descrição da vaga. Palavras muito comuns em qualquer anúncio ("dados", "desenvolvimento",
// "projetos", "suporte") só contam dentro de expressões ("banco de dados", "suporte tecnico").
const areas = [
  {
    course: ["software", "computacao", "sistemas", "informatica", "ciencia de dados", "tecnologia da informacao", "ti"],
    words: ["software", "sistemas", "ti", "tecnologia da informacao", "desenvolvimento de software", "desenvolvedor", "programador", "programacao", "banco de dados", "analise de dados", "ciencia de dados", "web", "suporte tecnico", "help desk", "computacao", "informatica"],
  },
  { course: ["direito"], words: ["direito", "juridic", "advocacia", "advogad", "trabalhista"] },
  { course: ["psicologia"], words: ["psicologia", "recursos humanos", "rh", "gestao de pessoas", "organizacional"] },
  { course: ["recursos humanos", "rh", "gestao de pessoas"], words: ["recursos humanos", "rh", "gestao de pessoas", "departamento pessoal"] },
  { course: ["administra"], words: ["administra", "atendimento", "escritorio", "financeiro", "recursos humanos", "rh"] },
  { course: ["enfermagem", "saude", "medicina", "farmacia", "fisioterapia"], words: ["enfermagem", "saude", "clinica", "hospital"] },
  { course: ["marketing", "publicidade", "comunicacao", "jornalismo", "design"], words: ["marketing", "comunicacao", "publicidade", "midias", "design", "conteudo"] },
  { course: ["contab", "economia", "financ"], words: ["contab", "financeiro", "fiscal", "economia"] },
  { course: ["engenharia civil", "arquitetura"], words: ["engenharia civil", "arquitetura", "obras", "construcao"] },
  { course: ["pedagogia", "licenciatura", "letras"], words: ["pedagogia", "educacao", "ensino", "escola"] },
];

// Palavras do nome do curso que não indicam área ("Ciência da Computação", "Gestão de Recursos Humanos").
const genericCourseWords = new Set([
  "curso", "bacharelado", "tecnologo", "tecnologia", "engenharia", "licenciatura", "graduacao", "superior", "tecnico",
  "ciencia", "ciencias", "gestao", "analise", "desenvolvimento", "informacao", "recursos", "processos",
]);

// Texto só com letras e números separados por um espaço, com espaço nas pontas, para buscar palavras inteiras.
const searchText = (text) => ` ${normalize(text).replace(/[^a-z0-9]+/g, " ").trim()} `;

// A palavra precisa começar uma palavra do texto ("juridic" acha "jurídico"); siglas curtas ("ti", "rh") só
// valem como palavra inteira, para "ti" não achar "time" nem "tipo".
const hasWord = (text, word) => text.includes(` ${word}${word.length <= 3 ? " " : ""}`);

function courseWords(course) {
  const text = searchText(course);
  const words = new Set(text.trim().split(" ").filter((word) => word.length > 3 && !genericCourseWords.has(word)));
  for (const area of areas) {
    if (area.course.some((key) => hasWord(text, key))) area.words.forEach((word) => words.add(word));
  }
  return [...words];
}

export function courseMatches(course, vaga) {
  if (!course?.trim()) return false;
  const text = searchText(`${vaga.titulo} ${vaga.descricao ?? ""}`);
  return courseWords(course).some((word) => hasWord(text, word));
}

// Turno da vaga x disponibilidade do estudante. null = não dá para saber (falta informação).
export function scheduleMatches(disponibilidade, turnoVaga) {
  if (!turnoVaga || !disponibilidade?.length) return null;
  if (turnoVaga === "INTEGRAL") return disponibilidade.includes("MANHA") && disponibilidade.includes("TARDE");
  return disponibilidade.includes(turnoVaga);
}

// Turno da vaga x turno em que o estudante estuda. Noite e EAD não chocam com nenhum turno de vaga;
// quem estuda em período integral não tem turno livre. null = falta informação.
const studyBusy = { MANHA: ["MANHA", "INTEGRAL"], TARDE: ["TARDE", "INTEGRAL"], NOITE: [], EAD: [], INTEGRAL: ["MANHA", "TARDE", "INTEGRAL"] };

export function studyShiftMatches(turnoEstudo, turnoVaga) {
  if (!turnoVaga || !studyBusy[turnoEstudo]) return null;
  return !studyBusy[turnoEstudo].includes(turnoVaga);
}

// Cidade da vaga x cidade do estudante. Home office vale para qualquer cidade. null = falta informação.
export function cityMatches(student, vaga) {
  if (vaga.modalidade === "HOME_OFFICE") return true;
  if (!normalize(vaga.cidade) || !normalize(student.cidade)) return null;
  return normalize(vaga.cidade) === normalize(student.cidade);
}

// Vagas abertas em que ele ainda não está e que batem com o curso. Disponibilidade, turno de estudo e cidade
// também precisam bater; se faltar a informação de um dos lados, a vaga aparece com aviso para conferir.
// Ordem: mais itens confirmados primeiro.
export function compatibleJobs(student, jobs) {
  const applied = new Set((student.aplicacoes ?? []).map((application) => application.vaga_id));
  return jobs
    .filter((job) => job.status === "ABERTA" && !applied.has(job.id) && courseMatches(student.curso, job))
    .map((job) => ({
      job,
      checks: {
        schedule: scheduleMatches(student.disponibilidade, job.turno),
        study: studyShiftMatches(studyShift(student), job.turno),
        city: cityMatches(student, job),
      },
    }))
    .filter((match) => Object.values(match.checks).every((result) => result !== false))
    .map((match) => ({ ...match, confirmed: Object.values(match.checks).filter((result) => result === true).length }))
    .sort((a, b) => b.confirmed - a.confirmed || a.job.titulo.localeCompare(b.job.titulo, "pt-BR"));
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
