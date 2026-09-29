-- CreateTable
CREATE TABLE "candidatos" (
    "id" UUID NOT NULL,
    "nome_completo" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "curso" TEXT NOT NULL,
    "instituicao" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidatos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aplicacoes" (
    "id" UUID NOT NULL,
    "vaga_id" INTEGER NOT NULL,
    "candidato_id" UUID NOT NULL,
    "status_funil" TEXT NOT NULL DEFAULT 'Novo',
    "data_aplicacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aplicacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entrevistas" (
    "id" UUID NOT NULL,
    "aplicacao_id" UUID NOT NULL,
    "data_hora_inicio" TIMESTAMP(3) NOT NULL,
    "data_hora_fim" TIMESTAMP(3) NOT NULL,
    "link_reuniao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Agendada',

    CONSTRAINT "entrevistas_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "aplicacoes" ADD CONSTRAINT "aplicacoes_vaga_id_fkey" FOREIGN KEY ("vaga_id") REFERENCES "vagas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicacoes" ADD CONSTRAINT "aplicacoes_candidato_id_fkey" FOREIGN KEY ("candidato_id") REFERENCES "candidatos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrevistas" ADD CONSTRAINT "entrevistas_aplicacao_id_fkey" FOREIGN KEY ("aplicacao_id") REFERENCES "aplicacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
