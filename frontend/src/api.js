// Ponto único de acesso à API: todas as telas chamam apiFetch ou apiJson (o login vai entrar aqui).

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

// Chama a API e devolve a Response (cada tela decide o que fazer com o status).
// path: "/vagas", "/candidatos/123"... · body: objeto (enviado como JSON) ou FormData (enviado como está).
export async function apiFetch(path, { body, headers, ...options } = {}) {
  const isJson = body !== undefined && !(body instanceof FormData);
  try {
    return await fetch(`${API_URL}${path}`, {
      ...options,
      headers: isJson ? { "Content-Type": "application/json", ...headers } : headers,
      body: isJson ? JSON.stringify(body) : body,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new OfflineError();
  }
}

// Chama a API esperando sucesso: devolve o JSON da resposta ({} se vier vazia).
// Em erro, lança ApiError com a mensagem da API ou, se ela não mandar, com fallbackMessage.
export async function apiJson(path, options, fallbackMessage = "Não foi possível concluir a operação.") {
  const response = await apiFetch(path, options);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(result.erro ?? fallbackMessage, response.status, result);
  return result;
}
