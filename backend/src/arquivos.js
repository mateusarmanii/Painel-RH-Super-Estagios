// Arquivos guardados no banco (tabela Arquivo): logos das empresas e currículos dos estudantes.
// O formato é conferido pelo conteúdo (assinatura dos primeiros bytes), não pelo nome nem pelo tipo informado.
// "conteudo" é pesado: fora do download, selecione só RESUMO_ARQUIVO.
const multer = require("multer");

const MB = 1024 * 1024;

// Campos do arquivo que podem ir nas listagens (nunca o conteúdo).
const RESUMO_ARQUIVO = { id: true, nome_original: true, mime: true, tamanho_bytes: true, created_at: true };

const comeca = (buffer, bytes) => buffer.length >= bytes.length && buffer.subarray(0, bytes.length).equals(Buffer.from(bytes));

// Imagens da logo. SVG fica de fora: pode carregar scripts.
function formatoDaImagem(buffer) {
  if (comeca(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { extensao: "png", mime: "image/png" };
  if (comeca(buffer, [0xff, 0xd8, 0xff])) return { extensao: "jpg", mime: "image/jpeg" };
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return { extensao: "webp", mime: "image/webp" };
  }
  return null;
}

// Currículo: PDF ("%PDF-"), DOC (arquivo OLE com o fluxo "WordDocument") ou DOCX (ZIP com a pasta "word/").
// O DOC e o DOCX precisam da marca do Word: uma planilha .xls ou .xlsx com o nome trocado é recusada.
function formatoDoCurriculo(buffer) {
  if (comeca(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { extensao: "pdf", mime: "application/pdf" };
  if (comeca(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) && buffer.includes(Buffer.from("WordDocument", "utf16le"))) {
    return { extensao: "doc", mime: "application/msword" };
  }
  if (comeca(buffer, [0x50, 0x4b, 0x03, 0x04]) && buffer.includes("word/document")) {
    return { extensao: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  }
  return null;
}

const regras = {
  LOGO: {
    campo: "logo",
    tamanhoMaximo: 2 * MB,
    detectar: formatoDaImagem,
    erroTamanho: "A logo deve ter no máximo 2 MB.",
    erroAusente: "Escolha uma imagem para a logo.",
    erroFormato: "Formato não aceito: envie PNG, JPG ou WEBP.",
  },
  CURRICULO: {
    campo: "curriculo",
    tamanhoMaximo: 5 * MB,
    detectar: formatoDoCurriculo,
    erroTamanho: "O currículo deve ter no máximo 5 MB.",
    erroAusente: "Escolha o arquivo do currículo.",
    erroFormato: "Formato não aceito: envie PDF, DOC ou DOCX.",
  },
};

// Nome mostrado no download: sem caminho, sem caracteres de controle, até 255 caracteres e com a extensão certa.
function nomeSeguro(nome, extensao) {
  const base = String(nome ?? "")
    .split(/[\\/]/)
    .pop()
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"]/g, "")
    .trim();
  const semExtensao = base.replace(/\.[^.]*$/, "") || "arquivo";
  return `${semExtensao.slice(0, 240)}.${extensao}`;
}

// Middleware: lê o arquivo do campo do tipo (multipart), confere tamanho e formato e deixa em req.arquivo
// { nome_original, mime, tamanho_bytes, conteudo }. Responde 413 (grande), 415 (formato) ou 400 (ausente).
function receberArquivo(tipo) {
  const regra = regras[tipo];
  const receber = multer({ storage: multer.memoryStorage(), limits: { fileSize: regra.tamanhoMaximo, files: 1 } }).single(regra.campo);

  return (req, res, next) => {
    receber(req, res, (error) => {
      if (error?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ erro: regra.erroTamanho });
      if (error) return res.status(400).json({ erro: `Envie um único arquivo no campo "${regra.campo}".` });
      if (!req.file) return res.status(400).json({ erro: regra.erroAusente });

      const formato = regra.detectar(req.file.buffer);
      if (!formato) return res.status(415).json({ erro: regra.erroFormato });
      // O multer lê o nome como latin1; navegadores mandam UTF-8 ("Currículo.pdf").
      const nome = Buffer.from(req.file.originalname, "latin1").toString("utf8");
      req.arquivo = {
        nome_original: nomeSeguro(nome, formato.extensao),
        mime: formato.mime,
        tamanho_bytes: req.file.size,
        conteudo: req.file.buffer,
      };
      return next();
    });
  };
}

// Grava o arquivo recebido (dentro da transação, se houver) e devolve só o resumo.
function gravarArquivo(cliente, tipo, arquivo, usuarioId) {
  return cliente.arquivo.create({
    data: { tipo, ...arquivo, enviado_por_id: usuarioId ?? null },
    select: RESUMO_ARQUIVO,
  });
}

// Apaga um arquivo que deixou de ser usado (troca, remoção, exclusão do dono). Ignora id vazio ou já apagado.
async function apagarArquivo(cliente, id) {
  if (id) await cliente.arquivo.deleteMany({ where: { id } });
}

// Content-Disposition com o nome original: "filename" só com ASCII (reserva para navegadores antigos) e
// "filename*" em UTF-8, que preserva acentos ("Currículo João.pdf").
function disposicaoComNome(disposicao, nome) {
  const ascii = nome.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^\x20-\x7e]|["\\]/g, "_");
  const utf8 = encodeURIComponent(nome).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${disposicao}; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

// Envia o conteúdo com os cabeçalhos de segurança: nosniff e CSP vazia (o navegador nunca executa o arquivo).
function enviarArquivo(res, arquivo, { disposicao, cache }) {
  res.set({
    "Content-Type": arquivo.mime,
    "Content-Disposition": disposicaoComNome(disposicao, arquivo.nome_original),
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cache-Control": cache,
  });
  return res.end(arquivo.conteudo);
}

module.exports = {
  RESUMO_ARQUIVO,
  formatoDaImagem,
  formatoDoCurriculo,
  receberArquivo,
  gravarArquivo,
  apagarArquivo,
  enviarArquivo,
};
