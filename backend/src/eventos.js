// Regras dos eventos do Calendário (compromissos que não são entrevistas).
const { MINUTO_MS, meiaNoiteSaoPaulo } = require("./fuso");

const TITULO_MAX = 120;
const DESCRICAO_MAX = 2000;
const DURACAO_PADRAO = 60;
const DURACAO_MAX = 1440;
const DIA_INTEIRO_MINUTOS = 1440;
const ANO_MINIMO = 2000;
const ANO_MAXIMO = 2100;

const selectEvento = {
  id: true,
  titulo: true,
  descricao: true,
  inicio: true,
  duracao_minutos: true,
  dia_inteiro: true,
  created_at: true,
  updated_at: true,
  criado_por: { select: { id: true, nome: true } },
};

const fimDoEvento = (evento) => new Date(new Date(evento.inicio).getTime() + evento.duracao_minutos * MINUTO_MS);

// Confere os campos enviados. Na criação, título e início são obrigatórios; na edição (atual = evento salvo),
// campo ausente não muda. Devolve { erro } ou { data } já pronto para o Prisma.
function camposEvento(body, atual = null) {
  const { titulo, descricao, inicio, duracao_minutos, dia_inteiro } = body ?? {};
  const data = {};

  if (titulo !== undefined || !atual) {
    if (typeof titulo !== "string" || !titulo.trim()) return { erro: "Informe o título do evento." };
    if (titulo.trim().length > TITULO_MAX) return { erro: `O título pode ter no máximo ${TITULO_MAX} caracteres.` };
    data.titulo = titulo.trim();
  }

  if (descricao !== undefined) {
    if (descricao !== null && typeof descricao !== "string") return { erro: "Descrição inválida." };
    if (descricao && descricao.length > DESCRICAO_MAX) return { erro: `A descrição pode ter no máximo ${DESCRICAO_MAX} caracteres.` };
    data.descricao = descricao?.trim() || null;
  }

  if (inicio !== undefined || !atual) {
    const data_inicio = typeof inicio === "string" && inicio ? new Date(inicio) : null;
    if (!data_inicio || Number.isNaN(data_inicio.getTime())) return { erro: "Informe uma data e hora válidas." };
    const ano = data_inicio.getUTCFullYear();
    if (ano < ANO_MINIMO || ano > ANO_MAXIMO) return { erro: `Informe uma data entre ${ANO_MINIMO} e ${ANO_MAXIMO}.` };
    data.inicio = data_inicio;
  }

  if (dia_inteiro !== undefined) {
    if (typeof dia_inteiro !== "boolean") return { erro: "Dia inteiro deve ser verdadeiro ou falso." };
    data.dia_inteiro = dia_inteiro;
  }

  if (duracao_minutos !== undefined && duracao_minutos !== null && duracao_minutos !== "") {
    const duracao = Number(duracao_minutos);
    if (!Number.isInteger(duracao) || duracao <= 0) return { erro: "A duração deve ser um número inteiro e positivo de minutos." };
    if (duracao > DURACAO_MAX) return { erro: `A duração pode ser de no máximo ${DURACAO_MAX} minutos (24 horas).` };
    data.duracao_minutos = duracao;
  }

  // Dia inteiro: começa às 00:00 de São Paulo e dura o dia todo. Ao deixar de ser dia inteiro sem informar a
  // duração, volta para a duração padrão.
  const diaInteiro = data.dia_inteiro ?? atual?.dia_inteiro ?? false;
  if (diaInteiro) {
    data.inicio = meiaNoiteSaoPaulo(data.inicio ?? atual.inicio);
    data.duracao_minutos = DIA_INTEIRO_MINUTOS;
  } else if (atual?.dia_inteiro && data.duracao_minutos === undefined) {
    data.duracao_minutos = DURACAO_PADRAO;
  }

  return { data };
}

module.exports = { selectEvento, fimDoEvento, camposEvento, TITULO_MAX, DESCRICAO_MAX, DURACAO_MAX };
