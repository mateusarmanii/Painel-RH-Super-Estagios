-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "telegram_chat_id" VARCHAR(32),
ADD COLUMN     "telegram_codigo" VARCHAR(40),
ADD COLUMN     "telegram_codigo_expira" TIMESTAMP(3),
ADD COLUMN     "telegram_conectado_em" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "NotificacaoEnviada" (
    "usuario_id" UUID NOT NULL,
    "chave" VARCHAR(300) NOT NULL,
    "enviada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificacaoEnviada_pkey" PRIMARY KEY ("usuario_id","chave")
);

-- CreateIndex
CREATE INDEX "NotificacaoEnviada_enviada_em_idx" ON "NotificacaoEnviada"("enviada_em");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_telegram_chat_id_key" ON "Usuario"("telegram_chat_id");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_telegram_codigo_key" ON "Usuario"("telegram_codigo");

-- AddForeignKey
ALTER TABLE "NotificacaoEnviada" ADD CONSTRAINT "NotificacaoEnviada_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

