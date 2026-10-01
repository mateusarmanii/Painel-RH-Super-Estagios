const express = require("express");
const prisma = require("../prisma");

const router = express.Router();
const horariosValidos = new Set(["MANHA", "TARDE", "NOITE"]);

router.get("/", async (_req, res) => {
  try {
    const candidatos = await prisma.estudante.findMany({
      orderBy: { nome_completo: "asc" },
    });

    return res.json(candidatos);
  } catch (error) {
    console.error("Erro ao listar candidatos:", error);
    return res.status(500).json({ erro: "Não foi possível listar os candidatos." });
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