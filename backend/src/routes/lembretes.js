// Lembretes por e-mail com convite de calendário, para eventos ({ evento_id }) e entrevistas ({ entrevista_id }).
// Exigem login (server.js); no máximo MAX_EMAILS_POR_ENVIO e-mails por envio e LIMITE_POR_HORA por usuário.
const express = require("express");
const { emailConfigurado } = require("../email");
const {
  ALARMES_PADRAO,
  ALARMES_PERMITIDOS,
  LIMITE_POR_HORA,
  MAX_EMAILS_POR_ENVIO,
  ErroLembrete,
  carregarAlvo,
  cancelarLembrete,
  criarLembrete,
  lerAlarmes,
  lerEmails,
  reenviarLembrete,
  situacaoPublica,
} = require("../lembretes");

const router = express.Router();

function tratarErro(res, error, mensagem) {
  if (error instanceof ErroLembrete) return res.status(error.status).json({ erro: error.message });
  console.error(`${mensagem}:`, error);
  return res.status(500).json({ erro: `${mensagem}.` });
}

const exigirConfiguracao = (_req, res, next) =>
  emailConfigurado() ? next() : res.status(503).json({ erro: "Envio de e-mail não configurado." });

// O botão do Calendário fica desabilitado quando o SMTP não está configurado.
router.get("/config", (_req, res) => {
  res.json({
    configurado: emailConfigurado(),
    max_emails_por_envio: MAX_EMAILS_POR_ENVIO,
    limite_por_hora: LIMITE_POR_HORA,
    alarmes_padrao: ALARMES_PADRAO,
    alarmes_permitidos: [...ALARMES_PERMITIDOS],
  });
});

// ?evento_id= ou ?entrevista_id=: envios feitos e situação do convite.
router.get("/", async (req, res) => {
  try {
    const alvo = await carregarAlvo(req.query);
    return res.json(await situacaoPublica(alvo));
  } catch (error) {
    return tratarErro(res, error, "Não foi possível carregar os lembretes");
  }
});

// { evento_id | entrevista_id, emails: [...], alarmes?: [minutos] }
router.post("/", exigirConfiguracao, async (req, res) => {
  try {
    const emails = lerEmails(req.body?.emails);
    const alarmes = lerAlarmes(req.body?.alarmes);
    const alvo = await carregarAlvo(req.body);
    const enviados = await criarLembrete(alvo, { emails, alarmes, usuario: req.usuario });
    return res.status(201).json({ enviados, ...(await situacaoPublica(alvo)) });
  } catch (error) {
    return tratarErro(res, error, "Não foi possível enviar o lembrete");
  }
});

// Convite atualizado (mesmo UID, SEQUENCE maior) depois de mudar data ou hora.
router.post("/reenviar", exigirConfiguracao, async (req, res) => {
  try {
    const alvo = await carregarAlvo(req.body);
    const enviados = await reenviarLembrete(alvo, { usuario: req.usuario });
    return res.json({ enviados, ...(await situacaoPublica(alvo)) });
  } catch (error) {
    return tratarErro(res, error, "Não foi possível reenviar o convite");
  }
});

// Cancelamento (METHOD:CANCEL) para quem recebeu o convite (ex.: entrevista cancelada).
router.post("/cancelar", exigirConfiguracao, async (req, res) => {
  try {
    const alvo = await carregarAlvo(req.body);
    const enviados = await cancelarLembrete(alvo, { usuario: req.usuario });
    return res.json({ enviados, ...(await situacaoPublica(alvo)) });
  } catch (error) {
    return tratarErro(res, error, "Não foi possível enviar o cancelamento");
  }
});

module.exports = router;
