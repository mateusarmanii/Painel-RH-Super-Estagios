-- CreateTable
CREATE TABLE "HistoricoEtapa" (
    "id" UUID NOT NULL,
    "aplicacao_id" UUID NOT NULL,
    "de_status" "StatusKanban",
    "para_status" "StatusKanban" NOT NULL,
    "usuario_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoEtapa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistoricoEtapa_aplicacao_id_created_at_idx" ON "HistoricoEtapa"("aplicacao_id", "created_at");

-- AddForeignKey
ALTER TABLE "HistoricoEtapa" ADD CONSTRAINT "HistoricoEtapa_aplicacao_id_fkey" FOREIGN KEY ("aplicacao_id") REFERENCES "Aplicacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoEtapa" ADD CONSTRAINT "HistoricoEtapa_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

