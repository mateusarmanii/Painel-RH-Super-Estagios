// Testes do assistente do Telegram (src/ia.js e src/assistente.js). SÓ LÊ o banco: não grava nada.
// A IA é um servidor falso nesta porta: nada sai para a internet. Não mostra dados do banco na saída.
const http = require("http");
const path = require("path");

process.chdir(path.resolve(__dirname, ".."));
require("dotenv").config();

const PORTA_IA = 3498;
process.env.IA_API_KEY = "CHAVE-FALSA";
process.env.IA_API_URL = `http://localhost:${PORTA_IA}/v1`;

const prisma = require("../src/prisma");
const { limparTexto, interpretar, FERRAMENTAS } = require("../src/ia");
const { juntar, periodoValido, executarComando, executarAcao, responderTextoLivre, resumoDoDia, resumoDaSemana, escapar } = require("../src/assistente");
const { montarNotificacoes } = require("../src/notificacoes");
const { prepararBotoes, pegarAcao, proporMover, proporContato, consequencias, ETAPAS_PELO_BOT } = require("../src/acoes");

let falhas = 0;
function checar(nome, ok, detalhe = "") {
  console.log(`${ok ? "OK  " : "FALHA"} ${nome}${ok || !detalhe ? "" : ` → ${detalhe}`}`);
  if (!ok) falhas++;
}

const falso = { pedidos: [], resposta: null, status: 200 };
const servidor = http.createServer((pedido, resposta) => {
  let corpo = "";
  pedido.on("data", (parte) => { corpo += parte; });
  pedido.on("end", () => {
    falso.pedidos.push({ url: pedido.url, autorizacao: pedido.headers.authorization, corpo: JSON.parse(corpo) });
    resposta.writeHead(falso.status, { "Content-Type": "application/json" });
    resposta.end(JSON.stringify({ choices: [{ message: falso.resposta }] }));
  });
});

const chamaFerramenta = (name, args) => ({ tool_calls: [{ function: { name, arguments: JSON.stringify(args) } }] });

// HTML do Telegram: só tags fechadas e nada acima do limite.
function htmlValido(texto) {
  const abertas = [];
  for (const [, fecha, tag] of texto.matchAll(/<(\/?)(b|a|code)\b[^>]*>/g)) {
    if (fecha) { if (abertas.pop() !== tag) return false; } else abertas.push(tag);
  }
  return !abertas.length && texto.length <= 4096;
}

async function main() {
  // Privacidade: o que sai do servidor.
  const limpo = limparTexto("ligar para ana@exemplo.com no (31) 99999-1234, CPF 123.456.789-00, vaga 12345");
  checar("Tira e-mail", !limpo.includes("ana@exemplo.com"), limpo);
  checar("Tira telefone e CPF", !limpo.includes("99999") && !limpo.includes("123.456"), limpo);
  checar("Mantém número de vaga", limpo.includes("12345"), limpo);
  checar("Corta textos enormes", limparTexto("a".repeat(5000)).length === 500);
  checar("IA só consulta ou propõe", FERRAMENTAS.every((f) => /^(consultar|listar|buscar|resumo|propor)/.test(f.function.name)));

  // Botões: uma vez só, só na própria conversa e com prazo.
  const acaoTeste = { tipo: "cancelar" };
  const tokenDe = (teclado) => teclado[0][0].callback_data;
  let token = tokenDe(prepararBotoes("chat-a", [[{ texto: "Sim", acao: acaoTeste }]]));
  checar("Botão cabe no limite do Telegram", Buffer.byteLength(token) <= 64);
  checar("Botão de outra conversa não vale", pegarAcao("chat-b", token) === null);
  checar("Botão vale na própria conversa", pegarAcao("chat-a", token) === acaoTeste);
  checar("Botão vale uma vez só", pegarAcao("chat-a", token) === null);
  token = tokenDe(prepararBotoes("chat-a", [[{ texto: "Sim", acao: acaoTeste }]]));
  const novo = tokenDe(prepararBotoes("chat-a", [[{ texto: "Outro", acao: acaoTeste }]]));
  checar("Pedido novo cancela o anterior", pegarAcao("chat-a", token) === null && pegarAcao("chat-a", novo) === acaoTeste);
  token = tokenDe(prepararBotoes("chat-a", [[{ texto: "Sim", acao: acaoTeste }]]));
  checar("Botão vence em 10 minutos", pegarAcao("chat-a", token, Date.now() + 11 * 60000) === null);
  checar("Etapas com data ou motivo ficam fora do bot", !ETAPAS_PELO_BOT.includes("ENTREVISTA_AGENDADA") && !ETAPAS_PELO_BOT.includes("RECUSADO"));
  checar("Avisa o que se perde ao sair de Contratado", consequencias("APROVADO", "EM_TESTE").some((a) => a.includes("contratação")));
  checar("Entrevista vira realizada ao ir para teste", consequencias("ENTREVISTA_AGENDADA", "EM_TESTE").some((a) => a.includes("realizada")));
  checar("Entrevista vira cancelada ao voltar", consequencias("ENTREVISTA_AGENDADA", "ENVIADO_EMPRESA").some((a) => a.includes("cancelada")));

  // Período pedido pela IA.
  const agora = new Date("2026-11-03T15:00:00Z");
  checar("Data inválida vira hoje", periodoValido({ data_inicio: "ontem" }, agora).de === "2026-11-03");
  checar("Data impossível vira hoje", periodoValido({ data_inicio: "2026-02-31" }, agora).de === "2026-11-03");
  checar("Fim antes do início vira um dia", periodoValido({ data_inicio: "2026-11-10", data_fim: "2026-11-01" }, agora).ate === "2026-11-10");
  checar("No máximo 31 dias", periodoValido({ data_inicio: "2026-11-01", data_fim: "2027-11-01" }, agora).ate === "2026-12-01");
  checar("Perto da meia-noite usa o dia de São Paulo", periodoValido({}, new Date("2026-11-04T01:00:00Z")).de === "2026-11-03");

  // Texto.
  checar("Escapa HTML", escapar('<b>&"') === "&lt;b&gt;&amp;&quot;");
  const cortado = juntar(Array.from({ length: 500 }, (_, i) => `<b>linha ${i}</b>`));
  checar("Corta listas longas sem quebrar tags", cortado.includes("lista cortada") && htmlValido(cortado));

  await new Promise((resolve) => servidor.listen(PORTA_IA, resolve));

  // A IA escolhe a consulta; o servidor responde.
  falso.resposta = chamaFerramenta("consultar_agenda", { data_inicio: "2026-11-04" });
  const escolha = await interpretar("quem tem entrevista amanhã?", agora);
  const enviado = falso.pedidos.at(-1);
  checar("Escolhe a ferramenta", escolha.acao === "consultar_agenda" && escolha.args.data_inicio === "2026-11-04", JSON.stringify(escolha));
  checar("Chama /chat/completions com a chave", enviado.url === "/v1/chat/completions" && enviado.autorizacao === "Bearer CHAVE-FALSA");
  checar("Envia só o sistema e a pergunta", enviado.corpo.messages.length === 2 && enviado.corpo.messages[1].content === "quem tem entrevista amanhã?");
  checar("Informa a data de hoje à IA", enviado.corpo.messages[0].content.includes("03/11/2026"));

  const antes = falso.pedidos.length;
  falso.resposta = chamaFerramenta("listar_pendencias", {});
  const pendencias = await responderTextoLivre("o que está pendente?", "chat-1", agora);
  checar("Resposta sai do banco, numa chamada só à IA", falso.pedidos.length === antes + 1 && !pendencias.startsWith("🤖") && htmlValido(pendencias));

  falso.resposta = { content: "Olá <b>{primeiro_nome}</b> & cia" };
  const livre = await responderTextoLivre("escreva uma mensagem", "chat-1", agora);
  checar("Texto da IA vem marcado e escapado", livre === "🤖 Olá &lt;b&gt;{primeiro_nome}&lt;/b&gt; &amp; cia", livre);

  falso.resposta = chamaFerramenta("apagar_tudo", {});
  checar("Ferramenta desconhecida não executa", (await responderTextoLivre("apague tudo", "chat-1", agora)).includes("Não entendi"));

  falso.resposta = { tool_calls: [{ function: { name: "buscar", arguments: "{quebrado" } }] };
  checar("Argumentos quebrados não derrubam", (await responderTextoLivre("busque", "chat-1", agora)).includes("/ajuda"));

  falso.status = 429;
  falso.resposta = {};
  checar("Limite gratuito avisa e sugere comandos", (await responderTextoLivre("oi", "chat-1", agora)).includes("limite do plano gratuito"));
  falso.status = 200;

  falso.resposta = { content: "ok" };
  let ultima = "";
  for (let i = 0; i < 12; i++) ultima = await responderTextoLivre("oi", "chat-rapido", agora);
  checar("Limita 10 perguntas por minuto", ultima.includes("Muitas perguntas"), ultima);

  // Consultas reais, só leitura.
  const avisos = await montarNotificacoes();
  checar("Avisos sem id repetido", new Set(avisos.map((a) => a.id)).size === avisos.length);
  checar("Avisos completos", avisos.every((a) => a.tipo && a.gravidade && a.titulo && a.link));
  const respostas = {};
  for (const [comando, argumento] of [["hoje"], ["amanha"], ["semana"], ["pendencias"], ["vagas"], ["resumo"], ["ajuda"], ["buscar", "a"], ["buscar", "an"], ["buscar", "<x>&"], ["buscar", "1"]]) {
    respostas[`${comando} ${argumento ?? ""}`] = await executarComando(comando, argumento ?? "");
  }
  respostas.resumoDoDia = await resumoDoDia();
  respostas.resumoDaSemana = await resumoDaSemana();
  respostas.acaoAgenda = await executarAcao({ acao: "consultar_agenda", args: { data_inicio: "2026-11-03", data_fim: "2026-11-09" } });
  for (const [nome, texto] of Object.entries(respostas)) checar(`/${nome.trim()} devolve HTML válido`, typeof texto === "string" && texto.length > 0 && htmlValido(texto), `${texto?.length} caracteres`);
  checar("Comando desconhecido devolve null", executarComando("nao-existe", "") === null);

  // Propostas: só leem. Nada grava sem o botão Confirmar.
  const contatosAntes = await prisma.contato.count();
  const historicoAntes = await prisma.historicoEtapa.count();
  checar("Mover sem nome explica", (await proporMover("")).includes("/mover"));
  checar("Dispensado fica no painel", (await proporMover("Ana", "RECUSADO")).includes("painel"));
  checar("Em Entrevista fica no painel", (await proporMover("Ana", "ENTREVISTA_AGENDADA")).includes("painel"));
  checar("Nome inexistente avisa", typeof (await proporMover("zzz-ninguem-zzz")) === "string");
  checar("Contato sem nome explica", (await proporContato({})).includes("/contato"));
  const proposta = await proporMover("a");
  const textoProposta = typeof proposta === "string" ? proposta : proposta.texto;
  checar("Proposta real em HTML válido", htmlValido(textoProposta));
  checar("Mover sem etapa escolhida não oferece Confirmar", !JSON.stringify(proposta?.botoes ?? []).includes("Confirmar"));
  const propostaContato = await proporContato({ nome: "a", tipo: "LIGACAO", texto: "<teste> & cia", proximo_contato: "2026-13-45" });
  checar("Proposta de contato em HTML válido", htmlValido(typeof propostaContato === "string" ? propostaContato : propostaContato.texto));
  checar("Propostas não gravaram nada", (await prisma.contato.count()) === contatosAntes && (await prisma.historicoEtapa.count()) === historicoAntes);
  checar("Busca escapa o termo", !respostas["buscar <x>&"].includes("<x>"));
  checar("Sem preferência de sexo nas respostas", !Object.values(respostas).some((texto) => /FEMININO|MASCULINO|preferência informada/i.test(texto)));

  await prisma.$disconnect();
  servidor.close();
  servidor.closeAllConnections();
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
  process.exitCode = falhas ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; prisma.$disconnect(); servidor.close(); });
