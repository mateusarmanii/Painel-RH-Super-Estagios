// Registro de contatos e anotações (estudante ou empresa): ligação, WhatsApp, e-mail, reunião, sem resposta ou nota,
// com texto e próximo contato opcionais.
//   GET    /contatos?estudante_id= | ?empresa_id=   (mais recente primeiro)
//   POST   /contatos                                { estudante_id | empresa_id, tipo?, texto?, proximo_contato?, aplicacao_id? }
//   PATCH  /contatos/:id                            { proximo_contato: null } marca o retorno como feito
//   DELETE /contatos/:id
const express = require("express");
const prisma = require("../prisma");
const { uuidValido } = require("../utils");
const { lerDia } = require("../estagios");

const router = express.Router();
const TIPOS = new Set(["NOTA", "LIGACAO", "WHATSAPP", "EMAIL", "REUNIAO", "SEM_RESPOSTA"]);
const TEXTO_MAX = 2000;

const selectContato = {
  id: true,
  tipo: true,
  texto: true,
  proximo_contato: true,
  created_at: true,
  estudante_id: true,
  empresa_id: true,
  aplicacao_id: true,
  usuario: { select: { id: true, nome: true } },
};

router.get("/", async (req, res) => {
  const { estudante_id, empresa_id } = req.query;
  const filtro = estudante_id ? { estudante_id } : empresa_id ? { empresa_id } : null;
  if (!filtro || !uuidValido.test(estudante_id ?? empresa_id)) return res.status(400).json({ erro: "Informe estudante_id ou empresa_id." });
  try {
    const contatos = await prisma.contato.findMany({ where: filtro, orderBy: { created_at: "desc" }, take: 200, select: selectContato });
    return res.json(contatos);
  } catch (error) {
    console.error("Erro ao listar contatos:", error);
    return res.status(500).json({ erro: "Não foi possível listar os contatos." });
  }
});

router.post("/", async (req, res) => {
  const { estudante_id, empresa_id, aplicacao_id, tipo = "NOTA", texto, proximo_contato } = req.body ?? {};
  if (Boolean(estudante_id) === Boolean(empresa_id)) return res.status(400).json({ erro: "Informe o estudante ou a empresa." });
  if (![estudante_id, empresa_id, aplicacao_id].filter(Boolean).every((id) => uuidValido.test(id))) {
    return res.status(400).json({ erro: "ID inválido." });
  }
  if (!TIPOS.has(tipo)) return res.status(400).json({ erro: "Tipo de contato inválido." });
  if (texto !== undefined && texto !== null && (typeof texto !== "string" || texto.length > TEXTO_MAX)) {
    return res.status(400).json({ erro: `Texto inválido (até ${TEXTO_MAX} caracteres).` });
  }
  const proximo = proximo_contato ? lerDia(proximo_contato) : null;
  if (proximo_contato && !proximo) return res.status(400).json({ erro: "Data do próximo contato inválida." });
  if (!texto?.trim() && tipo === "NOTA" && !proximo) return res.status(400).json({ erro: "Escreva a anotação." });

  try {
    const dono = estudante_id
      ? await prisma.estudante.findUnique({ where: { id: estudante_id }, select: { id: true } })
      : await prisma.empresa.findUnique({ where: { id: empresa_id }, select: { id: true } });
    if (!dono) return res.status(404).json({ erro: estudante_id ? "Estudante não encontrado." : "Empresa não encontrada." });
    const contato = await prisma.contato.create({
      data: {
        estudante_id: estudante_id || null,
        empresa_id: empresa_id || null,
        aplicacao_id: aplicacao_id || null,
        tipo,
        texto: texto?.trim() || null,
        proximo_contato: proximo,
        usuario_id: req.usuario.id,
      },
      select: selectContato,
    });
    return res.status(201).json(contato);
  } catch (error) {
    console.error("Erro ao registrar contato:", error);
    return res.status(500).json({ erro: "Não foi possível registrar o contato." });
  }
});

router.patch("/:id", async (req, res) => {
  if (!uuidValido.test(req.params.id)) return res.status(400).json({ erro: "ID inválido." });
  const { proximo_contato } = req.body ?? {};
  const proximo = proximo_contato ? lerDia(proximo_contato) : null;
  if (proximo_contato && !proximo) return res.status(400).json({ erro: "Data do próximo contato inválida." });
  try {
    const contato = await prisma.contato.update({ where: { id: req.params.id }, data: { proximo_contato: proximo }, select: selectContato });
    return res.json(contato);
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ erro: "Contato não encontrado." });
    console.error("Erro ao atualizar contato:", error);
    return res.status(500).json({ erro: "Não foi possível atualizar o contato." });
  }
});

router.delete("/:id", async (req, res) => {
  if (!uuidValido.test(req.params.id)) return res.status(400).json({ erro: "ID inválido." });
  try {
    await prisma.contato.delete({ where: { id: req.params.id } });
    return res.status(204).end();
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ erro: "Contato não encontrado." });
    console.error("Erro ao excluir contato:", error);
    return res.status(500).json({ erro: "Não foi possível excluir o contato." });
  }
});

module.exports = router;
