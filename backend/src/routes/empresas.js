const express = require("express");
const prisma = require("../prisma");

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const empresas = await prisma.empresa.findMany({
      orderBy: { nome: "asc" },
    });

    return res.json(empresas);
  } catch (error) {
    console.error("Erro ao listar empresas:", error);
    return res.status(500).json({ erro: "Não foi possível listar as empresas." });
  }
});

router.post("/", async (req, res) => {
  const { nome, setor, nome_contato, telefone_contato, email_contato } = req.body ?? {};

  if (!nome || !setor || !nome_contato || !telefone_contato || !email_contato) {
    return res.status(400).json({
      erro: "Informe nome, setor, nome do contato, telefone e e-mail de contato.",
    });
  }

  try {
    const empresa = await prisma.empresa.create({
      data: { nome, setor, nome_contato, telefone_contato, email_contato },
    });

    return res.status(201).json(empresa);
  } catch (error) {
    console.error("Erro ao criar empresa:", error);
    return res.status(500).json({ erro: "Não foi possível criar a empresa." });
  }
});

module.exports = router;