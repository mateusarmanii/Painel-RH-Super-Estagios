// Notificações no celular pelo Telegram (opcional). Liga só com TELEGRAM_BOT_TOKEN (criado no @BotFather); cada
// usuário conecta o próprio Telegram em Configurações → Celular (link t.me/<bot>?start=<código>, vale 15 min).
//
// Dois laços enquanto a API está no ar:
//   - leitura (getUpdates, long polling): recebe o /start <código> que conecta o usuário e o /parar que desconecta.
//     Não usa webhook, então funciona também no localhost. Só uma instância da API pode ler por vez.
//   - envio (a cada TELEGRAM_INTERVALO_SEG, padrão 120): monta os avisos do sino (src/notificacoes.js) e manda a
//     cada usuário conectado só os que ainda não recebeu (tabela NotificacaoEnviada; limpa depois de 90 dias).
// Entre 22h e 7h (São Paulo) as mensagens chegam sem som.
//
// Testes: TELEGRAM_API_URL troca o endereço da API do Telegram (ignorado em produção).
const crypto = require("crypto");
const prisma = require("./prisma");
const { montarNotificacoes } = require("./notificacoes");

const producao = () => process.env.NODE_ENV === "production";
const token = () => (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
const telegramConfigurado = () => Boolean(token());
const baseApi = () => ((!producao() && process.env.TELEGRAM_API_URL) || "https://api.telegram.org").replace(/\/+$/, "");

const CODIGO_MINUTOS = 15;
const MAX_POR_RODADA = 15; // por usuário; o resto vira um resumo "+N avisos"
const GUARDAR_DIAS = 90;
const DIA_MS = 24 * 60 * 60 * 1000;

function intervaloMs() {
  const segundos = Number(process.env.TELEGRAM_INTERVALO_SEG) || 120;
  return Math.max(producao() ? 30 : 1, segundos) * 1000;
}

class ErroTelegram extends Error {
  constructor(metodo, status, descricao) {
    super(`Telegram ${metodo}: ${descricao ?? status}`);
    this.status = status;
  }
}

async function chamar(metodo, corpo = {}, { signal } = {}) {
  const res = await fetch(`${baseApi()}/bot${token()}/${metodo}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
    signal,
  });
  const dados = await res.json().catch(() => null);
  if (!res.ok || !dados?.ok) throw new ErroTelegram(metodo, res.status, dados?.description);
  return dados.result;
}

let nomeDoBot = null;
async function usuarioDoBot() {
  if (!nomeDoBot) nomeDoBot = (await chamar("getMe")).username;
  return nomeDoBot;
}

const escapar = (texto) => String(texto ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Endereço do painel para o link "Abrir no painel" (o primeiro do FRONTEND_URL). O Telegram não aceita link para
// localhost, então fora do ar público a mensagem vai sem link.
function enderecoPainel() {
  const primeiro = (process.env.FRONTEND_URL ?? "").split(",")[0].trim().replace(/\/+$/, "");
  try {
    const url = new URL(primeiro);
    return /^(localhost|127\.0\.0\.1)$/.test(url.hostname) ? null : primeiro;
  } catch {
    return null;
  }
}

const horaSp = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" });
const silencioso = (agora = new Date()) => {
  const h = Number(horaSp.format(agora));
  return h >= 22 || h < 7;
};

const marcador = { alta: "🔴", media: "🟠", info: "🔵" };

function textoDoAviso(item) {
  const painel = enderecoPainel();
  return [
    `${marcador[item.gravidade] ?? "🔔"} <b>${escapar(item.titulo)}</b>`,
    item.descricao && escapar(item.descricao),
    painel && item.link && `<a href="${escapar(painel + item.link)}">Abrir no painel</a>`,
  ].filter(Boolean).join("\n");
}

// Identidade do aviso para não reenviar: a chave (ou o id) mais a gravidade. Se o aviso piorar (ex.: prazo da vaga
// vence), ele chega de novo.
const chaveDoAviso = (item) => `${item.chave ?? item.id}:${item.gravidade}`.slice(0, 300);

function enviarMensagem(chatId, texto, { agora } = {}) {
  return chamar("sendMessage", {
    chat_id: chatId,
    text: texto,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    disable_notification: silencioso(agora),
  });
}

// Bloqueou o bot ou apagou a conversa: desconecta (o usuário conecta de novo pelo painel quando quiser).
async function desconectarSeBloqueado(usuario, error) {
  if (error instanceof ErroTelegram && (error.status === 403 || (error.status === 400 && /chat not found/i.test(error.message)))) {
    await prisma.usuario.updateMany({ where: { id: usuario.id, telegram_chat_id: usuario.telegram_chat_id }, data: { telegram_chat_id: null, telegram_conectado_em: null } });
    console.warn(`Telegram: ${usuario.nome} bloqueou o bot; desconectado.`);
    return true;
  }
  return false;
}

// ---------- Conexão pelo /start <código> ----------

async function novoCodigo(usuarioId) {
  const codigo = crypto.randomBytes(18).toString("base64url");
  const expira = new Date(Date.now() + CODIGO_MINUTOS * 60 * 1000);
  await prisma.usuario.update({ where: { id: usuarioId }, data: { telegram_codigo: codigo, telegram_codigo_expira: expira } });
  return { link: `https://t.me/${await usuarioDoBot()}?start=${codigo}`, expira_em: expira };
}

async function marcarComoEnviados(usuarioId, itens) {
  if (!itens.length) return;
  await prisma.notificacaoEnviada.createMany({ data: itens.map((item) => ({ usuario_id: usuarioId, chave: chaveDoAviso(item) })), skipDuplicates: true });
}

async function conectar(chatId, codigo) {
  const usuario = /^[A-Za-z0-9_-]{20,40}$/.test(codigo ?? "")
    ? await prisma.usuario.findFirst({ where: { telegram_codigo: codigo, telegram_codigo_expira: { gt: new Date() }, ativo: true }, select: { id: true, nome: true } })
    : null;
  if (!usuario) {
    await enviarMensagem(chatId, "Para receber os avisos do painel Super Estágios, abra <b>Configurações → Celular</b> no painel e toque em <b>Conectar Telegram</b>. O link vale 15 minutos.");
    return;
  }
  // Um Telegram fica ligado a um usuário só: se já estava em outro, passa para este.
  await prisma.$transaction([
    prisma.usuario.updateMany({ where: { telegram_chat_id: chatId, NOT: { id: usuario.id } }, data: { telegram_chat_id: null, telegram_conectado_em: null } }),
    prisma.usuario.update({ where: { id: usuario.id }, data: { telegram_chat_id: chatId, telegram_conectado_em: new Date(), telegram_codigo: null, telegram_codigo_expira: null } }),
    prisma.notificacaoEnviada.deleteMany({ where: { usuario_id: usuario.id } }),
  ]);
  // O que já está no sino agora não é mandado um por um: vira um resumo, e daqui para a frente chega cada aviso novo.
  const abertos = await montarNotificacoes();
  await marcarComoEnviados(usuario.id, abertos);
  const urgentes = abertos.filter((item) => item.gravidade === "alta").length;
  const painel = enderecoPainel();
  await enviarMensagem(chatId, [
    `✅ Pronto, ${escapar(usuario.nome.split(" ")[0])}! Este Telegram vai receber os avisos do painel Super Estágios.`,
    abertos.length
      ? `Agora há ${abertos.length} ${abertos.length === 1 ? "aviso aberto" : "avisos abertos"} no sino${urgentes ? ` (${urgentes} ${urgentes === 1 ? "urgente" : "urgentes"})` : ""}. A partir de agora, cada aviso novo chega aqui.`
      : "Não há avisos abertos agora. Cada aviso novo chega aqui.",
    painel && `<a href="${escapar(painel)}">Abrir o painel</a>`,
    "Para parar, envie /parar ou desconecte em Configurações.",
  ].filter(Boolean).join("\n\n"));
}

async function desconectarChat(chatId) {
  const { count } = await prisma.usuario.updateMany({ where: { telegram_chat_id: chatId }, data: { telegram_chat_id: null, telegram_conectado_em: null } });
  await enviarMensagem(chatId, count ? "Desconectado. Você não vai mais receber avisos do painel aqui." : "Este Telegram não está conectado ao painel.");
}

async function tratarMensagem(mensagem) {
  if (mensagem?.chat?.type !== "private" || typeof mensagem.text !== "string") return;
  const chatId = String(mensagem.chat.id);
  const [comando, argumento] = mensagem.text.trim().split(/\s+/);
  if (comando === "/start") return conectar(chatId, argumento);
  if (comando === "/parar" || comando === "/stop") return desconectarChat(chatId);
  const conectado = await prisma.usuario.count({ where: { telegram_chat_id: chatId } });
  return enviarMensagem(chatId, conectado
    ? "Este bot só envia os avisos do painel; as respostas aqui não são lidas. Para parar, envie /parar."
    : "Para receber os avisos do painel Super Estágios, abra Configurações → Celular no painel e toque em Conectar Telegram.");
}

// ---------- Envio dos avisos ----------

async function enviarNovos(agora = new Date()) {
  const usuarios = await prisma.usuario.findMany({ where: { telegram_chat_id: { not: null }, ativo: true }, select: { id: true, nome: true, telegram_chat_id: true } });
  if (!usuarios.length) return { enviados: 0 };
  const itens = await montarNotificacoes(agora);
  let enviados = 0;
  for (const usuario of usuarios) {
    const jaEnviados = new Set((await prisma.notificacaoEnviada.findMany({
      where: { usuario_id: usuario.id, chave: { in: itens.map(chaveDoAviso) } },
      select: { chave: true },
    })).map((linha) => linha.chave));
    const novos = itens.filter((item) => !jaEnviados.has(chaveDoAviso(item)));
    if (!novos.length) continue;
    try {
      const lote = novos.slice(0, MAX_POR_RODADA);
      for (const item of lote) {
        await enviarMensagem(usuario.telegram_chat_id, textoDoAviso(item), { agora });
        await marcarComoEnviados(usuario.id, [item]);
        enviados++;
      }
      const resto = novos.slice(MAX_POR_RODADA);
      if (resto.length) {
        const painel = enderecoPainel();
        await enviarMensagem(usuario.telegram_chat_id, `🔔 E mais ${resto.length} ${resto.length === 1 ? "aviso novo" : "avisos novos"} no sino.${painel ? ` <a href="${escapar(painel)}">Abrir o painel</a>` : ""}`, { agora });
        await marcarComoEnviados(usuario.id, resto);
        enviados++;
      }
    } catch (error) {
      if (!(await desconectarSeBloqueado(usuario, error))) console.error(`Telegram: erro ao enviar para ${usuario.nome}:`, error.message);
    }
  }
  await prisma.notificacaoEnviada.deleteMany({ where: { enviada_em: { lt: new Date(agora.getTime() - GUARDAR_DIAS * DIA_MS) } } });
  return { enviados };
}

async function enviarTeste(usuarioId) {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { id: true, nome: true, telegram_chat_id: true } });
  if (!usuario?.telegram_chat_id) return false;
  try {
    await enviarMensagem(usuario.telegram_chat_id, "🔔 <b>Teste do painel Super Estágios</b>\nSe você está lendo isto, os avisos vão chegar aqui.");
    return true;
  } catch (error) {
    if (await desconectarSeBloqueado(usuario, error)) return false;
    throw error;
  }
}

// ---------- Laços ----------

let ligado = false;
let controle = null;
let esperaLeitura = null;
let proximoEnvio = null;

async function lacoLeitura() {
  let offset = 0;
  let espera = 1000;
  while (ligado) {
    try {
      controle = new AbortController();
      const atualizacoes = await chamar("getUpdates", { offset, timeout: 25, allowed_updates: ["message"] }, { signal: controle.signal });
      espera = 1000;
      for (const atualizacao of atualizacoes) {
        offset = atualizacao.update_id + 1;
        await tratarMensagem(atualizacao.message).catch((error) => console.error("Telegram: erro ao tratar mensagem:", error.message));
      }
    } catch (error) {
      if (!ligado) break;
      // 409: outra instância lendo o mesmo bot, ou um webhook configurado nele.
      if (error.status === 409) console.warn("Telegram: outra instância (ou um webhook) está lendo este bot; tentando de novo em 60 s.");
      else if (error.status === 401 || error.status === 404) console.error("Telegram: TELEGRAM_BOT_TOKEN inválido.");
      else console.error("Telegram: erro na leitura:", error.message);
      espera = error.status === 409 || error.status === 401 || error.status === 404 ? 60000 : Math.min(espera * 2, 60000);
      await new Promise((resolve) => { esperaLeitura = setTimeout(resolve, espera); });
    }
  }
}

async function rodadaDeEnvio() {
  try {
    await enviarNovos();
  } catch (error) {
    console.error("Telegram: erro ao enviar avisos:", error.message);
  }
  if (ligado) proximoEnvio = setTimeout(rodadaDeEnvio, intervaloMs());
}

function iniciarTelegram() {
  if (!telegramConfigurado() || ligado) return;
  ligado = true;
  lacoLeitura();
  proximoEnvio = setTimeout(rodadaDeEnvio, Math.min(5000, intervaloMs()));
  console.log(`Telegram: avisos ligados (a cada ${intervaloMs() / 1000} s).`);
}

function pararTelegram() {
  ligado = false;
  controle?.abort();
  clearTimeout(esperaLeitura);
  clearTimeout(proximoEnvio);
}

module.exports = {
  telegramConfigurado,
  usuarioDoBot,
  novoCodigo,
  enviarTeste,
  enviarNovos,
  iniciarTelegram,
  pararTelegram,
  textoDoAviso,
  chaveDoAviso,
  ErroTelegram,
};
