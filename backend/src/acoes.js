// Alterações pelo bot do Telegram: registrar contato e mover candidato. Nada é gravado sem o botão "Confirmar".
//
// Cada passo devolve { texto, botoes }, em que cada botão leva uma ação. O caminho até gravar é sempre:
//   proposta (comando ou IA) → escolhas por botão → resumo com "Confirmar" → gravação.
// A IA só preenche a proposta: o resumo mostra exatamente o que será salvo, e é a pessoa quem confirma.
//
// Os botões ficam em memória, por conversa: valem 10 minutos e uma vez só, e um pedido novo cancela os anteriores.
// Reiniciar a API também os cancela (basta repetir o pedido); o texto de uma anotação não confirmada não fica salvo.
//
// Em Entrevista e Dispensado continuam só no painel, porque exigem data ou motivo preenchidos na tela.
const crypto = require("crypto");
const prisma = require("./prisma");
const { statusAoSairDaEntrevista } = require("./agenda");
const { registrarEtapa } = require("./historico");
const { lerDia } = require("./estagios");
const { ROTULOS_ETAPA, escapar, linkPainel } = require("./textoBot");

const VALIDADE_MS = 10 * 60 * 1000;
const TEXTO_MAX = 2000;
const ETAPAS_PELO_BOT = ["CANDIDATO_CONTATADO", "ENVIADO_EMPRESA", "EM_TESTE", "APROVADO"];
const TIPOS_CONTATO = {
  LIGACAO: "Ligação",
  WHATSAPP: "WhatsApp",
  EMAIL: "E-mail",
  REUNIAO: "Reunião",
  SEM_RESPOSTA: "Sem resposta",
  NOTA: "Anotação",
};

// ---------- Botões pendentes ----------

const fluxos = new Map(); // chatId → { expira, acoes: Map(token → ação) }

// Troca as ações pelo teclado do Telegram. Substitui o pedido anterior da conversa.
function prepararBotoes(chatId, botoes, agora = Date.now()) {
  const acoes = new Map();
  const teclado = botoes.map((linha) => linha.map(({ texto, acao }) => {
    const token = crypto.randomBytes(9).toString("base64url");
    acoes.set(token, acao);
    return { text: texto, callback_data: token };
  }));
  fluxos.set(chatId, { expira: agora + VALIDADE_MS, acoes });
  return teclado;
}

// Devolve a ação do botão tocado e encerra o pedido: um segundo toque não faz nada.
function pegarAcao(chatId, token, agora = Date.now()) {
  const fluxo = fluxos.get(chatId);
  if (!fluxo?.acoes.has(token)) return null;
  fluxos.delete(chatId);
  return fluxo.expira > agora ? fluxo.acoes.get(token) : null;
}

const cancelar = { texto: "Cancelar", acao: { tipo: "cancelar" } };

// ---------- Mover candidato ----------

const estudantesPorNome = (nome) => prisma.estudante.findMany({
  where: { anonimizado_em: null, arquivado_em: null, nome_completo: { contains: nome, mode: "insensitive" } },
  take: 5,
  orderBy: { nome_completo: "asc" },
  select: { id: true, nome_completo: true, curso: true },
});

async function proporMover(nomeBruto, para) {
  const nome = String(nomeBruto ?? "").trim().slice(0, 80);
  if (nome.length < 2) return "Diga quem mover. Exemplo: <code>/mover Ana Souza</code>";
  if (para === "ENTREVISTA_AGENDADA" || para === "RECUSADO") return `${escapar(ROTULOS_ETAPA[para])} exige ${para === "RECUSADO" ? "um motivo" : "data e hora"}, então essa mudança é feita no painel.`;
  const etapa = ETAPAS_PELO_BOT.includes(para) ? para : null;
  const estudantes = await estudantesPorNome(nome);
  if (!estudantes.length) return `Não encontrei estudante com “${escapar(nome)}”.`;
  if (estudantes.length === 1) return escolherCandidatura(estudantes[0].id, etapa);
  return {
    texto: "<b>Qual estudante?</b>",
    botoes: [...estudantes.map((e) => [{ texto: `${e.nome_completo} · ${e.curso}`.slice(0, 60), acao: { tipo: "mover_estudante", estudanteId: e.id, para: etapa } }]), [cancelar]],
  };
}

async function escolherCandidatura(estudanteId, para) {
  const estudante = await prisma.estudante.findUnique({
    where: { id: estudanteId },
    select: {
      nome_completo: true,
      aplicacoes: { orderBy: { created_at: "desc" }, take: 8, select: { id: true, status_kanban: true, vaga: { select: { titulo: true, codigo_vaga: true } } } },
    },
  });
  if (!estudante) return "Esse estudante não existe mais.";
  if (!estudante.aplicacoes.length) return `${escapar(estudante.nome_completo)} não tem candidaturas. Indique para uma vaga pelo painel.`;
  if (estudante.aplicacoes.length === 1) return escolherEtapa(estudante.aplicacoes[0].id, para);
  return {
    texto: `<b>${escapar(estudante.nome_completo)}</b>\nQual candidatura?`,
    botoes: [
      ...estudante.aplicacoes.map((a) => [{ texto: `Nº ${a.vaga.codigo_vaga} · ${a.vaga.titulo} · ${ROTULOS_ETAPA[a.status_kanban] ?? a.status_kanban}`.slice(0, 60), acao: { tipo: "mover_candidatura", aplicacaoId: a.id, para } }]),
      [cancelar],
    ],
  };
}

const selectCandidatura = {
  id: true,
  estudante_id: true,
  vaga_id: true,
  status_kanban: true,
  entrevista_status: true,
  estudante: { select: { nome_completo: true } },
  vaga: { select: { titulo: true, codigo_vaga: true, empresa: { select: { nome: true } } } },
};

async function escolherEtapa(aplicacaoId, para) {
  const candidatura = await prisma.aplicacao.findUnique({ where: { id: aplicacaoId }, select: selectCandidatura });
  if (!candidatura) return "Essa candidatura não existe mais.";
  if (para) return resumoDaMudanca(candidatura, para);
  const opcoes = ETAPAS_PELO_BOT.filter((etapa) => etapa !== candidatura.status_kanban);
  return {
    texto: `<b>${escapar(candidatura.estudante.nome_completo)}</b>\n${escapar(candidatura.vaga.titulo)} · etapa atual: ${escapar(ROTULOS_ETAPA[candidatura.status_kanban])}\n\nMover para qual etapa? Em Entrevista e Dispensado são feitas no painel.`,
    botoes: [...opcoes.map((etapa) => [{ texto: ROTULOS_ETAPA[etapa], acao: { tipo: "mover_etapa", aplicacaoId, para: etapa } }]), [cancelar]],
  };
}

// O que mais muda além da etapa, nas mesmas regras do PATCH /candidatos/:id.
function consequencias(de, para) {
  const avisos = [];
  if (de === "APROVADO") avisos.push("A data de contratação será apagada.");
  if (de === "RECUSADO") avisos.push("O motivo da dispensa será apagado.");
  if (de === "ENTREVISTA_AGENDADA") avisos.push(`A entrevista ficará como ${["EM_TESTE", "APROVADO"].includes(para) ? "realizada" : "cancelada"}.`);
  return avisos;
}

function resumoDaMudanca(candidatura, para) {
  const de = candidatura.status_kanban;
  if (de === para) return `${escapar(candidatura.estudante.nome_completo)} já está em ${escapar(ROTULOS_ETAPA[para])}.`;
  return {
    texto: [
      "<b>Confirma a mudança?</b>",
      "",
      `<b>${escapar(candidatura.estudante.nome_completo)}</b>`,
      `Nº ${escapar(candidatura.vaga.codigo_vaga)} · ${escapar(candidatura.vaga.titulo)} · ${escapar(candidatura.vaga.empresa.nome)}`,
      `${escapar(ROTULOS_ETAPA[de] ?? de)} → <b>${escapar(ROTULOS_ETAPA[para])}</b>`,
      ...consequencias(de, para).map((aviso) => `⚠️ ${escapar(aviso)}`),
    ].join("\n"),
    botoes: [[{ texto: "✅ Confirmar", acao: { tipo: "mover_confirmar", aplicacaoId: candidatura.id, de, para } }, cancelar]],
  };
}

async function gravarMudanca({ aplicacaoId, de, para }, usuario) {
  if (!ETAPAS_PELO_BOT.includes(para)) return "Essa etapa só pode ser escolhida no painel.";
  const atual = await prisma.aplicacao.findUnique({ where: { id: aplicacaoId }, select: selectCandidatura });
  if (!atual) return "Essa candidatura não existe mais.";
  const data = {
    status_kanban: para,
    data_aprovacao: para === "APROVADO" ? new Date() : null,
    motivo_recusa: null,
    motivo_categoria: null,
  };
  if (de === "ENTREVISTA_AGENDADA") data.entrevista_status = statusAoSairDaEntrevista(atual.entrevista_status, para);
  // Só grava se a etapa ainda for a que a pessoa viu no resumo: alguém pode ter mexido no painel nesse meio-tempo.
  const gravou = await prisma.$transaction(async (transaction) => {
    const { count } = await transaction.aplicacao.updateMany({ where: { id: aplicacaoId, status_kanban: de }, data });
    if (!count) return false;
    await registrarEtapa(transaction, { aplicacaoId, de, para }, usuario.id);
    return true;
  });
  if (!gravou) return `Nada foi alterado: ${escapar(atual.estudante.nome_completo)} mudou de etapa nesse meio-tempo e agora está em ${escapar(ROTULOS_ETAPA[atual.status_kanban] ?? atual.status_kanban)}.`;
  await registrarAtividade(usuario, { metodo: "PATCH", entidade: "candidatos", id: atual.estudante_id });
  const link = linkPainel(`/kanban/${atual.vaga_id}`, "Abrir o Kanban");
  return [
    `✅ <b>${escapar(atual.estudante.nome_completo)}</b> agora está em <b>${escapar(ROTULOS_ETAPA[para])}</b>.`,
    para === "APROVADO" ? "Para encerrar a vaga ou preencher os dados do estágio, use o painel." : null,
    link || null,
  ].filter(Boolean).join("\n");
}

// ---------- Registrar contato ----------

async function proporContato({ nome: nomeBruto, tipo, texto, proximo_contato } = {}) {
  const nome = String(nomeBruto ?? "").trim().slice(0, 80);
  const anotacao = String(texto ?? "").trim().slice(0, TEXTO_MAX);
  if (nome.length < 2) return "Diga quem e o que registrar. Exemplo: <code>/contato Ana Souza: confirmou a entrevista</code>";
  const contem = { contains: nome, mode: "insensitive" };
  const [estudantes, empresas] = await Promise.all([
    estudantesPorNome(nome),
    prisma.empresa.findMany({ where: { arquivada_em: null, nome: contem }, take: 3, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);
  const alvos = [
    ...estudantes.map((e) => ({ campo: "estudante_id", id: e.id, nome: e.nome_completo, rotulo: `${e.nome_completo} · ${e.curso}` })),
    ...empresas.map((e) => ({ campo: "empresa_id", id: e.id, nome: e.nome, rotulo: `🏢 ${e.nome}` })),
  ];
  if (!alvos.length) return `Não encontrei estudante nem empresa com “${escapar(nome)}”.`;
  const pedido = { texto: anotacao, tipo: TIPOS_CONTATO[tipo] ? tipo : null, proximo: lerDia(proximo_contato ?? "") ? proximo_contato : null };
  if (alvos.length === 1) return escolherTipo(alvos[0], pedido);
  return {
    texto: "<b>Registrar para quem?</b>",
    botoes: [...alvos.map((alvo) => [{ texto: alvo.rotulo.slice(0, 60), acao: { tipo: "contato_alvo", alvo: { campo: alvo.campo, id: alvo.id, nome: alvo.nome }, pedido } }]), [cancelar]],
  };
}

function escolherTipo(alvo, pedido) {
  if (pedido.tipo) return resumoDoContato(alvo, pedido);
  const opcoes = Object.entries(TIPOS_CONTATO).map(([tipo, rotulo]) => ({ texto: rotulo, acao: { tipo: "contato_tipo", alvo, pedido: { ...pedido, tipo } } }));
  return {
    texto: `<b>${escapar(alvo.nome)}</b>\nQue tipo de contato foi?`,
    botoes: [opcoes.slice(0, 2), opcoes.slice(2, 4), opcoes.slice(4), [cancelar]],
  };
}

function resumoDoContato(alvo, pedido) {
  // Mesma regra do POST /contatos: anotação precisa de texto ou de uma data de retorno.
  if (pedido.tipo === "NOTA" && !pedido.texto && !pedido.proximo) return "Escreva o que anotar. Exemplo: <code>/contato Ana Souza: confirmou a entrevista</code>";
  return {
    texto: [
      "<b>Confirma o registro?</b>",
      "",
      `<b>${escapar(alvo.nome)}</b> · ${escapar(TIPOS_CONTATO[pedido.tipo])}`,
      pedido.texto ? `“${escapar(pedido.texto)}”` : "Sem texto",
      pedido.proximo ? `Retorno em ${pedido.proximo.split("-").reverse().join("/")}` : null,
    ].filter(Boolean).join("\n"),
    botoes: [[{ texto: "✅ Confirmar", acao: { tipo: "contato_confirmar", alvo, pedido } }, cancelar]],
  };
}

async function gravarContato({ alvo, pedido }, usuario) {
  const dono = alvo.campo === "estudante_id"
    ? await prisma.estudante.findUnique({ where: { id: alvo.id }, select: { id: true } })
    : await prisma.empresa.findUnique({ where: { id: alvo.id }, select: { id: true } });
  if (!dono) return "Esse cadastro não existe mais. Nada foi registrado.";
  const contato = await prisma.contato.create({
    data: {
      [alvo.campo]: alvo.id,
      tipo: pedido.tipo,
      texto: pedido.texto || null,
      proximo_contato: pedido.proximo ? lerDia(pedido.proximo) : null,
      usuario_id: usuario.id,
    },
    select: { id: true },
  });
  await registrarAtividade(usuario, { metodo: "POST", entidade: "contatos", id: contato.id });
  return `✅ Contato registrado para <b>${escapar(alvo.nome)}</b>.`;
}

// ---------- Registro de atividades e botões ----------

// O mesmo registro das alterações feitas pelo painel, com o Telegram no caminho. Falha aqui só aparece no log.
async function registrarAtividade(usuario, { metodo, entidade, id }) {
  if (usuario.email?.endsWith("@teste.local")) return;
  await prisma.atividade
    .create({ data: { usuario_id: usuario.id, metodo, caminho: `/${entidade}/${id} (Telegram)`, entidade, entidade_id: id, status: 200 } })
    .catch((error) => console.error("Erro ao registrar atividade:", error.message));
}

// Executa o botão tocado. usuario: { id, email } de quem está conectado nesta conversa.
function executarBotao(acao, usuario) {
  switch (acao.tipo) {
    case "cancelar": return Promise.resolve("Cancelado. Nada foi alterado.");
    case "mover_estudante": return escolherCandidatura(acao.estudanteId, acao.para);
    case "mover_candidatura": return escolherEtapa(acao.aplicacaoId, acao.para);
    case "mover_etapa": return escolherEtapa(acao.aplicacaoId, acao.para);
    case "mover_confirmar": return gravarMudanca(acao, usuario);
    case "contato_alvo": return Promise.resolve(escolherTipo(acao.alvo, acao.pedido));
    case "contato_tipo": return Promise.resolve(resumoDoContato(acao.alvo, acao.pedido));
    case "contato_confirmar": return gravarContato(acao, usuario);
    default: return Promise.resolve("Não entendi esse botão. Nada foi alterado.");
  }
}

module.exports = { prepararBotoes, pegarAcao, executarBotao, proporMover, proporContato, consequencias, ETAPAS_PELO_BOT };
