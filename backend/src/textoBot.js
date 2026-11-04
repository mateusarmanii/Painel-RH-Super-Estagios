// Pequenos ajudantes de texto das mensagens do bot do Telegram (src/assistente.js e src/acoes.js).
const ROTULOS_ETAPA = {
  CANDIDATO_CONTATADO: "Candidato Contatado",
  ENVIADO_EMPRESA: "Enviado à Empresa",
  ENTREVISTA_AGENDADA: "Em Entrevista",
  EM_TESTE: "Em Teste",
  APROVADO: "Contratado",
  RECUSADO: "Dispensado",
};

const escapar = (texto) => String(texto ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Endereço do painel para os links (o primeiro do FRONTEND_URL). O Telegram não aceita link para localhost, então
// fora do ar público a mensagem vai sem link.
function enderecoPainel() {
  const primeiro = (process.env.FRONTEND_URL ?? "").split(",")[0].trim().replace(/\/+$/, "");
  try {
    const url = new URL(primeiro);
    return /^(localhost|127\.0\.0\.1)$/.test(url.hostname) ? null : primeiro;
  } catch {
    return null;
  }
}

const linkPainel = (caminho, texto = "Abrir no painel") => {
  const painel = enderecoPainel();
  return painel ? `<a href="${escapar(painel + caminho)}">${escapar(texto)}</a>` : "";
};

module.exports = { ROTULOS_ETAPA, escapar, enderecoPainel, linkPainel };
