require("dotenv").config();

const express = require("express");
const cors = require("cors");
const prisma = require("./src/prisma");
const empresasRoutes = require("./src/routes/empresas");
const vagasRoutes = require("./src/routes/vagas");
const candidatosRoutes = require("./src/routes/candidatos");

const app = express();
const port = Number(process.env.PORT) || 3333;

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ status: "ok", mensagem: "API Super Estágios" });
});

app.get("/dashboard-metrics", async (_req, res) => {
  try {
    const [openJobs, candidatesInProcess, partnerCompanies, scheduledInterviews, grouped, interviews] =
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
      ]);

    const countsByStatus = new Map(
      grouped.map((item) => [item.status_kanban, item._count._all]),
    );

    return res.json({
      metrics: {
        openJobs,
        candidatesInProcess,
        partnerCompanies,
        scheduledInterviews,
      },
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