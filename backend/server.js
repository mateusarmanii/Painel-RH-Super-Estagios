require("dotenv").config();

const express = require("express");
const cors = require("cors");
const prisma = require("./src/prisma");
const empresasRoutes = require("./src/routes/empresas");
const vagasRoutes = require("./src/routes/vagas");
const candidatosRoutes = require("./src/routes/candidatos");
const entrevistasRoutes = require("./src/routes/entrevistas");
const { DIA_MS, DIAS_PARA_ALERTA, aparaTextos } = require("./src/utils");

const app = express();
const port = Number(process.env.PORT) || 3333;

app.use(cors());
app.use(express.json());
app.use(aparaTextos);

app.get("/", (_req, res) => {
  res.json({ status: "ok", mensagem: "API Super Estágios" });
});

// Agrupa ignorando maiúsculas, acentos e espaços extras; exibe a grafia mais usada (empate: ordem alfabética).
function agruparPorCurso(cursos) {
  const grupos = new Map();

  for (const curso of cursos) {
    const grafia = curso.trim().replace(/\s+/g, " ");
    const chave = grafia.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    const grupo = grupos.get(chave) ?? { total: 0, grafias: new Map() };
    grupo.total += 1;
    grupo.grafias.set(grafia, (grupo.grafias.get(grafia) ?? 0) + 1);
    grupos.set(chave, grupo);
  }

  return [...grupos.values()]
    .map(({ total, grafias }) => ({
      curso: [...grafias].sort(([a, totalA], [b, totalB]) => totalB - totalA || a.localeCompare(b, "pt-BR"))[0][0],
      total,
    }))
    .sort((a, b) => b.total - a.total || a.curso.localeCompare(b.curso, "pt-BR"));
}

app.get("/dashboard-metrics", async (_req, res) => {
  const agora = new Date();

  try {
    const [
      openJobs,
      candidatesInProcess,
      partnerCompanies,
      scheduledInterviews,
      grouped,
      interviews,
      contratacoes,
      vagasEmAlerta,
      cursos,
    ] =
      await Promise.all([
        prisma.vaga.count({ where: { status: "ABERTA" } }),
        prisma.aplicacao.count({
          where: { status_kanban: { notIn: ["APROVADO", "RECUSADO"] } },
        }),
        prisma.empresa.count(),
        prisma.aplicacao.count({ where: { status_kanban: "ENTREVISTA_AGENDADA" } }),
        prisma.aplicacao.groupBy({
          by: ["status_kanban"],
          _count: { _all: true },
        }),
        prisma.aplicacao.findMany({
          where: {
            status_kanban: "ENTREVISTA_AGENDADA",
            data_hora_entrevista: { not: null },
          },
          orderBy: { data_hora_entrevista: "asc" },
          take: 5,
          include: {
            estudante: { select: { nome_completo: true } },
            vaga: { select: { titulo: true } },
          },
        }),
        prisma.aplicacao.findMany({
          where: { status_kanban: "APROVADO", data_aprovacao: { not: null } },
          select: { created_at: true, data_aprovacao: true },
        }),
        prisma.vaga.findMany({
          where: {
            status: "ABERTA",
            created_at: { lt: new Date(agora.getTime() - DIAS_PARA_ALERTA * DIA_MS) },
            aplicacoes: { none: { status_kanban: "ENTREVISTA_AGENDADA" } },
          },
          orderBy: { created_at: "asc" },
          select: {
            id: true,
            codigo_vaga: true,
            titulo: true,
            created_at: true,
            empresa: { select: { nome: true } },
            _count: { select: { aplicacoes: true } },
          },
        }),
        prisma.estudante.findMany({ select: { curso: true } }),
      ]);

    const countsByStatus = new Map(
      grouped.map((item) => [item.status_kanban, item._count._all]),
    );

    // Dias entre a criação da candidatura e a aprovação (contratação); null se ainda não houver contratações.
    const tempoMedioContratacaoDias = contratacoes.length
      ? Math.round(
          (contratacoes.reduce(
            (total, { created_at, data_aprovacao }) => total + (data_aprovacao - created_at),
            0,
          ) / contratacoes.length / DIA_MS) * 10,
        ) / 10
      : null;

    return res.json({
      metrics: {
        openJobs,
        candidatesInProcess,
        partnerCompanies,
        scheduledInterviews,
        tempoMedioContratacaoDias,
        totalContratacoes: contratacoes.length,
      },
      vagasEmAlerta: vagasEmAlerta.map((vaga) => ({
        id: vaga.id,
        codigo_vaga: vaga.codigo_vaga,
        titulo: vaga.titulo,
        empresa: vaga.empresa.nome,
        created_at: vaga.created_at,
        diasAberta: Math.floor((agora - vaga.created_at) / DIA_MS),
        totalCandidaturas: vaga._count.aplicacoes,
      })),
      distribuicaoPorCurso: agruparPorCurso(cursos.map((item) => item.curso)),
      funnel: [
        { status: "ENVIADO_EMPRESA", label: "Novos", total: countsByStatus.get("ENVIADO_EMPRESA") ?? 0 },
        { status: "AGUARDANDO_RETORNO", label: "Análise", total: countsByStatus.get("AGUARDANDO_RETORNO") ?? 0 },
        { status: "ENTREVISTA_AGENDADA", label: "Entrevista", total: countsByStatus.get("ENTREVISTA_AGENDADA") ?? 0 },
        { status: "APROVADO", label: "Contratados", total: countsByStatus.get("APROVADO") ?? 0 },
      ],
      recentInterviews: interviews.map((interview) => ({
        id: interview.id,
        estudante: interview.estudante.nome_completo,
        vaga: interview.vaga.titulo,
        data_hora: interview.data_hora_entrevista,
      })),
    });
  } catch (error) {
    console.error("Erro ao carregar métricas do dashboard:", error);
    return res.status(500).json({ erro: "Não foi possível carregar as métricas." });
  }
});

app.use("/empresas", empresasRoutes);
app.use("/vagas", vagasRoutes);
app.use("/candidatos", candidatosRoutes);
app.use("/entrevistas", entrevistasRoutes);

const server = app.listen(port, () => {
  console.log(`API disponível em http://localhost:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);