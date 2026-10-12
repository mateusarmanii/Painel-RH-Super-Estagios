require("dotenv").config();

const express = require("express");
const cors = require("cors");
const prisma = require("./src/prisma");
const empresasRoutes = require("./src/routes/empresas");
const vagasRoutes = require("./src/routes/vagas");
const candidatosRoutes = require("./src/routes/candidatos");
const entrevistasRoutes = require("./src/routes/entrevistas");
const eventosRoutes = require("./src/routes/eventos");
const lembretesRoutes = require("./src/routes/lembretes");
const authRoutes = require("./src/routes/auth");
const { DIA_MS, DIAS_PARA_ALERTA, aparaTextos } = require("./src/utils");
const { ETAPAS_EM_PROCESSO, ETAPAS_AVANCADAS } = require("./src/etapas");

// Rótulos de reserva do funil (o frontend usa os mesmos nomes do Kanban).
const rotulosDoFunil = {
  CANDIDATO_CONTATADO: "Candidato contatado",
  ENVIADO_EMPRESA: "Enviado à empresa",
  ENTREVISTA_AGENDADA: "Em entrevista",
  EM_TESTE: "Em teste",
  APROVADO: "Contratado",
};
const arquivosRoutes = require("./src/routes/arquivos");
const { exigirLogin, segredoJwt } = require("./src/auth");

// Confere o JWT_SECRET já na subida (sem ele a API não sobe).
segredoJwt();

const app = express();
const port = Number(process.env.PORT) || 3333;
const producao = process.env.NODE_ENV === "production";

// No Render a API fica atrás de um proxy: o IP real (usado no limite de tentativas de login) vem dele.
if (producao) app.set("trust proxy", 1);

// CORS: só o endereço do frontend (FRONTEND_URL; vários separados por vírgula). Fora de produção, localhost também.
const origensPermitidas = (process.env.FRONTEND_URL ?? "")
  .split(",")
  .map((origem) => origem.trim().replace(/\/+$/, ""))
  .filter(Boolean);
const localhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
if (producao && !origensPermitidas.length) {
  console.warn("Aviso: FRONTEND_URL não configurada; o navegador não vai conseguir chamar a API.");
}

app.use(cors({
  origin: (origem, callback) =>
    callback(null, !origem || origensPermitidas.includes(origem) || (!producao && localhost.test(origem))),
}));
app.use(express.json());
app.use(aparaTextos);

// Logo das empresas (guardada no banco): pública, para poder ir direto em <img>. Currículos exigem login.
app.use("/arquivos", arquivosRoutes.publico);

app.get("/", (_req, res) => {
  res.json({ status: "ok", mensagem: "API Super Estágios" });
});

// Login é público; daqui para baixo, toda rota exige o token (401 sem token ou com token inválido).
app.use("/auth", authRoutes);
app.use(exigirLogin);

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
        // Entrevistas agendadas = futuras e ainda em aberto (mesma conta do quadro "Olá, o RH tem" e da Agenda).
        prisma.aplicacao.count({
          where: {
            status_kanban: "ENTREVISTA_AGENDADA",
            data_hora_entrevista: { gt: agora },
            OR: [{ entrevista_status: null }, { entrevista_status: { in: ["AGUARDANDO", "CONFIRMADA"] } }],
          },
        }),
        prisma.aplicacao.groupBy({
          by: ["status_kanban"],
          _count: { _all: true },
        }),
        prisma.aplicacao.findMany({
          where: { status_kanban: "APROVADO", data_aprovacao: { not: null } },
          select: { created_at: true, data_aprovacao: true },
        }),
        prisma.vaga.findMany({
          where: {
            status: "ABERTA",
            created_at: { lt: new Date(agora.getTime() - DIAS_PARA_ALERTA * DIA_MS) },
            aplicacoes: { none: { status_kanban: { in: ETAPAS_AVANCADAS } } },
          },
          orderBy: { created_at: "asc" },
          select: {
            id: true,
            codigo_vaga: true,
            titulo: true,
            created_at: true,
            empresa: { select: { id: true, nome: true, logo_arquivo_id: true } },
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
      // Etapas do processo até a contratação, na ordem do Kanban (Dispensado não entra no funil).
      funnel: [...ETAPAS_EM_PROCESSO, "APROVADO"].map((status) => ({
        status,
        label: rotulosDoFunil[status],
        total: countsByStatus.get(status) ?? 0,
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
app.use("/eventos", eventosRoutes);
app.use("/lembretes", lembretesRoutes);

// Erros que escapam das rotas (JSON malformado...): resposta curta em JSON, sem detalhes internos.
app.use((error, _req, res, _next) => {
  const status = error.status ?? error.statusCode ?? 500;
  if (status >= 500) console.error("Erro não tratado:", error);
  const mensagens = { 400: "Requisição inválida.", 403: "Acesso negado.", 404: "Não encontrado." };
  res.status(status).json({ erro: mensagens[status] ?? "Erro interno." });
});

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