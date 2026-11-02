// Testes das notificações pelo Telegram (src/telegram.js e /telegram). Nada sai para o Telegram de verdade:
// o script sobe um "Telegram falso" na porta 3499 (getMe, getUpdates, sendMessage) e a API na porta 3404 apontando
// para ele (TELEGRAM_API_URL), conferindo a cada 1 s.
// ATENÇÃO: grava e apaga dados no banco do DATABASE_URL (só os registros que o próprio teste cria).
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const BACKEND = path.resolve(__dirname, "..");
process.chdir(BACKEND);
require("dotenv").config();
const prisma = require("../src/prisma");
const { textoDoAviso, chaveDoAviso } = require("../src/telegram");
const { criarTeste } = require("./lib/teste");

const PORT = 3404;
const PORTA_FALSA = 3499;
const PAINEL = "https://painel.exemplo.com.br";
const teste = criarTeste(PORT);
const { req, checar, checarStatus, esperarServidor } = teste;
const ids = { estudantes: [] };
const hoje = new Date().toISOString().slice(0, 10);
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- Telegram falso ----------
const falso = { atualizacoes: [], proximoId: 1, enviadas: [], bloqueados: new Set() };
const mensagemDe = (chatId, text) => falso.atualizacoes.push({ update_id: falso.proximoId++, message: { chat: { id: chatId, type: "private" }, text } });
const servidorFalso = http.createServer((pedido, resposta) => {
  let corpo = "";
  pedido.on("data", (parte) => { corpo += parte; });
  pedido.on("end", async () => {
    const dados = corpo ? JSON.parse(corpo) : {};
    const metodo = pedido.url.split("/").pop();
    const responder = (status, json) => { resposta.writeHead(status, { "Content-Type": "application/json" }); resposta.end(JSON.stringify(json)); };
    if (!pedido.url.startsWith("/botFALSO-123/")) return responder(401, { ok: false, description: "Unauthorized" });
    if (metodo === "getMe") return responder(200, { ok: true, result: { username: "painel_teste_bot" } });
    if (metodo === "getUpdates") {
      for (let i = 0; i < 10 && !falso.atualizacoes.some((a) => a.update_id >= (dados.offset ?? 0)); i++) await esperar(100);
      return responder(200, { ok: true, result: falso.atualizacoes.filter((a) => a.update_id >= (dados.offset ?? 0)) });
    }
    if (metodo === "sendMessage") {
      if (falso.bloqueados.has(String(dados.chat_id))) return responder(403, { ok: false, description: "Forbidden: bot was blocked by the user" });
      falso.enviadas.push(dados);
      return responder(200, { ok: true, result: { message_id: falso.enviadas.length } });
    }
    return responder(404, { ok: false, description: "Not Found" });
  });
});

async function esperarAte(condicao, ms = 8000) {
  for (let t = 0; t < ms; t += 200) {
    const valor = await condicao();
    if (valor) return valor;
    await esperar(200);
  }
  return null;
}
const enviadasPara = (chat) => falso.enviadas.filter((m) => String(m.chat_id) === String(chat));

async function main() {
  // Funções puras: chave anti-repetição e texto da mensagem.
  const aviso = { id: "estagio-1-fim_proximo-Contrato termina em 5 dias", chave: "estagio-1-fim_proximo", gravidade: "media", titulo: "Contrato <termina> em 5 dias", descricao: "Ana & Cia", link: "/contratacoes" };
  checar("Chave do estágio ignora a contagem de dias", chaveDoAviso(aviso) === chaveDoAviso({ ...aviso, id: "estagio-1-fim_proximo-Contrato termina em 4 dias" }));
  checar("Aviso que piora (média → alta) tem chave nova", chaveDoAviso(aviso) !== chaveDoAviso({ ...aviso, gravidade: "alta" }));
  checar("Sem chave, usa o id", chaveDoAviso({ id: "parecer-9", gravidade: "info" }) === "parecer-9:info");
  process.env.FRONTEND_URL = PAINEL;
  let texto = textoDoAviso(aviso);
  checar("Texto escapa HTML", texto.includes("Contrato &lt;termina&gt; em 5 dias") && texto.includes("Ana &amp; Cia"), texto);
  checar("Texto tem link para o painel", texto.includes(`<a href="${PAINEL}/contratacoes">Abrir no painel</a>`));
  process.env.FRONTEND_URL = "http://localhost:5173";
  checar("Sem link quando o painel é localhost", !textoDoAviso(aviso).includes("<a "));

  await new Promise((resolve) => servidorFalso.listen(PORTA_FALSA, resolve));
  const server = spawn(process.execPath, ["server.js"], {
    env: { ...process.env, PORT, NODE_ENV: "test", FRONTEND_URL: PAINEL, TELEGRAM_BOT_TOKEN: "FALSO-123", TELEGRAM_API_URL: `http://localhost:${PORTA_FALSA}`, TELEGRAM_INTERVALO_SEG: "1" },
    stdio: ["ignore", "ignore", "inherit"],
  });

  try {
    await esperarServidor();
    let r = await req("GET", "/telegram", undefined, { token: null });
    checarStatus("GET /telegram sem login → 401", r, 401);
    r = await req("GET", "/telegram");
    checarStatus("GET /telegram", r, 200);
    checar("Configurado, ainda não conectado", r.body.configurado === true && r.body.conectado === false && r.body.bot === "painel_teste_bot", JSON.stringify(r.body));
    checarStatus("Teste sem conectar → 409", await req("POST", "/telegram/teste"), 409);

    r = await req("POST", "/telegram/conectar");
    checarStatus("Gerar link de conexão", r, 200);
    const codigo = r.body.link?.match(/^https:\/\/t\.me\/painel_teste_bot\?start=([A-Za-z0-9_-]+)$/)?.[1];
    checar("Link t.me com código", Boolean(codigo), r.body.link);
    checar("Código vence em ~15 min", Math.abs(new Date(r.body.expira_em) - Date.now() - 15 * 60000) < 60000);

    mensagemDe(777001, "/start codigo-que-nao-existe-123456");
    checar("Código errado recebe instruções", Boolean(await esperarAte(() => enviadasPara(777001).find((m) => m.text.includes("Configurações")))));
    checar("Código errado não conecta", (await req("GET", "/telegram")).body.conectado === false);

    mensagemDe(777001, `/start ${codigo}`);
    const conectado = await esperarAte(async () => (await req("GET", "/telegram")).body.conectado);
    checar("/start com o código conecta", Boolean(conectado));
    const boasVindas = await esperarAte(() => enviadasPara(777001).find((m) => m.text.includes("Pronto")));
    checar("Mensagem de boas-vindas com resumo", Boolean(boasVindas) && /avisos? abertos?|Não há avisos/.test(boasVindas.text), boasVindas?.text);
    const usuario = await prisma.usuario.findUnique({ where: { id: teste.usuario.id }, select: { telegram_chat_id: true, telegram_codigo: true } });
    checar("Chat guardado e código apagado", usuario.telegram_chat_id === "777001" && usuario.telegram_codigo === null);
    const linhaBase = await prisma.notificacaoEnviada.count({ where: { usuario_id: teste.usuario.id } });
    checar("Avisos já abertos ficam como enviados (não chegam um por um)", linhaBase === (await req("GET", "/notificacoes")).body.length, `${linhaBase}`);

    mensagemDe(777002, `/start ${codigo}`);
    await esperarAte(() => enviadasPara(777002).length);
    checar("Código vale uma vez só", (await prisma.usuario.findUnique({ where: { id: teste.usuario.id } })).telegram_chat_id === "777001");

    // Aviso novo: retorno de contato combinado para hoje.
    r = await req("POST", "/candidatos", { nome_completo: "[TESTE] Telegram Ana", telefone: teste.telefone(), curso: "Administração" });
    if (r.body?.id) ids.estudantes.push(r.body.id);
    const estudanteId = r.body?.id;
    const antes = enviadasPara(777001).length;
    checarStatus("Registrar contato com retorno hoje", await req("POST", "/contatos", { estudante_id: estudanteId, tipo: "LIGACAO", texto: "Ligar <amanhã> & confirmar", proximo_contato: hoje }), 201);
    const avisoNovo = await esperarAte(() => enviadasPara(777001).slice(antes).find((m) => m.text.includes("[TESTE] Telegram Ana")));
    checar("Aviso novo chega no Telegram", Boolean(avisoNovo));
    checar("Mensagem em HTML escapado", avisoNovo?.parse_mode === "HTML" && avisoNovo.text.includes("Ligar &lt;amanhã&gt; &amp; confirmar"), avisoNovo?.text);
    checar("Mensagem com link do painel", avisoNovo?.text.includes(`<a href="${PAINEL}/estudantes/${estudanteId}">Abrir no painel</a>`));
    checar("Sem prévia de link", avisoNovo?.link_preview_options?.is_disabled === true);
    await esperar(2500);
    checar("Não repete o mesmo aviso", enviadasPara(777001).filter((m) => m.text.includes("[TESTE] Telegram Ana")).length === 1);

    const antesTeste = enviadasPara(777001).length;
    checarStatus("Enviar teste", await req("POST", "/telegram/teste"), 200);
    checar("Mensagem de teste chegou", enviadasPara(777001).slice(antesTeste).some((m) => m.text.includes("Teste do painel")));

    mensagemDe(777001, "oi");
    checar("Mensagem solta recebe explicação", Boolean(await esperarAte(() => enviadasPara(777001).find((m) => m.text.includes("não são lidas")))));

    // Bloqueou o bot: o próximo envio falha com 403 e o usuário é desconectado.
    falso.bloqueados.add("777001");
    await req("POST", "/contatos", { estudante_id: estudanteId, tipo: "NOTA", texto: "Outro retorno", proximo_contato: hoje });
    checar("Bot bloqueado → desconecta sozinho", Boolean(await esperarAte(async () => !(await req("GET", "/telegram")).body.conectado)));
    falso.bloqueados.clear();

    // Reconecta e sai pelo /parar.
    r = await req("POST", "/telegram/conectar");
    mensagemDe(777003, `/start ${new URL(r.body.link).searchParams.get("start")}`);
    checar("Reconectar com código novo", Boolean(await esperarAte(async () => (await req("GET", "/telegram")).body.conectado)));
    mensagemDe(777003, "/parar");
    checar("/parar desconecta", Boolean(await esperarAte(async () => !(await req("GET", "/telegram")).body.conectado)));
    checar("/parar confirma", Boolean(await esperarAte(() => enviadasPara(777003).find((m) => m.text.startsWith("Desconectado")))));

    r = await req("POST", "/telegram/conectar");
    mensagemDe(777004, `/start ${new URL(r.body.link).searchParams.get("start")}`);
    await esperarAte(async () => (await req("GET", "/telegram")).body.conectado);
    checarStatus("Desconectar pelo painel", await req("DELETE", "/telegram"), 204);
    checar("Desconectado e histórico limpo", (await req("GET", "/telegram")).body.conectado === false
      && (await prisma.notificacaoEnviada.count({ where: { usuario_id: teste.usuario.id } })) === 0);
    checar("Silencioso entre 22h e 7h", falso.enviadas.every((m) => typeof m.disable_notification === "boolean"));
  } finally {
    await prisma.contato.deleteMany({ where: { estudante_id: { in: ids.estudantes } } }).catch(() => {});
    await prisma.aplicacao.deleteMany({ where: { estudante_id: { in: ids.estudantes } } }).catch(() => {});
    await prisma.estudante.deleteMany({ where: { id: { in: ids.estudantes } } }).catch(() => {});
    await teste.removerUsuario();
    const sobras = await prisma.estudante.count({ where: { nome_completo: { startsWith: "[TESTE]" } } })
      + await prisma.notificacaoEnviada.count({ where: { usuario: { email: { endsWith: "@teste.local" } } } });
    console.log(`\nRegistros [TESTE] restantes: ${sobras}`);
    if (sobras) teste.falhas++;
    await prisma.$disconnect();
    server.kill();
    servidorFalso.close();
    servidorFalso.closeAllConnections();
  }
  console.log(teste.falhas ? `\n${teste.falhas} FALHA(S)` : "\nTodos os testes passaram.");
  process.exitCode = teste.falhas ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
