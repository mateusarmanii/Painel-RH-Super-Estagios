// Pasta antiga das logos (backend/uploads/logos). Desde a Parte 6 as logos ficam no banco (tabela Arquivo);
// a pasta só é lida pelo "npm run logos:migrar" e os arquivos que sobraram nela são apagados quando a logo muda.
const fs = require("fs");
const path = require("path");

const PASTA_LOGOS = path.resolve(__dirname, "../uploads/logos");
const URL_LOGOS = "/uploads/logos";

// "/uploads/logos/<uuid>.png" → caminho do arquivo na pasta; null para qualquer outro valor (nada fora da pasta).
function arquivoDaLogoAntiga(logoUrl) {
  const nome = typeof logoUrl === "string" && logoUrl.startsWith(`${URL_LOGOS}/`) ? logoUrl.slice(URL_LOGOS.length + 1) : "";
  return /^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(nome) ? path.join(PASTA_LOGOS, nome) : null;
}

// Apaga o arquivo antigo de uma logo_url, se ainda existir.
function apagarLogoAntiga(logoUrl) {
  const arquivo = arquivoDaLogoAntiga(logoUrl);
  if (arquivo) fs.rmSync(arquivo, { force: true });
}

module.exports = { PASTA_LOGOS, URL_LOGOS, arquivoDaLogoAntiga, apagarLogoAntiga };
