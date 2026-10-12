// Download de arquivos guardados no banco.
// A logo é pública (não é dado sensível; vai em <img>) e não muda: um envio novo gera outro id, então pode ficar
// em cache no navegador por um ano. Só serve arquivos do tipo LOGO: um currículo nunca sai por aqui.
const express = require("express");
const prisma = require("../prisma");
const { uuidValido } = require("../utils");
const { enviarArquivo } = require("../arquivos");

const publico = express.Router();

publico.get("/logo/:id", async (req, res) => {
  if (!uuidValido.test(req.params.id)) return res.status(404).json({ erro: "Não encontrado." });
  try {
    const arquivo = await prisma.arquivo.findFirst({
      where: { id: req.params.id, tipo: "LOGO" },
      select: { nome_original: true, mime: true, conteudo: true },
    });
    if (!arquivo) return res.status(404).json({ erro: "Não encontrado." });
    return enviarArquivo(res, arquivo, { disposicao: "inline", cache: "public, max-age=31536000, immutable" });
  } catch (error) {
    console.error("Erro ao enviar logo:", error);
    return res.status(500).json({ erro: "Não foi possível carregar a logo." });
  }
});

module.exports = { publico };
