// Estágio depois da contratação: datas, TCE, seguro, supervisor, taxa e relatórios semestrais (Lei 11.788).
// Todos os campos são opcionais; os alertas só aparecem quando a data correspondente foi informada.
const { DIA_MS } = require("./utils");

const LIMITE_ANOS = 2; // estágio na mesma empresa: no máximo 2 anos (exceto estagiário com deficiência)
const AVISO_FIM_DIAS = 30;
const AVISO_LIMITE_DIAS = 60;
const TEXTO_MAX = 100;
const OBSERVACOES_MAX = 2000;

function lerDia(valor) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor));
  if (!partes) return null;
  const [ano, mes, dia] = partes.slice(1).map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia || ano < 2000 || ano > 2100) return null;
  return data;
}

const vazio = (valor) => valor === null || valor === "";

// Valida os campos enviados (ausente = não muda; null/"" = apaga). Devolve { data } ou { erro }.
function camposEstagio(body = {}) {
  const data = {};
  for (const campo of ["data_inicio", "data_fim", "encerrado_em"]) {
    if (body[campo] === undefined) continue;
    if (vazio(body[campo])) data[campo] = null;
    else {
      const dia = lerDia(body[campo]);
      if (!dia) return { erro: "Data inválida: use o formato AAAA-MM-DD." };
      data[campo] = dia;
    }
  }
  if (data.data_inicio && data.data_fim && data.data_fim < data.data_inicio) {
    return { erro: "O fim do estágio precisa ser depois do início." };
  }
  if (body.tce_assinado !== undefined) {
    if (typeof body.tce_assinado !== "boolean") return { erro: "TCE assinado inválido." };
    data.tce_assinado = body.tce_assinado;
  }
  for (const campo of ["seguro_apolice", "supervisor"]) {
    if (body[campo] === undefined) continue;
    if (vazio(body[campo])) data[campo] = null;
    else if (typeof body[campo] !== "string" || body[campo].length > TEXTO_MAX) return { erro: `Texto inválido (até ${TEXTO_MAX} caracteres).` };
    else data[campo] = body[campo];
  }
  if (body.observacoes !== undefined) {
    if (vazio(body.observacoes)) data.observacoes = null;
    else if (typeof body.observacoes !== "string" || body.observacoes.length > OBSERVACOES_MAX) {
      return { erro: `Observações inválidas (até ${OBSERVACOES_MAX} caracteres).` };
    }
    else data.observacoes = body.observacoes;
  }
  if (body.taxa_agenciamento !== undefined) {
    if (vazio(body.taxa_agenciamento)) data.taxa_agenciamento = null;
    else {
      const taxa = Number(body.taxa_agenciamento);
      if (!Number.isFinite(taxa) || taxa < 0 || taxa > 1e7) return { erro: "Taxa de agenciamento inválida." };
      data.taxa_agenciamento = Math.round(taxa * 100) / 100;
    }
  }
  return { data };
}

const somarMeses = (data, meses) => new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + meses, data.getUTCDate()));
const diasAte = (data, hoje) => Math.ceil((data - hoje) / DIA_MS);

// Situação do estágio para as telas e notificações. hoje: 00:00 UTC do dia atual.
function situacaoEstagio(estagio, hoje = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()))) {
  if (!estagio) return { alertas: [], relatoriosDevidos: 0, relatoriosPendentes: [] };
  const alertas = [];
  const encerrado = Boolean(estagio.encerrado_em);
  const inicio = estagio.data_inicio ? new Date(estagio.data_inicio) : null;
  const fim = estagio.data_fim ? new Date(estagio.data_fim) : null;

  if (!encerrado && fim) {
    const dias = diasAte(fim, hoje);
    if (dias < 0) alertas.push({ tipo: "fim_passou", gravidade: "alta", texto: `Contrato terminou há ${-dias} ${dias === -1 ? "dia" : "dias"}` });
    else if (dias <= AVISO_FIM_DIAS) alertas.push({ tipo: "fim_proximo", gravidade: "media", texto: `Contrato termina em ${dias} ${dias === 1 ? "dia" : "dias"}` });
  }
  if (!encerrado && inicio) {
    const limite = somarMeses(inicio, LIMITE_ANOS * 12);
    const dias = diasAte(limite, hoje);
    if (dias <= AVISO_LIMITE_DIAS) {
      alertas.push({ tipo: "limite_2_anos", gravidade: dias < 0 ? "alta" : "media", texto: dias < 0 ? "Passou do limite de 2 anos na mesma empresa" : `Limite de 2 anos em ${dias} ${dias === 1 ? "dia" : "dias"}` });
    }
  }
  if (!encerrado && !estagio.tce_assinado && inicio) alertas.push({ tipo: "tce", gravidade: "media", texto: "TCE ainda não assinado" });

  // Um relatório a cada 6 meses completos desde o início (até o fim ou o encerramento, se houver).
  let relatoriosDevidos = 0;
  if (inicio) {
    const ate = [hoje, fim, estagio.encerrado_em ? new Date(estagio.encerrado_em) : null].filter(Boolean).reduce((a, b) => (b < a ? b : a));
    while (somarMeses(inicio, (relatoriosDevidos + 1) * 6) <= ate) relatoriosDevidos++;
  }
  const entregues = new Set((estagio.relatorios ?? []).map((relatorio) => relatorio.numero));
  const relatoriosPendentes = Array.from({ length: relatoriosDevidos }, (_, i) => i + 1).filter((numero) => !entregues.has(numero));
  if (relatoriosPendentes.length) {
    alertas.push({
      tipo: "relatorio",
      gravidade: "media",
      texto: relatoriosPendentes.length === 1 ? `Relatório do ${relatoriosPendentes[0]}º semestre pendente` : `${relatoriosPendentes.length} relatórios semestrais pendentes`,
    });
  }
  return { alertas, relatoriosDevidos, relatoriosPendentes };
}

module.exports = { camposEstagio, situacaoEstagio, lerDia };
