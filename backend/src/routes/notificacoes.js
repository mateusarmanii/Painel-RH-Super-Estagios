// Notificações do sino (montadas em src/notificacoes.js, calculadas na hora; nada é gravado):
//   GET /notificacoes → [{ id, tipo, gravidade: "alta"|"media"|"info", titulo, descricao, link, quando }]
// O "lida" fica no navegador de cada usuário. O id é estável para o mesmo acontecimento.
//   GET /busca?q=     → { estudantes, empresas, vagas } (até 6 de cada) para a busca do topo
const express = require("express");
const prisma = require("../prisma");
const { montarNotificacoes } = require("../notificacoes");

const router = express.Router();

router.get("/notificacoes", async (_req, res) => {
  try {
    return res.json(await montarNotificacoes());
  } catch (error) {
    console.error("Erro ao montar notificações:", error);
    return res.status(500).json({ erro: "Não foi possível carregar as notificações." });
  }
});

router.get("/busca", async (req, res) => {
  const termo = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
  if (termo.length < 2) return res.json({ estudantes: [], empresas: [], vagas: [] });
  const digitos = termo.replace(/\D/g, "");
  const contem = { contains: termo, mode: "insensitive" };
  try {
    const [estudantes, porTelefone, empresas, vagas] = await Promise.all([
      prisma.estudante.findMany({ where: { OR: [{ nome_completo: contem }, { email: contem }] }, take: 6, orderBy: { nome_completo: "asc" }, select: { id: true, nome_completo: true, curso: true } }),
      digitos.length >= 4
        ? prisma.$queryRaw`SELECT id, nome_completo, curso FROM "Estudante" WHERE regexp_replace(telefone, '\\D', '', 'g') LIKE ${`%${digitos}`} LIMIT 6`
        : [],
      prisma.empresa.findMany({ where: { nome: contem }, take: 6, orderBy: { nome: "asc" }, select: { id: true, nome: true, logo_arquivo_id: true } }),
      prisma.vaga.findMany({
        where: { OR: [{ titulo: contem }, { codigo_vaga: { startsWith: termo } }] },
        take: 6,
        orderBy: { created_at: "desc" },
        select: { id: true, titulo: true, codigo_vaga: true, status: true, empresa: { select: { nome: true } } },
      }),
    ]);
    const vistos = new Set();
    const todos = [...estudantes, ...porTelefone].filter((e) => !vistos.has(e.id) && vistos.add(e.id)).slice(0, 6);
    return res.json({ estudantes: todos, empresas, vagas });
  } catch (error) {
    console.error("Erro na busca:", error);
    return res.status(500).json({ erro: "Não foi possível buscar." });
  }
});

module.exports = router;
