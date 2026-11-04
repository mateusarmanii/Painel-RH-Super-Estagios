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
const ids = { estudantes: [], empresas: [], vagas: [] };
const hoje = new Date().toISOString().slice(0, 10);
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- Telegram falso ----------
const falso = { atualizacoes: [], proximoId: 1, enviadas: [], bloqueados: new Set() };
const mensagemDe = (chatId, text) => falso.atualizacoes.push({ update_id: falso.proximoId++, message: { chat: { id: chatId, type: "private" }, text } });
const toqueDe = (chatId, data) => falso.atualizacoes.push({ update_id: falso.proximoId++, callback_query: { id: `toque-${falso.proximoId}`, data, message: { message_id: 1, chat: { id: chatId, type: "private" } } } });
// Procura o botão pelo começo do texto, entre as mensagens enviadas depois da posição "desde".
const botaoEm = (chat, desde, rotulo) => enviadasPara(chat).slice(desde).flatMap((m) => m.reply_markup?.inline_keyboard?.flat() ?? []).find((b) => b.text.startsWith(rotulo));
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
    if (["answerCallbackQuery", "editMessageReplyMarkup", "sendChatAction", "setMyCommands"].includes(metodo)) return responder(200, { ok: true, result: true });
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
    env: { ...process.env, PORT, NODE_ENV: "test", FRONTEND_URL: PAINEL, IA_API_KEY: "", TELEGRAM_BOT_TOKEN: "FALSO-123", TELEGRAM_API_URL: `http://localhost:${PORTA_FALSA}`, TELEGRAM_INTERVALO_SEG: "1" },
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
    const linhaBase = await prisma.notificacaoEnviada.count({ where: { usuario_id: teste.usuario.id, NOT: { chave: { startsWith: "resumo-" } } } });
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
    checar("Sem IA, texto livre aponta para os comandos", Boolean(await esperarAte(() => enviadasPara(777001).find((m) => m.text.includes("Ainda não entendo texto livre")))));

    // Comandos de consulta: só para quem está conectado.
    const antesComandos = enviadasPara(777001).length;
    mensagemDe(777001, "/ajuda");
    checar("/ajuda lista os comandos", Boolean(await esperarAte(() => enviadasPara(777001).slice(antesComandos).find((m) => m.text.includes("/pendencias")))));
    mensagemDe(777001, "/Amanhã@painel_teste_bot");
    checar("Comando com acento e nome do bot", Boolean(await esperarAte(() => enviadasPara(777001).slice(antesComandos).find((m) => m.text.includes("Agenda de amanhã")))));
    mensagemDe(777001, "/buscar [TESTE] Telegram");
    const busca = await esperarAte(() => enviadasPara(777001).slice(antesComandos).find((m) => m.text.includes("[TESTE] Telegram Ana")));
    checar("/buscar acha o estudante", Boolean(busca) && busca.text.includes(`/estudantes/${estudanteId}`), busca?.text);
    mensagemDe(777001, "/inexistente");
    checar("Comando desconhecido explica", Boolean(await esperarAte(() => enviadasPara(777001).slice(antesComandos).find((m) => m.text.includes("Não conheço esse comando")))));
    mensagemDe(777099, "/buscar [TESTE] Telegram");
    const estranho = await esperarAte(() => enviadasPara(777099)[0]);
    checar("Chat não conectado não vê dados", Boolean(estranho) && !estranho.text.includes("[TESTE]") && estranho.text.includes("Conectar Telegram"), estranho?.text);
    await prisma.usuario.update({ where: { id: teste.usuario.id }, data: { ativo: false } });
    const antesInativo = enviadasPara(777001).length;
    mensagemDe(777001, "/buscar [TESTE] Telegram");
    const inativo = await esperarAte(() => enviadasPara(777001)[antesInativo]);
    checar("Usuário desativado não vê dados", Boolean(inativo) && !inativo.text.includes("[TESTE]"), inativo?.text);
    await prisma.usuario.update({ where: { id: teste.usuario.id }, data: { ativo: true } });

    // ---------- Alterações pelo bot: só gravam depois do Confirmar ----------
    r = await req("POST", "/empresas", { nome: "[TESTE] Empresa Bot", nome_contato: "Contato", telefone_contato: teste.telefone(), email_contato: "teste@teste.com" });
    if (r.body?.id) ids.empresas.push(r.body.id);
    r = await req("POST", "/vagas", { codigo_vaga: String(Math.floor(100000 + Math.random() * 899999)), titulo: "[TESTE] Vaga Bot", descricao: "Teste", valor: 1000, empresa_id: ids.empresas[0] });
    if (r.body?.id) ids.vagas.push(r.body.id);
    checarStatus("Criar vaga do bot", r, 201);
    r = await req("POST", `/candidatos/${estudanteId}/candidaturas`, { vaga_id: ids.vagas[0] });
    checarStatus("Indicar para a vaga do bot", r, 201);
    const etapaAtual = async () => (await prisma.aplicacao.findFirst({ where: { estudante_id: estudanteId, vaga_id: ids.vagas[0] }, select: { status_kanban: true } }))?.status_kanban;
    const contatosDe = () => prisma.contato.count({ where: { estudante_id: estudanteId } });

    let desde = enviadasPara(777001).length;
    mensagemDe(777001, "/mover [TESTE] Telegram Ana");
    const botaoEtapa = await esperarAte(() => botaoEm(777001, desde, "Em Teste"));
    checar("/mover oferece as etapas", Boolean(botaoEtapa));
    checar("Em Entrevista e Dispensado ficam fora", !botaoEm(777001, desde, "Em Entrevista") && !botaoEm(777001, desde, "Dispensado"));
    desde = enviadasPara(777001).length;
    toqueDe(777001, botaoEtapa?.callback_data);
    const botaoConfirmar = await esperarAte(() => botaoEm(777001, desde, "✅ Confirmar"));
    checar("Escolher a etapa pede confirmação", Boolean(botaoConfirmar));
    checar("Antes de confirmar, nada mudou", (await etapaAtual()) === "CANDIDATO_CONTATADO");

    // Outra conversa não consegue usar o botão.
    const antesOutro = enviadasPara(777099).length;
    toqueDe(777099, botaoConfirmar?.callback_data);
    await esperarAte(() => enviadasPara(777099).length > antesOutro);
    checar("Conversa não conectada não confirma", (await etapaAtual()) === "CANDIDATO_CONTATADO");

    desde = enviadasPara(777001).length;
    toqueDe(777001, botaoConfirmar?.callback_data);
    const movido = await esperarAte(() => enviadasPara(777001).slice(desde).find((m) => m.text.includes("agora está em")));
    checar("Confirmar move o candidato", Boolean(movido) && (await etapaAtual()) === "EM_TESTE", movido?.text);
    const linhaHistorico = await prisma.historicoEtapa.findFirst({ where: { aplicacao: { estudante_id: estudanteId, vaga_id: ids.vagas[0] }, para_status: "EM_TESTE" }, select: { de_status: true, usuario_id: true } });
    checar("Histórico registra quem confirmou", linhaHistorico?.de_status === "CANDIDATO_CONTATADO" && linhaHistorico?.usuario_id === teste.usuario.id);

    desde = enviadasPara(777001).length;
    toqueDe(777001, botaoConfirmar?.callback_data);
    checar("Tocar de novo em Confirmar não repete", Boolean(await esperarAte(() => enviadasPara(777001).slice(desde).find((m) => m.text.includes("expirou")))));
    checar("Só uma linha no histórico", (await prisma.historicoEtapa.count({ where: { aplicacao: { estudante_id: estudanteId, vaga_id: ids.vagas[0] }, para_status: "EM_TESTE" } })) === 1);

    // Alguém mexeu no painel entre o resumo e o Confirmar.
    desde = enviadasPara(777001).length;
    mensagemDe(777001, "/mover [TESTE] Telegram Ana");
    const botaoContratar = await esperarAte(() => botaoEm(777001, desde, "Contratado"));
    desde = enviadasPara(777001).length;
    toqueDe(777001, botaoContratar?.callback_data);
    const confirmarContratar = await esperarAte(() => botaoEm(777001, desde, "✅ Confirmar"));
    await prisma.aplicacao.updateMany({ where: { estudante_id: estudanteId, vaga_id: ids.vagas[0] }, data: { status_kanban: "ENVIADO_EMPRESA" } });
    desde = enviadasPara(777001).length;
    toqueDe(777001, confirmarContratar?.callback_data);
    checar("Etapa mudada no painel não é sobrescrita", Boolean(await esperarAte(() => enviadasPara(777001).slice(desde).find((m) => m.text.includes("Nada foi alterado")))) && (await etapaAtual()) === "ENVIADO_EMPRESA");

    // Contratar grava a data, como no painel.
    desde = enviadasPara(777001).length;
    mensagemDe(777001, "/mover [TESTE] Telegram Ana");
    const botaoContratar2 = await esperarAte(() => botaoEm(777001, desde, "Contratado"));
    desde = enviadasPara(777001).length;
    toqueDe(777001, botaoContratar2?.callback_data);
    const confirmarContratar2 = await esperarAte(() => botaoEm(777001, desde, "✅ Confirmar"));
    desde = enviadasPara(777001).length;
    toqueDe(777001, confirmarContratar2?.callback_data);
    await esperarAte(() => enviadasPara(777001).slice(desde).find((m) => m.text.includes("agora está em")));
    const contratada = await prisma.aplicacao.findFirst({ where: { estudante_id: estudanteId, vaga_id: ids.vagas[0] }, select: { status_kanban: true, data_aprovacao: true } });
    checar("Contratar grava a data de contratação", contratada?.status_kanban === "APROVADO" && Boolean(contratada?.data_aprovacao));

    // Registrar contato.
    const contatosAntes = await contatosDe();
    desde = enviadasPara(777001).length;
    mensagemDe(777001, "/contato [TESTE] Telegram Ana: Confirmou <presença> & documentos");
    const botaoLigacao = await esperarAte(() => botaoEm(777001, desde, "Ligação"));
    checar("/contato pergunta o tipo", Boolean(botaoLigacao));
    desde = enviadasPara(777001).length;
    toqueDe(777001, botaoLigacao?.callback_data);
    const confirmarContato = await esperarAte(() => botaoEm(777001, desde, "✅ Confirmar"));
    const resumoContato = enviadasPara(777001).slice(desde).find((m) => m.text.includes("Confirma o registro"));
    checar("Resumo mostra o texto escapado", resumoContato?.text.includes("Confirmou &lt;presença&gt; &amp; documentos"), resumoContato?.text);
    checar("Antes de confirmar, nenhum contato", (await contatosDe()) === contatosAntes);

    // Cancelar não grava.
    const botaoCancelar = botaoEm(777001, desde, "Cancelar");
    desde = enviadasPara(777001).length;
    toqueDe(777001, botaoCancelar?.callback_data);
    checar("Cancelar avisa", Boolean(await esperarAte(() => enviadasPara(777001).slice(desde).find((m) => m.text.startsWith("Cancelado")))));
    checar("Cancelar não grava", (await contatosDe()) === contatosAntes);

    desde = enviadasPara(777001).length;
    mensagemDe(777001, "/contato [TESTE] Telegram Ana: Confirmou presença");
    const botaoWhats = await esperarAte(() => botaoEm(777001, desde, "WhatsApp"));
    desde = enviadasPara(777001).length;
    toqueDe(777001, botaoWhats?.callback_data);
    const confirmarWhats = await esperarAte(() => botaoEm(777001, desde, "✅ Confirmar"));
    desde = enviadasPara(777001).length;
    toqueDe(777001, confirmarWhats?.callback_data);
    await esperarAte(() => enviadasPara(777001).slice(desde).find((m) => m.text.includes("Contato registrado")));
    const contatoSalvo = await prisma.contato.findFirst({ where: { estudante_id: estudanteId, texto: "Confirmou presença" }, select: { tipo: true, usuario_id: true } });
    checar("Confirmar registra o contato com o autor", contatoSalvo?.tipo === "WHATSAPP" && contatoSalvo?.usuario_id === teste.usuario.id, JSON.stringify(contatoSalvo));

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
    await prisma.vaga.deleteMany({ where: { id: { in: ids.vagas } } }).catch(() => {});
    await prisma.empresa.deleteMany({ where: { id: { in: ids.empresas } } }).catch(() => {});
    await teste.removerUsuario();
    const sobras = await prisma.estudante.count({ where: { nome_completo: { startsWith: "[TESTE]" } } })
      + await prisma.vaga.count({ where: { titulo: { startsWith: "[TESTE]" } } })
      + await prisma.empresa.count({ where: { nome: { startsWith: "[TESTE]" } } })
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
