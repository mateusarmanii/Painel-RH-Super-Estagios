// Datas da Agenda (sempre no fuso do navegador). A semana começa na segunda-feira.
import { DEFAULT_DURATION, interviewFormatLabels } from "../interviewStatus.js";

export const MINUTE_MS = 60 * 1000;

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, date.getHours(), date.getMinutes());
}

export function startOfWeek(date) {
  const day = startOfDay(date);
  return addDays(day, -((day.getDay() + 6) % 7));
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// Intervalo buscado na API e dias mostrados em cada visão.
export function periodFor(view, anchor) {
  if (view === "dia") {
    const start = startOfDay(anchor);
    return { start, end: addDays(start, 1), days: [start] };
  }
  if (view === "semana") {
    const start = startOfWeek(anchor);
    return { start, end: addDays(start, 7), days: Array.from({ length: 7 }, (_, i) => addDays(start, i)) };
  }
  if (view === "mes") {
    const first = startOfMonth(anchor);
    const start = startOfWeek(first);
    const weeks = Math.ceil(((first - start) / 86400000 + new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()) / 7);
    const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
    return { start, end: addDays(start, weeks * 7), days };
  }
  const start = startOfMonth(anchor);
  return { start, end: addMonths(start, 1), days: [] };
}

export function shiftAnchor(view, anchor, direction) {
  if (view === "dia") return addDays(startOfDay(anchor), direction);
  if (view === "semana") return addDays(startOfDay(anchor), 7 * direction);
  return addMonths(anchor, direction);
}

const fullDay = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const monthYear = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });
export const timeFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
export const weekdayShort = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
const weekdayDate = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
const longDay = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

export function periodLabel(view, anchor) {
  if (view === "dia") return capitalize(fullDay.format(anchor));
  if (view === "semana") {
    const start = startOfWeek(anchor);
    const end = addDays(start, 6);
    return `${dayMonth.format(start)} – ${dayMonth.format(end)} de ${end.getFullYear()}`;
  }
  return capitalize(monthYear.format(anchor));
}

export function dayTitle(date, today = new Date()) {
  if (sameDay(date, today)) return `Hoje · ${longDay.format(date)}`;
  if (sameDay(date, addDays(startOfDay(today), 1))) return `Amanhã · ${longDay.format(date)}`;
  return capitalize(longDay.format(date));
}

export function interviewEnd(interview) {
  return new Date(new Date(interview.data_hora_entrevista).getTime() + (interview.entrevista_duracao ?? DEFAULT_DURATION) * MINUTE_MS);
}

export function interviewTimeRange(interview) {
  return `${timeFormat.format(new Date(interview.data_hora_entrevista))} – ${timeFormat.format(interviewEnd(interview))}`;
}

// Valor para <input type="datetime-local">.
export function toLocalInput(date) {
  const value = new Date(date);
  value.setSeconds(0, 0);
  return new Date(value.getTime() - value.getTimezoneOffset() * MINUTE_MS).toISOString().slice(0, 16);
}

const isLink = (text) => /^https?:\/\//i.test(text ?? "");

// Mensagem de WhatsApp para pedir confirmação.
export function confirmationMessage(interview) {
  const firstName = interview.estudante.nome_completo.replace(/^\s*\[[^\]]*\]\s*/, "").split(/\s+/)[0];
  const start = new Date(interview.data_hora_entrevista);
  const format = interviewFormatLabels[interview.entrevista_formato];
  const where = interview.entrevista_local
    ? `${format ? `${format}: ` : isLink(interview.entrevista_local) ? "Link: " : "Local: "}${interview.entrevista_local}`
    : format
      ? `Entrevista ${format.toLowerCase()}`
      : "";
  return [
    `Olá, ${firstName}! Aqui é da Super Estágios.`,
    `Sua entrevista para a vaga "${interview.vaga.titulo}" na empresa ${interview.vaga.empresa.nome} está marcada para ${weekdayDate.format(start)}, às ${timeFormat.format(start)}.`,
    where && `${where}.`,
    "Pode confirmar sua presença? Obrigado!",
  ]
    .filter(Boolean)
    .join("\n");
}

// "Adicionar ao Google Agenda" por link (sem integração).
export function googleCalendarLink(interview) {
  const stamp = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = new Date(interview.data_hora_entrevista);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Entrevista: ${interview.estudante.nome_completo} – ${interview.vaga.titulo} (${interview.vaga.empresa.nome})`,
    dates: `${stamp(start)}/${stamp(interviewEnd(interview))}`,
    details: [
      `Candidato: ${interview.estudante.nome_completo}`,
      `Vaga: ${interview.vaga.titulo} · Nº ${interview.vaga.codigo_vaga}`,
      `Empresa: ${interview.vaga.empresa.nome}`,
      interview.entrevista_formato && `Formato: ${interviewFormatLabels[interview.entrevista_formato]}`,
      interview.entrevistador && `Entrevistador: ${interview.entrevistador}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
  if (interview.entrevista_local) params.set("location", interview.entrevista_local);
  return `https://calendar.google.com/calendar/render?${params}`;
}

export { isLink };
