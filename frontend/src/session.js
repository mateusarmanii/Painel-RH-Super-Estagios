// Sessão de login: token JWT e dados do usuário, guardados no localStorage do navegador (e em memória, caso o
// navegador bloqueie o armazenamento). O token vale 8 horas; quando a API responde 401, a sessão é apagada e a tela
// de login volta (ver api.js e App.jsx).

const TOKEN_KEY = "superEstagios.token";
const USER_KEY = "superEstagios.usuario";
export const SESSION_EXPIRED_EVENT = "auth:expired";

function readStored() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    return token ? { token, usuario: JSON.parse(localStorage.getItem(USER_KEY) ?? "null") } : null;
  } catch {
    return null;
  }
}

let session = readStored();

export const getToken = () => session?.token ?? null;
export const getUser = () => session?.usuario ?? null;

export function saveSession(token, usuario) {
  session = { token, usuario };
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(usuario));
  } catch {
    // Sem acesso ao armazenamento local: o login vale até recarregar a página.
  }
}

export function clearSession() {
  session = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // Nada a apagar.
  }
}
