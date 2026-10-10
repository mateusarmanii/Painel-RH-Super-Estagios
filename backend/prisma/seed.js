require("dotenv").config();

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Este seed APAGA todas as empresas, vagas, estudantes e candidaturas antes de criar os exemplos.
// Só roda com a confirmação explícita: npm run seed -- --confirmar-apagar-tudo
const CONFIRMACAO = "--confirmar-apagar-tudo";

async function main() {
  if (!process.argv.includes(CONFIRMACAO)) {
    console.log("ATENÇÃO: este seed apaga TODOS os dados do banco (empresas, vagas, estudantes e candidaturas).");
    console.log(`Nada foi feito. Para confirmar, rode: npm run seed -- ${CONFIRMACAO}`);
    process.exitCode = 1;
    return;
  }

  const resumo = await prisma.$transaction(async (transaction) => {
    await transaction.aplicacao.deleteMany();
    await transaction.vaga.deleteMany();
    await transaction.estudante.deleteMany();
    await transaction.empresa.deleteMany();

    const empresaAurora = await transaction.empresa.create({
      data: {
        nome: "Aurora Tecnologia",
        nome_contato: "Mariana Costa",
        telefone_contato: "11987654321",
        email_contato: "mariana@auroratecnologia.example",
      },
    });

    const empresaHorizonte = await transaction.empresa.create({
      data: {
        nome: "Horizonte Comunicação",
        nome_contato: "Paulo Mendes",
        telefone_contato: "1134567890",
        email_contato: "paulo@horizontecomunicacao.example",
      },
    });

    const vagaDesenvolvimento = await transaction.vaga.create({
      data: {
        codigo_vaga: "100001",
        titulo: "Estágio em Desenvolvimento Front-end",
        descricao: "Apoio no desenvolvimento de interfaces web.",
        valor: 1500,
        empresa_id: empresaAurora.id,
      },
    });

    const vagaDados = await transaction.vaga.create({
      data: {
        codigo_vaga: "100002",
        titulo: "Estágio em Análise de Dados",
        descricao: "Apoio na análise e visualização de dados.",
        valor: 1600,
        empresa_id: empresaAurora.id,
      },
    });

    const vagaMarketing = await transaction.vaga.create({
      data: {
        codigo_vaga: "100003",
        titulo: "Estágio em Marketing Digital",
        descricao: "Apoio na criação de campanhas e conteúdo digital.",
        valor: 1400,
        empresa_id: empresaHorizonte.id,
      },
    });

    const candidatos = await Promise.all([
      transaction.estudante.create({
        data: {
          nome_completo: "Ana Luiza Martins",
          telefone: "11911112222",
          email: "ana.martins@example.com",
          curso: "Sistemas de Informação",
          instituicao_ensino: "Universidade Central",
          horario_estudo: "NOITE",
        },
      }),
      transaction.estudante.create({
        data: {
          nome_completo: "Bruno Henrique Costa",
          telefone: "11922223333",
          email: "bruno.costa@example.com",
          curso: "Ciência da Computação",
          instituicao_ensino: "Faculdade Metropolitana",
          horario_estudo: "MANHA",
        },
      }),
      transaction.estudante.create({
        data: {
          nome_completo: "Camila Rocha Almeida",
          telefone: "11933334444",
          email: "camila.almeida@example.com",
          curso: "Estatística",
          instituicao_ensino: "Universidade Central",
          horario_estudo: "TARDE",
        },
      }),
      transaction.estudante.create({
        data: {
          nome_completo: "Daniel Souza Lima",
          telefone: "11944445555",
          email: "daniel.lima@example.com",
          curso: "Engenharia de Computação",
          instituicao_ensino: "Instituto do Vale",
          horario_estudo: "NOITE",
        },
      }),
      transaction.estudante.create({
        data: {
          nome_completo: "Eduarda Lima Santos",
          telefone: "11955556666",
          email: "eduarda.santos@example.com",
          curso: "Publicidade e Propaganda",
          instituicao_ensino: "Faculdade Metropolitana",
          horario_estudo: "MANHA",
        },
      }),
      transaction.estudante.create({
        data: {
          nome_completo: "Felipe Oliveira Nunes",
          telefone: "11966667777",
          email: "felipe.nunes@example.com",
          curso: "Marketing",
          instituicao_ensino: "Instituto do Vale",
          horario_estudo: "TARDE",
        },
      }),
    ]);

    await transaction.aplicacao.createMany({
      data: [
        {
          vaga_id: vagaDesenvolvimento.id,
          estudante_id: candidatos[0].id,
          status_kanban: "ENVIADO_EMPRESA",
        },
        {
          vaga_id: vagaDesenvolvimento.id,
          estudante_id: candidatos[1].id,
          status_kanban: "AGUARDANDO_RETORNO",
        },
        {
          vaga_id: vagaDados.id,
          estudante_id: candidatos[2].id,
          status_kanban: "ENTREVISTA_AGENDADA",
          data_hora_entrevista: new Date("2026-10-05T14:00:00.000Z"),
        },
        {
          vaga_id: vagaDados.id,
          estudante_id: candidatos[3].id,
          status_kanban: "APROVADO",
        },
        {
          vaga_id: vagaMarketing.id,
          estudante_id: candidatos[4].id,
          status_kanban: "ENVIADO_EMPRESA",
        },
        {
          vaga_id: vagaMarketing.id,
          estudante_id: candidatos[5].id,
          status_kanban: "AGUARDANDO_RETORNO",
        },
      ],
    });

    return { empresas: 2, vagas: 3, candidatos: candidatos.length, aplicacoes: 6 };
  });

  console.log("Seed concluído:", resumo);
}

main()
  .catch((error) => {
    console.error("Erro ao executar seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });