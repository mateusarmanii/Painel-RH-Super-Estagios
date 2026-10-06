// Rótulos das etapas da candidatura, iguais no Kanban, no Dashboard e no histórico.
// São só de exibição: o enum StatusKanban do banco não muda.
export const kanbanStatusLabels = {
  ENVIADO_EMPRESA: "Enviado à empresa",
  AGUARDANDO_RETORNO: "Em análise",
  ENTREVISTA_AGENDADA: "Entrevista",
  APROVADO: "Contratado",
  RECUSADO: "Dispensado",
};

// Ordem das etapas no Kanban e no funil do Dashboard.
export const kanbanStatusOrder = ["ENVIADO_EMPRESA", "ENTREVISTA_AGENDADA", "AGUARDANDO_RETORNO", "APROVADO", "RECUSADO"];

export const kanbanStatusStyles = {
  ENVIADO_EMPRESA: "bg-sky-50 text-sky-700",
  AGUARDANDO_RETORNO: "bg-amber-50 text-amber-800",
  ENTREVISTA_AGENDADA: "bg-violet-50 text-violet-700",
  APROVADO: "bg-emerald-50 text-emerald-700",
  RECUSADO: "bg-rose-50 text-rose-700",
};

// Valor mínimo/inicial de um <input type="datetime-local">, no fuso do navegador.
export function toDateTimeInputValue(date = new Date()) {
  const value = new Date(date);
  value.setSeconds(0, 0);
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

// Cores da barra do mini funil nos cards de vaga (mesmos tons das etiquetas acima).
export const kanbanStatusBar = {
  ENVIADO_EMPRESA: "bg-sky-500",
  ENTREVISTA_AGENDADA: "bg-violet-500",
  AGUARDANDO_RETORNO: "bg-amber-400",
  APROVADO: "bg-emerald-500",
  RECUSADO: "bg-rose-400",
};
