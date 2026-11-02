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
const { aparaTextos } = require("./src/utils");
const { montarDashboard } = require("./src/dashboard");
const arquivosRoutes = require("./src/routes/arquivos");
const publicoRoutes = require("./src/routes/publico");
const estagiosRoutes = require("./src/routes/estagios");
const contatosRoutes = require("./src/routes/contatos");
const modelosRoutes = require("./src/routes/modelos");
const adminRoutes = require("./src/routes/admin");
const notificacoesRoutes = require("./src/routes/notificacoes");
const relatoriosRoutes = require("./src/routes/relatorios");
const telegramRoutes = require("./src/routes/telegram");
const { iniciarTelegram, pararTelegram } = require("./src/telegram");
const { registrarAtividades } = require("./src/atividades");
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
// Links públicos (formulário, confirmação de presença, portal da empresa), com limite de requisições.
app.use("/publico", publicoRoutes);
app.use(exigirLogin);
// Registro de atividades: toda alteração feita por um usuário logado (automático).
app.use(registrarAtividades);

// Dashboard: ?periodo=7d|30d|90d|mes|ano|12m (padrão 30d) ou ?de=&ate= (AAAA-MM-DD), mais ?empresa=<id> e ?area=<id>.
// Os cálculos ficam em src/dashboard.js.
app.get("/dashboard-metrics", async (req, res) => {
  try {
    const resultado = await montarDashboard(req.query);
    if (resultado.erro) return res.status(400).json({ erro: resultado.erro });
    return res.json(resultado);
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
app.use("/estagios", estagiosRoutes);
app.use("/contatos", contatosRoutes);
app.use("/modelos", modelosRoutes);
app.use("/relatorios", relatoriosRoutes);
app.use("/telegram", telegramRoutes);
app.use(adminRoutes);
app.use(notificacoesRoutes);

// Erros que escapam das rotas (JSON malformado...): resposta curta em JSON, sem detalhes internos.
app.use((error, _req, res, _next) => {
  const status = error.status ?? error.statusCode ?? 500;
  if (status >= 500) console.error("Erro não tratado:", error);
  const mensagens = { 400: "Requisição inválida.", 403: "Acesso negado.", 404: "Não encontrado." };
  res.status(status).json({ erro: mensagens[status] ?? "Erro interno." });
});

const server = app.listen(port, () => {
  console.log(`API disponível em http://localhost:${port}`);
  // Avisos do sino no Telegram (só com TELEGRAM_BOT_TOKEN). Ver src/telegram.js.
  iniciarTelegram();
});

async function shutdown() {
  pararTelegram();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);