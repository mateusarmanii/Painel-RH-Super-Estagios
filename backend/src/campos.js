// Validação dos campos opcionais de estudante, vaga e candidatura.
// Regra comum: campo ausente (undefined) não muda nada; null ou "" apaga o valor.

const turnosEstudo = new Set(["MANHA", "TARDE", "NOITE", "INTEGRAL", "EAD"]);
const periodos = ["MANHA", "TARDE", "NOITE"];
const turnosVaga = new Set(["MANHA", "TARDE", "INTEGRAL"]);
const horariosAntigos = new Set(["MANHA", "TARDE", "NOITE"]);
const modalidades = new Set(["PRESENCIAL", "HIBRIDA", "HOME_OFFICE"]);
const sexosPreferencia = new Set(["FEMININO", "MASCULINO"]);

const TAMANHO_MAXIMO_TEXTO_CURTO = 100;

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

  const endereco = camposEndereco(body);
  if (endereco.erro) return endereco;
  Object.assign(data, endereco.data);

  return { data };
}

// Texto curto opcional (cidade, bairro, horário da vaga).
function textoCurto(data, campo, valor, rotulo) {
  if (valor === undefined) return null;
  if (vazio(valor)) {
    data[campo] = null;
    return null;
  }
  if (typeof valor !== "string") return `Campo "${rotulo}" inválido.`;
  if (valor.length > TAMANHO_MAXIMO_TEXTO_CURTO) return `${rotulo} pode ter no máximo ${TAMANHO_MAXIMO_TEXTO_CURTO} caracteres.`;
  data[campo] = valor;
  return null;
}

// CEP, cidade e bairro (estudante e vaga). O CEP é guardado só com os 8 dígitos ("30130-010" → "30130010").
function camposEndereco(body) {
  const data = {};
  const { cep, cidade, bairro } = body;

  if (cep !== undefined) {
    if (vazio(cep)) data.cep = null;
    else {
      const digitos = typeof cep === "string" || typeof cep === "number" ? String(cep).replace(/\D/g, "") : "";
      if (digitos.length !== 8) return erro("CEP inválido: use 8 dígitos.");
      data.cep = digitos;
    }
  }

  const problema = textoCurto(data, "cidade", cidade, "Cidade") ?? textoCurto(data, "bairro", bairro, "Bairro");
  if (problema) return erro(problema);
  return { data };
}

// Campos opcionais da vaga: turno, horário, endereço, modalidade e preferência de sexo (uso interno).
function camposVaga(body) {
  const data = {};
  const { turno, horario, modalidade, sexo_preferencia } = body;

  if (turno !== undefined) {
    if (vazio(turno)) data.turno = null;
    else if (turnosVaga.has(turno)) data.turno = turno;
    else return erro("Turno da vaga inválido: use Manhã, Tarde ou Integral.");
  }

  const problema = textoCurto(data, "horario", horario, "Horário");
  if (problema) return erro(problema);

  const endereco = camposEndereco(body);
  if (endereco.erro) return endereco;
  Object.assign(data, endereco.data);

  if (modalidade !== undefined) {
    if (vazio(modalidade)) data.modalidade = null;
    else if (modalidades.has(modalidade)) data.modalidade = modalidade;
    else return erro("Modalidade inválida: use Presencial, Híbrida ou Home office.");
  }

  if (sexo_preferencia !== undefined) {
    if (vazio(sexo_preferencia)) data.sexo_preferencia = null;
    else if (sexosPreferencia.has(sexo_preferencia)) data.sexo_preferencia = sexo_preferencia;
    else return erro("Preferência informada pela empresa inválida.");
  }

  return { data };
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

module.exports = { camposEstudante, camposVaga, observacao, TAMANHO_MAXIMO_OBSERVACAO };
