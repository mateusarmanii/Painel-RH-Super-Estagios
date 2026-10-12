import { apiJson } from "../api.js";

// Ações da entrevista (confirmar, reagendar, realizada, não compareceu, dispensar).
export function runInterviewAction(interviewId, body) {
  return apiJson(`/entrevistas/${interviewId}`, { method: "PATCH", body }, "Não foi possível atualizar a entrevista.");
}

// Eventos do Calendário.
export function listEvents(startIso, endIso) {
  const params = new URLSearchParams({ inicio: startIso, fim: endIso });
  return apiJson(`/eventos?${params}`, undefined, "Não foi possível carregar os eventos.");
}

export function saveEvent(eventId, body) {
  return eventId
    ? apiJson(`/eventos/${eventId}`, { method: "PUT", body }, "Não foi possível salvar o evento.")
    : apiJson("/eventos", { method: "POST", body }, "Não foi possível criar o evento.");
}

// cancelInvite: envia antes o cancelamento (METHOD:CANCEL) a quem recebeu o convite.
export function deleteEvent(eventId, cancelInvite = false) {
  return apiJson(`/eventos/${eventId}${cancelInvite ? "?cancelar_convite=1" : ""}`, { method: "DELETE" }, "Não foi possível excluir o evento.");
}

// Lembretes por e-mail. target: { evento_id } ou { entrevista_id }.
let configPromise = null;
export function reminderConfig() {
  configPromise ??= apiJson("/lembretes/config", undefined, "").catch((error) => {
    configPromise = null;
    throw error;
  });
  return configPromise;
}

export function getReminders(target) {
  return apiJson(`/lembretes?${new URLSearchParams(target)}`, undefined, "Não foi possível carregar os lembretes.");
}

export function sendReminder(target, emails, alarms) {
  return apiJson("/lembretes", { method: "POST", body: { ...target, emails, alarmes: alarms } }, "Não foi possível enviar o lembrete.");
}

export function resendReminder(target) {
  return apiJson("/lembretes/reenviar", { method: "POST", body: target }, "Não foi possível reenviar o convite.");
}

export function cancelReminder(target) {
  return apiJson("/lembretes/cancelar", { method: "POST", body: target }, "Não foi possível enviar o cancelamento.");
}
