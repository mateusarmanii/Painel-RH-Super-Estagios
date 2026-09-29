-- AlterTable
ALTER TABLE "aplicacoes" ADD COLUMN     "contratada_em" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "vagas" ADD COLUMN     "aberta" BOOLEAN NOT NULL DEFAULT true;
