-- CreateEnum
CREATE TYPE "HorarioEstudo" AS ENUM ('MANHA', 'TARDE', 'NOITE');

-- CreateEnum
CREATE TYPE "StatusVaga" AS ENUM ('ABERTA', 'FECHADA', 'SUSPENSA');

-- CreateEnum
CREATE TYPE "StatusKanban" AS ENUM ('ENVIADO_EMPRESA', 'ENTREVISTA_AGENDADA', 'AGUARDANDO_RETORNO', 'APROVADO', 'RECUSADO');

-- CreateTable
CREATE TABLE "Empresa" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "nome_contato" TEXT NOT NULL,
    "telefone_contato" TEXT NOT NULL,
    "email_contato" TEXT,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estudante" (
    "id" UUID NOT NULL,
    "nome_completo" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "email" TEXT,
    "curso" TEXT NOT NULL,
    "instituicao_ensino" TEXT NOT NULL,
    "link_curriculo" TEXT,
    "endereco" TEXT,
    "horario_estudo" "HorarioEstudo" NOT NULL,

    CONSTRAINT "Estudante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vaga" (
    "id" UUID NOT NULL,
    "codigo_vaga" VARCHAR(6) NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "status" "StatusVaga" NOT NULL DEFAULT 'ABERTA',
    "empresa_id" UUID NOT NULL,

    CONSTRAINT "Vaga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aplicacao" (
    "id" UUID NOT NULL,
    "vaga_id" UUID NOT NULL,
    "estudante_id" UUID NOT NULL,
    "status_kanban" "StatusKanban" NOT NULL DEFAULT 'ENVIADO_EMPRESA',
    "data_hora_entrevista" TIMESTAMP(3),
    "motivo_recusa" TEXT,

    CONSTRAINT "Aplicacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vaga_codigo_vaga_key" ON "Vaga"("codigo_vaga");

-- AddForeignKey
ALTER TABLE "Vaga" ADD CONSTRAINT "Vaga_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aplicacao" ADD CONSTRAINT "Aplicacao_vaga_id_fkey" FOREIGN KEY ("vaga_id") REFERENCES "Vaga"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aplicacao" ADD CONSTRAINT "Aplicacao_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "Estudante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
