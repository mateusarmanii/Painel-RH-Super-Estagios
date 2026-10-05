const express = require("express");
const prisma = require("../prisma");
const { uuidValido, pluralizar } = require("../utils");

const router = express.Router();
const horariosValidos = new Set(["MANHA", "TARDE", "NOITE"]);
const statusKanbanValidos = new Set([
  "ENVIADO_EMPRESA",
  "ENTREVISTA_AGENDADA",
  "AGUARDANDO_RETORNO",
  "APROVADO",
  "RECUSADO",
]);

router.get("/", async (_req, res) => {
  try {
    const candidatos = await prisma.estudante.findMany({
      include: {
        aplicacoes: {
          select: {
            id: true,
            vaga_id: true,
            status_kanban: true,
            data_hora_entrevista: true,
          },
        },
      },
      orderBy: { nome_completo: "asc" },
    });

    return res.json(candidatos);
  } catch (error) {
    console.error("Erro ao listar candidatos:", error);
    return res.status(500).json({ erro: "Não foi possível listar os candidatos." });
  }
});

router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { aplicacao_id, status_kanban, data_hora_entrevista, motivo_recusa } = req.body ?? {};

  if (!uuidValido.test(id) || !uuidValido.test(aplicacao_id ?? "")) {
    return res.status(400).json({ erro: "ID de candidato ou aplicação inválido." });
  }

  if (!statusKanbanValidos.has(status_kanban)) {
    return res.status(400).json({ erro: "Status de candidatura inválido." });
  }

  const dataEntrevista = data_hora_entrevista ? new Date(data_hora_entrevista) : null;
  if (status_kanban === "ENTREVISTA_AGENDADA" && (!dataEntrevista || Number.isNaN(dataEntrevista.getTime()))) {
    return res.status(400).json({ erro: "Informe uma data e hora válidas para a entrevista." });
  }

  const motivo = typeof motivo_recusa === "string" ? motivo_recusa.trim() : "";
  if (status_kanban === "RECUSADO" && !motivo) {
    return res.status(400).json({ erro: "Informe o motivo da dispensa." });
  }

  try {
    const aplicacao = await prisma.aplicacao.findFirst({
      where: { id: aplicacao_id, estudante_id: id },
      select: { id: true, status_kanban: true },
    });

    if (!aplicacao) {
      return res.status(404).json({ erro: "Aplicação não encontrada para este candidato." });
    }

    // data_aprovacao marca a contratação: grava ao entrar em APROVADO e limpa ao sair.
    const data = { status_kanban };
    if (status_kanban === "APROVADO" && aplicacao.status_kanban !== "APROVADO") {
      data.data_aprovacao = new Date();
    } else if (status_kanban !== "APROVADO") {
      data.data_aprovacao = null;
    }

    // A data da entrevista fica no histórico mesmo após mudar de coluna; o motivo só vale enquanto RECUSADO.
    if (status_kanban === "ENTREVISTA_AGENDADA") data.data_hora_entrevista = dataEntrevista;
    data.motivo_recusa = status_kanban === "RECUSADO" ? motivo : null;

    const atualizada = await prisma.aplicacao.update({
      where: { id: aplicacao.id },
      data,
      select: {
        id: true,
        estudante_id: true,
        vaga_id: true,
        status_kanban: true,
        data_hora_entrevista: true,
        motivo_recusa: true,
        data_aprovacao: true,
      },
    });

    return res.json(atualizada);
  } catch (error) {
    console.error("Erro ao atualizar candidatura:", error);
    return res.status(500).json({ erro: "Não foi possível atualizar a candidatura." });
  }
});

router.post("/", async (req, res) => {
  const {
    nome_completo,
    telefone,
    email,
    curso,
    instituicao_ensino,
    link_curriculo,
    endereco,
    horario_estudo,
    anotacoes_recrutador,
    vaga_id,
  } = req.body ?? {};

  if (!nome_completo || !telefone || !curso || !instituicao_ensino || !vaga_id) {
    return res.status(400).json({
      erro: "Informe nome, telefone, curso, instituição de ensino e vaga.",
    });
  }

  if (!horariosValidos.has(horario_estudo)) {
    return res.status(400).json({ erro: "Horário de estudo inválido." });
  }

  if (!uuidValido.test(vaga_id)) {
    return res.status(400).json({ erro: "ID de vaga inválido." });
  }

  try {
    const candidato = await prisma.$transaction(async (transaction) => {
      const vaga = await transaction.vaga.findUnique({
        where: { id: vaga_id },
        select: { id: true, status: true },
      });

      if (!vaga) {
        const error = new Error("Vaga não encontrada.");
        error.status = 404;
        throw error;
      }

      if (vaga.status !== "ABERTA") {
        const error = new Error("A vaga selecionada não está aberta.");
        error.status = 409;
        throw error;
      }

      return transaction.estudante.create({
        data: {
          nome_completo,
          telefone,
          email,
          curso,
          instituicao_ensino,
          link_curriculo,
          endereco,
          horario_estudo,
          anotacoes_recrutador,
          aplicacoes: { create: { vaga: { connect: { id: vaga_id } } } },
        },
        include: { aplicacoes: true },
      });
    });

    return res.status(201).json(candidato);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ erro: error.message });
    }

    console.error("Erro ao criar candidato:", error);
    return res.status(500).json({ erro: "Não foi possível criar o candidato." });
  }
});

// Edita os dados do estudante; candidaturas são gerenciadas pelo PATCH (Kanban).
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    nome_completo,
    telefone,
    email,
    curso,
    instituicao_ensino,
    link_curriculo,
    endereco,
    horario_estudo,
    anotacoes_recrutador,
  } = req.body ?? {};

  if (!uuidValido.test(id)) {
    return res.status(400).json({ erro: "ID de candidato inválido." });
  }

  if (!nome_completo || !telefone || !curso || !instituicao_ensino) {
    return res.status(400).json({
      erro: "Informe nome, telefone, curso e instituição de ensino.",
    });
  }

  if (!horariosValidos.has(horario_estudo)) {
    return res.status(400).json({ erro: "Horário de estudo inválido." });
  }

  try {
    const candidato = await prisma.estudante.update({
      where: { id },
      data: {
        nome_completo,
        telefone,
        email,
        curso,
        instituicao_ensino,
        link_curriculo,
        endereco,
        horario_estudo,
        anotacoes_recrutador,
      },
    });

    return res.json(candidato);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ erro: "Candidato não encontrado." });
    }

    console.error("Erro ao atualizar candidato:", error);
    return res.status(500).json({ erro: "Não foi possível atualizar o candidato." });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  if (!uuidValido.test(id)) {
    return res.status(400).json({ erro: "ID de candidato inválido." });
  }

  try {
    const candidato = await prisma.estudante.findUnique({
      where: { id },
      select: { _count: { select: { aplicacoes: true } } },
    });

    if (!candidato) {
      return res.status(404).json({ erro: "Candidato não encontrado." });
    }

    const totalAplicacoes = candidato._count.aplicacoes;
    if (totalAplicacoes > 0) {
      return res.status(409).json({
        erro: `Não é possível excluir este candidato: ele possui ${pluralizar(totalAplicacoes, "candidatura vinculada", "candidaturas vinculadas")}.`,
      });
    }

    await prisma.estudante.delete({ where: { id } });
    return res.status(204).end();
  } catch (error) {
    if (error.code === "P2003") {
      return res.status(409).json({ erro: "Não é possível excluir este candidato: ele possui candidaturas vinculadas." });
    }
    if (error.code === "P2025") {
      return res.status(404).json({ erro: "Candidato não encontrado." });
    }

    console.error("Erro ao excluir candidato:", error);
    return res.status(500).json({ erro: "Não foi possível excluir o candidato." });
  }
});

module.exports = router;