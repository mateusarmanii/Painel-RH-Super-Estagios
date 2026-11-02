// Números do Dashboard (GET /dashboard-metrics). Só leitura: carrega vagas e candidaturas e calcula tudo aqui,
// para poder filtrar por empresa e por área (a área da vaga é calculada em código, não fica no banco).
//
// Dois tipos de número:
//   foto do momento  vagas abertas, em processo, entrevistas, alertas, funil, cursos: respeitam empresa e área
//   do período       candidaturas, contratações, dispensas, série, conversão, ranking, motivos: também o período,
//                    comparados com o período anterior equivalente
const prisma = require("./prisma");
const { DIA_MS, DIAS_PARA_ALERTA } = require("./utils");
const { ETAPAS_EM_PROCESSO, ETAPAS_AVANCADAS } = require("./etapas");
const { areaDaVaga, listaAreas } = require("./compatibilidade");
const { partesSaoPaulo, meiaNoiteSaoPaulo } = require("./fuso");
const { motivoPorId, categorizarTexto } = require("./motivos");
const { lerConfiguracao } = require("./configuracoes");

// Registros que já existiam em 05/10/2026 receberam a data da migration: antes disso as datas não são reais.
const DATAS_REAIS_DESDE = "2026-10-05";
const AREA_NAO_IDENTIFICADA = "nao-identificada";
const ETAPAS_DO_FUNIL = [...ETAPAS_EM_PROCESSO, "APROVADO"];
const ITENS_POR_ETAPA = 50;
const MAX_MOTIVOS = 6;
const MAX_DIAS_PERIODO = 3 * 366;

const rotulosDoFunil = {
  CANDIDATO_CONTATADO: "Candidato contatado",
  ENVIADO_EMPRESA: "Enviado à empresa",
  ENTREVISTA_AGENDADA: "Em entrevista",
  EM_TESTE: "Em teste",
  APROVADO: "Contratado",
};

// ---------- Datas "de calendário" no fuso de São Paulo ({ ano, mes, dia }) ----------

const civil = (data) => {
  const { ano, mes, dia } = partesSaoPaulo(data);
  return { ano, mes, dia };
};
// Date.UTC normaliza estouros (dia 0, mês 13...), então somar dias e meses é só somar.
const somarDias = ({ ano, mes, dia }, dias) => {
  const d = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
};
const somarMeses = ({ ano, mes, dia }, meses) => {
  const d = new Date(Date.UTC(ano, mes - 1 + meses, dia));
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
};
// 00:00 em São Paulo do dia de calendário (meio-dia UTC cai sempre no mesmo dia em São Paulo).
const instante = ({ ano, mes, dia }) => meiaNoiteSaoPaulo(new Date(Date.UTC(ano, mes - 1, dia, 12)));
const doisDigitos = (n) => String(n).padStart(2, "0");
const chaveDia = ({ ano, mes, dia }) => `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`;
const diasEntre = (a, b) => Math.round((Date.UTC(b.ano, b.mes - 1, b.dia) - Date.UTC(a.ano, a.mes - 1, a.dia)) / DIA_MS);

function lerDiaCivil(valor) {
  const partes = typeof valor === "string" && /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!partes) return null;
  const dia = { ano: Number(partes[1]), mes: Number(partes[2]), dia: Number(partes[3]) };
  return chaveDia(somarDias(dia, 0)) === valor ? dia : null;
}

const PERIODOS = ["7d", "30d", "90d", "mes", "ano", "12m"];

// Período pedido (?periodo= ou ?de=&ate=, datas AAAA-MM-DD inclusivas) e o anterior equivalente.
// Devolve { erro } ou { periodo, inicio, fim, inicioAnterior, fimAnterior, granularidade } (fim exclusivo).
function lerPeriodo(query, agora) {
  const hoje = civil(agora);
  const amanha = somarDias(hoje, 1);
  let de;
  let ateExclusivo = amanha;
  let anterior;

  if (query.de !== undefined || query.ate !== undefined) {
    de = lerDiaCivil(query.de);
    const ate = lerDiaCivil(query.ate);
    if (!de || !ate) return { erro: "Informe as datas no formato AAAA-MM-DD." };
    if (diasEntre(de, ate) < 0) return { erro: "A data final precisa ser igual ou posterior à inicial." };
    if (diasEntre(de, ate) > MAX_DIAS_PERIODO) return { erro: "O período pode ter no máximo 3 anos." };
    ateExclusivo = somarDias(ate, 1);
    const dias = diasEntre(de, ateExclusivo);
    anterior = { de: somarDias(de, -dias), ate: de };
    return montar("personalizado", de, ateExclusivo, anterior);
  }

  const periodo = query.periodo ?? "30d";
  if (!PERIODOS.includes(periodo)) return { erro: "Período inválido." };

  if (periodo.endsWith("d")) {
    const dias = Number(periodo.slice(0, -1));
    de = somarDias(hoje, 1 - dias);
    anterior = { de: somarDias(de, -dias), ate: de };
  } else if (periodo === "mes") {
    // Do dia 1 até hoje, comparado com os mesmos dias do mês anterior.
    de = { ...hoje, dia: 1 };
    const deAnterior = somarMeses(de, -1);
    anterior = { de: deAnterior, ate: somarDias(deAnterior, diasEntre(de, ateExclusivo)) };
  } else if (periodo === "ano") {
    de = { ano: hoje.ano, mes: 1, dia: 1 };
    const deAnterior = { ano: hoje.ano - 1, mes: 1, dia: 1 };
    anterior = { de: deAnterior, ate: somarDias(deAnterior, diasEntre(de, ateExclusivo)) };
  } else {
    // 12m: os últimos 12 meses inteiros, contando o atual.
    de = somarMeses({ ...hoje, dia: 1 }, -11);
    anterior = { de: somarMeses(de, -12), ate: de };
  }
  return montar(periodo, de, ateExclusivo, anterior);
}

function montar(periodo, de, ateExclusivo, anterior) {
  const dias = diasEntre(de, ateExclusivo);
  return {
    periodo,
    de,
    ateExclusivo,
    inicio: instante(de),
    fim: instante(ateExclusivo),
    inicioAnterior: instante(anterior.de),
    fimAnterior: instante(anterior.ate),
    granularidade: dias <= 31 ? "dia" : dias <= 120 ? "semana" : "mes",
  };
}

// Grupos da série (dia, semana começando na segunda, ou mês), do início ao fim do período.
function gruposDaSerie({ de, ateExclusivo, granularidade }) {
  const grupos = [];
  if (granularidade === "mes") {
    for (let atual = { ...de, dia: 1 }; diasEntre(atual, ateExclusivo) > 0; atual = somarMeses(atual, 1)) {
      grupos.push({ chave: chaveDia(atual).slice(0, 7), inicio: atual });
    }
    return grupos;
  }
  const passo = granularidade === "semana" ? 7 : 1;
  let atual = de;
  if (granularidade === "semana") {
    const diaDaSemana = new Date(Date.UTC(de.ano, de.mes - 1, de.dia)).getUTCDay();
    atual = somarDias(de, -((diaDaSemana + 6) % 7));
  }
  for (; diasEntre(atual, ateExclusivo) > 0; atual = somarDias(atual, passo)) {
    grupos.push({ chave: chaveDia(atual), inicio: atual });
  }
  return grupos;
}

function chaveDoGrupo(data, granularidade) {
  const dia = civil(data);
  if (granularidade === "mes") return chaveDia(dia).slice(0, 7);
  if (granularidade === "dia") return chaveDia(dia);
  const diaDaSemana = new Date(Date.UTC(dia.ano, dia.mes - 1, dia.dia)).getUTCDay();
  return chaveDia(somarDias(dia, -((diaDaSemana + 6) % 7)));
}

// ---------- Cálculos ----------

const dentro = (data, inicio, fim) => data && data >= inicio && data < fim;

// Média em dias da candidatura à contratação (1 casa decimal); null sem contratações.
function tempoMedio(contratacoes) {
  if (!contratacoes.length) return null;
  const total = contratacoes.reduce((soma, { created_at, data_aprovacao }) => soma + (data_aprovacao - created_at), 0);
  return Math.round((total / contratacoes.length / DIA_MS) * 10) / 10;
}

// Agrupa ignorando maiúsculas, acentos e espaços extras; exibe a grafia mais usada (empate: ordem alfabética).
function agruparTextos(textos) {
  const grupos = new Map();
  for (const texto of textos) {
    const grafia = texto.trim().replace(/\s+/g, " ");
    const chave = grafia.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[.!;,]+$/, "");
    const grupo = grupos.get(chave) ?? { total: 0, grafias: new Map() };
    grupo.total += 1;
    grupo.grafias.set(grafia, (grupo.grafias.get(grafia) ?? 0) + 1);
    grupos.set(chave, grupo);
  }
  return [...grupos.values()]
    .map(({ total, grafias }) => ({
      texto: [...grafias].sort(([a, totalA], [b, totalB]) => totalB - totalA || a.localeCompare(b, "pt-BR"))[0][0],
      total,
    }))
    .sort((a, b) => b.total - a.total || a.texto.localeCompare(b.texto, "pt-BR"));
}

// Etapa mais avançada que a candidatura comprovadamente alcançou (0 = contatado ... 4 = contratado).
// Com histórico de etapas (desde 02/11/2026) a conta é exata. Sem ele, dispensados contam até a entrevista
// se tiveram data marcada; senão, só como contatados.
function etapaAlcancada(aplicacao, historico = []) {
  const pelaEtapaAtual = aplicacao.status_kanban === "RECUSADO"
    ? (aplicacao.data_hora_entrevista ? 2 : 0)
    : Math.max(0, ETAPAS_DO_FUNIL.indexOf(aplicacao.status_kanban));
  const peloHistorico = historico.flatMap((item) => [item.de_status, item.para_status]).map((status) => ETAPAS_DO_FUNIL.indexOf(status));
  return Math.max(pelaEtapaAtual, ...peloHistorico);
}

// Tempo médio (dias) que as candidaturas ficaram em cada etapa do processo, contando as saídas no período.
// Só dá para medir quando o histórico tem a entrada e a saída da etapa.
function tempoPorEtapa(historicoPorAplicacao, noPeriodo) {
  const duracoes = new Map(ETAPAS_EM_PROCESSO.map((status) => [status, []]));
  for (const historico of historicoPorAplicacao.values()) {
    for (let i = 1; i < historico.length; i++) {
      const entrada = historico[i - 1];
      const saida = historico[i];
      if (!duracoes.has(saida.de_status) || entrada.para_status !== saida.de_status || !noPeriodo(saida.created_at)) continue;
      duracoes.get(saida.de_status).push((saida.created_at - entrada.created_at) / DIA_MS);
    }
  }
  return ETAPAS_EM_PROCESSO.map((status) => {
    const lista = duracoes.get(status);
    return {
      status,
      label: rotulosDoFunil[status],
      amostras: lista.length,
      mediaDias: lista.length ? Math.round((lista.reduce((soma, dias) => soma + dias, 0) / lista.length) * 10) / 10 : null,
    };
  });
}

const entrevistaEmAberto = (aplicacao, agora) =>
  aplicacao.status_kanban === "ENTREVISTA_AGENDADA" &&
  aplicacao.data_hora_entrevista > agora &&
  (!aplicacao.entrevista_status || ["AGUARDANDO", "CONFIRMADA"].includes(aplicacao.entrevista_status));

async function montarDashboard(query, agora = new Date()) {
  const periodo = lerPeriodo(query, agora);
  if (periodo.erro) return periodo;

  const empresaId = typeof query.empresa === "string" && query.empresa ? query.empresa : null;
  const area = typeof query.area === "string" && query.area ? query.area : null;
  if (area && area !== AREA_NAO_IDENTIFICADA && !listaAreas.some((item) => item.id === area)) return { erro: "Área inválida." };

  const [vagasDoBanco, aplicacoes, empresas, estudantes, historicos, metaMensal] = await Promise.all([
    prisma.vaga.findMany({
      select: {
        id: true,
        codigo_vaga: true,
        titulo: true,
        descricao: true,
        status: true,
        area_manual: true,
        created_at: true,
        empresa: { select: { id: true, nome: true, setor: true, logo_arquivo_id: true } },
      },
    }),
    prisma.aplicacao.findMany({
      select: {
        id: true,
        vaga_id: true,
        estudante_id: true,
        status_kanban: true,
        data_hora_entrevista: true,
        entrevista_status: true,
        motivo_recusa: true,
        motivo_categoria: true,
        data_aprovacao: true,
        created_at: true,
        updated_at: true,
        estudante: { select: { id: true, nome_completo: true, curso: true } },
      },
    }),
    prisma.empresa.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    prisma.estudante.findMany({ select: { curso: true } }),
    prisma.historicoEtapa.findMany({
      orderBy: { created_at: "asc" },
      select: { aplicacao_id: true, de_status: true, para_status: true, created_at: true },
    }),
    lerConfiguracao("meta_contratacoes_mensal"),
  ]);

  const vagas = vagasDoBanco.map((vaga) => ({ ...vaga, areas: areaDaVaga(vaga).areas }));
  const filtrado = Boolean(empresaId || area);
  const vagasFiltradas = vagas.filter(
    (vaga) =>
      (!empresaId || vaga.empresa.id === empresaId) &&
      (!area || (area === AREA_NAO_IDENTIFICADA ? !vaga.areas.length : vaga.areas.some((item) => item.id === area))),
  );
  const vagaPorId = new Map(vagasFiltradas.map((vaga) => [vaga.id, vaga]));
  const apps = aplicacoes.filter((aplicacao) => vagaPorId.has(aplicacao.vaga_id));
  const doPeriodo = (data) => dentro(data, periodo.inicio, periodo.fim);
  const doAnterior = (data) => dentro(data, periodo.inicioAnterior, periodo.fimAnterior);

  // Histórico de etapas por candidatura (do mais antigo para o mais recente).
  const historicoPorAplicacao = new Map();
  for (const item of historicos) {
    if (!historicoPorAplicacao.has(item.aplicacao_id)) historicoPorAplicacao.set(item.aplicacao_id, []);
    historicoPorAplicacao.get(item.aplicacao_id).push(item);
  }
  const historicoDe = (aplicacao) => historicoPorAplicacao.get(aplicacao.id) ?? [];
  // Desde quando a candidatura está na etapa atual: a última entrada nela no histórico ou, sem histórico, a última alteração.
  const desdeQuando = (aplicacao) =>
    historicoDe(aplicacao).findLast((item) => item.para_status === aplicacao.status_kanban)?.created_at ?? aplicacao.updated_at;

  // ----- Foto do momento -----
  const vagasAbertas = vagasFiltradas.filter((vaga) => vaga.status === "ABERTA");
  const etapasPorVaga = new Map();
  for (const aplicacao of apps) {
    const etapas = etapasPorVaga.get(aplicacao.vaga_id) ?? new Set();
    etapas.add(aplicacao.status_kanban);
    etapasPorVaga.set(aplicacao.vaga_id, etapas);
  }
  const totalPorVaga = new Map();
  for (const aplicacao of apps) totalPorVaga.set(aplicacao.vaga_id, (totalPorVaga.get(aplicacao.vaga_id) ?? 0) + 1);

  const vagasEmAlerta = vagasAbertas
    .filter((vaga) => agora - vaga.created_at > DIAS_PARA_ALERTA * DIA_MS)
    .filter((vaga) => !ETAPAS_AVANCADAS.some((etapa) => etapasPorVaga.get(vaga.id)?.has(etapa)))
    .sort((a, b) => a.created_at - b.created_at)
    .map((vaga) => ({
      id: vaga.id,
      codigo_vaga: vaga.codigo_vaga,
      titulo: vaga.titulo,
      empresa: vaga.empresa.nome,
      empresa_id: vaga.empresa.id,
      logo_arquivo_id: vaga.empresa.logo_arquivo_id,
      created_at: vaga.created_at,
      diasAberta: Math.floor((agora - vaga.created_at) / DIA_MS),
      totalCandidaturas: totalPorVaga.get(vaga.id) ?? 0,
    }));

  // Funil: candidaturas em cada etapa agora, com as mais recentes de cada uma (para a lista ao clicar na barra).
  const funnel = ETAPAS_DO_FUNIL.map((status) => {
    const daEtapa = apps.filter((aplicacao) => aplicacao.status_kanban === status).sort((a, b) => desdeQuando(b) - desdeQuando(a));
    return {
      status,
      label: rotulosDoFunil[status],
      total: daEtapa.length,
      itens: daEtapa.slice(0, ITENS_POR_ETAPA).map((aplicacao) => {
        const vaga = vagaPorId.get(aplicacao.vaga_id);
        return {
          id: aplicacao.id,
          estudante: { id: aplicacao.estudante.id, nome: aplicacao.estudante.nome_completo, curso: aplicacao.estudante.curso },
          vaga: { id: vaga.id, titulo: vaga.titulo, codigo_vaga: vaga.codigo_vaga, empresa: vaga.empresa.nome },
          desde: desdeQuando(aplicacao),
        };
      }),
    };
  });

  // Cursos: todos os estudantes; com filtro, só quem se candidatou às vagas filtradas.
  const cursos = filtrado
    ? [...new Map(apps.map((aplicacao) => [aplicacao.estudante.id, aplicacao.estudante.curso])).values()]
    : estudantes.map((estudante) => estudante.curso);

  // Vagas abertas por área principal (a primeira da lista: manual ou a mais pontuada).
  const porArea = new Map();
  for (const vaga of vagasAbertas) {
    const principal = vaga.areas[0] ?? { id: AREA_NAO_IDENTIFICADA, nome: "Área não identificada" };
    const atual = porArea.get(principal.id) ?? { id: principal.id, nome: principal.nome, total: 0 };
    atual.total += 1;
    porArea.set(principal.id, atual);
  }

  // Pendências (sem filtro: são do RH todo). Talentos: mesma regra do Banco de Talentos (regras.js do frontend):
  // ao menos uma dispensa e nenhuma contratação.
  const statusPorEstudante = new Map();
  for (const aplicacao of aplicacoes) {
    const status = statusPorEstudante.get(aplicacao.estudante_id) ?? new Set();
    status.add(aplicacao.status_kanban);
    statusPorEstudante.set(aplicacao.estudante_id, status);
  }
  const talentos = [...statusPorEstudante.values()].filter((status) => status.has("RECUSADO") && !status.has("APROVADO")).length;
  const empresasComVagaAberta = new Set(vagas.filter((vaga) => vaga.status === "ABERTA").map((vaga) => vaga.empresa.id));
  const hoje = civil(agora);
  const inicioHoje = instante(hoje);
  const fimHoje = instante(somarDias(hoje, 1));

  // ----- Período -----
  const contratacoesTodas = apps.filter((aplicacao) => aplicacao.status_kanban === "APROVADO" && aplicacao.data_aprovacao);
  const contratacoes = contratacoesTodas.filter((aplicacao) => doPeriodo(aplicacao.data_aprovacao));
  const contratacoesAnteriores = contratacoesTodas.filter((aplicacao) => doAnterior(aplicacao.data_aprovacao));
  const candidaturas = apps.filter((aplicacao) => doPeriodo(aplicacao.created_at));
  const candidaturasAnteriores = apps.filter((aplicacao) => doAnterior(aplicacao.created_at));
  // Data da dispensa: a do histórico; sem histórico, a última atualização (mesma regra do Banco de Talentos).
  const dispensadas = apps.filter((aplicacao) => aplicacao.status_kanban === "RECUSADO");
  const dispensas = dispensadas.filter((aplicacao) => doPeriodo(desdeQuando(aplicacao)));
  const dispensasAnteriores = dispensadas.filter((aplicacao) => doAnterior(desdeQuando(aplicacao)));
  const novasVagas = vagasFiltradas.filter((vaga) => doPeriodo(vaga.created_at));
  const novasVagasAnteriores = vagasFiltradas.filter((vaga) => doAnterior(vaga.created_at));

  // Série: candidaturas, contratações e vagas novas por dia/semana/mês.
  const serie = gruposDaSerie(periodo).map(({ chave, inicio }) => ({
    chave,
    inicio: chaveDia(inicio),
    candidaturas: 0,
    contratacoes: 0,
    vagas: 0,
    dispensas: 0,
  }));
  const grupoPorChave = new Map(serie.map((grupo) => [grupo.chave, grupo]));
  const contar = (lista, data, campo) => {
    for (const item of lista) {
      const grupo = grupoPorChave.get(chaveDoGrupo(data(item), periodo.granularidade));
      if (grupo) grupo[campo] += 1;
    }
  };
  contar(candidaturas, (a) => a.created_at, "candidaturas");
  contar(contratacoes, (a) => a.data_aprovacao, "contratacoes");
  contar(novasVagas, (v) => v.created_at, "vagas");
  contar(dispensas, desdeQuando, "dispensas");

  // Conversão das candidaturas criadas no período: quantas chegaram (ao menos) a cada etapa.
  const alcancadas = candidaturas.map((aplicacao) => etapaAlcancada(aplicacao, historicoDe(aplicacao)));
  const conversao = ETAPAS_DO_FUNIL.map((status, indice) => ({
    status,
    label: rotulosDoFunil[status],
    total: alcancadas.filter((etapa) => etapa >= indice).length,
  }));
  const taxaDe = (lista) => {
    if (!lista.length) return null;
    return Math.round((lista.filter((a) => a.status_kanban === "APROVADO").length / lista.length) * 1000) / 10;
  };

  // Ranking de empresas: vagas abertas agora e o movimento do período.
  const porEmpresa = new Map();
  const daEmpresa = (vaga) => {
    const atual = porEmpresa.get(vaga.empresa.id) ?? {
      id: vaga.empresa.id,
      nome: vaga.empresa.nome,
      logo_arquivo_id: vaga.empresa.logo_arquivo_id,
      vagasAbertas: 0,
      candidaturas: 0,
      contratacoes: 0,
      emAlerta: 0,
      contratadas: [],
    };
    porEmpresa.set(vaga.empresa.id, atual);
    return atual;
  };
  for (const vaga of vagasAbertas) daEmpresa(vaga).vagasAbertas += 1;
  for (const vaga of vagasEmAlerta) daEmpresa(vagaPorId.get(vaga.id)).emAlerta += 1;
  for (const aplicacao of candidaturas) daEmpresa(vagaPorId.get(aplicacao.vaga_id)).candidaturas += 1;
  for (const aplicacao of contratacoes) {
    const empresa = daEmpresa(vagaPorId.get(aplicacao.vaga_id));
    empresa.contratacoes += 1;
    empresa.contratadas.push(aplicacao);
  }
  const rankingEmpresas = [...porEmpresa.values()]
    .map(({ contratadas, ...empresa }) => ({ ...empresa, tempoMedioDias: tempoMedio(contratadas) }))
    .sort((a, b) => b.contratacoes - a.contratacoes || b.candidaturas - a.candidaturas || b.vagasAbertas - a.vagasAbertas
      || a.nome.localeCompare(b.nome, "pt-BR"));

  // Motivos: pela categoria escolhida ao dispensar; sem ela, pela categoria que o texto indica (só na leitura,
  // nada é gravado); sem nenhuma, pelo próprio texto.
  const porMotivo = new Map();
  const semCategoria = [];
  for (const aplicacao of dispensas) {
    const escolhida = aplicacao.motivo_categoria && motivoPorId.has(aplicacao.motivo_categoria) ? aplicacao.motivo_categoria : null;
    const categoria = escolhida ?? categorizarTexto(aplicacao.motivo_recusa);
    if (!categoria) {
      semCategoria.push(aplicacao.motivo_recusa?.trim() || "Sem motivo informado");
      continue;
    }
    const atual = porMotivo.get(categoria) ?? { categoria, texto: motivoPorId.get(categoria).nome, total: 0, estimadas: 0 };
    atual.total += 1;
    if (!escolhida) atual.estimadas += 1;
    porMotivo.set(categoria, atual);
  }
  const motivos = [...porMotivo.values(), ...agruparTextos(semCategoria).map(({ texto, total }) => ({ categoria: null, texto, total, estimadas: 0 }))]
    .sort((a, b) => b.total - a.total || a.texto.localeCompare(b.texto, "pt-BR"));
  const outrosMotivos = motivos.slice(MAX_MOTIVOS);

  return {
    metrics: {
      openJobs: vagasAbertas.length,
      candidatesInProcess: apps.filter((aplicacao) => ETAPAS_EM_PROCESSO.includes(aplicacao.status_kanban)).length,
      partnerCompanies: filtrado ? new Set(vagasFiltradas.map((vaga) => vaga.empresa.id)).size : empresas.length,
      scheduledInterviews: apps.filter((aplicacao) => entrevistaEmAberto(aplicacao, agora)).length,
      // Desde sempre (o do período fica em periodo.tempoMedioDias).
      tempoMedioContratacaoDias: tempoMedio(contratacoesTodas),
      totalContratacoes: contratacoesTodas.length,
    },
    // Meta mensal (Configurações; null = sem meta): contratações do mês atual, com os mesmos filtros.
    meta: {
      mensal: metaMensal,
      contratacoesMes: contratacoesTodas.filter((aplicacao) => dentro(aplicacao.data_aprovacao, instante({ ...hoje, dia: 1 }), instante(somarMeses({ ...hoje, dia: 1 }, 1)))).length,
    },
    pendencias: {
      vagasEmAlerta: vagasEmAlerta.length,
      entrevistasHoje: aplicacoes.filter((aplicacao) =>
        aplicacao.status_kanban === "ENTREVISTA_AGENDADA" && dentro(aplicacao.data_hora_entrevista, inicioHoje, fimHoje)
        && aplicacao.entrevista_status !== "CANCELADA").length,
      talentos,
      empresasSemVagaAberta: empresas.filter((empresa) => !empresasComVagaAberta.has(empresa.id)).length,
    },
    periodo: {
      periodo: periodo.periodo,
      de: chaveDia(periodo.de),
      ate: chaveDia(somarDias(periodo.ateExclusivo, -1)),
      anteriorDe: chaveDia(civil(periodo.inicioAnterior)),
      anteriorAte: chaveDia(somarDias(civil(periodo.fimAnterior), -1)),
      granularidade: periodo.granularidade,
      datasAproximadas: chaveDia(civil(periodo.inicioAnterior)) < DATAS_REAIS_DESDE,
      datasReaisDesde: DATAS_REAIS_DESDE,
      candidaturas: { atual: candidaturas.length, anterior: candidaturasAnteriores.length },
      contratacoes: { atual: contratacoes.length, anterior: contratacoesAnteriores.length },
      dispensas: { atual: dispensas.length, anterior: dispensasAnteriores.length },
      novasVagas: { atual: novasVagas.length, anterior: novasVagasAnteriores.length },
      tempoMedioDias: { atual: tempoMedio(contratacoes), anterior: tempoMedio(contratacoesAnteriores) },
      // % das candidaturas criadas no período que já viraram contratação.
      taxaContratacao: { atual: taxaDe(candidaturas), anterior: taxaDe(candidaturasAnteriores) },
    },
    serie,
    conversao,
    // Quantas candidaturas do período têm histórico completo (a conversão delas é exata).
    conversaoExata: candidaturas.filter((aplicacao) => historicoDe(aplicacao)[0]?.de_status === null).length,
    tempoPorEtapa: tempoPorEtapa(historicoPorAplicacao, doPeriodo),
    historicoDesde: historicos[0]?.created_at ?? null,
    vagasEmAlerta,
    distribuicaoPorCurso: agruparTextos(cursos).map(({ texto, total }) => ({ curso: texto, total })),
    vagasPorArea: [...porArea.values()].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR")),
    funnel,
    rankingEmpresas,
    motivosDispensa: [
      ...motivos.slice(0, MAX_MOTIVOS),
      ...(outrosMotivos.length
        ? [{ texto: `Outros (${outrosMotivos.length} motivos)`, total: outrosMotivos.reduce((soma, m) => soma + m.total, 0), outros: true }]
        : []),
    ],
    opcoes: {
      empresas,
      areas: [...listaAreas.map(({ id, nome }) => ({ id, nome })), { id: AREA_NAO_IDENTIFICADA, nome: "Área não identificada" }],
    },
  };
}

module.exports = { montarDashboard, lerPeriodo };
