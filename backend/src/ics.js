// Convite de calendário (.ics, RFC 5545 / iTIP RFC 5546) para os lembretes por e-mail.
// METHOD:REQUEST cria ou atualiza o compromisso (mesmo UID, SEQUENCE maior); METHOD:CANCEL o cancela.
// Horários no fuso America/Sao_Paulo (com VTIMEZONE); dia inteiro usa VALUE=DATE.
const { FUSO, partesSaoPaulo } = require("./fuso");

const PRODID = "-//Super Estagios//Painel de RH//PT-BR";

// Brasil sem horário de verão desde 2019: um único bloco STANDARD em -03:00.
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${FUSO}`,
  `X-LIC-LOCATION:${FUSO}`,
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0300",
  "TZOFFSETTO:-0300",
  "TZNAME:-03",
  "DTSTART:19700101T000000",
  "END:STANDARD",
  "END:VTIMEZONE",
];

const doisDigitos = (n) => String(n).padStart(2, "0");

// Texto de propriedade: escapa \ ; , e quebras de linha.
function escaparTexto(texto) {
  return String(texto).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// Parâmetro (ex.: CN): sem aspas nem quebras, entre aspas.
const parametro = (texto) => `"${String(texto).replace(/["\r\n]/g, "")}"`;

// Linhas com mais de 75 bytes continuam na linha seguinte começando com espaço (sem partir caracteres UTF-8).
function dobrarLinha(linha) {
  const partes = [];
  let atual = "";
  let bytes = 0;
  for (const caractere of linha) {
    const tamanho = Buffer.byteLength(caractere);
    const limite = partes.length ? 74 : 75;
    if (bytes + tamanho > limite) {
      partes.push(atual);
      atual = "";
      bytes = 0;
    }
    atual += caractere;
    bytes += tamanho;
  }
  partes.push(atual);
  return partes.join("\r\n ");
}

const utc = (data) => data.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function local(data) {
  const p = partesSaoPaulo(data);
  return `${p.ano}${doisDigitos(p.mes)}${doisDigitos(p.dia)}T${doisDigitos(p.hora)}${doisDigitos(p.minuto)}${doisDigitos(p.segundo)}`;
}

function dia(data) {
  const p = partesSaoPaulo(data);
  return `${p.ano}${doisDigitos(p.mes)}${doisDigitos(p.dia)}`;
}

// Minutos antes do início → duração ISO negativa (-P1D, -PT1H, -PT30M, -P1W).
function gatilho(minutos) {
  if (minutos % 10080 === 0) return `-P${minutos / 10080}W`;
  if (minutos % 1440 === 0) return `-P${minutos / 1440}D`;
  if (minutos % 60 === 0) return `-PT${minutos / 60}H`;
  return `-PT${minutos}M`;
}

// Monta o .ics de um convidado.
// { metodo: "REQUEST" | "CANCEL", uid, sequence, inicio, fim, diaInteiro, titulo, descricao?, local?,
//   organizador: { email, nome? }, convidado, alarmes: [minutos], agora? }
function gerarIcs({ metodo, uid, sequence, inicio, fim, diaInteiro, titulo, descricao, local: lugar, organizador, convidado, alarmes = [], agora = new Date() }) {
  const cancelado = metodo === "CANCEL";
  const linhas = [
    "BEGIN:VCALENDAR",
    `PRODID:${PRODID}`,
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    `METHOD:${metodo}`,
    ...(diaInteiro ? [] : VTIMEZONE),
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${utc(agora)}`,
    `SEQUENCE:${sequence}`,
    ...(diaInteiro
      ? [`DTSTART;VALUE=DATE:${dia(inicio)}`, `DTEND;VALUE=DATE:${dia(fim)}`]
      : [`DTSTART;TZID=${FUSO}:${local(inicio)}`, `DTEND;TZID=${FUSO}:${local(fim)}`]),
    `SUMMARY:${escaparTexto(titulo)}`,
    ...(descricao ? [`DESCRIPTION:${escaparTexto(descricao)}`] : []),
    ...(lugar ? [`LOCATION:${escaparTexto(lugar)}`] : []),
    `ORGANIZER${organizador.nome ? `;CN=${parametro(organizador.nome)}` : ""}:mailto:${organizador.email}`,
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:${convidado}`,
    `STATUS:${cancelado ? "CANCELLED" : "CONFIRMED"}`,
    `TRANSP:${diaInteiro ? "TRANSPARENT" : "OPAQUE"}`,
  ];

  if (!cancelado) {
    for (const minutos of alarmes) {
      linhas.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escaparTexto(`Lembrete: ${titulo}`)}`, `TRIGGER:${gatilho(minutos)}`, "END:VALARM");
    }
  }

  linhas.push("END:VEVENT", "END:VCALENDAR");
  return `${linhas.map(dobrarLinha).join("\r\n")}\r\n`;
}

module.exports = { gerarIcs, escaparTexto, dobrarLinha, gatilho };
