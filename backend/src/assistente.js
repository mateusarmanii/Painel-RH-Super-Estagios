// O assistente do RH no Telegram: consultas ao banco, comandos, resumos e mensagens livres (com src/ia.js).
// As consultas só leem o banco; as alterações ficam em src/acoes.js e sempre pedem confirmação por botão.
// Cada função devolve o texto pronto em HTML do Telegram (todo dado passa por escapar), ou { texto, botoes }.
// sexo_preferencia e anotacoes_recrutador nunca são selecionados aqui.
const prisma = require("./prisma");
const { montarNotificacoes } = require("./notificacoes");
const { DIA_MS } = require("./utils");
const { ETAPAS_EM_PROCESSO } = require("./etapas");
const { iaConfigurada, interpretar } = require("./ia");
const { proporMover, proporContato } = require("./acoes");
const { ROTULOS_ETAPA, escapar, enderecoPainel, linkPainel } = require("./textoBot");

const FUSO = "America/Sao_Paulo";
const LIMITE_TELEGRAM = 3800; // o Telegram aceita até 4096; a sobra é para o aviso de lista cortada
const IA_POR_MINUTO = 10;

const marcador = { alta: "🔴", media: "🟠", info: "🔵" };

// Junta as linhas sem passar do limite. Corta entre linhas para nunca quebrar uma tag HTML.
function juntar(linhas) {
  const validas = linhas.filter((linha) => linha !== null && linha !== undefined && linha !== false);
  let total = 0;
  const saida = [];
  for (const linha of validas) {
    total += linha.length + 1;
    if (total > LIMITE_TELEGRAM) {
      saida.push("… lista cortada. Veja o restante no painel.");
      break;
    }
    saida.push(linha);
  }
  return saida.join("\n");
}

// ---------- Datas no fuso de São Paulo (sem horário de verão desde 2019) ----------

const formatoDia = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" });
const formatoHora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
const formatoTitulo = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, weekday: "long", day: "2-digit", month: "2-digit" });
const diaSp = (data) => formatoDia.format(data);
const inicioDoDia = (dia) => new Date(`${dia}T00:00:00-03:00`);
const somarDias = (dia, dias) => new Date(Date.UTC(...dia.split("-").map((n, i) => Number(n) - (i === 1 ? 1 : 0))) + dias * DIA_MS).toISOString().slice(0, 10);

function diaValido(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto ?? "")) return false;
  const data = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === texto;
}

// Período pedido pela IA: data inválida vira hoje; fim antes do início vira um dia só; no máximo 31 dias.
function periodoValido({ data_inicio, data_fim } = {}, agora = new Date()) {
  const de = diaValido(data_inicio) ? data_inicio : diaSp(agora);
  const ate = diaValido(data_fim) && data_fim >= de ? data_fim : de;
  const limite = somarDias(de, 30);
  return { de, ate: ate > limite ? limite : ate };
}

// ---------- Consultas ----------

async function agenda(de, ate, titulo) {
  const inicio = inicioDoDia(de);
  const fim = inicioDoDia(somarDias(ate, 1));
  const [entrevistas, eventos] = await Promise.all([
    prisma.aplicacao.findMany({
      where: {
        status_kanban: "ENTREVISTA_AGENDADA",
        data_hora_entrevista: { gte: inicio, lt: fim },
        OR: [{ entrevista_status: null }, { entrevista_status: { in: ["AGUARDANDO", "CONFIRMADA"] } }],
      },
      select: {
        data_hora_entrevista: true,
        entrevista_status: true,
        entrevista_formato: true,
        estudante: { select: { nome_completo: true } },
        vaga: { select: { titulo: true, empresa: { select: { nome: true } } } },
      },
    }),
    prisma.evento.findMany({ where: { inicio: { gte: inicio, lt: fim } }, select: { titulo: true, inicio: true, dia_inteiro: true } }),
  ]);
  const itens = [
    ...entrevistas.map((e) => ({
      quando: e.data_hora_entrevista,
      linha: `🕗 ${formatoHora.format(e.data_hora_entrevista)} · <b>${escapar(e.vaga.empresa.nome)}</b> · ${escapar(e.estudante.nome_completo)}\n    ${escapar(e.vaga.titulo)} · ${e.entrevista_status === "CONFIRMADA" ? "✅ confirmada" : "⏳ sem confirmação"}${e.entrevista_formato === "ONLINE" ? " · online" : ""}`,
    })),
    ...eventos.map((e) => ({ quando: e.inicio, linha: `📅 ${e.dia_inteiro ? "Dia inteiro" : formatoHora.format(e.inicio)} · ${escapar(e.titulo)}` })),
  ].sort((a, b) => a.quando - b.quando);

  const linhas = [`<b>${escapar(titulo)}</b>`];
  if (!itens.length) linhas.push("Nenhuma entrevista ou evento.");
  let diaAtual = null;
  for (const item of itens) {
    const dia = diaSp(item.quando);
    if (de !== ate && dia !== diaAtual) {
      diaAtual = dia;
      linhas.push("", `<b>${escapar(formatoTitulo.format(item.quando))}</b>`);
    }
    linhas.push(item.linha);
  }
  const link = linkPainel("/calendario", "Abrir o calendário");
  if (link) linhas.push("", link);
  return juntar(linhas);
}

const agendaHoje = (agora) => agenda(diaSp(agora), diaSp(agora), "Agenda de hoje");
const agendaAmanha = (agora) => { const dia = somarDias(diaSp(agora), 1); return agenda(dia, dia, "Agenda de amanhã"); };
const agendaSemana = (agora) => agenda(diaSp(agora), somarDias(diaSp(agora), 6), "Agenda dos próximos 7 dias");

async function pendencias(agora) {
  const itens = (await montarNotificacoes(agora)).filter((item) => item.gravidade !== "info");
  if (!itens.length) return "✅ <b>Nada pendente agora.</b>";
  const urgentes = itens.filter((item) => item.gravidade === "alta").length;
  return juntar([
    `<b>Pendências: ${itens.length}</b>${urgentes ? ` (${urgentes} ${urgentes === 1 ? "urgente" : "urgentes"})` : ""}`,
    "",
    ...itens.map((item) => `${marcador[item.gravidade]} <b>${escapar(item.titulo)}</b>\n    ${escapar(item.descricao)}`),
  ]);
}

async function vagasAbertas(agora) {
  const vagas = await prisma.vaga.findMany({
    where: { status: "ABERTA", arquivada_em: null },
    orderBy: { created_at: "asc" },
    select: { id: true, codigo_vaga: true, titulo: true, created_at: true, empresa: { select: { nome: true } }, aplicacoes: { select: { status_kanban: true } } },
  });
  if (!vagas.length) return "Nenhuma vaga aberta agora.";
  return juntar([
    `<b>Vagas abertas: ${vagas.length}</b> (as mais antigas primeiro)`,
    "",
    ...vagas.map((v) => {
      const emProcesso = v.aplicacoes.filter((a) => ETAPAS_EM_PROCESSO.includes(a.status_kanban)).length;
      return `<b>Nº ${escapar(v.codigo_vaga)}</b> · ${escapar(v.titulo)}\n    ${escapar(v.empresa.nome)} · ${emProcesso} em processo · ${Math.floor((agora - v.created_at) / DIA_MS)} dias`;
    }),
  ]);
}

async function buscar(termoBruto) {
  const termo = String(termoBruto ?? "").trim().slice(0, 80);
  if (termo.length < 2) return "Diga o que procurar. Exemplo: <code>/buscar Ana Souza</code>, ou o número de uma vaga.";
  const contem = { contains: termo, mode: "insensitive" };
  const digitos = termo.replace(/\D/g, "");
  const porTelefone = digitos.length >= 4 && digitos.length === termo.replace(/[\s().+-]/g, "").length
    ? await prisma.$queryRaw`SELECT id FROM "Estudante" WHERE regexp_replace(telefone, '\\D', '', 'g') LIKE ${`%${digitos}`} LIMIT 5`
    : [];
  const [estudantes, empresas, vagas] = await Promise.all([
    prisma.estudante.findMany({
      where: { anonimizado_em: null, arquivado_em: null, OR: [{ nome_completo: contem }, { email: contem }, { id: { in: porTelefone.map((linha) => linha.id) } }] },
      take: 5,
      orderBy: { nome_completo: "asc" },
      select: {
        id: true, nome_completo: true, curso: true, telefone: true, cidade: true,
        aplicacoes: { orderBy: { created_at: "desc" }, take: 3, select: { status_kanban: true, vaga: { select: { titulo: true } } } },
      },
    }),
    prisma.empresa.findMany({
      where: { arquivada_em: null, nome: contem },
      take: 3,
      orderBy: { nome: "asc" },
      select: { nome: true, nome_contato: true, telefone_contato: true, vagas: { where: { status: "ABERTA" }, select: { id: true } } },
    }),
    prisma.vaga.findMany({
      where: { arquivada_em: null, OR: [{ titulo: contem }, { codigo_vaga: { startsWith: termo } }] },
      take: 3,
      orderBy: { created_at: "desc" },
      select: { id: true, codigo_vaga: true, titulo: true, status: true, empresa: { select: { nome: true } }, aplicacoes: { select: { status_kanban: true } } },
    }),
  ]);
  if (!estudantes.length && !empresas.length && !vagas.length) return `Não encontrei nada com “${escapar(termo)}”. Confira os acentos ou tente só uma parte do nome.`;
  const linhas = [];
  for (const e of estudantes) {
    linhas.push(`🎓 <b>${escapar(e.nome_completo)}</b>`, `    ${escapar(e.curso)}${e.cidade ? ` · ${escapar(e.cidade)}` : ""}`, `    📞 ${escapar(e.telefone)}`);
    for (const a of e.aplicacoes) linhas.push(`    • ${escapar(a.vaga.titulo)}: ${escapar(ROTULOS_ETAPA[a.status_kanban] ?? a.status_kanban)}`);
    const link = linkPainel(`/estudantes/${e.id}`, "Ver perfil");
    if (link) linhas.push(`    ${link}`);
    linhas.push("");
  }
  for (const e of empresas) {
    linhas.push(`🏢 <b>${escapar(e.nome)}</b>`, `    ${escapar(e.nome_contato)} · 📞 ${escapar(e.telefone_contato)}`, `    ${e.vagas.length} ${e.vagas.length === 1 ? "vaga aberta" : "vagas abertas"}`, "");
  }
  for (const v of vagas) {
    const contagem = ETAPAS_EM_PROCESSO.map((etapa) => [etapa, v.aplicacoes.filter((a) => a.status_kanban === etapa).length]).filter(([, total]) => total);
    linhas.push(`💼 <b>Nº ${escapar(v.codigo_vaga)}</b> · ${escapar(v.titulo)}`, `    ${escapar(v.empresa.nome)} · ${v.status === "ABERTA" ? "aberta" : v.status === "FECHADA" ? "fechada" : "suspensa"}`);
    linhas.push(`    ${contagem.length ? contagem.map(([etapa, total]) => `${ROTULOS_ETAPA[etapa]}: ${total}`).join(" · ") : "Ninguém em processo"}`);
    const link = linkPainel(`/kanban/${v.id}`, "Abrir o Kanban");
    if (link) linhas.push(`    ${link}`);
    linhas.push("");
  }
  return juntar(linhas).trim();
}

// ---------- Resumos ----------

async function resumoDoDia(agora = new Date()) {
  const itens = (await montarNotificacoes(agora)).filter((item) => item.gravidade !== "info");
  const urgentes = itens.filter((item) => item.gravidade === "alta");
  return juntar([
    "☀️ <b>Bom dia! Seu resumo de hoje</b>",
    "",
    await agendaHoje(agora),
    "",
    itens.length ? `<b>Pendências: ${itens.length}</b>${urgentes.length ? ` (${urgentes.length} ${urgentes.length === 1 ? "urgente" : "urgentes"})` : ""}` : "✅ Nenhuma pendência.",
    ...urgentes.slice(0, 5).map((item) => `🔴 ${escapar(item.titulo)}\n    ${escapar(item.descricao)}`),
    itens.length ? "Para ver todas, envie /pendencias." : null,
  ]);
}

async function resumoDaSemana(agora = new Date()) {
  const desde = new Date(agora.getTime() - 7 * DIA_MS);
  const hoje = diaSp(agora);
  const [candidaturas, contratacoes, dispensas, vagasNovas, abertas, proximas] = await Promise.all([
    prisma.aplicacao.count({ where: { created_at: { gte: desde } } }),
    prisma.aplicacao.count({ where: { data_aprovacao: { gte: desde } } }),
    prisma.historicoEtapa.count({ where: { para_status: "RECUSADO", created_at: { gte: desde } } }),
    prisma.vaga.count({ where: { created_at: { gte: desde } } }),
    prisma.vaga.count({ where: { status: "ABERTA", arquivada_em: null } }),
    prisma.aplicacao.count({
      where: {
        status_kanban: "ENTREVISTA_AGENDADA",
        data_hora_entrevista: { gte: agora, lt: inicioDoDia(somarDias(hoje, 8)) },
        OR: [{ entrevista_status: null }, { entrevista_status: { in: ["AGUARDANDO", "CONFIRMADA"] } }],
      },
    }),
  ]);
  return juntar([
    "📊 <b>Resumo dos últimos 7 dias</b>",
    "",
    `Candidaturas novas: <b>${candidaturas}</b>`,
    `Contratações: <b>${contratacoes}</b>`,
    `Dispensas: <b>${dispensas}</b>`,
    `Vagas novas: <b>${vagasNovas}</b>`,
    "",
    `Vagas abertas agora: <b>${abertas}</b>`,
    `Entrevistas nos próximos 7 dias: <b>${proximas}</b>`,
  ]);
}

// ---------- Comandos e texto livre ----------

const AJUDA = [
  ["hoje", "agenda de hoje"],
  ["amanha", "agenda de amanhã"],
  ["semana", "agenda dos próximos 7 dias"],
  ["pendencias", "o que precisa de atenção"],
  ["vagas", "vagas abertas"],
  ["buscar", "estudante, empresa ou vaga. Ex.: /buscar Ana"],
  ["resumo", "números dos últimos 7 dias"],
  ["contato", "registrar contato. Ex.: /contato Ana: confirmou"],
  ["mover", "mudar a etapa de um candidato. Ex.: /mover Ana"],
  ["ajuda", "esta lista"],
  ["parar", "desconectar este Telegram"],
];

function textoDeAjuda() {
  return [
    "<b>O que posso fazer</b>",
    "",
    ...AJUDA.map(([comando, descricao]) => `/${comando} · ${escapar(descricao)}`),
    "",
    iaConfigurada()
      ? "Você também pode escrever normalmente, como “quem tem entrevista amanhã?”, “liguei para a Ana e ela confirmou” ou “escreva uma mensagem pedindo o currículo”. Os dados do painel vêm direto do banco. O que começa com 🤖 foi escrito pela IA: confira antes de usar."
      : "A conversa em texto livre está desligada. Use os comandos acima.",
    "",
    "Só altero algo depois que você tocar em Confirmar. Entrevistas e dispensas são feitas no painel.",
  ].join("\n");
}

// Devolve o texto da resposta, ou null se o comando não existir.
function executarComando(comando, argumento, agora = new Date()) {
  switch (comando) {
    case "hoje": return agendaHoje(agora);
    case "amanha": return agendaAmanha(agora);
    case "semana": return agendaSemana(agora);
    case "pendencias": return pendencias(agora);
    case "vagas": return vagasAbertas(agora);
    case "buscar": return buscar(argumento);
    case "resumo": return resumoDaSemana(agora);
    case "mover": return proporMover(argumento);
    case "contato": {
      // "/contato Ana Souza: confirmou a entrevista"
      const separador = argumento.indexOf(":");
      return separador < 0
        ? proporContato({ nome: argumento })
        : proporContato({ nome: argumento.slice(0, separador), texto: argumento.slice(separador + 1) });
    }
    case "ajuda":
    case "help": return Promise.resolve(textoDeAjuda());
    default: return null;
  }
}

function executarAcao({ acao, args }, agora = new Date()) {
  switch (acao) {
    case "consultar_agenda": {
      const { de, ate } = periodoValido(args, agora);
      const nomeDia = (dia) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "2-digit" }).format(new Date(`${dia}T12:00:00Z`));
      return agenda(de, ate, de === ate ? `Agenda de ${nomeDia(de)}` : `Agenda de ${de.split("-").reverse().join("/")} a ${ate.split("-").reverse().join("/")}`);
    }
    case "listar_pendencias": return pendencias(agora);
    case "listar_vagas_abertas": return vagasAbertas(agora);
    case "buscar": return buscar(args?.termo);
    case "resumo_da_semana": return resumoDaSemana(agora);
    // Só propõem: a gravação depende do botão Confirmar.
    case "propor_mover_candidato": return proporMover(args?.nome, args?.etapa);
    case "propor_registrar_contato": return proporContato(args);
    default: return null;
  }
}

const usoIa = new Map();
function dentroDoLimite(chatId, agora = Date.now()) {
  const recentes = (usoIa.get(chatId) ?? []).filter((momento) => agora - momento < 60000);
  const permitido = recentes.length < IA_POR_MINUTO;
  if (permitido) recentes.push(agora);
  usoIa.set(chatId, recentes);
  return permitido;
}

async function responderTextoLivre(texto, chatId, agora = new Date()) {
  if (!iaConfigurada()) return "Ainda não entendo texto livre aqui. Envie /ajuda para ver os comandos.";
  if (!dentroDoLimite(chatId)) return "Muitas perguntas em pouco tempo. Espere um minuto ou envie /ajuda para usar os comandos, que não têm limite.";
  let resultado;
  try {
    resultado = await interpretar(texto, agora);
  } catch (error) {
    // Nunca registra o texto da pessoa no log.
    console.error("IA: não foi possível interpretar a mensagem:", error.status ?? error.name);
    return error.status === 429
      ? "A IA atingiu o limite do plano gratuito por agora. Os comandos continuam funcionando: envie /ajuda."
      : "Não consegui falar com a IA agora. Os comandos continuam funcionando: envie /ajuda.";
  }
  if (resultado.acao) {
    const resposta = executarAcao(resultado, agora);
    return resposta ?? "Não entendi o pedido. Envie /ajuda para ver os comandos.";
  }
  return `🤖 ${escapar(resultado.texto.slice(0, 3500))}`;
}

module.exports = {
  AJUDA,
  marcador,
  escapar,
  enderecoPainel,
  juntar,
  diaSp,
  periodoValido,
  executarComando,
  executarAcao,
  responderTextoLivre,
  resumoDoDia,
  resumoDaSemana,
};
