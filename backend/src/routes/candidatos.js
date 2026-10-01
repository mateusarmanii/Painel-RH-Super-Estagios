const express = require("express");
const prisma = require("../prisma");

const router = express.Router();
const horariosValidos = new Set(["MANHA", "TARDE", "NOITE"]);
const statusKanbanValidos = new Set([
  "ENVIADO_EMPRESA",
  "ENTREVISTA_AGENDADA",
  "AGUARDANDO_RETORNO",
  "APROVADO",
  "RECUSADO",
]);
const uuidValido = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const { aplicacao_id, status_kanban } = req.body ?? {};

  if (!uuidValido.test(id) || !uuidValido.test(aplicacao_id ?? "")) {
    return res.status(400).json({ erro: "ID de candidato ou aplicação inválido." });
  }

  if (!statusKanbanValidos.has(status_kanban)) {
    return res.status(400).json({ erro: "Status de candidatura inválido." });
  }

  try {
    const aplicacao = await prisma.aplicacao.findFirst({
      where: { id: aplicacao_id, estudante_id: id },
      select: { id: true },
    });

    if (!aplicacao) {
      return res.status(404).json({ erro: "Aplicação não encontrada para este candidato." });
    }

    const atualizada = await prisma.aplicacao.update({
      where: { id: aplicacao.id },
      data: { status_kanban },
      select: {
        id: true,
        estudante_id: true,
        vaga_id: true,
        status_kanban: true,
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
  } = req.body ?? {};

  if (!nome_completo || !telefone || !curso || !instituicao_ensino) {
    return res.status(400).json({
      erro: "Informe nome completo, telefone, curso e instituição de ensino.",
    });
  }

  if (!horariosValidos.has(horario_estudo)) {
    return res.status(400).json({ erro: "Horário de estudo inválido." });
  }

  try {
    const candidato = await prisma.estudante.create({
      data: {
        nome_completo,
        telefone,
        email,
        curso,
        instituicao_ensino,
        link_curriculo,
        endereco,
        horario_estudo,
      },
    });

    return res.status(201).json(candidato);
  } catch (error) {
    console.error("Erro ao criar candidato:", error);
    return res.status(500).json({ erro: "Não foi possível criar o candidato." });
  }
});

module.exports = router;