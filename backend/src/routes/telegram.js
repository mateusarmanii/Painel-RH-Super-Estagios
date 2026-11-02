// Notificações no celular pelo Telegram, do próprio usuário logado (cada um conecta o seu). Ver src/telegram.js.
//   GET    /telegram          → { configurado, conectado, conectado_em, bot }
//   POST   /telegram/conectar → { link, expira_em }  (abrir o link no celular e tocar em "Iniciar")
//   POST   /telegram/teste    → envia uma mensagem de teste
//   DELETE /telegram          → desconecta
const express = require("express");
const prisma = require("../prisma");
const { telegramConfigurado, usuarioDoBot, novoCodigo, enviarTeste } = require("../telegram");

const router = express.Router();

const exigirConfiguracao = (_req, res, next) =>
  telegramConfigurado() ? next() : res.status(503).json({ erro: "O Telegram não está configurado no servidor." });

router.get("/", async (req, res) => {
  try {
    const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id }, select: { telegram_chat_id: true, telegram_conectado_em: true } });
    const configurado = telegramConfigurado();
    return res.json({
      configurado,
      conectado: Boolean(usuario?.telegram_chat_id),
      conectado_em: usuario?.telegram_conectado_em ?? null,
      bot: configurado ? await usuarioDoBot().catch(() => null) : null,
    });
  } catch (error) {
    console.error("Erro ao ler o Telegram do usuário:", error);
    return res.status(500).json({ erro: "Não foi possível carregar." });
  }
});

router.post("/conectar", exigirConfiguracao, async (req, res) => {
  try {
    return res.json(await novoCodigo(req.usuario.id));
  } catch (error) {
    console.error("Erro ao gerar o link do Telegram:", error);
    return res.status(502).json({ erro: "Não foi possível falar com o Telegram. Confira o TELEGRAM_BOT_TOKEN." });
  }
});

router.post("/teste", exigirConfiguracao, async (req, res) => {
  try {
    if (!(await enviarTeste(req.usuario.id))) return res.status(409).json({ erro: "Seu Telegram não está conectado." });
    return res.json({ ok: true });
  } catch (error) {
    console.error("Erro ao enviar teste pelo Telegram:", error);
    return res.status(502).json({ erro: "O Telegram recusou a mensagem. Tente de novo em instantes." });
  }
});

router.delete("/", async (req, res) => {
  try {
    await prisma.usuario.update({
      where: { id: req.usuario.id },
      data: { telegram_chat_id: null, telegram_conectado_em: null, telegram_codigo: null, telegram_codigo_expira: null },
    });
    await prisma.notificacaoEnviada.deleteMany({ where: { usuario_id: req.usuario.id } });
    return res.status(204).end();
  } catch (error) {
    console.error("Erro ao desconectar o Telegram:", error);
    return res.status(500).json({ erro: "Não foi possível desconectar." });
  }
});

module.exports = router;
