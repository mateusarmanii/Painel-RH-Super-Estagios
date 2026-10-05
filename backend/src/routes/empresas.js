const express = require("express");
const prisma = require("../prisma");
const { uuidValido, pluralizar } = require("../utils");

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

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { nome, setor, nome_contato, telefone_contato, email_contato } = req.body ?? {};

  if (!uuidValido.test(id)) {
    return res.status(400).json({ erro: "ID de empresa inválido." });
  }

  if (!nome || !setor || !nome_contato || !telefone_contato || !email_contato) {
    return res.status(400).json({
      erro: "Informe nome, setor, nome do contato, telefone e e-mail de contato.",
    });
  }

  try {
    const empresa = await prisma.empresa.update({
      where: { id },
      data: { nome, setor, nome_contato, telefone_contato, email_contato },
    });

    return res.json(empresa);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ erro: "Empresa não encontrada." });
    }

    console.error("Erro ao atualizar empresa:", error);
    return res.status(500).json({ erro: "Não foi possível atualizar a empresa." });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  if (!uuidValido.test(id)) {
    return res.status(400).json({ erro: "ID de empresa inválido." });
  }

  try {
    const empresa = await prisma.empresa.findUnique({
      where: { id },
      select: { _count: { select: { vagas: true } } },
    });

    if (!empresa) {
      return res.status(404).json({ erro: "Empresa não encontrada." });
    }

    const totalVagas = empresa._count.vagas;
    if (totalVagas > 0) {
      return res.status(409).json({
        erro: `Não é possível excluir esta empresa: ela possui ${pluralizar(totalVagas, "vaga vinculada", "vagas vinculadas")}. Exclua ou transfira as vagas antes.`,
      });
    }

    await prisma.empresa.delete({ where: { id } });
    return res.status(204).end();
  } catch (error) {
    if (error.code === "P2003") {
      return res.status(409).json({ erro: "Não é possível excluir esta empresa: ela possui vagas vinculadas." });
    }
    if (error.code === "P2025") {
      return res.status(404).json({ erro: "Empresa não encontrada." });
    }

    console.error("Erro ao excluir empresa:", error);
    return res.status(500).json({ erro: "Não foi possível excluir a empresa." });
  }
});

module.exports = router;