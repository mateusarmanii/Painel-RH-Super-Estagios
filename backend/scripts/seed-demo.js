// Cria dados de demonstração marcados com "[DEMO]": 5 empresas, 10 vagas, 30 estudantes e 40 candidaturas
// espalhadas por todas as colunas do Kanban, com datas variadas e vagas em alerta.
// Uso: npm run demo:criar   (para remover: npm run demo:limpar)
// ATENÇÃO: grava no banco do DATABASE_URL. Não altera nem apaga registros que não sejam [DEMO].
const path = require("path");

process.chdir(path.resolve(__dirname, ".."));
require("dotenv").config();
const prisma = require("../src/prisma");

const PREFIXO = "[DEMO]";
const HORA_MS = 60 * 60 * 1000;
const DIA_MS = 24 * HORA_MS;

const empresas = [
  { nome: "Nova Tech Sistemas", setor: "Tecnologia", nome_contato: "Renata Albuquerque" },
  { nome: "Grupo Horizonte Varejo", setor: "Varejo", nome_contato: "Carlos Menezes" },
  { nome: "Clínica Bem Viver", setor: "Saúde", nome_contato: "Dra. Lúcia Prado" },
  { nome: "Lima & Souza Advogados", setor: "Jurídico", nome_contato: "Fernando Lima" },
  { nome: "Construtora Alicerce", setor: "Construção civil", nome_contato: "Patrícia Rocha" },
];

// perfil define quais etapas as candidaturas da vaga recebem:
//  nova      → só etapas iniciais e entrevistas futuras
//  ativa     → todas as etapas (inclui contratados e dispensados)
//  parada    → aberta há mais de 10 dias SEM entrevista (aparece em "Vagas em alerta")
//  fechada   → vaga fechada, com contratado e dispensados
//  suspensa  → vaga suspensa, etapas iniciais
const vagas = [
  { titulo: "Estágio em Desenvolvimento Web", empresa: 0, diasAtras: 2, status: "ABERTA", perfil: "nova" },
  { titulo: "Estágio em Suporte de TI", empresa: 0, diasAtras: 5, status: "ABERTA", perfil: "nova" },
  { titulo: "Estágio em Atendimento ao Cliente", empresa: 1, diasAtras: 8, status: "ABERTA", perfil: "nova" },
  { titulo: "Estágio em Marketing Digital", empresa: 1, diasAtras: 12, status: "ABERTA", perfil: "ativa" },
  { titulo: "Estágio em Psicologia Organizacional", empresa: 2, diasAtras: 15, status: "ABERTA", perfil: "ativa" },
  { titulo: "Estágio em Enfermagem", empresa: 2, diasAtras: 20, status: "ABERTA", perfil: "parada" },
  { titulo: "Estágio em Direito Trabalhista", empresa: 3, diasAtras: 25, status: "ABERTA", perfil: "ativa" },
  { titulo: "Estágio em Contabilidade", empresa: 3, diasAtras: 30, status: "FECHADA", perfil: "fechada" },
  { titulo: "Estágio em Engenharia Civil", empresa: 4, diasAtras: 40, status: "ABERTA", perfil: "parada" },
  { titulo: "Estágio em Administração de Obras", empresa: 4, diasAtras: 3, status: "SUSPENSA", perfil: "suspensa" },
];

const etapasPorPerfil = {
  nova: ["ENVIADO_EMPRESA", "AGUARDANDO_RETORNO", "ENTREVISTA_AGENDADA"],
  ativa: ["ENTREVISTA_AGENDADA", "AGUARDANDO_RETORNO", "APROVADO", "RECUSADO", "ENVIADO_EMPRESA"],
  parada: ["ENVIADO_EMPRESA", "AGUARDANDO_RETORNO", "RECUSADO"],
  fechada: ["APROVADO", "RECUSADO", "RECUSADO"],
  suspensa: ["ENVIADO_EMPRESA", "AGUARDANDO_RETORNO"],
};

const nomes = [
  "Ana Beatriz Costa", "Bruno Henrique Silva", "Camila Rodrigues", "Diego Martins", "Eduarda Ferreira",
  "Felipe Gomes", "Gabriela Santos", "Henrique Oliveira", "Isabela Ribeiro", "João Pedro Alves",
  "Larissa Carvalho", "Lucas Pereira", "Mariana Lopes", "Matheus Araújo", "Natália Freitas",
  "Otávio Barbosa", "Paula Cristina Dias", "Rafael Moreira", "Sabrina Teixeira", "Thiago Nascimento",
  "Úrsula Monteiro", "Vinícius Cardoso", "Yasmin Correia", "Gustavo Pinto", "Letícia Fernandes",
  "Pedro Henrique Rocha", "Beatriz Mendes", "Caio Vieira", "Júlia Castro", "Leonardo Azevedo",
];

// Algumas grafias variam de propósito ("direito", "Administracao ") para mostrar o agrupamento do gráfico de cursos.
const cursos = [
  "Engenharia de Software", "Direito", "Psicologia", "Administração", "Enfermagem", "Marketing",
  "Ciências Contábeis", "Engenharia Civil", "Ciência da Computação", "Pedagogia",
  "direito", "Administracao ", "PSICOLOGIA", "Design Gráfico", "Engenharia de Software",
];
const instituicoes = ["PUC Minas", "UFMG", "Newton Paiva", "UNA", "Fumec", "Uni-BH"];
const horarios = ["MANHA", "TARDE", "NOITE"];
const motivos = [
  "Perfil não aderente à vaga",
  "Aceitou outra proposta",
  "Indisponibilidade de horário",
  "Vaga preenchida",
  "Não compareceu à entrevista",
];
const anotacoes = [
  "Boa comunicação, demonstrou interesse pela área.",
  "Disponível para início imediato.",
  "Pediu retorno por WhatsApp.",
  null,
  null,
];

// Gerador pseudoaleatório com semente fixa: os dados saem iguais a cada execução.
function criarAleatorio(semente) {
  let estado = semente;
  return () => {
    estado = (estado * 1664525 + 1013904223) % 4294967296;
    return estado / 4294967296;
  };
}

function horarioComercial(data, aleatorio) {
  const resultado = new Date(data);
  resultado.setHours(9 + Math.floor(aleatorio() * 8), aleatorio() < 0.5 ? 0 : 30, 0, 0);
  return resultado;
}

// Monta tudo o que será criado, sem tocar no banco (função pura, testável).
function montarPlano(agora = new Date(), codigosEmUso = new Set()) {
  const aleatorio = criarAleatorio(20261005);
  let proximoCodigo = 700001;
  const novoCodigo = () => {
    while (codigosEmUso.has(String(proximoCodigo))) proximoCodigo += 1;
    codigosEmUso.add(String(proximoCodigo));
    return String(proximoCodigo++);
  };

  const planoEmpresas = empresas.map((empresa, indice) => ({
    ...empresa,
    nome: `${PREFIXO} ${empresa.nome}`,
    telefone_contato: `(31) 3${String(2000000 + indice * 111111).slice(0, 3)}-${String(1000 + indice * 1234).slice(0, 4)}`,
    email_contato: `contato${indice + 1}@demo.superestagios.com.br`,
  }));

  const planoVagas = vagas.map((vaga) => ({
    ...vaga,
    titulo: `${PREFIXO} ${vaga.titulo}`,
    codigo_vaga: novoCodigo(),
    descricao: `Vaga de demonstração para ${vaga.titulo.replace("Estágio em ", "").toLowerCase()}.`,
    valor: 900 + Math.round(aleatorio() * 26) * 50,
    created_at: new Date(agora.getTime() - vaga.diasAtras * DIA_MS),
  }));

  const planoEstudantes = nomes.map((nome, indice) => ({
    nome_completo: `${PREFIXO} ${nome}`,
    telefone: `(31) 9${String(8000 + indice * 37).padStart(4, "0")}-${String(1000 + indice * 271).slice(-4)}`,
    email: indice % 7 === 6 ? null : `estudante${indice + 1}@demo.superestagios.com.br`,
    curso: cursos[indice % cursos.length],
    instituicao_ensino: instituicoes[indice % instituicoes.length],
    horario_estudo: horarios[indice % horarios.length],
    anotacoes_recrutador: anotacoes[indice % anotacoes.length],
  }));

  // Cada estudante concorre a uma vaga; 1 em cada 3 concorre também a uma segunda (sempre diferente).
  const pares = [];
  planoEstudantes.forEach((_, indice) => {
    pares.push([indice, indice % planoVagas.length]);
    if (indice % 3 === 0) pares.push([indice, (indice + 3) % planoVagas.length]);
  });

  const contadorPorVaga = new Map();
  const planoCandidaturas = pares.map(([estudante, vagaIndice]) => {
    const vaga = planoVagas[vagaIndice];
    const ordem = contadorPorVaga.get(vagaIndice) ?? 0;
    contadorPorVaga.set(vagaIndice, ordem + 1);
    const etapas = etapasPorPerfil[vaga.perfil];
    const status = etapas[ordem % etapas.length];

    // A candidatura nasce entre a abertura da vaga e agora (contratados: logo no início).
    const idadeVagaMs = agora - vaga.created_at;
    const criadaEm = status === "APROVADO"
      ? new Date(vaga.created_at.getTime() + DIA_MS)
      : new Date(vaga.created_at.getTime() + aleatorio() * idadeVagaMs * 0.6);

    const candidatura = {
      estudante,
      vaga: vagaIndice,
      status_kanban: status,
      created_at: criadaEm,
      data_hora_entrevista: null,
      motivo_recusa: null,
      data_aprovacao: null,
    };

    if (status === "ENTREVISTA_AGENDADA") {
      candidatura.data_hora_entrevista = horarioComercial(new Date(agora.getTime() + (1 + Math.floor(aleatorio() * 10)) * DIA_MS), aleatorio);
    }
    if (status === "APROVADO") {
      const aprovadaEm = new Date(criadaEm.getTime() + (3 + Math.floor(aleatorio() * 12)) * DIA_MS);
      candidatura.data_aprovacao = new Date(Math.min(aprovadaEm.getTime(), agora.getTime() - HORA_MS));
      candidatura.data_hora_entrevista = horarioComercial(new Date(criadaEm.getTime() + DIA_MS), aleatorio);
    }
    if (status === "RECUSADO") {
      candidatura.motivo_recusa = vaga.status === "FECHADA" ? "Vaga preenchida" : motivos[ordem % motivos.length];
    }
    // Última alteração da candidatura (para dispensados, é a data da dispensa mostrada no Banco de Talentos).
    const alteradaEm = status === "APROVADO"
      ? candidatura.data_aprovacao
      : new Date(criadaEm.getTime() + (1 + Math.floor(aleatorio() * 8)) * DIA_MS);
    candidatura.updated_at = new Date(Math.min(alteradaEm.getTime(), agora.getTime() - HORA_MS));
    return candidatura;
  });

  return { empresas: planoEmpresas, vagas: planoVagas, estudantes: planoEstudantes, candidaturas: planoCandidaturas };
}

async function main() {
  const existentes = await prisma.empresa.count({ where: { nome: { startsWith: PREFIXO } } })
    + await prisma.vaga.count({ where: { titulo: { startsWith: PREFIXO } } })
    + await prisma.estudante.count({ where: { nome_completo: { startsWith: PREFIXO } } });
  if (existentes > 0) {
    console.log(`Já existem ${existentes} registros ${PREFIXO}. Rode "npm run demo:limpar" antes de criar de novo.`);
    process.exitCode = 1;
    return;
  }

  const codigosEmUso = new Set((await prisma.vaga.findMany({ select: { codigo_vaga: true } })).map((v) => v.codigo_vaga));
  const plano = montarPlano(new Date(), codigosEmUso);

  await prisma.$transaction(async (tx) => {
    const empresaIds = [];
    for (const empresa of plano.empresas) {
      empresaIds.push((await tx.empresa.create({ data: empresa, select: { id: true } })).id);
    }

    const vagaIds = [];
    for (const vaga of plano.vagas) {
      const { codigo_vaga, titulo, descricao, valor, status, created_at } = vaga;
      vagaIds.push((await tx.vaga.create({
        data: { codigo_vaga, titulo, descricao, valor, status, created_at, empresa_id: empresaIds[vaga.empresa] },
        select: { id: true },
      })).id);
    }

    const estudanteIds = [];
    for (const estudante of plano.estudantes) {
      estudanteIds.push((await tx.estudante.create({ data: estudante, select: { id: true } })).id);
    }

    for (const { estudante, vaga, ...candidatura } of plano.candidaturas) {
      await tx.aplicacao.create({
        data: { ...candidatura, estudante_id: estudanteIds[estudante], vaga_id: vagaIds[vaga] },
      });
    }
  }, { timeout: 60000 });

  const porEtapa = plano.candidaturas.reduce((acc, c) => ({ ...acc, [c.status_kanban]: (acc[c.status_kanban] ?? 0) + 1 }), {});
  console.log(`Criados: ${plano.empresas.length} empresas, ${plano.vagas.length} vagas, ${plano.estudantes.length} estudantes e ${plano.candidaturas.length} candidaturas ${PREFIXO}.`);
  console.log("Candidaturas por etapa:", porEtapa);
  console.log("Vagas que devem aparecer em alerta:", plano.vagas.filter((v) => v.perfil === "parada").map((v) => v.titulo).join(", "));
}

module.exports = { montarPlano };

if (require.main === module) {
  main()
    .catch((error) => {
      console.error("Erro ao criar os dados de demonstração (nada foi gravado):", error.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
