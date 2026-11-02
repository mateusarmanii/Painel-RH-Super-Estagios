// Configurações gerais (tabela Configuracao). Cada chave tem um valor padrão e uma validação.
// Tudo começa desligado/vazio: o painel funciona como antes até alguém mudar algo.
const prisma = require("./prisma");

const CONFIGURACOES = {
  // Meta de contratações por mês (Dashboard). null = sem meta.
  meta_contratacoes_mensal: {
    padrao: null,
    validar: (valor) => (valor === null || (Number.isInteger(valor) && valor >= 1 && valor <= 10000) ? null : "A meta deve ser um número inteiro de 1 a 10.000."),
  },
  // Formulário público de cadastro e página pública de vagas.
  formulario_publico_ativo: {
    padrao: false,
    validar: (valor) => (typeof valor === "boolean" ? null : "Valor inválido."),
  },
  // Mostrar o nome da empresa na página pública de vagas.
  vagas_publicas_mostrar_empresa: {
    padrao: false,
    validar: (valor) => (typeof valor === "boolean" ? null : "Valor inválido."),
  },
};

async function lerConfiguracoes() {
  const salvas = await prisma.configuracao.findMany();
  const porChave = new Map(salvas.map((item) => [item.chave, item.valor]));
  return Object.fromEntries(Object.entries(CONFIGURACOES).map(([chave, { padrao }]) => [chave, porChave.has(chave) ? porChave.get(chave) : padrao]));
}

async function lerConfiguracao(chave) {
  const salva = await prisma.configuracao.findUnique({ where: { chave } });
  return salva ? salva.valor : CONFIGURACOES[chave].padrao;
}

// Grava as chaves enviadas (as outras não mudam). Devolve { erro } ou as configurações completas.
async function salvarConfiguracoes(alteracoes) {
  if (!alteracoes || typeof alteracoes !== "object" || Array.isArray(alteracoes)) return { erro: "Envie as configurações." };
  for (const [chave, valor] of Object.entries(alteracoes)) {
    if (!CONFIGURACOES[chave]) return { erro: `Configuração desconhecida: ${chave}.` };
    const problema = CONFIGURACOES[chave].validar(valor);
    if (problema) return { erro: problema };
  }
  await prisma.$transaction(
    Object.entries(alteracoes).map(([chave, valor]) =>
      prisma.configuracao.upsert({ where: { chave }, create: { chave, valor }, update: { valor } }),
    ),
  );
  return { configuracoes: await lerConfiguracoes() };
}

module.exports = { lerConfiguracoes, lerConfiguracao, salvarConfiguracoes };
