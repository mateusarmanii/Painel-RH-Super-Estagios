const express = require("express");
const prisma = require("../prisma");

const router = express.Router();
const statusVagaValidos = new Set(["ABERTA", "FECHADA", "SUSPENSA"]);

router.get("/", async (_req, res) => {
  try {
    const vagas = await prisma.vaga.findMany({
      include: { empresa: true },
      orderBy: { codigo_vaga: "asc" },
    });

    return res.json(vagas);
  } catch (error) {
    console.error("Erro ao listar vagas:", error);
    return res.status(500).json({ erro: "Não foi possível listar as vagas." });
  }
});

router.post("/", async (req, res) => {
  const { codigo_vaga, titulo, descricao, valor, empresa_id, status } = req.body ?? {};

  if (!codigo_vaga || !/^\d{6}$/.test(codigo_vaga)) {
    return res.status(400).json({ erro: "O código da vaga deve conter 6 dígitos." });
  }

  if (!titulo || !descricao || !empresa_id || typeof valor !== "number" || !Number.isFinite(valor)) {
    return res.status(400).json({ erro: "Informe título, descrição, valor numérico e empresa." });
  }

  if (status !== undefined && !statusVagaValidos.has(status)) {
    return res.status(400).json({ erro: "Status de vaga inválido." });
  }

  try {
    const vaga = await prisma.vaga.create({
      data: { codigo_vaga, titulo, descricao, valor, empresa_id, ...(status && { status }) },
      include: { empresa: true },
    });

    return res.status(201).json(vaga);
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ erro: "O código da vaga já está cadastrado." });
    }
    if (error.code === "P2003") {
      return res.status(400).json({ erro: "A empresa informada não existe." });
    }

    console.error("Erro ao criar vaga:", error);
    return res.status(500).json({ erro: "Não foi possível criar a vaga." });
  }
});

router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body ?? {};

  if (!statusVagaValidos.has(status)) {
    return res.status(400).json({ erro: "Status de vaga inválido." });
  }

  try {
    const vaga = await prisma.$transaction(async (transaction) => {
      const vagaAtualizada = await transaction.vaga.update({
        where: { id },
        data: { status },
      });

      if (status === "FECHADA" || status === "SUSPENSA") {
        await transaction.aplicacao.updateMany({
          where: {
            vaga_id: id,
            status_kanban: { notIn: ["APROVADO", "RECUSADO"] },
          },
          data: {
            status_kanban: "RECUSADO",
            motivo_recusa: "Vaga preenchida",
          },
        });
      }

      return vagaAtualizada;
    });

    return res.json(vaga);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ erro: "Vaga não encontrada." });
    }

    console.error("Erro ao atualizar vaga:", error);
    return res.status(500).json({ erro: "Não foi possível atualizar a vaga." });
  }
});

module.exports = router;