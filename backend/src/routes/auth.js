const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { conferirLogin, gerarToken, usuarioPublico, normalizarEmail, exigirLogin } = require("../auth");

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

module.exports = router;
