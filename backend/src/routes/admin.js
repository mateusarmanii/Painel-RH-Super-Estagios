// Administração (só papel ADMIN): usuários e registro de atividades. Configurações gerais: qualquer usuário lê;
// só ADMIN altera.
//   GET  /usuarios · POST /usuarios { nome, email, senha, papel } · PATCH /usuarios/:id { nome?, papel?, ativo?, senha? }
//   GET  /atividades?usuario_id=&entidade=&limite=
//   GET  /configuracoes · PUT /configuracoes { chave: valor, ... }
const express = require("express");
const prisma = require("../prisma");
const { uuidValido } = require("../utils");
const { gerarHash, normalizarEmail, papeis, TAMANHO_MINIMO_SENHA } = require("../auth");
const { lerConfiguracoes, salvarConfiguracoes } = require("../configuracoes");

const router = express.Router();

function exigirAdmin(req, res, next) {
  if (req.usuario?.papel !== "ADMIN") return res.status(403).json({ erro: "Só administradores podem fazer isso." });
  return next();
}

const selectUsuario = { id: true, nome: true, email: true, papel: true, ativo: true, created_at: true };
const emailValido = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

router.get("/usuarios", exigirAdmin, async (_req, res) => {
  try {
    return res.json(await prisma.usuario.findMany({ orderBy: { nome: "asc" }, select: selectUsuario }));
  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    return res.status(500).json({ erro: "Não foi possível listar os usuários." });
  }
});

// Lista curta (id e nome dos ativos) para os seletores, como "Recrutador responsável". Qualquer usuário.
router.get("/usuarios/opcoes", async (_req, res) => {
  try {
    return res.json(await prisma.usuario.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }));
  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    return res.status(500).json({ erro: "Não foi possível listar os usuários." });
  }
});

router.post("/usuarios", exigirAdmin, async (req, res) => {
  const { nome, email, senha, papel = "RECRUTADOR" } = req.body ?? {};
  const emailNormalizado = normalizarEmail(email);
  if (typeof nome !== "string" || !nome.trim() || nome.length > 100) return res.status(400).json({ erro: "Informe o nome." });
  if (!emailValido(emailNormalizado)) return res.status(400).json({ erro: "E-mail inválido." });
  if (typeof senha !== "string" || senha.length < TAMANHO_MINIMO_SENHA) {
    return res.status(400).json({ erro: `A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.` });
  }
  if (!papeis.includes(papel)) return res.status(400).json({ erro: "Papel inválido." });
  try {
    const usuario = await prisma.usuario.create({
      data: { nome: nome.trim(), email: emailNormalizado, senha_hash: await gerarHash(senha), papel },
      select: selectUsuario,
    });
    return res.status(201).json(usuario);
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ erro: "Já existe um usuário com este e-mail." });
    console.error("Erro ao criar usuário:", error);
    return res.status(500).json({ erro: "Não foi possível criar o usuário." });
  }
});

router.patch("/usuarios/:id", exigirAdmin, async (req, res) => {
  const { id } = req.params;
  if (!uuidValido.test(id)) return res.status(400).json({ erro: "ID inválido." });
  const { nome, papel, ativo, senha } = req.body ?? {};
  const data = {};
  if (nome !== undefined) {
    if (typeof nome !== "string" || !nome.trim() || nome.length > 100) return res.status(400).json({ erro: "Nome inválido." });
    data.nome = nome.trim();
  }
  if (papel !== undefined) {
    if (!papeis.includes(papel)) return res.status(400).json({ erro: "Papel inválido." });
    data.papel = papel;
  }
  if (ativo !== undefined) {
    if (typeof ativo !== "boolean") return res.status(400).json({ erro: "Valor de ativo inválido." });
    data.ativo = ativo;
  }
  if (senha !== undefined) {
    if (typeof senha !== "string" || senha.length < TAMANHO_MINIMO_SENHA) {
      return res.status(400).json({ erro: `A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.` });
    }
    data.senha_hash = await gerarHash(senha);
  }
  // Não deixa o painel sem nenhum administrador ativo.
  if (id === req.usuario.id && (data.ativo === false || (data.papel && data.papel !== "ADMIN"))) {
    return res.status(409).json({ erro: "Você não pode desativar nem tirar o papel de administrador de si mesmo." });
  }
  try {
    return res.json(await prisma.usuario.update({ where: { id }, data, select: selectUsuario }));
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ erro: "Usuário não encontrado." });
    console.error("Erro ao atualizar usuário:", error);
    return res.status(500).json({ erro: "Não foi possível atualizar o usuário." });
  }
});

router.get("/atividades", exigirAdmin, async (req, res) => {
  const { usuario_id, entidade } = req.query;
  const limite = Math.min(Math.max(Number(req.query.limite) || 100, 1), 500);
  if (usuario_id && !uuidValido.test(usuario_id)) return res.status(400).json({ erro: "Usuário inválido." });
  try {
    const atividades = await prisma.atividade.findMany({
      where: { ...(usuario_id && { usuario_id }), ...(typeof entidade === "string" && entidade && { entidade }) },
      orderBy: { created_at: "desc" },
      take: limite,
      select: { id: true, metodo: true, caminho: true, entidade: true, entidade_id: true, status: true, created_at: true, usuario: { select: { id: true, nome: true } } },
    });
    return res.json(atividades);
  } catch (error) {
    console.error("Erro ao listar atividades:", error);
    return res.status(500).json({ erro: "Não foi possível listar as atividades." });
  }
});

router.get("/configuracoes", async (_req, res) => {
  try {
    return res.json(await lerConfiguracoes());
  } catch (error) {
    console.error("Erro ao ler configurações:", error);
    return res.status(500).json({ erro: "Não foi possível carregar as configurações." });
  }
});

router.put("/configuracoes", exigirAdmin, async (req, res) => {
  try {
    const resultado = await salvarConfiguracoes(req.body);
    if (resultado.erro) return res.status(400).json({ erro: resultado.erro });
    return res.json(resultado.configuracoes);
  } catch (error) {
    console.error("Erro ao salvar configurações:", error);
    return res.status(500).json({ erro: "Não foi possível salvar as configurações." });
  }
});

module.exports = router;
module.exports.exigirAdmin = exigirAdmin;
