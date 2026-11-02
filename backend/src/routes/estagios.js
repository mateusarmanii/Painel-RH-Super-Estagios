// Estágios (pós-contratação): uma linha por candidatura Contratada, com os dados opcionais do estágio.
//   GET    /estagios                               contratados + dados do estágio + alertas
//   PUT    /estagios/:aplicacaoId                  grava os campos enviados (cria o registro se não houver)
//   POST   /estagios/:aplicacaoId/relatorios       { numero, entregue_em? } marca o relatório do semestre como entregue
//   DELETE /estagios/:aplicacaoId/relatorios/:numero
const express = require("express");
const prisma = require("../prisma");
const { uuidValido } = require("../utils");
const { camposEstagio, situacaoEstagio, lerDia } = require("../estagios");

const router = express.Router();

const selectEstagio = {
  id: true,
  data_inicio: true,
  data_fim: true,
  tce_assinado: true,
  seguro_apolice: true,
  supervisor: true,
  taxa_agenciamento: true,
  observacoes: true,
  encerrado_em: true,
  updated_at: true,
  relatorios: { select: { numero: true, entregue_em: true }, orderBy: { numero: "asc" } },
};

const comSituacao = (estagio) => (estagio ? { ...estagio, situacao: situacaoEstagio(estagio) } : null);

router.get("/", async (_req, res) => {
  try {
    const contratados = await prisma.aplicacao.findMany({
      where: { status_kanban: "APROVADO" },
      orderBy: { data_aprovacao: "desc" },
      select: {
        id: true,
        data_aprovacao: true,
        created_at: true,
        estudante: { select: { id: true, nome_completo: true, curso: true, telefone: true } },
        vaga: { select: { id: true, titulo: true, codigo_vaga: true, empresa: { select: { id: true, nome: true, logo_arquivo_id: true } } } },
        estagio: { select: selectEstagio },
      },
    });
    return res.json(contratados.map((item) => ({ ...item, estagio: comSituacao(item.estagio) })));
  } catch (error) {
    console.error("Erro ao listar estágios:", error);
    return res.status(500).json({ erro: "Não foi possível listar os estágios." });
  }
});

async function contratada(aplicacaoId) {
  return prisma.aplicacao.findUnique({ where: { id: aplicacaoId }, select: { id: true, status_kanban: true } });
}

router.put("/:aplicacaoId", async (req, res) => {
  const { aplicacaoId } = req.params;
  if (!uuidValido.test(aplicacaoId)) return res.status(400).json({ erro: "ID de candidatura inválido." });
  const campos = camposEstagio(req.body ?? {});
  if (campos.erro) return res.status(400).json({ erro: campos.erro });

  try {
    const aplicacao = await contratada(aplicacaoId);
    if (!aplicacao) return res.status(404).json({ erro: "Candidatura não encontrada." });
    if (aplicacao.status_kanban !== "APROVADO") return res.status(409).json({ erro: "Só candidaturas contratadas têm dados de estágio." });

    const atual = await prisma.estagio.findUnique({ where: { aplicacao_id: aplicacaoId }, select: { data_inicio: true, data_fim: true } });
    const inicio = campos.data.data_inicio !== undefined ? campos.data.data_inicio : atual?.data_inicio;
    const fim = campos.data.data_fim !== undefined ? campos.data.data_fim : atual?.data_fim;
    if (inicio && fim && fim < inicio) return res.status(400).json({ erro: "O fim do estágio precisa ser depois do início." });

    const estagio = await prisma.estagio.upsert({
      where: { aplicacao_id: aplicacaoId },
      create: { aplicacao_id: aplicacaoId, ...campos.data },
      update: campos.data,
      select: selectEstagio,
    });
    return res.json(comSituacao(estagio));
  } catch (error) {
    console.error("Erro ao salvar estágio:", error);
    return res.status(500).json({ erro: "Não foi possível salvar os dados do estágio." });
  }
});

router.post("/:aplicacaoId/relatorios", async (req, res) => {
  const { aplicacaoId } = req.params;
  const numero = Number(req.body?.numero);
  if (!uuidValido.test(aplicacaoId)) return res.status(400).json({ erro: "ID de candidatura inválido." });
  if (!Number.isInteger(numero) || numero < 1 || numero > 8) return res.status(400).json({ erro: "Semestre do relatório inválido (1 a 8)." });
  const entregue = req.body?.entregue_em ? lerDia(req.body.entregue_em) : new Date(new Date().toISOString().slice(0, 10));
  if (!entregue) return res.status(400).json({ erro: "Data de entrega inválida." });

  try {
    const aplicacao = await contratada(aplicacaoId);
    if (!aplicacao) return res.status(404).json({ erro: "Candidatura não encontrada." });
    if (aplicacao.status_kanban !== "APROVADO") return res.status(409).json({ erro: "Só candidaturas contratadas têm dados de estágio." });
    const estagio = await prisma.estagio.upsert({
      where: { aplicacao_id: aplicacaoId },
      create: { aplicacao_id: aplicacaoId },
      update: {},
      select: { id: true },
    });
    await prisma.relatorioEstagio.upsert({
      where: { estagio_id_numero: { estagio_id: estagio.id, numero } },
      create: { estagio_id: estagio.id, numero, entregue_em: entregue },
      update: { entregue_em: entregue },
    });
    const atualizado = await prisma.estagio.findUnique({ where: { id: estagio.id }, select: selectEstagio });
    return res.status(201).json(comSituacao(atualizado));
  } catch (error) {
    console.error("Erro ao registrar relatório:", error);
    return res.status(500).json({ erro: "Não foi possível registrar o relatório." });
  }
});

router.delete("/:aplicacaoId/relatorios/:numero", async (req, res) => {
  const { aplicacaoId } = req.params;
  const numero = Number(req.params.numero);
  if (!uuidValido.test(aplicacaoId) || !Number.isInteger(numero)) return res.status(400).json({ erro: "Dados inválidos." });
  try {
    const estagio = await prisma.estagio.findUnique({ where: { aplicacao_id: aplicacaoId }, select: { id: true } });
    if (!estagio) return res.status(404).json({ erro: "Estágio não encontrado." });
    await prisma.relatorioEstagio.deleteMany({ where: { estagio_id: estagio.id, numero } });
    const atualizado = await prisma.estagio.findUnique({ where: { id: estagio.id }, select: selectEstagio });
    return res.json(comSituacao(atualizado));
  } catch (error) {
    console.error("Erro ao desfazer relatório:", error);
    return res.status(500).json({ erro: "Não foi possível desfazer o relatório." });
  }
});

module.exports = router;
module.exports.selectEstagio = selectEstagio;
