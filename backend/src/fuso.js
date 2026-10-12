// Datas no fuso de São Paulo (horário de Brasília), usado nos eventos de dia inteiro e nos e-mails de lembrete.
// Usa o Intl do Node (com a tabela de fusos), então continua certo se o horário de verão voltar.

const FUSO = "America/Sao_Paulo";
const MINUTO_MS = 60 * 1000;

const formatoPartes = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

// { ano, mes, dia, hora, minuto, segundo } (números) da data no fuso de São Paulo.
function partesSaoPaulo(data) {
  const partes = Object.fromEntries(formatoPartes.formatToParts(data).map(({ type, value }) => [type, Number(value)]));
  return { ano: partes.year, mes: partes.month, dia: partes.day, hora: partes.hour, minuto: partes.minute, segundo: partes.second };
}

// 00:00 em São Paulo do dia (em São Paulo) da data recebida.
function meiaNoiteSaoPaulo(data) {
  const { ano, mes, dia } = partesSaoPaulo(data);
  const palpite = Date.UTC(ano, mes - 1, dia);
  const local = partesSaoPaulo(new Date(palpite));
  const diferenca = Date.UTC(local.ano, local.mes - 1, local.dia, local.hora, local.minuto) - palpite;
  return new Date(palpite - diferenca);
}

const dataLonga = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const dataCurta = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" });
const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });

function duracaoTexto(minutos) {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (!horas) return `${resto} min`;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

module.exports = {
  FUSO,
  MINUTO_MS,
  partesSaoPaulo,
  meiaNoiteSaoPaulo,
  dataLonga: (data) => dataLonga.format(data),
  dataCurta: (data) => dataCurta.format(data),
  horaTexto: (data) => hora.format(data),
  duracaoTexto,
};
