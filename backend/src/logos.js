// Logos das empresas: recebe o arquivo, confere o formato pelo conteúdo e grava em backend/uploads/logos.
// Os arquivos ficam fora do banco: a pasta precisa entrar no backup (ver README).
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const PASTA_LOGOS = path.resolve(__dirname, "../uploads/logos");
const URL_LOGOS = "/uploads/logos";
const TAMANHO_MAXIMO = 2 * 1024 * 1024;

fs.mkdirSync(PASTA_LOGOS, { recursive: true });

// Só aceita o arquivo pelo que ele é de fato (assinatura dos primeiros bytes), não pelo nome ou tipo informado.
// SVG fica de fora: pode carregar scripts.
function detectarFormato(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "webp";
  }
  return null;
}

const receberLogo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANHO_MAXIMO, files: 1 },
}).single("logo");

// Middleware: lê o campo "logo" do formulário e responde com mensagens claras para arquivo grande ou ausente.
function lerArquivoDaLogo(req, res, next) {
  receberLogo(req, res, (error) => {
    if (error?.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ erro: "A logo deve ter no máximo 2 MB." });
    }
    if (error) return res.status(400).json({ erro: "Envie um único arquivo no campo \"logo\"." });
    if (!req.file) return res.status(400).json({ erro: "Escolha uma imagem para a logo." });

    const formato = detectarFormato(req.file.buffer);
    if (!formato) return res.status(415).json({ erro: "Formato não aceito: envie PNG, JPG ou WEBP." });
    req.formatoLogo = formato;
    return next();
  });
}

function gravarLogo(buffer, formato) {
  const nome = `${crypto.randomUUID()}.${formato}`;
  fs.writeFileSync(path.join(PASTA_LOGOS, nome), buffer, { flag: "wx" });
  return `${URL_LOGOS}/${nome}`;
}

// Apaga o arquivo de uma logo_url gravada por nós; ignora qualquer outro valor (nada fora da pasta de logos).
function apagarLogo(logoUrl) {
  const nome = typeof logoUrl === "string" && logoUrl.startsWith(`${URL_LOGOS}/`) ? logoUrl.slice(URL_LOGOS.length + 1) : "";
  if (!/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(nome)) return;
  fs.rmSync(path.join(PASTA_LOGOS, nome), { force: true });
}

module.exports = { PASTA_LOGOS, URL_LOGOS, TAMANHO_MAXIMO, lerArquivoDaLogo, gravarLogo, apagarLogo };
