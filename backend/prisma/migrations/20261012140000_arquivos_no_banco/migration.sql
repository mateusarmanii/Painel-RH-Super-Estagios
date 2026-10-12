-- CreateEnum
CREATE TYPE "TipoArquivo" AS ENUM ('LOGO', 'CURRICULO');

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "logo_arquivo_id" UUID;

-- AlterTable
ALTER TABLE "Estudante" ADD COLUMN     "curriculo_arquivo_id" UUID;

-- CreateTable
CREATE TABLE "Arquivo" (
    "id" UUID NOT NULL,
    "tipo" "TipoArquivo" NOT NULL,
    "nome_original" VARCHAR(255) NOT NULL,
    "mime" VARCHAR(100) NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "conteudo" BYTEA NOT NULL,
    "enviado_por_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Arquivo_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Arquivo" ADD CONSTRAINT "Arquivo_enviado_por_id_fkey" FOREIGN KEY ("enviado_por_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_logo_arquivo_id_fkey" FOREIGN KEY ("logo_arquivo_id") REFERENCES "Arquivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estudante" ADD CONSTRAINT "Estudante_curriculo_arquivo_id_fkey" FOREIGN KEY ("curriculo_arquivo_id") REFERENCES "Arquivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

