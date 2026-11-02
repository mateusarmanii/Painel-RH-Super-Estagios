-- CreateEnum
CREATE TYPE "ParecerTipo" AS ENUM ('APROVADO', 'TALVEZ', 'REPROVADO');

-- CreateEnum
CREATE TYPE "TipoContato" AS ENUM ('NOTA', 'LIGACAO', 'WHATSAPP', 'EMAIL', 'REUNIAO', 'SEM_RESPOSTA');

-- AlterTable
ALTER TABLE "Aplicacao" ADD COLUMN     "ordem" INTEGER,
ADD COLUMN     "remarcacao_mensagem" TEXT,
ADD COLUMN     "remarcacao_pedida_em" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "arquivada_em" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Estudante" ADD COLUMN     "anonimizado_em" TIMESTAMP(3),
ADD COLUMN     "arquivado_em" TIMESTAMP(3),
ADD COLUMN     "consentimento_em" TIMESTAMP(3),
ADD COLUMN     "etiquetas" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "origem" VARCHAR(20);

-- AlterTable
ALTER TABLE "Vaga" ADD COLUMN     "arquivada_em" TIMESTAMP(3),
ADD COLUMN     "portal_token" VARCHAR(64),
ADD COLUMN     "prazo" DATE,
ADD COLUMN     "quantidade" INTEGER,
ADD COLUMN     "responsavel_id" UUID;

-- CreateTable
CREATE TABLE "Estagio" (
    "id" UUID NOT NULL,
    "aplicacao_id" UUID NOT NULL,
    "data_inicio" DATE,
    "data_fim" DATE,
    "tce_assinado" BOOLEAN NOT NULL DEFAULT false,
    "seguro_apolice" VARCHAR(100),
    "supervisor" VARCHAR(100),
    "taxa_agenciamento" DOUBLE PRECISION,
    "observacoes" TEXT,
    "encerrado_em" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Estagio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelatorioEstagio" (
    "id" UUID NOT NULL,
    "estagio_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "entregue_em" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelatorioEstagio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParecerEmpresa" (
    "id" UUID NOT NULL,
    "aplicacao_id" UUID NOT NULL,
    "parecer" "ParecerTipo" NOT NULL,
    "comentario" TEXT,
    "nome_avaliador" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParecerEmpresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModeloMensagem" (
    "id" UUID NOT NULL,
    "titulo" VARCHAR(80) NOT NULL,
    "texto" TEXT NOT NULL,
    "criado_por_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModeloMensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contato" (
    "id" UUID NOT NULL,
    "estudante_id" UUID,
    "empresa_id" UUID,
    "aplicacao_id" UUID,
    "tipo" "TipoContato" NOT NULL DEFAULT 'NOTA',
    "texto" TEXT,
    "proximo_contato" DATE,
    "usuario_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Atividade" (
    "id" UUID NOT NULL,
    "usuario_id" UUID,
    "metodo" VARCHAR(8) NOT NULL,
    "caminho" VARCHAR(200) NOT NULL,
    "entidade" VARCHAR(30),
    "entidade_id" UUID,
    "status" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Atividade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracao" (
    "chave" VARCHAR(60) NOT NULL,
    "valor" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Configuracao_pkey" PRIMARY KEY ("chave")
);

-- CreateIndex
CREATE UNIQUE INDEX "Estagio_aplicacao_id_key" ON "Estagio"("aplicacao_id");

-- CreateIndex
CREATE UNIQUE INDEX "RelatorioEstagio_estagio_id_numero_key" ON "RelatorioEstagio"("estagio_id", "numero");

-- CreateIndex
CREATE INDEX "ParecerEmpresa_aplicacao_id_created_at_idx" ON "ParecerEmpresa"("aplicacao_id", "created_at");

-- CreateIndex
CREATE INDEX "Contato_estudante_id_created_at_idx" ON "Contato"("estudante_id", "created_at");

-- CreateIndex
CREATE INDEX "Contato_empresa_id_created_at_idx" ON "Contato"("empresa_id", "created_at");

-- CreateIndex
CREATE INDEX "Atividade_created_at_idx" ON "Atividade"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Vaga_portal_token_key" ON "Vaga"("portal_token");

-- AddForeignKey
ALTER TABLE "Vaga" ADD CONSTRAINT "Vaga_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estagio" ADD CONSTRAINT "Estagio_aplicacao_id_fkey" FOREIGN KEY ("aplicacao_id") REFERENCES "Aplicacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatorioEstagio" ADD CONSTRAINT "RelatorioEstagio_estagio_id_fkey" FOREIGN KEY ("estagio_id") REFERENCES "Estagio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParecerEmpresa" ADD CONSTRAINT "ParecerEmpresa_aplicacao_id_fkey" FOREIGN KEY ("aplicacao_id") REFERENCES "Aplicacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeloMensagem" ADD CONSTRAINT "ModeloMensagem_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contato" ADD CONSTRAINT "Contato_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "Estudante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contato" ADD CONSTRAINT "Contato_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contato" ADD CONSTRAINT "Contato_aplicacao_id_fkey" FOREIGN KEY ("aplicacao_id") REFERENCES "Aplicacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contato" ADD CONSTRAINT "Contato_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atividade" ADD CONSTRAINT "Atividade_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

