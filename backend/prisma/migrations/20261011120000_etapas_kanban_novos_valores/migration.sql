-- Parte 3 (1/2): novas etapas do Kanban. Só adiciona os valores ao enum.
-- No Postgres, um valor novo de enum não pode ser usado na mesma transação em que foi criado;
-- por isso a mudança dos dados e do padrão fica na migration seguinte.
-- AGUARDANDO_RETORNO não é removido (evita recriar o tipo); o código deixa de usá-lo.
ALTER TYPE "StatusKanban" ADD VALUE IF NOT EXISTS 'CANDIDATO_CONTATADO' BEFORE 'ENVIADO_EMPRESA';
ALTER TYPE "StatusKanban" ADD VALUE IF NOT EXISTS 'EM_TESTE' AFTER 'ENTREVISTA_AGENDADA';
