const express = require("express");
const prisma = require("../prisma");
const { uuidValido, pluralizar, resumirCandidaturas } = require("../utils");
const { lerArquivoDaLogo, gravarLogo, apagarLogo } = require("../logos");

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const empresas = await prisma.empresa.findMany({
      // Vagas resumidas para a página "Empresas sem vaga" (empresas sem nenhuma vaga ABERTA).
      include: {
        vagas: {
          select: {
            id: true,
            codigo_vaga: true,
            titulo: true,
            status: true,
            created_at: true,
            aplicacoes: { select: { status_kanban: true } },
          },
          orderBy: { created_at: "desc" },
        },
      },
      orderBy: { nome: "asc" },
    });

    // Números dos cards: vagas abertas, candidatos em processo e contratados (somando todas as vagas da empresa).
    return res.json(
      empresas.map((empresa) => {
        const resumo = resumirCandidaturas(empresa.vagas.flatMap((vaga) => vaga.aplicacoes));
        return {
          ...empresa,
          vagas: empresa.vagas.map(({ aplicacoes: _aplicacoes, ...vaga }) => vaga),
          resumo: {
            vagas_abertas: empresa.vagas.filter((vaga) => vaga.status === "ABERTA").length,
            em_processo: resumo.em_processo,
            contratados: resumo.por_etapa.APROVADO,
          },
        };
      }),
    );
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

// Envia ou troca a logo (multipart, campo "logo"): PNG, JPG ou WEBP até 2 MB. A logo anterior é apagada.
router.post("/:id/logo", async (req, res, next) => {
  if (!uuidValido.test(req.params.id)) {
    return res.status(400).json({ erro: "ID de empresa inválido." });
  }
  // A empresa é conferida antes de ler o arquivo, para não receber upload de empresa inexistente.
  const empresa = await prisma.empresa.findUnique({ where: { id: req.params.id }, select: { logo_url: true } }).catch(() => null);
  if (!empresa) return res.status(404).json({ erro: "Empresa não encontrada." });
  req.logoAnterior = empresa.logo_url;
  return next();
}, lerArquivoDaLogo, async (req, res) => {
  let novaLogo = null;
  try {
    novaLogo = gravarLogo(req.file.buffer, req.formatoLogo);
    const empresa = await prisma.empresa.update({ where: { id: req.params.id }, data: { logo_url: novaLogo } });
    apagarLogo(req.logoAnterior);
    return res.json(empresa);
  } catch (error) {
    apagarLogo(novaLogo);
    if (error.code === "P2025") return res.status(404).json({ erro: "Empresa não encontrada." });
    console.error("Erro ao salvar logo:", error);
    return res.status(500).json({ erro: "Não foi possível salvar a logo." });
  }
});

router.delete("/:id/logo", async (req, res) => {
  const { id } = req.params;
  if (!uuidValido.test(id)) {
    return res.status(400).json({ erro: "ID de empresa inválido." });
  }

  try {
    const anterior = await prisma.empresa.findUnique({ where: { id }, select: { logo_url: true } });
    if (!anterior) return res.status(404).json({ erro: "Empresa não encontrada." });
    const empresa = await prisma.empresa.update({ where: { id }, data: { logo_url: null } });
    apagarLogo(anterior.logo_url);
    return res.json(empresa);
  } catch (error) {
    console.error("Erro ao remover logo:", error);
    return res.status(500).json({ erro: "Não foi possível remover a logo." });
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
      select: { logo_url: true, _count: { select: { vagas: true } } },
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
    apagarLogo(empresa.logo_url);
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