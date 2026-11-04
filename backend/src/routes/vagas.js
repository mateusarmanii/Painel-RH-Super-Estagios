const express = require("express");
const prisma = require("../prisma");
const { uuidValido, pluralizar, resumirVaga } = require("../utils");
const { camposVaga } = require("../campos");
const { RESUMO_ARQUIVO } = require("../arquivos");
const { areaDaVaga, listaAreas, separarVagas } = require("../compatibilidade");
const { registrarEtapas } = require("../historico");

const router = express.Router();
const statusVagaValidos = new Set(["ABERTA", "FECHADA", "SUSPENSA"]);
const codigoVagaValido = /^\d{5,6}$/;

router.get("/", async (_req, res) => {
  try {
    const vagas = await prisma.vaga.findMany({
      include: { empresa: true, responsavel: { select: { id: true, nome: true } }, aplicacoes: { select: { status_kanban: true } } },
    });
    // Ordem numérica do Nº: com códigos de 5 e 6 dígitos, a ordem de texto poria "100001" antes de "12345".
    vagas.sort((a, b) => Number(a.codigo_vaga) - Number(b.codigo_vaga));

    // Resumo para os cards: candidatos por etapa, dias em aberto e alerta. Área: detectada ou corrigida pelo RH.
    const agora = new Date();
    return res.json(
      vagas.map(({ aplicacoes, ...vaga }) => ({ ...vaga, resumo: resumirVaga(vaga, aplicacoes, agora), area: areaDaVaga(vaga) })),
    );
  } catch (error) {
    console.error("Erro ao listar vagas:", error);
    return res.status(500).json({ erro: "Não foi possível listar as vagas." });
  }
});

// Áreas do dicionário (src/areas.js), para o seletor "Corrigir área" do formulário.
router.get("/areas", (_req, res) => res.json(listaAreas));

// Área que o sistema detecta para um título/descrição/empresa, enquanto o RH preenche o formulário (não grava nada).
router.post("/area-detectada", async (req, res) => {
  const { titulo, descricao, empresa_id } = req.body ?? {};
  if ((titulo !== undefined && typeof titulo !== "string") || (descricao !== undefined && typeof descricao !== "string")) {
    return res.status(400).json({ erro: "Título e descrição devem ser texto." });
  }

  try {
    const empresa = uuidValido.test(empresa_id ?? "")
      ? await prisma.empresa.findUnique({ where: { id: empresa_id }, select: { setor: true } })
      : null;
    const { detectadas } = areaDaVaga({ titulo, descricao, empresa });
    return res.json({ detectadas });
  } catch (error) {
    console.error("Erro ao detectar área da vaga:", error);
    return res.status(500).json({ erro: "Não foi possível detectar a área da vaga." });
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
            curriculo: { select: RESUMO_ARQUIVO },
          },
        },
      },
      // Ordem salva no Kanban (arrastar dentro da coluna); sem ordem, a de chegada.
      orderBy: [{ ordem: { sort: "asc", nulls: "last" } }, { created_at: "asc" }],
    });

    return res.json(aplicacoes);
  } catch (error) {
    console.error("Erro ao listar candidatos da vaga:", error);
    return res.status(500).json({ erro: "Não foi possível listar os candidatos da vaga." });
  }
});

router.post("/", async (req, res) => {
  const { codigo_vaga, titulo, descricao, valor, empresa_id, status } = req.body ?? {};

  if (!codigo_vaga || !codigoVagaValido.test(codigo_vaga)) {
    return res.status(400).json({ erro: "O código da vaga deve ter 5 ou 6 dígitos." });
  }

  if (!titulo || !descricao || !empresa_id || typeof valor !== "number" || !Number.isFinite(valor)) {
    return res.status(400).json({ erro: "Informe título, descrição, valor numérico e empresa." });
  }

  if (status !== undefined && !statusVagaValidos.has(status)) {
    return res.status(400).json({ erro: "Status de vaga inválido." });
  }

  const extras = camposVaga(req.body);
  if (extras.erro) return res.status(400).json({ erro: extras.erro });

  try {
    const vaga = await prisma.vaga.create({
      data: { codigo_vaga, titulo, descricao, valor, empresa_id, ...extras.data, ...(status && { status }) },
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

const MOTIVO_PADRAO_FECHAMENTO = "Vaga encerrada pela empresa";

// Muda o status da vaga (Abrir, Suspender, Fechar).
//  FECHADA  → candidaturas em andamento viram "Dispensado" com o motivo (opcional; padrão acima) e as entrevistas
//             em aberto são canceladas. Contratados não mudam.
//  SUSPENSA → pausa a vaga: ninguém novo é indicado, mas os candidatos continuam onde estão (reabrir retoma).
//  ABERTA   → reabre.
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { status, motivo } = req.body ?? {};

  if (!uuidValido.test(id)) {
    return res.status(400).json({ erro: "ID de vaga inválido." });
  }
  if (!statusVagaValidos.has(status)) {
    return res.status(400).json({ erro: "Status de vaga inválido." });
  }
  if (motivo !== undefined && motivo !== null && typeof motivo !== "string") {
    return res.status(400).json({ erro: "Motivo inválido." });
  }
  if (typeof motivo === "string" && motivo.length > 500) {
    return res.status(400).json({ erro: "O motivo pode ter no máximo 500 caracteres." });
  }

  try {
    const resultado = await prisma.$transaction(async (transaction) => {
      const vaga = await transaction.vaga.update({ where: { id }, data: { status } });
      if (status !== "FECHADA") return { vaga, dispensados: 0, entrevistasCanceladas: 0 };

      const entrevistas = await transaction.aplicacao.updateMany({
        where: {
          vaga_id: id,
          status_kanban: "ENTREVISTA_AGENDADA",
          OR: [{ entrevista_status: null }, { entrevista_status: { in: ["AGUARDANDO", "CONFIRMADA"] } }],
        },
        data: { entrevista_status: "CANCELADA" },
      });
      // updated_at (preenchido automaticamente) fica como a data da dispensa; o histórico guarda de que etapa saíram.
      const emAberto = { vaga_id: id, status_kanban: { notIn: ["APROVADO", "RECUSADO"] } };
      const antes = await transaction.aplicacao.findMany({ where: emAberto, select: { id: true, status_kanban: true } });
      const dispensadas = await transaction.aplicacao.updateMany({
        where: { id: { in: antes.map((aplicacao) => aplicacao.id) } },
        data: { status_kanban: "RECUSADO", motivo_recusa: motivo || MOTIVO_PADRAO_FECHAMENTO, motivo_categoria: "vaga_encerrada", data_aprovacao: null },
      });
      await registrarEtapas(
        transaction,
        antes.map((aplicacao) => ({ aplicacaoId: aplicacao.id, de: aplicacao.status_kanban, para: "RECUSADO" })),
        req.usuario.id,
      );
      return { vaga, dispensados: dispensadas.count, entrevistasCanceladas: entrevistas.count };
    });

    return res.json({ ...resultado.vaga, dispensados: resultado.dispensados, entrevistasCanceladas: resultado.entrevistasCanceladas });
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

  if (!codigo_vaga || !codigoVagaValido.test(codigo_vaga)) {
    return res.status(400).json({ erro: "O código da vaga deve ter 5 ou 6 dígitos." });
  }

  if (!titulo || !descricao || !empresa_id || typeof valor !== "number" || !Number.isFinite(valor)) {
    return res.status(400).json({ erro: "Informe título, descrição, valor numérico e empresa." });
  }

  if (!uuidValido.test(empresa_id)) {
    return res.status(400).json({ erro: "ID de empresa inválido." });
  }

  const extras = camposVaga(req.body);
  if (extras.erro) return res.status(400).json({ erro: extras.erro });

  try {
    const vaga = await prisma.vaga.update({
      where: { id },
      data: { codigo_vaga, titulo, descricao, valor, empresa_id, ...extras.data },
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

// ---------- Recursos opcionais da vaga ----------

// Estudantes compatíveis com a vaga que ainda não estão nela (mesma regra das "Vagas compatíveis" do perfil).
// Contratados e anonimizados ficam de fora.
router.get("/:id/sugestoes", async (req, res) => {
  if (!uuidValido.test(req.params.id)) return res.status(400).json({ erro: "ID de vaga inválido." });
  try {
    const vaga = await prisma.vaga.findUnique({ where: { id: req.params.id }, include: { empresa: { select: { setor: true } } } });
    if (!vaga) return res.status(404).json({ erro: "Vaga não encontrada." });
    if (vaga.status !== "ABERTA") return res.json({ sugestoes: [], vagaFechada: true });
    const estudantes = await prisma.estudante.findMany({
      where: { anonimizado_em: null, aplicacoes: { none: { status_kanban: "APROVADO" } } },
      select: {
        id: true, nome_completo: true, curso: true, instituicao_ensino: true, semestre_atual: true, turno_estudo: true,
        horario_estudo: true, disponibilidade: true, cidade: true, etiquetas: true, aplicacoes: { select: { vaga_id: true } },
      },
    });
    const sugestoes = estudantes
      .map((estudante) => {
        const compativel = separarVagas(estudante, [vaga]).compativeis[0];
        if (!compativel) return null;
        const { id, nome_completo, curso, instituicao_ensino, semestre_atual, turno_estudo, disponibilidade, cidade, etiquetas } = estudante;
        const confirmados = Object.values(compativel.checks).filter((valor) => valor === true).length;
        return {
          estudante: { id, nome_completo, curso, instituicao_ensino, semestre_atual, turno_estudo, disponibilidade, cidade, etiquetas },
          tipo: compativel.tipo,
          motivo: compativel.motivo,
          checks: compativel.checks,
          confirmados,
        };
      })
      .filter(Boolean)
      .sort((a, b) => Number(a.tipo === "correlato") - Number(b.tipo === "correlato") || b.confirmados - a.confirmados
        || a.estudante.nome_completo.localeCompare(b.estudante.nome_completo, "pt-BR"))
      .slice(0, 50);
    return res.json({ sugestoes });
  } catch (error) {
    console.error("Erro ao sugerir candidatos:", error);
    return res.status(500).json({ erro: "Não foi possível sugerir candidatos." });
  }
});

// Ordem dos cartões no Kanban: { ids: [aplicacaoId, ...] } na ordem desejada (todas da vaga; vale para qualquer coluna).
router.put("/:id/ordem", async (req, res) => {
  const ids = req.body?.ids;
  if (!uuidValido.test(req.params.id) || !Array.isArray(ids) || ids.length > 1000 || !ids.every((id) => uuidValido.test(id))) {
    return res.status(400).json({ erro: "Ordem inválida." });
  }
  try {
    const daVaga = await prisma.aplicacao.count({ where: { id: { in: ids }, vaga_id: req.params.id } });
    if (daVaga !== new Set(ids).size) return res.status(400).json({ erro: "Há candidaturas que não são desta vaga." });
    await prisma.$transaction(ids.map((id, ordem) => prisma.aplicacao.update({ where: { id }, data: { ordem } })));
    return res.status(204).end();
  } catch (error) {
    console.error("Erro ao salvar ordem:", error);
    return res.status(500).json({ erro: "Não foi possível salvar a ordem." });
  }
});

// Arquivar (só esconde das listas; opcional): { arquivada: true | false }.
router.patch("/:id/arquivo", async (req, res) => {
  if (!uuidValido.test(req.params.id) || typeof req.body?.arquivada !== "boolean") return res.status(400).json({ erro: "Dados inválidos." });
  try {
    const vaga = await prisma.vaga.update({ where: { id: req.params.id }, data: { arquivada_em: req.body.arquivada ? new Date() : null }, select: { id: true, arquivada_em: true } });
    return res.json(vaga);
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ erro: "Vaga não encontrada." });
    console.error("Erro ao arquivar vaga:", error);
    return res.status(500).json({ erro: "Não foi possível arquivar a vaga." });
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