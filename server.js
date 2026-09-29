require("dotenv").config();

const cors = require("cors");
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

if (!process.env.JWT_SECRET ||
    (process.env.NODE_ENV === "production" && process.env.JWT_SECRET === "local-development-only-change-before-deploying")) {
  throw new Error("Configure JWT_SECRET no arquivo .env.");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const app = express();
const jwtSecret = process.env.JWT_SECRET;
const storageRoot = path.join(__dirname, "storage", "private");
const allowedApplicationStatuses = [
  "Enviado para a Empresa",
  "Em seleção",
  "Contratada",
  "Rejeitada",
];

fs.mkdirSync(path.join(storageRoot, "curriculos"), { recursive: true });
fs.mkdirSync(path.join(storageRoot, "relatorios"), { recursive: true });

app.use(cors());
app.use(express.json());

const candidatePublicSelect = {
  id: true,
  nome: true,
  telefone: true,
  curso: true,
  instituicao: true,
  cep: true,
  endereco: true,
  status_banco: true,
  criado_em: true,
};

const applicationInclude = {
  candidato: { select: candidatePublicSelect },
  vaga: { select: { id: true, codigo: true, link: true, nome: true } },
  entrevistas: {
    select: {
      id: true,
      data_hora_inicio: true,
      data_hora_fim: true,
      link_reuniao: true,
      status: true,
    },
  },
};

const pdfStorage = multer.diskStorage({
  destination: (req, file, callback) => {
    const folder = file.fieldname === "curriculo" ? "curriculos" : "relatorios";
    callback(null, path.join(storageRoot, folder));
  },
  filename: (req, file, callback) => callback(null, `${crypto.randomUUID()}.pdf`),
});

const pdfUpload = multer({
  storage: pdfStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (file.mimetype !== "application/pdf") {
      return callback(new Error("O arquivo deve ser um PDF."));
    }
    callback(null, true);
  },
});

function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ erro: "Autenticação necessária." });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    if (!Number.isInteger(payload.franchiseId)) {
      return res.status(401).json({ erro: "Token inválido." });
    }
    req.franchiseId = payload.franchiseId;
    next();
  } catch (error) {
    res.status(401).json({ erro: "Token inválido ou expirado." });
  }
}

async function isPdf(filePath) {
  const file = await fs.promises.readFile(filePath);
  return file.subarray(0, 5).toString() === "%PDF-";
}

async function removeUpload(file) {
  if (file) await fs.promises.rm(file.path, { force: true });
}

function privateFilePath(storedPath) {
  const resolvedPath = path.resolve(storageRoot, storedPath);
  if (!resolvedPath.startsWith(`${storageRoot}${path.sep}`)) {
    throw new Error("Caminho de arquivo inválido.");
  }
  return resolvedPath;
}

async function lookupAddress(cep) {
  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Serviço de CEP indisponível.");
  const result = await response.json();
  if (result.erro) return null;
  return [result.logradouro, result.bairro, [result.localidade, result.uf].filter(Boolean).join("/")]
    .filter(Boolean)
    .join(", ");
}

app.post("/auth/login", async (req, res) => {
  const login = typeof req.body.login === "string" ? req.body.login.trim().toLowerCase() : "";
  const { senha } = req.body;
  if (!login || typeof senha !== "string") {
    return res.status(400).json({ erro: "Login e senha são obrigatórios." });
  }

  try {
    const franquia = await prisma.franquia.findUnique({ where: { login } });
    if (!franquia || !(await bcrypt.compare(senha, franquia.senha_hash))) {
      return res.status(401).json({ erro: "Login ou senha inválidos." });
    }
    const token = jwt.sign({ franchiseId: franquia.id }, jwtSecret, { expiresIn: "8h" });
    res.json({ token, franquia: { id: franquia.id, nome: franquia.nome, cidade: franquia.cidade } });
  } catch (error) {
    res.status(500).json({ erro: "Não foi possível autenticar a franquia." });
  }
});

app.post("/franquias", async (req, res) => {
  const { nome, cidade, senha } = req.body;
  const login = typeof req.body.login === "string" ? req.body.login.trim().toLowerCase() : "";

  if (![nome, cidade, login].every((value) => typeof value === "string" && value.trim()) ||
      typeof senha !== "string" || senha.length < 12) {
    return res.status(400).json({ erro: "Nome, cidade, login e senha com ao menos 12 caracteres são obrigatórios." });
  }

  try {
    const senha_hash = await bcrypt.hash(senha, 12);
    const franquia = await prisma.franquia.create({
      data: { nome: nome.trim(), cidade: cidade.trim(), login, senha_hash },
      select: { id: true, nome: true, cidade: true, criado_em: true },
    });
    res.status(201).json(franquia);
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ erro: "Este login já está em uso." });
    res.status(500).json({ erro: "Não foi possível criar a franquia." });
  }
});

app.get("/franquias", authenticate, async (req, res) => {
  try {
    const franquia = await prisma.franquia.findUnique({
      where: { id: req.franchiseId },
      select: { id: true, nome: true, cidade: true, login: true, criado_em: true },
    });
    res.json(franquia ? [franquia] : []);
  } catch (error) {
    res.status(500).json({ erro: "Não foi possível consultar a franquia." });
  }
});

app.get("/candidatos", authenticate, async (req, res) => {
  try {
    const candidatos = await prisma.candidato.findMany({
      where: { franquia_id: req.franchiseId },
      select: candidatePublicSelect,
    });
    res.json(candidatos);
  } catch (error) {
    res.status(500).json({ erro: "Não foi possível listar os candidatos." });
  }
});

app.post("/candidatos", authenticate, pdfUpload.single("curriculo"), async (req, res) => {
  const { nome, telefone, curso, instituicao } = req.body;
  const cep = typeof req.body.cep === "string" ? req.body.cep.replace(/\D/g, "") : "";
  const camposObrigatorios = [nome, telefone, curso, instituicao];

  if (!req.file || !camposObrigatorios.every((campo) => typeof campo === "string" && campo.trim()) || !/^\d{8}$/.test(cep)) {
    await removeUpload(req.file);
    return res.status(400).json({ erro: "Nome, telefone, curso, instituição, CEP e currículo PDF são obrigatórios." });
  }

  try {
    if (!(await isPdf(req.file.path))) {
      await removeUpload(req.file);
      return res.status(400).json({ erro: "O conteúdo enviado não é um PDF válido." });
    }
    const endereco = await lookupAddress(cep);
    if (!endereco) {
      await removeUpload(req.file);
      return res.status(400).json({ erro: "CEP não encontrado." });
    }
    const candidato = await prisma.candidato.create({
      data: {
        franquia_id: req.franchiseId,
        nome: nome.trim(),
        telefone: telefone.trim(),
        curso: curso.trim(),
        instituicao: instituicao.trim(),
        cep,
        endereco,
        curriculo_path: path.relative(storageRoot, req.file.path),
      },
      select: candidatePublicSelect,
    });
    res.status(201).json(candidato);
  } catch (error) {
    await removeUpload(req.file);
    const cepError = error.name === "TimeoutError" || error.message === "Serviço de CEP indisponível.";
    res.status(cepError ? 502 : 500).json({ erro: cepError ? error.message : "Não foi possível criar o candidato." });
  }
});

app.get("/candidatos/:id/curriculo", authenticate, async (req, res) => {
  try {
    const candidato = await prisma.candidato.findFirst({
      where: { id: req.params.id, franquia_id: req.franchiseId },
      select: { curriculo_path: true },
    });
    if (!candidato) return res.status(404).json({ erro: "Candidato não encontrado." });
    res.type("application/pdf").sendFile(privateFilePath(candidato.curriculo_path));
  } catch (error) {
    res.status(500).json({ erro: "Não foi possível acessar o currículo." });
  }
});

app.get("/banco-curriculos", authenticate, async (req, res) => {
  try {
    const candidatos = await prisma.candidato.findMany({
      where: { franquia_id: req.franchiseId, status_banco: "Aguardando nova oportunidade" },
      select: candidatePublicSelect,
    });
    res.json(candidatos);
  } catch (error) {
    res.status(500).json({ erro: "Não foi possível listar o banco de currículos." });
  }
});

app.get("/aplicacoes", authenticate, async (req, res) => {
  try {
    const aplicacoes = await prisma.aplicacao.findMany({
      where: {
        removida_em: null,
        candidato: { franquia_id: req.franchiseId },
        vaga: { empresa: { franquia_id: req.franchiseId } },
      },
      include: applicationInclude,
    });
    res.json(aplicacoes);
  } catch (error) {
    res.status(500).json({ erro: "Não foi possível listar as aplicações." });
  }
});

app.post("/aplicacoes", authenticate, async (req, res) => {
  const { vaga_id, candidato_id, status_funil } = req.body;

  if (vaga_id == null || !Number.isInteger(Number(vaga_id)) || !candidato_id ||
      (status_funil && !allowedApplicationStatuses.includes(status_funil))) {
    return res.status(400).json({ erro: "vaga_id e candidato_id são obrigatórios." });
  }

  try {
    const [vaga, candidato] = await Promise.all([
      prisma.vaga.findFirst({ where: { id: Number(vaga_id), empresa: { franquia_id: req.franchiseId } } }),
      prisma.candidato.findFirst({ where: { id: candidato_id, franquia_id: req.franchiseId } }),
    ]);
    if (!vaga || !candidato) return res.status(404).json({ erro: "Vaga ou candidato não encontrado." });
    const aplicacao = await prisma.aplicacao.create({
      data: {
        vaga_id: Number(vaga_id),
        candidato_id,
        ...(status_funil ? { status_funil } : {}),
      },
      include: applicationInclude,
    });
    res.status(201).json(aplicacao);
  } catch (error) {
    res.status(500).json({ erro: "Não foi possível criar a aplicação." });
  }
});

app.patch("/aplicacoes/:id/status", authenticate, async (req, res) => {
  const { status_funil } = req.body;
  if (!allowedApplicationStatuses.includes(status_funil)) {
    return res.status(400).json({ erro: "Status de aplicação inválido." });
  }

  try {
    const existing = await prisma.aplicacao.findFirst({
      where: {
        id: req.params.id,
        removida_em: null,
        candidato: { franquia_id: req.franchiseId },
        vaga: { empresa: { franquia_id: req.franchiseId } },
      },
    });
    if (!existing) return res.status(404).json({ erro: "Aplicação não encontrada." });

    const aplicacao = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.aplicacao.update({
        where: { id: existing.id },
        data: { status_funil },
      });

      if (status_funil === "Contratada") {
        await transaction.aplicacao.updateMany({
          where: {
            candidato_id: existing.candidato_id,
            id: { not: existing.id },
            removida_em: null,
          },
          data: { removida_em: new Date() },
        });
        await transaction.candidato.update({
          where: { id: existing.candidato_id },
          data: { status_banco: null },
        });
      } else if (status_funil === "Rejeitada") {
        await transaction.candidato.update({
          where: { id: existing.candidato_id },
          data: { status_banco: "Aguardando nova oportunidade" },
        });
      }

      return transaction.aplicacao.findUnique({
        where: { id: updated.id },
        include: applicationInclude,
      });
    });
    res.json(aplicacao);
  } catch (error) {
    res.status(500).json({ erro: "Não foi possível atualizar o status da aplicação." });
  }
});

app.get("/aplicacoes/:id/entrevistas", authenticate, async (req, res) => {
  try {
    const aplicacao = await prisma.aplicacao.findFirst({
      where: { id: req.params.id, candidato: { franquia_id: req.franchiseId } },
      select: { id: true },
    });
    if (!aplicacao) return res.status(404).json({ erro: "Aplicação não encontrada." });
    const entrevistas = await prisma.entrevista.findMany({
      where: { aplicacao_id: aplicacao.id },
      select: { id: true, aplicacao_id: true, data_hora_inicio: true, data_hora_fim: true, link_reuniao: true, status: true },
    });
    res.json(entrevistas);
  } catch (error) {
    res.status(500).json({ erro: "Não foi possível listar as entrevistas." });
  }
});

app.post("/aplicacoes/:id/entrevistas", authenticate, pdfUpload.single("relatorio"), async (req, res) => {
  const data_hora_inicio = new Date(req.body.data_hora_inicio);
  const data_hora_fim = new Date(req.body.data_hora_fim);
  if (!Number.isFinite(data_hora_inicio.getTime()) || !Number.isFinite(data_hora_fim.getTime()) ||
      data_hora_fim <= data_hora_inicio) {
    await removeUpload(req.file);
    return res.status(400).json({ erro: "Informe início e fim válidos; o fim deve ser posterior ao início." });
  }

  try {
    if (req.file && !(await isPdf(req.file.path))) {
      await removeUpload(req.file);
      return res.status(400).json({ erro: "O relatório deve ser um PDF válido." });
    }
    const aplicacao = await prisma.aplicacao.findFirst({
      where: { id: req.params.id, candidato: { franquia_id: req.franchiseId } },
      select: { id: true },
    });
    if (!aplicacao) {
      await removeUpload(req.file);
      return res.status(404).json({ erro: "Aplicação não encontrada." });
    }
    const entrevista = await prisma.entrevista.create({
      data: {
        aplicacao_id: aplicacao.id,
        data_hora_inicio,
        data_hora_fim,
        link_reuniao: req.body.link_reuniao || null,
        ...(req.file ? { relatorio_path: path.relative(storageRoot, req.file.path) } : {}),
      },
      select: { id: true, aplicacao_id: true, data_hora_inicio: true, data_hora_fim: true, link_reuniao: true, status: true },
    });
    res.status(201).json(entrevista);
  } catch (error) {
    await removeUpload(req.file);
    res.status(500).json({ erro: "Não foi possível criar a entrevista." });
  }
});

app.get("/entrevistas/:id/relatorio", authenticate, async (req, res) => {
  try {
    const entrevista = await prisma.entrevista.findFirst({
      where: {
        id: req.params.id,
        aplicacao: { candidato: { franquia_id: req.franchiseId } },
      },
      select: { relatorio_path: true },
    });
    if (!entrevista?.relatorio_path) return res.status(404).json({ erro: "Relatório não encontrado." });
    res.type("application/pdf").sendFile(privateFilePath(entrevista.relatorio_path));
  } catch (error) {
    res.status(500).json({ erro: "Não foi possível acessar o relatório." });
  }
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return res.status(status).json({ erro: "Upload inválido; envie somente um PDF de até 10 MB." });
  }
  if (error.message === "O arquivo deve ser um PDF.") {
    return res.status(400).json({ erro: error.message });
  }
  res.status(500).json({ erro: "Erro interno do servidor." });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});