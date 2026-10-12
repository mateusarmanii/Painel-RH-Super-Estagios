-- Parte 5: eventos do Calendário e registro dos lembretes por e-mail. Só tabelas novas; nenhuma tabela existente muda
-- (as chaves estrangeiras ficam nas tabelas novas).

-- CreateEnum
CREATE TYPE "TipoLembrete" AS ENUM ('CONVITE', 'CANCELAMENTO');

-- CreateTable
CREATE TABLE "Evento" (
    "id" UUID NOT NULL,
    "titulo" VARCHAR(120) NOT NULL,
    "descricao" TEXT,
    "inicio" TIMESTAMP(3) NOT NULL,
    "duracao_minutos" INTEGER NOT NULL DEFAULT 60,
    "dia_inteiro" BOOLEAN NOT NULL DEFAULT false,
    "criado_por_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LembreteEmail" (
    "id" UUID NOT NULL,
    "evento_id" UUID,
    "aplicacao_id" UUID,
    "tipo" "TipoLembrete" NOT NULL DEFAULT 'CONVITE',
    "email_destino" VARCHAR(254) NOT NULL,
    "enviado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviado_por_id" UUID,
    "uid" VARCHAR(255) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "alarmes_minutos" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "inicio_convite" TIMESTAMP(3) NOT NULL,
    "fim_convite" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LembreteEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Evento_inicio_idx" ON "Evento"("inicio");

-- CreateIndex
CREATE INDEX "LembreteEmail_uid_idx" ON "LembreteEmail"("uid");

-- CreateIndex
CREATE INDEX "LembreteEmail_enviado_por_id_enviado_em_idx" ON "LembreteEmail"("enviado_por_id", "enviado_em");

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LembreteEmail" ADD CONSTRAINT "LembreteEmail_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LembreteEmail" ADD CONSTRAINT "LembreteEmail_aplicacao_id_fkey" FOREIGN KEY ("aplicacao_id") REFERENCES "Aplicacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LembreteEmail" ADD CONSTRAINT "LembreteEmail_enviado_por_id_fkey" FOREIGN KEY ("enviado_por_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

