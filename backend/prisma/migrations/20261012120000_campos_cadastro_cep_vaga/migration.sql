-- Parte 4: campos novos nos cadastros. Só adições e DROP NOT NULL (nenhuma coluna é apagada).

-- Enums novos da vaga
CREATE TYPE "ModalidadeVaga" AS ENUM ('PRESENCIAL', 'HIBRIDA', 'HOME_OFFICE');
CREATE TYPE "SexoPreferencia" AS ENUM ('FEMININO', 'MASCULINO');

-- Empresa: setor opcional (o padrão 'Nao informado' continua na coluna)
ALTER TABLE "Empresa" ALTER COLUMN "setor" DROP NOT NULL;

-- Estudante: CEP (8 dígitos), cidade e bairro; instituição aceita NULL
ALTER TABLE "Estudante" ADD COLUMN "cep" VARCHAR(8),
ADD COLUMN "cidade" TEXT,
ADD COLUMN "bairro" TEXT,
ALTER COLUMN "instituicao_ensino" DROP NOT NULL;

-- "Não informada" deixa de ser texto vazio
UPDATE "Estudante" SET "instituicao_ensino" = NULL WHERE "instituicao_ensino" = '';

-- Vaga: horário livre, endereço, modalidade e preferência interna
ALTER TABLE "Vaga" ADD COLUMN "horario" TEXT,
ADD COLUMN "cep" VARCHAR(8),
ADD COLUMN "cidade" TEXT,
ADD COLUMN "bairro" TEXT,
ADD COLUMN "modalidade" "ModalidadeVaga",
ADD COLUMN "sexo_preferencia" "SexoPreferencia";
