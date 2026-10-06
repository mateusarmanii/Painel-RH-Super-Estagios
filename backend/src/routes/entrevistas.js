const express = require("express");
const prisma = require("../prisma");
const { uuidValido } = require("../utils");
const {
  camposEntrevista,
  conflitosDoEstudante,
  marcarConflitos,
  statusAoSairDaEntrevista,
  statusDaEntrevista,
} = require("../agenda");

const router = express.Router();
const HORA_MS = 60 * 60 * 1000;
const DIA_MS = 24 * HORA_MS;
const PERIODO_MAXIMO_DIAS = 62;

const camposDaEntrevista = {
  id: true,
  status_kanban: true,
  motivo_recusa: true,
  observacao: true,
  data_hora_entrevista: true,
  entrevista_status: true,
  entrevista_formato: true,
  entrevista_local: true,
  entrevista_duracao: true,
  entrevistador: true,
  estudante: { select: { id: true, nome_completo: true, curso: true, telefone: true, email: true } },
  vaga: {
    select: {
      id: true,
      codigo_vaga: true,
      titulo: true,
      empresa: { select: { id: true, nome: true, logo_url: true } },
    },
  },
};

const comStatus = (entrevista) => ({ ...entrevista, status_exibido: statusDaEntrevista(entrevista) });

function lerData(valor) {
  const data = valor ? new Date(valor) : null;
  return data && !Number.isNaN(data.getTime()) ? data : null;
}

// Sem parâmetros: entrevistas futuras ainda na etapa "Entrevista" (Dashboard).
// Com ?inicio=&fim= (ISO): todas as entrevistas do período, em qualquer status (Agenda: dia, semana, mês, lista).
router.get("/", async (req, res) => {
  const { inicio, fim } = req.query;
  let where = { status_kanban: "ENTREVISTA_AGENDADA", data_hora_entrevista: { gt: new Date() } };

  if (inicio !== undefined || fim !== undefined) {
    const de = lerData(inicio);
    const ate = lerData(fim);
    if (!de || !ate || ate <= de) return res.status(400).json({ erro: "Informe início e fim válidos (fim depois do início)." });
    if (ate - de > PERIODO_MAXIMO_DIAS * DIA_MS) {
      return res.status(400).json({ erro: `O período pode ter no máximo ${PERIODO_MAXIMO_DIAS} dias.` });
    }
    where = { data_hora_entrevista: { gte: de, lt: ate } };
  }

  try {
    const entrevistas = await prisma.aplicacao.findMany({
      where,
      orderBy: { data_hora_entrevista: "asc" },
      select: camposDaEntrevista,
    });
    return res.json(marcarConflitos(entrevistas.map(comStatus)));
  } catch (error) {
    console.error("Erro ao listar entrevistas:", error);
    return res.status(500).json({ erro: "Não foi possível listar as entrevistas." });
  }
});

// Números do topo da Agenda: próximas 24h sem confirmação, total da semana e comparecimento (últimos 90 dias).
// A semana vem do navegador (?inicioSemana=&fimSemana=), para respeitar o fuso de quem usa.
router.get("/resumo", async (req, res) => {
  const inicioSemana = lerData(req.query.inicioSemana);
  const fimSemana = lerData(req.query.fimSemana);
  if (!inicioSemana || !fimSemana || fimSemana <= inicioSemana || fimSemana - inicioSemana > 8 * DIA_MS) {
    return res.status(400).json({ erro: "Informe o início e o fim da semana." });
  }

  const agora = new Date();
  try {
    const [proximas, daSemana, recentes] = await Promise.all([
      prisma.aplicacao.findMany({
        where: {
          status_kanban: "ENTREVISTA_AGENDADA",
          data_hora_entrevista: { gte: agora, lt: new Date(agora.getTime() + 24 * HORA_MS) },
          OR: [{ entrevista_status: null }, { entrevista_status: "AGUARDANDO" }],
        },
        orderBy: { data_hora_entrevista: "asc" },
        select: camposDaEntrevista,
      }),
      prisma.aplicacao.findMany({
        where: { data_hora_entrevista: { gte: inicioSemana, lt: fimSemana } },
        select: { status_kanban: true, entrevista_status: true },
      }),
      prisma.aplicacao.findMany({
        where: { data_hora_entrevista: { gte: new Date(agora.getTime() - 90 * DIA_MS), lte: agora } },
        select: { status_kanban: true, entrevista_status: true },
      }),
    ]);

    const realizadas = recentes.filter((a) => statusDaEntrevista(a) === "REALIZADA").length;
    const faltas = recentes.filter((a) => statusDaEntrevista(a) === "NAO_COMPARECEU").length;
    return res.json({
      semConfirmacao24h: proximas.map(comStatus),
      semana: daSemana.filter((a) => statusDaEntrevista(a) !== "CANCELADA").length,
      comparecimento: {
        realizadas,
        faltas,
        taxa: realizadas + faltas ? realizadas / (realizadas + faltas) : null,
      },
    });
  } catch (error) {
    console.error("Erro ao montar o resumo da agenda:", error);
    return res.status(500).json({ erro: "Não foi possível carregar o resumo da agenda." });
  }
});

const acoes = new Set(["confirmar", "reagendar", "realizada", "nao_compareceu", "dispensar"]);

// Ações do painel da Agenda. Só valem enquanto o candidato está na etapa "Entrevista".
//  confirmar        → Confirmada
//  reagendar        → nova data (e, se vierem, formato/local/duração/entrevistador); volta para Aguardando
//  realizada        → Realizada e o candidato vai para "Em análise"
//  nao_compareceu   → Não compareceu (continua na etapa, para reagendar ou dispensar)
//  dispensar        → candidato dispensado com motivo; a entrevista fica Cancelada (ou mantém "Não compareceu")
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { acao, data_hora_entrevista, motivo_recusa } = req.body ?? {};

  if (!uuidValido.test(id)) return res.status(400).json({ erro: "ID de entrevista inválido." });
  if (!acoes.has(acao)) return res.status(400).json({ erro: "Ação inválida." });

  try {
    const atual = await prisma.aplicacao.findUnique({
      where: { id },
      select: { id: true, estudante_id: true, status_kanban: true, data_hora_entrevista: true, entrevista_status: true },
    });
    if (!atual?.data_hora_entrevista) return res.status(404).json({ erro: "Entrevista não encontrada." });
    if (atual.status_kanban !== "ENTREVISTA_AGENDADA") {
      return res.status(409).json({ erro: "Esta entrevista já foi encerrada: o candidato não está mais na etapa Entrevista." });
    }

    const status = statusDaEntrevista(atual);
    const jaAconteceu = new Date(atual.data_hora_entrevista) <= new Date();
    let data;

    if (acao === "confirmar") {
      if (status === "NAO_COMPARECEU") {
        return res.status(409).json({ erro: "O candidato não compareceu; reagende a entrevista antes de confirmar." });
      }
      data = { entrevista_status: "CONFIRMADA" };
    } else if (acao === "reagendar") {
      const novaData = lerData(data_hora_entrevista);
      if (!novaData) return res.status(400).json({ erro: "Informe a nova data e hora da entrevista." });
      if (novaData <= new Date()) return res.status(400).json({ erro: "Escolha uma data e hora no futuro." });
      const detalhes = camposEntrevista(req.body);
      if (detalhes.erro) return res.status(400).json({ erro: detalhes.erro });
      data = { ...detalhes.data, data_hora_entrevista: novaData, entrevista_status: "AGUARDANDO" };
    } else if (acao === "realizada") {
      if (!jaAconteceu) return res.status(409).json({ erro: "A entrevista ainda não começou." });
      data = { entrevista_status: "REALIZADA", status_kanban: "AGUARDANDO_RETORNO", motivo_recusa: null };
    } else if (acao === "nao_compareceu") {
      if (!jaAconteceu) return res.status(409).json({ erro: "A entrevista ainda não começou." });
      data = { entrevista_status: "NAO_COMPARECEU" };
    } else {
      const motivo = typeof motivo_recusa === "string" ? motivo_recusa.trim() : "";
      if (!motivo) return res.status(400).json({ erro: "Informe o motivo da dispensa." });
      if (motivo.length > 500) return res.status(400).json({ erro: "O motivo pode ter no máximo 500 caracteres." });
      data = {
        status_kanban: "RECUSADO",
        motivo_recusa: motivo,
        data_aprovacao: null,
        entrevista_status: statusAoSairDaEntrevista(atual.entrevista_status, "RECUSADO"),
      };
    }

    const entrevista = comStatus(await prisma.aplicacao.update({ where: { id }, data, select: camposDaEntrevista }));
    const conflitos = acao === "reagendar"
      ? await conflitosDoEstudante(prisma, {
        estudanteId: atual.estudante_id,
        aplicacaoId: id,
        inicio: entrevista.data_hora_entrevista,
        duracao: entrevista.entrevista_duracao,
      })
      : [];
    return res.json({ ...entrevista, conflitos });
  } catch (error) {
    console.error("Erro ao atualizar entrevista:", error);
    return res.status(500).json({ erro: "Não foi possível atualizar a entrevista." });
  }
});

module.exports = router;
