// Rótulos das etapas da candidatura, iguais no Kanban, no Dashboard e no histórico.
// AGUARDANDO_RETORNO ("Em análise") saiu das telas: as candidaturas foram movidas para EM_TESTE.
export const kanbanStatusLabels = {
  CANDIDATO_CONTATADO: "Candidato Contatado",
  ENVIADO_EMPRESA: "Enviado à Empresa",
  ENTREVISTA_AGENDADA: "Em Entrevista",
  EM_TESTE: "Em Teste",
  APROVADO: "Contratado",
  RECUSADO: "Dispensado",
};

// Ordem das etapas no Kanban e no funil do Dashboard.
export const kanbanStatusOrder = ["CANDIDATO_CONTATADO", "ENVIADO_EMPRESA", "ENTREVISTA_AGENDADA", "EM_TESTE", "APROVADO", "RECUSADO"];

// Etapas em que o candidato ainda está no processo (antes de Contratado ou Dispensado).
export const IN_PROCESS_STATUSES = ["CANDIDATO_CONTATADO", "ENVIADO_EMPRESA", "ENTREVISTA_AGENDADA", "EM_TESTE"];

export const kanbanStatusStyles = {
  CANDIDATO_CONTATADO: "bg-slate-100 text-slate-700",
  ENVIADO_EMPRESA: "bg-sky-50 text-sky-700",
  ENTREVISTA_AGENDADA: "bg-violet-50 text-violet-700",
  EM_TESTE: "bg-amber-50 text-amber-800",
  APROVADO: "bg-emerald-50 text-emerald-700",
  RECUSADO: "bg-rose-50 text-rose-700",
};

export const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

// Cores da barra do mini funil nos cards de vaga (mesmos tons das etiquetas acima).
export const kanbanStatusBar = {
  CANDIDATO_CONTATADO: "bg-slate-400",
  ENVIADO_EMPRESA: "bg-sky-500",
  ENTREVISTA_AGENDADA: "bg-violet-500",
  EM_TESTE: "bg-amber-400",
  APROVADO: "bg-emerald-500",
  RECUSADO: "bg-rose-400",
};
