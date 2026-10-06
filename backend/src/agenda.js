// Regras da Agenda de entrevistas: status exibido, campos da entrevista e conflito de horário.

const MINUTO_MS = 60 * 1000;
const DURACAO_PADRAO = 45;
const formatos = new Set(["PRESENCIAL", "ONLINE"]);

// Status mostrado na Agenda. Entrevistas antigas (de antes do campo existir) têm entrevista_status vazio:
// deduz pela etapa em que o candidato está.
function statusDaEntrevista(aplicacao) {
  if (aplicacao.entrevista_status) return aplicacao.entrevista_status;
  switch (aplicacao.status_kanban) {
    case "ENTREVISTA_AGENDADA":
      return "AGUARDANDO";
    case "AGUARDANDO_RETORNO":
    case "APROVADO":
      return "REALIZADA";
    default:
      return "CANCELADA";
  }
}

// Ao tirar o candidato da coluna "Entrevista" pelo Kanban, a entrevista em aberto ganha um desfecho:
// seguiu no processo → realizada; voltou ou foi dispensado → cancelada. "Não compareceu" e "Realizada" ficam.
function statusAoSairDaEntrevista(statusAtual, novaEtapa) {
  if (statusAtual && !["AGUARDANDO", "CONFIRMADA"].includes(statusAtual)) return statusAtual;
  return ["AGUARDANDO_RETORNO", "APROVADO"].includes(novaEtapa) ? "REALIZADA" : "CANCELADA";
}

// Formato, local/link, duração e entrevistador (todos opcionais; ausente não muda, vazio apaga).
function camposEntrevista(body) {
  const data = {};
  const { entrevista_formato, entrevista_local, entrevista_duracao, entrevistador } = body ?? {};

  if (entrevista_formato !== undefined) {
    if (entrevista_formato === null || entrevista_formato === "") data.entrevista_formato = null;
    else if (formatos.has(entrevista_formato)) data.entrevista_formato = entrevista_formato;
    else return { erro: "Formato da entrevista inválido: use Presencial ou Online." };
  }

  if (entrevista_local !== undefined) {
    if (entrevista_local !== null && typeof entrevista_local !== "string") return { erro: "Local ou link inválido." };
    if (entrevista_local && entrevista_local.length > 500) return { erro: "Local ou link com mais de 500 caracteres." };
    data.entrevista_local = entrevista_local || null;
  }

  if (entrevista_duracao !== undefined) {
    if (entrevista_duracao === null || entrevista_duracao === "") data.entrevista_duracao = DURACAO_PADRAO;
    else {
      const duracao = Number(entrevista_duracao);
      if (!Number.isInteger(duracao) || duracao < 15 || duracao > 240) {
        return { erro: "Duração da entrevista deve ser de 15 a 240 minutos." };
      }
      data.entrevista_duracao = duracao;
    }
  }

  if (entrevistador !== undefined) {
    if (entrevistador !== null && typeof entrevistador !== "string") return { erro: "Entrevistador inválido." };
    if (entrevistador && entrevistador.length > 120) return { erro: "Nome do entrevistador com mais de 120 caracteres." };
    data.entrevistador = entrevistador || null;
  }

  return { data };
}

function fimDaEntrevista(aplicacao) {
  return new Date(new Date(aplicacao.data_hora_entrevista).getTime() + (aplicacao.entrevista_duracao ?? DURACAO_PADRAO) * MINUTO_MS);
}

function sobrepoe(a, b) {
  return new Date(a.data_hora_entrevista) < fimDaEntrevista(b) && new Date(b.data_hora_entrevista) < fimDaEntrevista(a);
}

// Outras entrevistas do mesmo estudante que batem com o horário (canceladas não contam).
async function conflitosDoEstudante(prisma, { estudanteId, aplicacaoId, inicio, duracao }) {
  const outras = await prisma.aplicacao.findMany({
    where: { estudante_id: estudanteId, id: { not: aplicacaoId }, data_hora_entrevista: { not: null } },
    select: {
      id: true,
      status_kanban: true,
      entrevista_status: true,
      data_hora_entrevista: true,
      entrevista_duracao: true,
      vaga: { select: { titulo: true, empresa: { select: { nome: true } } } },
    },
  });
  const nova = { data_hora_entrevista: inicio, entrevista_duracao: duracao };
  return outras
    .filter((outra) => statusDaEntrevista(outra) !== "CANCELADA" && sobrepoe(nova, outra))
    .map((outra) => ({
      id: outra.id,
      data_hora_entrevista: outra.data_hora_entrevista,
      vaga: outra.vaga.titulo,
      empresa: outra.vaga.empresa.nome,
    }));
}

// Marca, numa lista de entrevistas, as que batem com outra do mesmo estudante.
function marcarConflitos(entrevistas) {
  const ativas = entrevistas.filter((entrevista) => entrevista.status_exibido !== "CANCELADA");
  return entrevistas.map((entrevista) => ({
    ...entrevista,
    conflito_com:
      entrevista.status_exibido === "CANCELADA"
        ? []
        : ativas
            .filter((outra) => outra.id !== entrevista.id && outra.estudante.id === entrevista.estudante.id && sobrepoe(entrevista, outra))
            .map((outra) => outra.id),
  }));
}

module.exports = {
  DURACAO_PADRAO,
  statusDaEntrevista,
  statusAoSairDaEntrevista,
  camposEntrevista,
  conflitosDoEstudante,
  marcarConflitos,
};
