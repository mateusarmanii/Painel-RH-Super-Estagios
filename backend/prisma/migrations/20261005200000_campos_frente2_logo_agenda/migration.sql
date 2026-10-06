-- CreateEnum
CREATE TYPE "TurnoEstudo" AS ENUM ('MANHA', 'TARDE', 'NOITE', 'INTEGRAL', 'EAD');

-- CreateEnum
CREATE TYPE "Periodo" AS ENUM ('MANHA', 'TARDE', 'NOITE');

-- CreateEnum
CREATE TYPE "TurnoVaga" AS ENUM ('MANHA', 'TARDE', 'INTEGRAL');

-- CreateEnum
CREATE TYPE "EntrevistaStatus" AS ENUM ('AGUARDANDO', 'CONFIRMADA', 'REALIZADA', 'NAO_COMPARECEU', 'CANCELADA');

-- CreateEnum
CREATE TYPE "EntrevistaFormato" AS ENUM ('PRESENCIAL', 'ONLINE');

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "logo_url" TEXT;

-- AlterTable
ALTER TABLE "Estudante" ADD COLUMN     "data_nascimento" DATE,
ADD COLUMN     "disponibilidade" "Periodo"[] DEFAULT ARRAY[]::"Periodo"[],
ADD COLUMN     "previsao_formatura" DATE,
ADD COLUMN     "semestre_atual" INTEGER,
ADD COLUMN     "turno_estudo" "TurnoEstudo",
ALTER COLUMN "horario_estudo" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Vaga" ADD COLUMN     "turno" "TurnoVaga";

-- AlterTable
ALTER TABLE "Aplicacao" ADD COLUMN     "entrevista_duracao" INTEGER DEFAULT 45,
ADD COLUMN     "entrevista_formato" "EntrevistaFormato",
ADD COLUMN     "entrevista_local" TEXT,
ADD COLUMN     "entrevista_status" "EntrevistaStatus",
ADD COLUMN     "entrevistador" TEXT,
ADD COLUMN     "observacao" TEXT;


-- Dados (aprovados): estudantes já cadastrados recebem o turno de estudo a partir do horário antigo,
-- só onde ainda estiver vazio (MANHA, TARDE e NOITE existem nos dois enums).
UPDATE "Estudante" SET "turno_estudo" = "horario_estudo"::text::"TurnoEstudo"
WHERE "turno_estudo" IS NULL AND "horario_estudo" IS NOT NULL;

-- Dados (aprovados): entrevistas que estão hoje na coluna "Entrevista" ficam como "Aguardando".
UPDATE "Aplicacao" SET "entrevista_status" = 'AGUARDANDO'
WHERE "status_kanban" = 'ENTREVISTA_AGENDADA' AND "entrevista_status" IS NULL;
