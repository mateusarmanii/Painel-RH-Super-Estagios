const uuidValido = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DIA_MS = 24 * 60 * 60 * 1000;
// Vaga em alerta: aberta há mais de DIAS_PARA_ALERTA dias e sem ninguém em "Entrevista" (mesma regra do Dashboard).
const DIAS_PARA_ALERTA = 10;

function pluralizar(total, singular, plural) {
  return `${total} ${total === 1 ? singular : plural}`;
}

const etapasEmProcesso = ["ENVIADO_EMPRESA", "ENTREVISTA_AGENDADA", "AGUARDANDO_RETORNO"];

// Conta candidaturas por etapa (só leitura, usado nos cards de vagas e empresas).
function resumirCandidaturas(aplicacoes) {
  const por_etapa = { ENVIADO_EMPRESA: 0, ENTREVISTA_AGENDADA: 0, AGUARDANDO_RETORNO: 0, APROVADO: 0, RECUSADO: 0 };
  for (const aplicacao of aplicacoes) por_etapa[aplicacao.status_kanban]++;
  return {
    total: aplicacoes.length,
    por_etapa,
    em_processo: etapasEmProcesso.reduce((soma, etapa) => soma + por_etapa[etapa], 0),
  };
}

// Resumo do card de vaga: candidatos por etapa, dias em aberto e se está em alerta.
function resumirVaga(vaga, aplicacoes, agora = new Date()) {
  const resumo = resumirCandidaturas(aplicacoes);
  const dias_aberta = Math.floor((agora - vaga.created_at) / DIA_MS);
  return {
    ...resumo,
    dias_aberta,
    em_alerta: vaga.status === "ABERTA" && agora - vaga.created_at > DIAS_PARA_ALERTA * DIA_MS && resumo.por_etapa.ENTREVISTA_AGENDADA === 0,
  };
}

// Tira os espaços do começo e do fim de todos os textos enviados ao salvar (empresas, vagas, estudantes...).
// Um campo só com espaços vira "" e cai na validação de campo obrigatório.
function aparaTextos(req, _res, next) {
  if (["POST", "PUT", "PATCH"].includes(req.method) && req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    for (const [campo, valor] of Object.entries(req.body)) {
      if (typeof valor === "string") req.body[campo] = valor.trim();
    }
  }
  next();
}

module.exports = { uuidValido, pluralizar, resumirCandidaturas, resumirVaga, aparaTextos, DIA_MS, DIAS_PARA_ALERTA };
