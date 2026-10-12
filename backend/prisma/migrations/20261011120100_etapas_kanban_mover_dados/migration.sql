-- Parte 3 (2/2): "Em análise" (AGUARDANDO_RETORNO) deixa de existir nas telas; essas candidaturas vão para "Em Teste".
-- updated_at não muda (é preenchido pelo Prisma, não pelo banco), então as datas de cada candidatura ficam como estão.
UPDATE "Aplicacao" SET "status_kanban" = 'EM_TESTE' WHERE "status_kanban" = 'AGUARDANDO_RETORNO';

-- Candidaturas novas começam em "Candidato Contatado" (o código também envia a etapa explicitamente).
ALTER TABLE "Aplicacao" ALTER COLUMN "status_kanban" SET DEFAULT 'CANDIDATO_CONTATADO';
