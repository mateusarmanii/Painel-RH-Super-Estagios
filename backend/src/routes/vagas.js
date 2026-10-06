const express = require("express");
const prisma = require("../prisma");
const { uuidValido, pluralizar, resumirVaga } = require("../utils");
const { turnoVaga } = require("../campos");

const router = express.Router();
const statusVagaValidos = new Set(["ABERTA", "FECHADA", "SUSPENSA"]);

router.get("/", async (_req, res) => {
  try {
    const vagas = await prisma.vaga.findMany({
      include: { empresa: true, aplicacoes: { select: { status_kanban: true } } },
      orderBy: { codigo_vaga: "asc" },
    });

    // Resumo para os cards: candidatos por etapa, dias em aberto e alerta.
    const agora = new Date();
    return res.json(vagas.map(({ aplicacoes, ...vaga }) => ({ ...vaga, resumo: resumirVaga(vaga, aplicacoes, agora) })));
  } catch (error) {
    console.error("Erro ao listar vagas:", error);
    return res.status(500).json({ erro: "Não foi possível listar as vagas." });
  }
});

router.get("/:vagaId/candidatos", async (req, res) => {
  const { vagaId } = req.params;

  if (!uuidValido.test(vagaId)) {
    return res.status(400).json({ erro: "ID de vaga inválido." });
  }

  try {
    const vaga = await prisma.vaga.findUnique({
      where: { id: vagaId },
      select: { id: true },
    });

    if (!vaga) {
      return res.status(404).json({ erro: "Vaga não encontrada." });
    }

    const aplicacoes = await prisma.aplicacao.findMany({
      where: { vaga_id: vagaId },
      include: {
        estudante: {
          select: {
            id: true,
            nome_completo: true,
            curso: true,
            instituicao_ensino: true,
            telefone: true,
            email: true,
          },
        },
      },
      orderBy: { created_at: "asc" },
    });

    return res.json(aplicacoes);
  } catch (error) {
    console.error("Erro ao listar candidatos da vaga:", error);
    return res.status(500).json({ erro: "Não foi possível listar os candidatos da vaga." });
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

  const turno = turnoVaga(req.body);
  if (turno.erro) return res.status(400).json({ erro: turno.erro });

  try {
    const vaga = await prisma.vaga.create({
      data: { codigo_vaga, titulo, descricao, valor, empresa_id, ...turno.data, ...(status && { status }) },
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

// Edita os dados da vaga; mudanças de status continuam no PATCH, que também encerra as aplicações.
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { codigo_vaga, titulo, descricao, valor, empresa_id } = req.body ?? {};

  if (!uuidValido.test(id)) {
    return res.status(400).json({ erro: "ID de vaga inválido." });
  }

  if (!codigo_vaga || !/^\d{6}$/.test(codigo_vaga)) {
    return res.status(400).json({ erro: "O código da vaga deve conter 6 dígitos." });
  }

  if (!titulo || !descricao || !empresa_id || typeof valor !== "number" || !Number.isFinite(valor)) {
    return res.status(400).json({ erro: "Informe título, descrição, valor numérico e empresa." });
  }

  if (!uuidValido.test(empresa_id)) {
    return res.status(400).json({ erro: "ID de empresa inválido." });
  }

  const turno = turnoVaga(req.body);
  if (turno.erro) return res.status(400).json({ erro: turno.erro });

  try {
    const vaga = await prisma.vaga.update({
      where: { id },
      data: { codigo_vaga, titulo, descricao, valor, empresa_id, ...turno.data },
      include: { empresa: true },
    });

    return res.json(vaga);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ erro: "Vaga não encontrada." });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ erro: "O código da vaga já está cadastrado." });
    }
    if (error.code === "P2003") {
      return res.status(400).json({ erro: "A empresa informada não existe." });
    }

    console.error("Erro ao atualizar vaga:", error);
    return res.status(500).json({ erro: "Não foi possível atualizar a vaga." });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  if (!uuidValido.test(id)) {
    return res.status(400).json({ erro: "ID de vaga inválido." });
  }

  try {
    const vaga = await prisma.vaga.findUnique({
      where: { id },
      select: { _count: { select: { aplicacoes: true } } },
    });

    if (!vaga) {
      return res.status(404).json({ erro: "Vaga não encontrada." });
    }

    const totalAplicacoes = vaga._count.aplicacoes;
    if (totalAplicacoes > 0) {
      return res.status(409).json({
        erro: `Não é possível excluir esta vaga: ela possui ${pluralizar(totalAplicacoes, "candidatura vinculada", "candidaturas vinculadas")}. Considere fechar a vaga em vez de excluí-la.`,
      });
    }

    await prisma.vaga.delete({ where: { id } });
    return res.status(204).end();
  } catch (error) {
    if (error.code === "P2003") {
      return res.status(409).json({ erro: "Não é possível excluir esta vaga: ela possui candidaturas vinculadas." });
    }
    if (error.code === "P2025") {
      return res.status(404).json({ erro: "Vaga não encontrada." });
    }

    console.error("Erro ao excluir vaga:", error);
    return res.status(500).json({ erro: "Não foi possível excluir a vaga." });
  }
});

module.exports = router;