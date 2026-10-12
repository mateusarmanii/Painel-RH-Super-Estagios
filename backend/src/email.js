// Envio de e-mail (lembretes com convite .ics) por SMTP, configurado só por variáveis de ambiente:
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e EMAIL_REMETENTE. Sem todas elas, o envio fica desligado.
//
// Testes: EMAIL_TRANSPORTE_FALSO=<arquivo> faz o e-mail ser montado (MIME completo) mas NÃO enviado; cada mensagem
// vira uma linha JSON nesse arquivo. Ignorado em produção (NODE_ENV=production).
const fs = require("fs");
const nodemailer = require("nodemailer");

const variaveis = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "EMAIL_REMETENTE"];

function configuracao() {
  const valores = Object.fromEntries(variaveis.map((nome) => [nome, (process.env[nome] ?? "").trim()]));
  const porta = Number(valores.SMTP_PORT);
  if (variaveis.some((nome) => !valores[nome]) || !Number.isInteger(porta) || porta <= 0) return null;
  // "Nome <email@x.com>" ou só "email@x.com".
  const remetente = valores.EMAIL_REMETENTE;
  const email = (remetente.match(/<([^>]+)>/)?.[1] ?? remetente).trim();
  const nome = remetente.includes("<") ? remetente.slice(0, remetente.indexOf("<")).trim().replace(/^"|"$/g, "") : "";
  return { host: valores.SMTP_HOST, porta, usuario: valores.SMTP_USER, senha: valores.SMTP_PASS, remetente, email, nome };
}

const arquivoFalso = () => (process.env.NODE_ENV === "production" ? "" : (process.env.EMAIL_TRANSPORTE_FALSO ?? "").trim());

const emailConfigurado = () => configuracao() !== null;

// Organizador do convite (o próprio remetente).
function organizador() {
  const config = configuracao();
  return config && { email: config.email, nome: config.nome || "Super Estágios" };
}

let transporte = null;
let chaveTransporte = "";

function obterTransporte(config) {
  const falso = arquivoFalso();
  const chave = falso ? `falso:${falso}` : `${config.host}:${config.porta}:${config.usuario}`;
  if (transporte && chave === chaveTransporte) return transporte;
  transporte = falso
    ? nodemailer.createTransport({ streamTransport: true, buffer: true })
    : nodemailer.createTransport({
      host: config.host,
      port: config.porta,
      // 465 = TLS direto; 587 = STARTTLS (exigido).
      secure: config.porta === 465,
      requireTLS: config.porta !== 465,
      auth: { user: config.usuario, pass: config.senha },
    });
  chaveTransporte = chave;
  return transporte;
}

// Envia um e-mail com texto e convite de calendário (como alternativa text/calendar e como anexo .ics).
// metodo: "REQUEST" ou "CANCEL". Lança erro se o envio não estiver configurado ou falhar.
async function enviarConvite({ para, assunto, texto, ics, metodo }) {
  const config = configuracao();
  if (!config) throw new Error("Envio de e-mail não configurado.");
  const mensagem = {
    from: config.remetente,
    to: para,
    // Sem quebras de linha no assunto (o título vem do usuário).
    subject: assunto.replace(/[\r\n]+/g, " "),
    text: texto,
    icalEvent: { method: metodo, filename: "convite.ics", content: ics },
    attachments: [{ filename: "convite.ics", content: ics, contentType: `application/ics; method=${metodo}` }],
  };

  const info = await obterTransporte(config).sendMail(mensagem);
  const falso = arquivoFalso();
  if (falso) {
    fs.appendFileSync(falso, `${JSON.stringify({ para, assunto: mensagem.subject, texto, metodo, ics, mime: info.message.toString() })}\n`);
  }
  return info;
}

module.exports = { emailConfigurado, organizador, enviarConvite };
