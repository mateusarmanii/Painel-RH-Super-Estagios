// Lembretes por e-mail (convite .ics) de eventos e entrevistas.
// Cada compromisso tem um UID fixo; cada envio grava uma linha em LembreteEmail com a SEQUENCE usada.
// Um e-mail está "ativo" se o último envio para ele foi um convite (e não um cancelamento).
const prisma = require("./prisma");
const { statusDaEntrevista, DURACAO_PADRAO } = require("./agenda");
const { fimDoEvento } = require("./eventos");
const { MINUTO_MS, dataCurta, dataLonga, duracaoTexto, horaTexto } = require("./fuso");
const { gerarIcs } = require("./ics");
const { enviarConvite, organizador } = require("./email");
const { uuidValido } = require("./utils");

const MAX_EMAILS_POR_ENVIO = 10;
const LIMITE_POR_HORA = 30;
const MAX_ALARMES = 5;
const ALARMES_PADRAO = [1440, 60];
// Opções de alarme (minutos antes): 10 min, 15 min, 30 min, 1 h, 2 h, 1 dia, 2 dias, 1 semana.
const ALARMES_PERMITIDOS = new Set([10, 15, 30, 60, 120, 1440, 2880, 10080]);
const HORA_MS = 60 * MINUTO_MS;
const formatoEmail = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

// Erro com status HTTP, para a rota devolver a mensagem certa.
class ErroLembrete extends Error {
  constructor(status, mensagem, extra = {}) {
    super(mensagem);
    this.status = status;
    this.extra = extra;
  }
}

function lerEmails(lista) {
  const textos = Array.isArray(lista) ? lista : typeof lista === "string" ? lista.split(/[\s,;]+/) : null;
  if (!textos) throw new ErroLembrete(400, "Informe ao menos um e-mail.");
  const emails = [...new Set(textos.filter((item) => typeof item === "string").map((item) => item.trim().toLowerCase()).filter(Boolean))];
  if (!emails.length) throw new ErroLembrete(400, "Informe ao menos um e-mail.");
  if (emails.length > MAX_EMAILS_POR_ENVIO) throw new ErroLembrete(400, `Envie para no máximo ${MAX_EMAILS_POR_ENVIO} e-mails por vez.`);
  const invalidos = emails.filter((email) => email.length > 254 || !formatoEmail.test(email));
  if (invalidos.length) throw new ErroLembrete(400, `E-mail inválido: ${invalidos.join(", ")}.`);
  return emails;
}

function lerAlarmes(alarmes) {
  if (alarmes === undefined || alarmes === null) return ALARMES_PADRAO;
  if (!Array.isArray(alarmes)) throw new ErroLembrete(400, "Alarmes inválidos.");
  const minutos = [...new Set(alarmes.map(Number))];
  if (minutos.some((valor) => !ALARMES_PERMITIDOS.has(valor))) throw new ErroLembrete(400, "Alarme inválido.");
  if (minutos.length > MAX_ALARMES) throw new ErroLembrete(400, `Escolha no máximo ${MAX_ALARMES} alarmes.`);
  return minutos.sort((a, b) => b - a);
}

// Carrega o compromisso de { evento_id } ou { entrevista_id } (id da candidatura) com o que vai no convite.
// O convite da entrevista leva só o nome do candidato (sem telefone, e-mail ou curso).
async function carregarAlvo({ evento_id, entrevista_id } = {}) {
  if (Boolean(evento_id) === Boolean(entrevista_id)) throw new ErroLembrete(400, "Informe o evento ou a entrevista.");
  const id = evento_id ?? entrevista_id;
  if (typeof id !== "string" || !uuidValido.test(id)) throw new ErroLembrete(400, "ID inválido.");

  if (evento_id) {
    const evento = await prisma.evento.findUnique({ where: { id } });
    if (!evento) throw new ErroLembrete(404, "Evento não encontrado.");
    return {
      tipo: "evento",
      vinculo: { evento_id: id },
      uid: `evento-${id}@super-estagios`,
      titulo: evento.titulo,
      descricao: evento.descricao,
      local: null,
      inicio: evento.inicio,
      fim: fimDoEvento(evento),
      diaInteiro: evento.dia_inteiro,
      cancelado: false,
    };
  }

  const aplicacao = await prisma.aplicacao.findUnique({
    where: { id },
    select: {
      status_kanban: true,
      data_hora_entrevista: true,
      entrevista_status: true,
      entrevista_formato: true,
      entrevista_local: true,
      entrevista_duracao: true,
      entrevistador: true,
      estudante: { select: { nome_completo: true } },
      vaga: { select: { titulo: true, codigo_vaga: true, empresa: { select: { nome: true } } } },
    },
  });
  if (!aplicacao?.data_hora_entrevista) throw new ErroLembrete(404, "Entrevista não encontrada.");
  const inicio = aplicacao.data_hora_entrevista;
  const formato = { PRESENCIAL: "Presencial", ONLINE: "Online" }[aplicacao.entrevista_formato];
  return {
    tipo: "entrevista",
    vinculo: { aplicacao_id: id },
    uid: `entrevista-${id}@super-estagios`,
    titulo: `Entrevista: ${aplicacao.vaga.empresa.nome} · ${aplicacao.estudante.nome_completo}`,
    descricao: [
      `Vaga: ${aplicacao.vaga.titulo} (Nº ${aplicacao.vaga.codigo_vaga})`,
      `Empresa: ${aplicacao.vaga.empresa.nome}`,
      `Candidato(a): ${aplicacao.estudante.nome_completo}`,
      formato && `Formato: ${formato}`,
      aplicacao.entrevistador && `Entrevistador(a): ${aplicacao.entrevistador}`,
    ].filter(Boolean).join("\n"),
    local: aplicacao.entrevista_local,
    inicio,
    fim: new Date(inicio.getTime() + (aplicacao.entrevista_duracao ?? DURACAO_PADRAO) * MINUTO_MS),
    diaInteiro: false,
    cancelado: statusDaEntrevista(aplicacao) === "CANCELADA",
  };
}

// Histórico de envios e situação do convite: quem ainda tem o convite (ativos), se o horário mudou desde o
// envio (desatualizado) e se dá para mandar o cancelamento (entrevista cancelada com convite ativo).
async function situacao(alvo) {
  const envios = await prisma.lembreteEmail.findMany({
    where: { uid: alvo.uid },
    orderBy: [{ enviado_em: "asc" }, { sequence: "asc" }],
    select: {
      id: true,
      tipo: true,
      email_destino: true,
      enviado_em: true,
      sequence: true,
      alarmes_minutos: true,
      inicio_convite: true,
      fim_convite: true,
      enviado_por: { select: { id: true, nome: true } },
    },
  });

  const ultimoPorEmail = new Map();
  for (const envio of envios) ultimoPorEmail.set(envio.email_destino, envio);
  const ativos = [...ultimoPorEmail.values()].filter((envio) => envio.tipo === "CONVITE");
  const desatualizado = ativos.some((envio) =>
    envio.inicio_convite.getTime() !== alvo.inicio.getTime() || envio.fim_convite.getTime() !== alvo.fim.getTime());

  return {
    envios: envios.slice().reverse(),
    ativos: ativos.map((envio) => envio.email_destino),
    desatualizado: !alvo.cancelado && desatualizado,
    cancelavel: alvo.cancelado && ativos.length > 0,
    cancelado: alvo.cancelado,
    sequence: envios.reduce((maior, envio) => Math.max(maior, envio.sequence), -1),
    _ativos: ativos,
  };
}

function textoDoEmail(alvo, { metodo, atualizacao, usuario }) {
  const quando = alvo.diaInteiro ? `${dataCurta(alvo.inicio)} (dia inteiro)` : `${dataCurta(alvo.inicio)} às ${horaTexto(alvo.inicio)}`;
  const prefixo = metodo === "CANCEL" ? "Cancelado" : atualizacao ? "Atualizado" : "Lembrete";
  const abertura = metodo === "CANCEL"
    ? "O compromisso abaixo foi cancelado. O convite em anexo o remove da sua agenda."
    : atualizacao
      ? "O compromisso abaixo mudou. O convite em anexo atualiza o que já está na sua agenda."
      : "Este é um lembrete do compromisso abaixo. O convite em anexo o adiciona à sua agenda, com os alarmes escolhidos.";
  const linhas = [
    "Olá!",
    "",
    abertura,
    "",
    `Título: ${alvo.titulo}`,
    `Data: ${dataLonga(alvo.inicio)}`,
    alvo.diaInteiro ? "Hora: dia inteiro" : `Hora: ${horaTexto(alvo.inicio)} (horário de Brasília)`,
    !alvo.diaInteiro && `Duração: ${duracaoTexto(Math.round((alvo.fim - alvo.inicio) / MINUTO_MS))}`,
    alvo.local && `Local: ${alvo.local}`,
    alvo.descricao && `Descrição:\n${alvo.descricao}`,
    "",
    `Enviado por ${usuario.nome} pelo Painel de RH da Super Estágios.`,
  ].filter((linha) => linha !== false && linha !== null && linha !== undefined);
  return { assunto: `${prefixo}: ${alvo.titulo} — ${quando}`, texto: linhas.join("\n") };
}

// Limite por usuário: no máximo LIMITE_POR_HORA e-mails (convites, reenvios e cancelamentos) na última hora.
async function conferirLimite(usuario, quantidade) {
  const enviados = await prisma.lembreteEmail.count({
    where: { enviado_por_id: usuario.id, enviado_em: { gte: new Date(Date.now() - HORA_MS) } },
  });
  if (enviados + quantidade > LIMITE_POR_HORA) {
    throw new ErroLembrete(429, `Limite de ${LIMITE_POR_HORA} e-mails por hora atingido (${enviados} enviados na última hora). Tente mais tarde.`);
  }
}

// Envia o convite (REQUEST) ou o cancelamento (CANCEL) para cada destinatário, um e-mail por pessoa,
// e registra cada envio. destinatarios: [{ email, alarmes }]. Todos levam a mesma SEQUENCE (maior que a anterior).
async function enviar(alvo, destinatarios, { metodo, atualizacao = false, usuario, sequenceAnterior }) {
  const org = organizador();
  if (!org) throw new ErroLembrete(503, "Envio de e-mail não configurado.");
  await conferirLimite(usuario, destinatarios.length);

  const sequence = sequenceAnterior + 1;
  const { assunto, texto } = textoDoEmail(alvo, { metodo, atualizacao, usuario });
  const enviados = [];
  for (const { email, alarmes } of destinatarios) {
    const ics = gerarIcs({
      metodo,
      uid: alvo.uid,
      sequence,
      inicio: alvo.inicio,
      fim: alvo.fim,
      diaInteiro: alvo.diaInteiro,
      titulo: alvo.titulo,
      descricao: alvo.descricao,
      local: alvo.local,
      organizador: org,
      convidado: email,
      alarmes,
    });
    try {
      await enviarConvite({ para: email, assunto, texto, ics, metodo });
    } catch (error) {
      console.error("Erro ao enviar lembrete por e-mail:", error.message);
      throw new ErroLembrete(502, `Não foi possível enviar o e-mail para ${email}.${enviados.length ? ` Enviado antes para: ${enviados.join(", ")}.` : ""}`);
    }
    await prisma.lembreteEmail.create({
      data: {
        ...alvo.vinculo,
        tipo: metodo === "CANCEL" ? "CANCELAMENTO" : "CONVITE",
        email_destino: email,
        enviado_por_id: usuario.id,
        uid: alvo.uid,
        sequence,
        alarmes_minutos: alarmes,
        inicio_convite: alvo.inicio,
        fim_convite: alvo.fim,
      },
    });
    enviados.push(email);
  }
  return enviados;
}

// Primeiro envio (ou novos destinatários).
async function criarLembrete(alvo, { emails, alarmes, usuario }) {
  if (alvo.cancelado) throw new ErroLembrete(409, "Esta entrevista foi cancelada; não dá para enviar o convite.");
  const atual = await situacao(alvo);
  return enviar(alvo, emails.map((email) => ({ email, alarmes })), { metodo: "REQUEST", usuario, sequenceAnterior: atual.sequence });
}

// Convite atualizado (mesmo UID, SEQUENCE maior) para quem ainda tem o convite, com os alarmes de antes.
async function reenviarLembrete(alvo, { usuario }) {
  if (alvo.cancelado) throw new ErroLembrete(409, "Esta entrevista foi cancelada; envie o cancelamento do convite.");
  const atual = await situacao(alvo);
  if (!atual._ativos.length) throw new ErroLembrete(409, "Nenhum convite enviado para atualizar.");
  return enviar(alvo, atual._ativos.map((envio) => ({ email: envio.email_destino, alarmes: envio.alarmes_minutos })), {
    metodo: "REQUEST", atualizacao: true, usuario, sequenceAnterior: atual.sequence,
  });
}

// Cancelamento (METHOD:CANCEL) para quem ainda tem o convite.
async function cancelarLembrete(alvo, { usuario }) {
  const atual = await situacao(alvo);
  if (!atual._ativos.length) throw new ErroLembrete(409, "Nenhum convite ativo para cancelar.");
  return enviar(alvo, atual._ativos.map((envio) => ({ email: envio.email_destino, alarmes: [] })), {
    metodo: "CANCEL", usuario, sequenceAnterior: atual.sequence,
  });
}

// Situação para a resposta da API (sem os campos internos).
async function situacaoPublica(alvo) {
  const { _ativos, ...resto } = await situacao(alvo);
  return resto;
}

module.exports = {
  MAX_EMAILS_POR_ENVIO,
  LIMITE_POR_HORA,
  ALARMES_PADRAO,
  ALARMES_PERMITIDOS,
  ErroLembrete,
  lerEmails,
  lerAlarmes,
  carregarAlvo,
  situacaoPublica,
  criarLembrete,
  reenviarLembrete,
  cancelarLembrete,
};
