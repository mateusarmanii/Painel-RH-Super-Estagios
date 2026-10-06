// Remove tudo o que for "[DEMO]" (empresas, vagas, estudantes e as candidaturas deles).
// Uso: npm run demo:limpar
// Segurança: se algum registro real estiver ligado a um [DEMO] (ex.: um estudante real inscrito numa vaga
// [DEMO], ou uma vaga real cadastrada numa empresa [DEMO]), o script não apaga nada e lista o conflito.
const path = require("path");

process.chdir(path.resolve(__dirname, ".."));
require("dotenv").config();
const prisma = require("../src/prisma");
const { apagarLogo } = require("../src/logos");

const PREFIXO = "[DEMO]";

async function main() {
  const resultado = await prisma.$transaction(async (tx) => {
    const empresas = await tx.empresa.findMany({ where: { nome: { startsWith: PREFIXO } }, select: { id: true, logo_url: true } });
    const empresaIds = empresas.map((e) => e.id);
    const vagas = await tx.vaga.findMany({ where: { titulo: { startsWith: PREFIXO } }, select: { id: true } });
    const vagaIds = vagas.map((v) => v.id);
    const estudantes = await tx.estudante.findMany({ where: { nome_completo: { startsWith: PREFIXO } }, select: { id: true } });
    const estudanteIds = estudantes.map((e) => e.id);

    const vagasReaisEmEmpresaDemo = await tx.vaga.findMany({
      where: { empresa_id: { in: empresaIds }, id: { notIn: vagaIds } },
      select: { codigo_vaga: true, titulo: true },
    });
    const candidaturasReaisEmVagaDemo = await tx.aplicacao.findMany({
      where: { vaga_id: { in: vagaIds }, estudante_id: { notIn: estudanteIds } },
      select: { estudante: { select: { nome_completo: true } }, vaga: { select: { titulo: true } } },
    });

    if (vagasReaisEmEmpresaDemo.length || candidaturasReaisEmVagaDemo.length) {
      return { conflitos: { vagasReaisEmEmpresaDemo, candidaturasReaisEmVagaDemo } };
    }

    // Candidaturas dos estudantes [DEMO] (em qualquer vaga) e das vagas [DEMO].
    const candidaturas = await tx.aplicacao.deleteMany({
      where: { OR: [{ estudante_id: { in: estudanteIds } }, { vaga_id: { in: vagaIds } }] },
    });
    const removidosEstudantes = await tx.estudante.deleteMany({ where: { id: { in: estudanteIds } } });
    const removidasVagas = await tx.vaga.deleteMany({ where: { id: { in: vagaIds } } });
    const removidasEmpresas = await tx.empresa.deleteMany({ where: { id: { in: empresaIds } } });

    return {
      logos: empresas.map((e) => e.logo_url).filter(Boolean),
      removidos: {
        candidaturas: candidaturas.count,
        estudantes: removidosEstudantes.count,
        vagas: removidasVagas.count,
        empresas: removidasEmpresas.count,
      },
    };
  }, { timeout: 60000 });

  if (resultado.conflitos) {
    const { vagasReaisEmEmpresaDemo, candidaturasReaisEmVagaDemo } = resultado.conflitos;
    console.log(`Nada foi apagado: há dados reais ligados a registros ${PREFIXO}.`);
    for (const vaga of vagasReaisEmEmpresaDemo) {
      console.log(`  - Vaga real "${vaga.titulo}" (Nº ${vaga.codigo_vaga}) está numa empresa ${PREFIXO}.`);
    }
    for (const c of candidaturasReaisEmVagaDemo) {
      console.log(`  - Estudante real "${c.estudante.nome_completo}" está inscrito na vaga "${c.vaga.titulo}".`);
    }
    console.log("Mova ou remova esses vínculos pelo sistema e rode de novo.");
    process.exitCode = 1;
    return;
  }

  const { removidos, logos } = resultado;
  // Os arquivos de logo só saem depois que o banco confirmou a exclusão das empresas.
  logos.forEach(apagarLogo);
  if (logos.length) console.log(`Logos [DEMO] apagadas: ${logos.length}`);
  console.log(`Removidos: ${removidos.empresas} empresas, ${removidos.vagas} vagas, ${removidos.estudantes} estudantes e ${removidos.candidaturas} candidaturas ${PREFIXO}.`);

  const sobras = await prisma.empresa.count({ where: { nome: { startsWith: PREFIXO } } })
    + await prisma.vaga.count({ where: { titulo: { startsWith: PREFIXO } } })
    + await prisma.estudante.count({ where: { nome_completo: { startsWith: PREFIXO } } });
  console.log(`Registros ${PREFIXO} restantes: ${sobras}`);
  if (sobras) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Erro ao remover os dados de demonstração (nada foi apagado):", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
