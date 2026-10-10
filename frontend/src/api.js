// Ponto único de acesso à API: todas as telas chamam apiFetch ou apiJson, que enviam o token do login.
import { clearSession, getToken, SESSION_EXPIRED_EVENT } from "./session.js";

// Endereço da API. Configure em frontend/.env com VITE_API_URL (veja frontend/.env.example).
export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:3333").replace(/\/+$/, "");

// Falha de conexão (API fora do ar, sem internet) vira uma mensagem em português em todas as telas.
// Continua sendo um TypeError, então as telas que já tratam esse caso seguem funcionando.
export const OFFLINE_MESSAGE = "O servidor não respondeu. Verifique se a API está rodando.";

export class OfflineError extends TypeError {
  constructor() {
    super(OFFLINE_MESSAGE);
    this.name = "OfflineError";
  }
}

// Erro devolvido pela API (status fora de 2xx), com a mensagem do campo "erro" ou a mensagem padrão da tela.
export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

const LOGIN_PATH = "/auth/login";

// Chama a API e devolve a Response (cada tela decide o que fazer com o status).
// path: "/vagas", "/candidatos/123"... · body: objeto (enviado como JSON) ou FormData (enviado como está).
// Envia o token do login (Authorization: Bearer). Se a API responder 401 (token ausente, inválido ou vencido),
// apaga a sessão e avisa o App, que volta para a tela de login; a chamada fica sem resposta de propósito,
// para a tela que pediu não mostrar um erro a mais enquanto some.
export async function apiFetch(path, { body, headers, ...options } = {}) {
  const isJson = body !== undefined && !(body instanceof FormData);
  const token = getToken();
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(isJson && { "Content-Type": "application/json" }),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...headers,
      },
      body: isJson ? JSON.stringify(body) : body,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new OfflineError();
  }

  if (response.status === 401 && path !== LOGIN_PATH) {
    clearSession();
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    return new Promise(() => {});
  }
  return response;
}

// Chama a API esperando sucesso: devolve o JSON da resposta ({} se vier vazia).
// Em erro, lança ApiError com a mensagem da API ou, se ela não mandar, com fallbackMessage.
export async function apiJson(path, options, fallbackMessage = "Não foi possível concluir a operação.") {
  const response = await apiFetch(path, options);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(result.erro ?? fallbackMessage, response.status, result);
  return result;
}
