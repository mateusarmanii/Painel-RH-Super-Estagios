import { apiJson } from "../api.js";

// Ações da entrevista (confirmar, reagendar, realizada, não compareceu, dispensar).
export function runInterviewAction(interviewId, body) {
  return apiJson(`/entrevistas/${interviewId}`, { method: "PATCH", body }, "Não foi possível atualizar a entrevista.");
}
