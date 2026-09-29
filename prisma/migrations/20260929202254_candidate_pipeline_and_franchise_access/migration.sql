/*
  Warnings:

  - You are about to drop the column `email` on the `candidatos` table. All the data in the column will be lost.
  - You are about to drop the column `nome_completo` on the `candidatos` table. All the data in the column will be lost.
  - You are about to drop the column `cnpj` on the `empresas` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `vagas` table. All the data in the column will be lost.
  - You are about to drop the column `titulo` on the `vagas` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[login]` on the table `franquias` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[codigo]` on the table `vagas` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `cep` to the `candidatos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `curriculo_path` to the `candidatos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endereco` to the `candidatos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `franquia_id` to the `candidatos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nome` to the `candidatos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `login` to the `franquias` table without a default value. This is not possible if the table is not empty.
  - Added the required column `senha_hash` to the `franquias` table without a default value. This is not possible if the table is not empty.
  - Added the required column `codigo` to the `vagas` table without a default value. This is not possible if the table is not empty.
  - Added the required column `link` to the `vagas` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nome` to the `vagas` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "aplicacoes" ADD COLUMN     "removida_em" TIMESTAMP(3),
ALTER COLUMN "status_funil" SET DEFAULT 'Enviado para a Empresa';

-- AlterTable
ALTER TABLE "candidatos" DROP COLUMN "email",
DROP COLUMN "nome_completo",
ADD COLUMN     "cep" TEXT NOT NULL,
ADD COLUMN     "curriculo_path" TEXT NOT NULL,
ADD COLUMN     "endereco" TEXT NOT NULL,
ADD COLUMN     "franquia_id" INTEGER NOT NULL,
ADD COLUMN     "nome" TEXT NOT NULL,
ADD COLUMN     "status_banco" TEXT;

-- AlterTable
ALTER TABLE "empresas" DROP COLUMN "cnpj",
ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "entrevistas" ADD COLUMN     "relatorio_path" TEXT;

-- AlterTable
ALTER TABLE "franquias" ADD COLUMN     "login" TEXT NOT NULL,
ADD COLUMN     "senha_hash" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "vagas" DROP COLUMN "status",
DROP COLUMN "titulo",
ADD COLUMN     "codigo" VARCHAR(6) NOT NULL,
ADD COLUMN     "link" TEXT NOT NULL,
ADD COLUMN     "nome" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "aplicacoes_candidato_id_idx" ON "aplicacoes"("candidato_id");

-- CreateIndex
CREATE INDEX "aplicacoes_vaga_id_removida_em_idx" ON "aplicacoes"("vaga_id", "removida_em");

-- CreateIndex
CREATE INDEX "candidatos_franquia_id_idx" ON "candidatos"("franquia_id");

-- CreateIndex
CREATE UNIQUE INDEX "franquias_login_key" ON "franquias"("login");

-- CreateIndex
CREATE UNIQUE INDEX "vagas_codigo_key" ON "vagas"("codigo");

-- AddForeignKey
ALTER TABLE "candidatos" ADD CONSTRAINT "candidatos_franquia_id_fkey" FOREIGN KEY ("franquia_id") REFERENCES "franquias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
