// Validação dos campos opcionais de estudante, vaga e candidatura.
// Regra comum: campo ausente (undefined) não muda nada; null ou "" apaga o valor.

const turnosEstudo = new Set(["MANHA", "TARDE", "NOITE", "INTEGRAL", "EAD"]);
const periodos = ["MANHA", "TARDE", "NOITE"];
const turnosVaga = new Set(["MANHA", "TARDE", "INTEGRAL"]);
const horariosAntigos = new Set(["MANHA", "TARDE", "NOITE"]);

const TAMANHO_MAXIMO_OBSERVACAO = 1000;

function vazio(valor) {
  return valor === null || valor === "";
}

function erro(mensagem) {
  return { erro: mensagem };
}

// "2027-06" → 1º dia do mês (coluna DATE).
function lerMesAno(valor) {
  const partes = /^(\d{4})-(\d{2})$/.exec(String(valor));
  if (!partes) return null;
  const [ano, mes] = [Number(partes[1]), Number(partes[2])];
  if (mes < 1 || mes > 12 || ano < 1990 || ano > 2100) return null;
  return new Date(Date.UTC(ano, mes - 1, 1));
}

// "2004-03-15" → data (coluna DATE). Recusa datas inexistentes e futuras.
function lerData(valor) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor));
  if (!partes) return null;
  const [ano, mes, dia] = partes.slice(1).map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) return null;
  if (ano < 1900 || data > new Date()) return null;
  return data;
}

// Campos do estudante: turno de estudo, disponibilidade, semestre, previsão de formatura e nascimento.
// horario_estudo é o campo antigo: continua aceito (integrações e testes antigos) e preenche o turno quando ele não vem.
function camposEstudante(body) {
  const data = {};
  const { horario_estudo, turno_estudo, disponibilidade, semestre_atual, previsao_formatura, data_nascimento } = body;

  if (horario_estudo !== undefined && !vazio(horario_estudo)) {
    if (!horariosAntigos.has(horario_estudo)) return erro("Horário de estudo inválido.");
    data.horario_estudo = horario_estudo;
    if (turno_estudo === undefined) data.turno_estudo = horario_estudo;
  }

  if (turno_estudo !== undefined) {
    if (vazio(turno_estudo)) data.turno_estudo = null;
    else if (turnosEstudo.has(turno_estudo)) data.turno_estudo = turno_estudo;
    else return erro("Turno de estudo inválido.");
  }

  if (disponibilidade !== undefined) {
    const lista = disponibilidade === null ? [] : disponibilidade;
    if (!Array.isArray(lista) || lista.some((periodo) => !periodos.includes(periodo))) {
      return erro("Disponibilidade inválida: use Manhã, Tarde e/ou Noite.");
    }
    data.disponibilidade = periodos.filter((periodo) => lista.includes(periodo));
  }

  if (semestre_atual !== undefined) {
    if (vazio(semestre_atual)) data.semestre_atual = null;
    else {
      const semestre = Number(semestre_atual);
      if (!Number.isInteger(semestre) || semestre < 1 || semestre > 12) return erro("Semestre atual deve ser um número de 1 a 12.");
      data.semestre_atual = semestre;
    }
  }

  if (previsao_formatura !== undefined) {
    if (vazio(previsao_formatura)) data.previsao_formatura = null;
    else {
      const data_formatura = lerMesAno(previsao_formatura);
      if (!data_formatura) return erro("Previsão de formatura inválida: use mês/ano.");
      data.previsao_formatura = data_formatura;
    }
  }

  if (data_nascimento !== undefined) {
    if (vazio(data_nascimento)) data.data_nascimento = null;
    else {
      const nascimento = lerData(data_nascimento);
      if (!nascimento) return erro("Data de nascimento inválida.");
      data.data_nascimento = nascimento;
    }
  }

  return { data };
}

function turnoVaga(body) {
  const { turno } = body;
  if (turno === undefined) return { data: {} };
  if (vazio(turno)) return { data: { turno: null } };
  if (!turnosVaga.has(turno)) return erro("Turno da vaga inválido: use Manhã, Tarde ou Integral.");
  return { data: { turno } };
}

function observacao(valor) {
  if (valor === undefined) return erro("Informe a observação (ou deixe em branco para apagar).");
  if (vazio(valor)) return { data: { observacao: null } };
  if (typeof valor !== "string") return erro("Observação inválida.");
  if (valor.length > TAMANHO_MAXIMO_OBSERVACAO) {
    return erro(`A observação pode ter no máximo ${TAMANHO_MAXIMO_OBSERVACAO} caracteres.`);
  }
  return { data: { observacao: valor } };
}

module.exports = { camposEstudante, turnoVaga, observacao, TAMANHO_MAXIMO_OBSERVACAO };
