import { API_URL as apiUrl } from "../api.js";

// Ações da entrevista (confirmar, reagendar, realizada, não compareceu, dispensar).
export async function runInterviewAction(interviewId, body) {
  const response = await fetch(`${apiUrl}/entrevistas/${interviewId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.erro ?? "Não foi possível atualizar a entrevista.");
  return result;
}
