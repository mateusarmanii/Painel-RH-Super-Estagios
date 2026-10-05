const express = require("express");
const prisma = require("../prisma");

const router = express.Router();

// Entrevistas futuras (status ENTREVISTA_AGENDADA), da mais próxima para a mais distante.
router.get("/", async (_req, res) => {
  try {
    const entrevistas = await prisma.aplicacao.findMany({
      where: {
        status_kanban: "ENTREVISTA_AGENDADA",
        data_hora_entrevista: { gt: new Date() },
      },
      orderBy: { data_hora_entrevista: "asc" },
      select: {
        id: true,
        data_hora_entrevista: true,
        estudante: { select: { id: true, nome_completo: true, curso: true, telefone: true } },
        vaga: {
          select: {
            id: true,
            codigo_vaga: true,
            titulo: true,
            empresa: { select: { id: true, nome: true } },
          },
        },
      },
    });

    return res.json(entrevistas);
  } catch (error) {
    console.error("Erro ao listar entrevistas:", error);
    return res.status(500).json({ erro: "Não foi possível listar as entrevistas." });
  }
});

module.exports = router;
