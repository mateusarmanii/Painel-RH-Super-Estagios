// Etapas da candidatura (enum StatusKanban), na ordem das colunas do Kanban.
// AGUARDANDO_RETORNO ("Em análise") continua no enum do banco só para não recriar o tipo: as candidaturas
// foram movidas para EM_TESTE (migration 20261011120100) e o código não aceita mais esse valor.
const ETAPAS = ["CANDIDATO_CONTATADO", "ENVIADO_EMPRESA", "ENTREVISTA_AGENDADA", "EM_TESTE", "APROVADO", "RECUSADO"];

// Toda candidatura nova (cadastro com vaga e "Indicar para vaga") começa aqui.
const ETAPA_INICIAL = "CANDIDATO_CONTATADO";

// Ainda no processo: são dispensadas quando a vaga é fechada e contam como "em processo".
const ETAPAS_EM_PROCESSO = ["CANDIDATO_CONTATADO", "ENVIADO_EMPRESA", "ENTREVISTA_AGENDADA", "EM_TESTE"];

// A vaga andou: alguém chegou à entrevista ou ao teste. Sem ninguém nelas, a vaga aberta há dias entra em alerta.
const ETAPAS_AVANCADAS = ["ENTREVISTA_AGENDADA", "EM_TESTE"];

module.exports = { ETAPAS, ETAPA_INICIAL, ETAPAS_EM_PROCESSO, ETAPAS_AVANCADAS };
