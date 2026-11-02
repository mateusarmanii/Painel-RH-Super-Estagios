// Relatório por empresa (para mandar ao cliente): GET /relatorios/empresa/:id?de=AAAA-MM-DD&ate=AAAA-MM-DD
// Sem datas: últimos 90 dias. Só leitura.
const express = require("express");
const prisma = require("../prisma");
const { uuidValido, DIA_MS } = require("../utils");
const { lerDia } = require("../estagios");

const router = express.Router();
const ETAPAS_ENVIADAS = ["ENVIADO_EMPRESA", "ENTREVISTA_AGENDADA", "EM_TESTE", "APROVADO"];

router.get("/empresa/:id", async (req, res) => {
  const { id } = req.params;
  if (!uuidValido.test(id)) return res.status(400).json({ erro: "ID de empresa inválido." });
  const hoje = new Date(new Date().toISOString().slice(0, 10));
  const de = req.query.de ? lerDia(req.query.de) : new Date(hoje.getTime() - 89 * DIA_MS);
  const ateDia = req.query.ate ? lerDia(req.query.ate) : hoje;
  if (!de || !ateDia || ateDia < de) return res.status(400).json({ erro: "Período inválido." });
  // O dia final entra inteiro (folga de fuso para o horário de Brasília).
  const ate = new Date(ateDia.getTime() + DIA_MS + 3 * 60 * 60 * 1000);
  const inicio = new Date(de.getTime() + 3 * 60 * 60 * 1000);
  const noPeriodo = (data) => data && data >= inicio && data < ate;

  try {
    const empresa = await prisma.empresa.findUnique({
      where: { id },
      select: {
        id: true, nome: true, setor: true, nome_contato: true, logo_arquivo_id: true,
        vagas: {
          orderBy: { created_at: "desc" },
          select: {
            id: true, titulo: true, codigo_vaga: true, status: true, created_at: true, quantidade: true,
            aplicacoes: {
              select: {
                id: true, status_kanban: true, created_at: true, data_aprovacao: true, data_hora_entrevista: true,
                estudante: { select: { nome_completo: true, curso: true } },
                historico: { select: { para_status: true, created_at: true } },
                estagio: { select: { taxa_agenciamento: true, data_inicio: true, data_fim: true } },
              },
            },
          },
        },
      },
    });
    if (!empresa) return res.status(404).json({ erro: "Empresa não encontrada." });

    // Enviado à empresa no período: pelo histórico de etapas; sem histórico, pela data da candidatura.
    const enviadoNoPeriodo = (a) => a.historico.length
      ? a.historico.some((h) => h.para_status === "ENVIADO_EMPRESA" && noPeriodo(h.created_at))
      : ETAPAS_ENVIADAS.includes(a.status_kanban) && noPeriodo(a.created_at);

    const vagas = empresa.vagas.map((vaga) => {
      const apps = vaga.aplicacoes;
      const contratados = apps.filter((a) => a.status_kanban === "APROVADO" && noPeriodo(a.data_aprovacao));
      return {
        id: vaga.id,
        titulo: vaga.titulo,
        codigo_vaga: vaga.codigo_vaga,
        status: vaga.status,
        quantidade: vaga.quantidade,
        created_at: vaga.created_at,
        enviados: apps.filter(enviadoNoPeriodo).length,
        entrevistas: apps.filter((a) => noPeriodo(a.data_hora_entrevista)).length,
        contratados: contratados.map((a) => ({
          nome: a.estudante.nome_completo,
          curso: a.estudante.curso,
          data: a.data_aprovacao,
          dias: Math.round((a.data_aprovacao - a.created_at) / DIA_MS),
          taxa: a.estagio?.taxa_agenciamento ?? null,
        })),
      };
    }).filter((vaga) => vaga.status === "ABERTA" || vaga.enviados || vaga.entrevistas || vaga.contratados.length || (vaga.created_at >= inicio && vaga.created_at < ate));

    const contratacoes = vagas.flatMap((vaga) => vaga.contratados);
    return res.json({
      empresa: { id: empresa.id, nome: empresa.nome, setor: empresa.setor, nome_contato: empresa.nome_contato, logo_arquivo_id: empresa.logo_arquivo_id },
      periodo: { de: de.toISOString().slice(0, 10), ate: ateDia.toISOString().slice(0, 10) },
      totais: {
        vagasAbertas: empresa.vagas.filter((vaga) => vaga.status === "ABERTA").length,
        enviados: vagas.reduce((soma, vaga) => soma + vaga.enviados, 0),
        entrevistas: vagas.reduce((soma, vaga) => soma + vaga.entrevistas, 0),
        contratacoes: contratacoes.length,
        tempoMedioDias: contratacoes.length ? Math.round((contratacoes.reduce((soma, c) => soma + c.dias, 0) / contratacoes.length) * 10) / 10 : null,
        taxas: contratacoes.some((c) => c.taxa !== null) ? contratacoes.reduce((soma, c) => soma + (c.taxa ?? 0), 0) : null,
      },
      vagas,
    });
  } catch (error) {
    console.error("Erro no relatório da empresa:", error);
    return res.status(500).json({ erro: "Não foi possível gerar o relatório." });
  }
});

module.exports = router;
