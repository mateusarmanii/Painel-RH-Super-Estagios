// Status da entrevista (Agenda e Kanban). Cores: verde confirmada, laranja aguardando, vermelho não compareceu,
// cinza cancelada; realizada em azul-marinho (neutro). O âmbar fica só para "hoje" e o botão principal.

export const interviewStatusLabels = {
  AGUARDANDO: "Aguardando",
  CONFIRMADA: "Confirmada",
  REALIZADA: "Realizada",
  NAO_COMPARECEU: "Não compareceu",
  CANCELADA: "Cancelada",
};

// Etiqueta (texto + fundo).
export const interviewStatusBadge = {
  AGUARDANDO: "bg-orange-50 text-orange-800 ring-1 ring-orange-200",
  CONFIRMADA: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
  REALIZADA: "bg-marinho-50 text-marinho-800 ring-1 ring-marinho-200",
  NAO_COMPARECEU: "bg-rose-50 text-rose-800 ring-1 ring-rose-200",
  CANCELADA: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
};

// Bloco no calendário (fundo claro + faixa colorida à esquerda).
export const interviewStatusBlock = {
  AGUARDANDO: "border-l-orange-500 bg-orange-50 text-orange-950 hover:bg-orange-100",
  CONFIRMADA: "border-l-emerald-600 bg-emerald-50 text-emerald-950 hover:bg-emerald-100",
  REALIZADA: "border-l-marinho-600 bg-marinho-50 text-marinho-950 hover:bg-marinho-100",
  NAO_COMPARECEU: "border-l-rose-600 bg-rose-50 text-rose-950 hover:bg-rose-100",
  CANCELADA: "border-l-slate-400 bg-slate-100 text-slate-500 line-through hover:bg-slate-200",
};

export const interviewStatusDot = {
  AGUARDANDO: "bg-orange-500",
  CONFIRMADA: "bg-emerald-600",
  REALIZADA: "bg-marinho-600",
  NAO_COMPARECEU: "bg-rose-600",
  CANCELADA: "bg-slate-400",
};

export const interviewFormatLabels = { PRESENCIAL: "Presencial", ONLINE: "Online" };

export const DEFAULT_DURATION = 45;

// Mesmo critério da API para entrevistas antigas, sem status gravado.
export function interviewStatus(application) {
  if (application.status_exibido) return application.status_exibido;
  if (application.entrevista_status) return application.entrevista_status;
  if (application.status_kanban === "ENTREVISTA_AGENDADA" || application.status === "ENTREVISTA_AGENDADA") return "AGUARDANDO";
  return null;
}
