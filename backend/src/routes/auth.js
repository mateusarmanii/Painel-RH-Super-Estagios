const express = require("express");
const { rateLimit } = require("express-rate-limit");
const prisma = require("../prisma");
const { conferirLogin, gerarToken, usuarioPublico, normalizarEmail, exigirLogin, gerarHash, TAMANHO_MINIMO_SENHA } = require("../auth");
const { emailConfigurado, enviarEmail } = require("../email");
const { tokenSenha, lerTokenSenha, pedacoDoHash } = require("../tokens");

const router = express.Router();
const JANELA_MS = 15 * 60 * 1000;
const muitasTentativas = { erro: "Muitas tentativas de login. Aguarde 15 minutos e tente de novo." };

// Contra força bruta: só as tentativas que falham contam, por IP e por e-mail (cobre quem troca de IP).
const limitePorIp = rateLimit({
  windowMs: JANELA_MS,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: muitasTentativas,
});

const limitePorEmail = rateLimit({
  windowMs: JANELA_MS,
  limit: 8,
  skipSuccessfulRequests: true,
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req) => `email:${normalizarEmail(req.body?.email)}`,
  message: muitasTentativas,
});

router.post("/login", limitePorIp, limitePorEmail, async (req, res) => {
  const { email, senha } = req.body ?? {};
  if (typeof email !== "string" || typeof senha !== "string" || !email.trim() || !senha) {
    return res.status(400).json({ erro: "Informe e-mail e senha." });
  }

  try {
    const usuario = await conferirLogin(email, senha);
    // Mesma resposta para e-mail inexistente, senha errada ou usuário inativo.
    if (!usuario) return res.status(401).json({ erro: "E-mail ou senha incorretos." });
    return res.json({ token: gerarToken(usuario), usuario: usuarioPublico(usuario) });
  } catch (error) {
    console.error("Erro no login:", error);
    return res.status(500).json({ erro: "Não foi possível entrar agora. Tente novamente." });
  }
});

// Quem está logado (o frontend usa para mostrar o nome e conferir se o token ainda vale).
router.get("/me", exigirLogin, (req, res) => res.json(req.usuario));

// ---------- Esqueci minha senha (opcional: só funciona com o envio de e-mail configurado) ----------

const limiteRedefinicao = rateLimit({ windowMs: JANELA_MS, limit: 5, standardHeaders: "draft-8", legacyHeaders: false, message: muitasTentativas });

// Endereço do painel para montar o link: FRONTEND_URL (o primeiro) ou, em desenvolvimento, quem chamou.
function enderecoDoPainel(req) {
  const configurado = (process.env.FRONTEND_URL ?? "").split(",")[0].trim().replace(/\/+$/, "");
  return configurado || (req.get("Origin") ?? "http://localhost:5173");
}

router.get("/esqueci/disponivel", (_req, res) => res.json({ disponivel: emailConfigurado() }));

// Sempre responde igual (não revela quais e-mails existem). Usuário inativo não recebe.
router.post("/esqueci", limiteRedefinicao, async (req, res) => {
  const email = normalizarEmail(req.body?.email);
  if (!email) return res.status(400).json({ erro: "Informe o e-mail." });
  if (!emailConfigurado()) return res.status(503).json({ erro: "O envio de e-mail não está configurado. Peça a um administrador para redefinir sua senha." });
  try {
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (usuario?.ativo) {
      const link = `${enderecoDoPainel(req)}/redefinir-senha/${tokenSenha(usuario)}`;
      await enviarEmail({
        para: usuario.email,
        assunto: "Redefinir senha — Painel Super Estágios",
        texto: [
          `Olá, ${usuario.nome}.`,
          "Para criar uma nova senha, abra o link abaixo (vale por 1 hora e só pode ser usado uma vez):",
          link,
          "Se você não pediu, ignore este e-mail: sua senha continua a mesma.",
        ].join("\n\n"),
      });
    }
    return res.json({ mensagem: "Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha." });
  } catch (error) {
    console.error("Erro ao enviar redefinição de senha:", error);
    return res.status(500).json({ erro: "Não foi possível enviar o e-mail agora. Tente novamente." });
  }
});

router.post("/redefinir", limiteRedefinicao, async (req, res) => {
  const { token, senha } = req.body ?? {};
  if (typeof senha !== "string" || senha.length < TAMANHO_MINIMO_SENHA) {
    return res.status(400).json({ erro: `A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.` });
  }
  const dados = lerTokenSenha(token);
  const invalido = () => res.status(400).json({ erro: "Link inválido ou vencido. Peça um novo." });
  if (!dados) return invalido();
  try {
    const usuario = await prisma.usuario.findUnique({ where: { id: dados.id } });
    // O token guarda um pedaço do hash antigo: depois de trocar a senha, o mesmo link não vale de novo.
    if (!usuario?.ativo || pedacoDoHash(usuario.senha_hash) !== dados.h) return invalido();
    await prisma.usuario.update({ where: { id: usuario.id }, data: { senha_hash: await gerarHash(senha) } });
    return res.json({ mensagem: "Senha alterada. Entre com a nova senha." });
  } catch (error) {
    console.error("Erro ao redefinir senha:", error);
    return res.status(500).json({ erro: "Não foi possível alterar a senha." });
  }
});

module.exports = router;
