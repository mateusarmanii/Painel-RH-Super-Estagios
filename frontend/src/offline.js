// Falha de conexão (API fora do ar, sem internet) vira uma mensagem em português em todas as telas.
// Continua sendo um TypeError, então as telas que já tratam esse caso seguem funcionando.
export const OFFLINE_MESSAGE = "O servidor não respondeu. Verifique se a API está rodando.";

class OfflineError extends TypeError {
  constructor() {
    super(OFFLINE_MESSAGE);
    this.name = "OfflineError";
  }
}

const nativeFetch = window.fetch.bind(window);
window.fetch = (...args) =>
  nativeFetch(...args).catch((error) => {
    if (error?.name === "AbortError") throw error;
    throw new OfflineError();
  });
