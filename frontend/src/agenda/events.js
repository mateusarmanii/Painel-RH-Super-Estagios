// Eventos do Calendário (compromissos que não são entrevistas): datas, textos, formulário e cores.
// Cor própria (azul-céu, com ícone de calendário), diferente de todos os status de entrevista.
import { MINUTE_MS, timeFormat } from "./dates.js";

export const DEFAULT_EVENT_DURATION = 60;
export const EVENT_TITLE_MAX = 120;
export const EVENT_DESCRIPTION_MAX = 2000;
export const eventDurations = [15, 30, 45, 60, 90, 120, 180, 240, 480];

export const eventBlock = "border-l-sky-600 bg-sky-50 text-sky-950 hover:bg-sky-100";
export const eventDot = "bg-sky-600";
export const eventBadge = "bg-sky-50 text-sky-800 ring-1 ring-sky-200";

export const eventStart = (event) => new Date(event.inicio);
export const eventEnd = (event) => new Date(new Date(event.inicio).getTime() + event.duracao_minutos * MINUTE_MS);

// "09:00 · Título" ou "Dia inteiro · Título".
export function eventLine(event, date = eventStart(event)) {
  return `${event.dia_inteiro ? "Dia inteiro" : timeFormat.format(date)} · ${event.titulo}`;
}

export function eventTimeRange(event) {
  if (event.dia_inteiro) return "Dia inteiro";
  return `${timeFormat.format(eventStart(event))} – ${timeFormat.format(eventEnd(event))}`;
}

export function durationLabel(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

const pad = (value) => String(value).padStart(2, "0");
const dateInput = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const timeInput = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

// Valores do formulário: de um evento existente ou de uma data (clique num horário vazio / "Novo evento").
export function eventFormValues(event, date) {
  if (event) {
    const start = eventStart(event);
    return {
      titulo: event.titulo,
      data: dateInput(start),
      hora: event.dia_inteiro ? "09:00" : timeInput(start),
      duracao: String(event.dia_inteiro ? DEFAULT_EVENT_DURATION : event.duracao_minutos),
      diaInteiro: event.dia_inteiro,
      descricao: event.descricao ?? "",
    };
  }
  const start = date ?? nextHalfHour();
  return { titulo: "", data: dateInput(start), hora: timeInput(start), duracao: String(DEFAULT_EVENT_DURATION), diaInteiro: false, descricao: "" };
}

function nextHalfHour() {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setMinutes(date.getMinutes() < 30 ? 30 : 60);
  return date;
}

// Confere e monta o corpo para a API. Devolve { erro } ou { body }.
export function eventPayload(values) {
  const titulo = values.titulo.trim();
  if (!titulo) return { erro: "Informe o título do evento." };
  if (titulo.length > EVENT_TITLE_MAX) return { erro: `O título pode ter no máximo ${EVENT_TITLE_MAX} caracteres.` };
  if (!values.data) return { erro: "Informe a data do evento." };
  if (!values.diaInteiro && !values.hora) return { erro: "Informe a hora do evento (ou marque Dia inteiro)." };
  const start = new Date(`${values.data}T${values.diaInteiro ? "00:00" : values.hora}`);
  if (Number.isNaN(start.getTime())) return { erro: "Data ou hora inválida." };
  const duracao = Number(values.duracao);
  if (!values.diaInteiro && (!Number.isInteger(duracao) || duracao <= 0)) return { erro: "Escolha a duração do evento." };
  return {
    body: {
      titulo,
      inicio: start.toISOString(),
      dia_inteiro: values.diaInteiro,
      ...(!values.diaInteiro && { duracao_minutos: duracao }),
      descricao: values.descricao.trim() || null,
    },
  };
}

// "Adicionar ao Google Agenda" por link (sem integração).
export function googleCalendarEventLink(event) {
  const stamp = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const day = (date) => dateInput(date).replace(/-/g, "");
  const start = eventStart(event);
  // Dia inteiro: o Google usa datas, com a final exclusiva (dia seguinte).
  const nextDay = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.titulo,
    dates: event.dia_inteiro ? `${day(start)}/${day(nextDay)}` : `${stamp(start)}/${stamp(eventEnd(event))}`,
  });
  if (event.descricao) params.set("details", event.descricao);
  return `https://calendar.google.com/calendar/render?${params}`;
}
