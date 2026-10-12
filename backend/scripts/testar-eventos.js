// Testes dos eventos do Calendário e dos lembretes por e-mail (convite .ics).
// NENHUM e-mail é enviado de verdade: a API sobe com EMAIL_TRANSPORTE_FALSO, que monta a mensagem e só a grava
// num arquivo temporário; o teste confere o .ics (UID, SEQUENCE, VALARM, fuso, REQUEST e CANCEL).
// Sobe duas APIs: 3384 (SMTP "configurado", transporte falso) e 3383 (sem SMTP).
// ATENÇÃO: grava e apaga dados no banco do DATABASE_URL (só os registros "[TESTE]" que o próprio teste cria).
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const BACKEND = path.resolve(__dirname, "..");
process.chdir(BACKEND);
require("dotenv").config();
const prisma = require("../src/prisma");
const { criarTeste } = require("./lib/teste");
const { gerarIcs } = require("../src/ics");
const { meiaNoiteSaoPaulo } = require("../src/fuso");
const { LIMITE_POR_HORA } = require("../src/lembretes");

const PORT = 3384;
const PORT_SEM_SMTP = 3383;
const UUID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const DOMINIO = "teste.invalid";
const ARQUIVO_EMAILS = path.join(os.tmpdir(), `lembretes-teste-${process.pid}.jsonl`);
const UID_LIMITE = `teste-limite-${process.pid}@super-estagios`;

const teste = criarTeste(PORT);
const semSmtp = criarTeste(PORT_SEM_SMTP);
const { req, checar, checarStatus, esperarServidor } = teste;
const ids = { eventos: [], uids: [UID_LIMITE], empresa: null, vaga: null, estudante: null };

const email = (nome) => `${nome}@${DOMINIO}`;
// Horário "redondo" (múltiplo de 5 min) daqui a ms.
const daqui = (ms) => new Date(Math.ceil((Date.now() + ms) / (5 * 60 * 1000)) * 5 * 60 * 1000);

// E-mails gravados pelo transporte falso (um JSON por linha).
function emailsGravados() {
  if (!fs.existsSync(ARQUIVO_EMAILS)) return [];
  return fs.readFileSync(ARQUIVO_EMAILS, "utf8").split("\n").filter(Boolean).map((linha) => JSON.parse(linha));
}
const novosEmails = (antes) => emailsGravados().slice(antes);

// Variáveis SMTP de mentira: o host nem existe, e o transporte falso garante que nada sai.
function subirApi(port, smtp) {
  return spawn(process.execPath, ["server.js"], {
    env: {
      ...process.env,
      PORT: port,
      NODE_ENV: "test",
      SMTP_HOST: smtp ? "smtp.teste.invalid" : "",
      SMTP_PORT: smtp ? "587" : "",
      SMTP_USER: smtp ? "usuario-teste" : "",
      SMTP_PASS: smtp ? "senha-teste" : "",
      EMAIL_REMETENTE: smtp ? `Super Estágios Teste <rh@${DOMINIO}>` : "",
      EMAIL_TRANSPORTE_FALSO: ARQUIVO_EMAILS,
    },
    stdio: "ignore",
  });
}

function testarIcs() {
  console.log("\n== Arquivo .ics (sem API)");
  const base = {
    uid: "evento-abc@super-estagios",
    inicio: new Date("2026-10-13T12:00:00Z"),
    fim: new Date("2026-10-13T13:30:00Z"),
    diaInteiro: false,
    titulo: "Reunião; com, vírgulas \\ e um título bem comprido para a linha passar de setenta e cinco bytes",
    descricao: "Linha 1\nLinha 2",
    organizador: { email: `rh@${DOMINIO}`, nome: "Super Estágios" },
    convidado: email("a"),
    agora: new Date("2026-10-12T15:00:00Z"),
  };
  const ics = gerarIcs({ ...base, metodo: "REQUEST", sequence: 0, alarmes: [1440, 60] });
  const linhas = ics.split("\r\n");
  checar("REQUEST: METHOD, UID, SEQUENCE:0 e STATUS:CONFIRMED", ics.includes("METHOD:REQUEST\r\n") && ics.includes("UID:evento-abc@super-estagios\r\n")
    && ics.includes("SEQUENCE:0\r\n") && ics.includes("STATUS:CONFIRMED\r\n"));
  checar("Fuso America/Sao_Paulo: VTIMEZONE e 12:00Z → 09:00 local", ics.includes("BEGIN:VTIMEZONE") && ics.includes("TZID:America/Sao_Paulo")
    && ics.includes("DTSTART;TZID=America/Sao_Paulo:20261013T090000") && ics.includes("DTEND;TZID=America/Sao_Paulo:20261013T103000"));
  checar("Dois VALARM: 1 dia e 1 hora antes", (ics.match(/BEGIN:VALARM/g) ?? []).length === 2 && ics.includes("TRIGGER:-P1D") && ics.includes("TRIGGER:-PT1H"));
  checar("Texto escapado (; , \\ e quebra de linha)", ics.includes("Reunião\\; com\\, vírgulas \\\\ e") && ics.includes("DESCRIPTION:Linha 1\\nLinha 2"));
  checar("Linhas com CRLF e no máximo 75 bytes (dobradas)", linhas.every((linha) => Buffer.byteLength(linha) <= 75) && linhas.some((linha) => linha.startsWith(" ")));
  checar("ORGANIZER e ATTENDEE", ics.includes(`ORGANIZER;CN="Super Estágios":mailto:rh@${DOMINIO}`) && ics.replace(/\r\n /g, "").includes(`mailto:${email("a")}`));

  const cancel = gerarIcs({ ...base, metodo: "CANCEL", sequence: 2, alarmes: [1440] });
  checar("CANCEL: METHOD:CANCEL, STATUS:CANCELLED, mesmo UID, SEQUENCE:2, sem VALARM", cancel.includes("METHOD:CANCEL\r\n")
    && cancel.includes("STATUS:CANCELLED") && cancel.includes("UID:evento-abc@super-estagios") && cancel.includes("SEQUENCE:2\r\n")
    && !cancel.includes("VALARM"));

  const inicioDia = meiaNoiteSaoPaulo(new Date("2026-10-13T15:00:00Z"));
  const diaInteiro = gerarIcs({ ...base, metodo: "REQUEST", sequence: 0, diaInteiro: true, inicio: inicioDia, fim: new Date(inicioDia.getTime() + DIA), alarmes: [] });
  checar("Dia inteiro: VALUE=DATE, fim no dia seguinte, sem VTIMEZONE", diaInteiro.includes("DTSTART;VALUE=DATE:20261013")
    && diaInteiro.includes("DTEND;VALUE=DATE:20261014") && !diaInteiro.includes("VTIMEZONE"), inicioDia.toISOString());
  checar("00:00 de São Paulo = 03:00Z", inicioDia.toISOString() === "2026-10-13T03:00:00.000Z"
    && meiaNoiteSaoPaulo(new Date("2026-10-13T02:30:00Z")).toISOString() === "2026-10-12T03:00:00.000Z");
}

async function main() {
  testarIcs();
  const servidor = subirApi(PORT, true);
  const servidorSemSmtp = subirApi(PORT_SEM_SMTP, false);
  try {
    await esperarServidor();
    await semSmtp.esperarServidor();

    console.log("\n== Login");
    let r = await req("GET", `/eventos?inicio=${new Date().toISOString()}&fim=${new Date(Date.now() + DIA).toISOString()}`, undefined, { token: null });
    checarStatus("Listar eventos sem login → 401", r, 401);
    r = await req("POST", "/lembretes", { evento_id: UUID_INEXISTENTE, emails: [email("x")] }, { token: null });
    checarStatus("Enviar lembrete sem login → 401", r, 401);

    console.log("\n== Validações do evento");
    const inicio = daqui(3 * HORA).toISOString();
    checarStatus("Sem título → 400", await req("POST", "/eventos", { titulo: "  ", inicio }), 400);
    checarStatus("Título com 121 caracteres → 400", await req("POST", "/eventos", { titulo: `[TESTE] ${"x".repeat(113)}`, inicio }), 400);
    checarStatus("Sem data → 400", await req("POST", "/eventos", { titulo: "[TESTE] Sem data" }), 400);
    checarStatus("Data inválida → 400", await req("POST", "/eventos", { titulo: "[TESTE] Data ruim", inicio: "2026-13-45T99:00" }), 400);
    checarStatus("Duração 0 → 400", await req("POST", "/eventos", { titulo: "[TESTE] Zero", inicio, duracao_minutos: 0 }), 400);
    checarStatus("Duração negativa → 400", await req("POST", "/eventos", { titulo: "[TESTE] Negativa", inicio, duracao_minutos: -30 }), 400);
    checarStatus("Duração quebrada (1,5) → 400", await req("POST", "/eventos", { titulo: "[TESTE] Quebrada", inicio, duracao_minutos: 1.5 }), 400);
    checarStatus("Duração acima de 24h → 400", await req("POST", "/eventos", { titulo: "[TESTE] Longa", inicio, duracao_minutos: 1441 }), 400);
    checarStatus("Dia inteiro não booleano → 400", await req("POST", "/eventos", { titulo: "[TESTE] Dia", inicio, dia_inteiro: "sim" }), 400);

    console.log("\n== Criar, listar e editar");
    r = await req("POST", "/eventos", { titulo: "[TESTE] Reunião com a empresa", descricao: "Pauta: contrato", inicio });
    checarStatus("Cria evento → 201", r, 201);
    const evento = r.body;
    ids.eventos.push(evento.id);
    checar("Duração padrão 60, não é dia inteiro, criado pelo usuário logado", evento.duracao_minutos === 60 && evento.dia_inteiro === false
      && evento.criado_por?.id === teste.usuario.id, JSON.stringify(evento.criado_por));

    r = await req("POST", "/eventos", { titulo: "[TESTE] Prazo de documentos", inicio: daqui(5 * DIA).toISOString(), dia_inteiro: true, duracao_minutos: 30 });
    ids.eventos.push(r.body?.id);
    const meiaNoite = meiaNoiteSaoPaulo(daqui(5 * DIA)).toISOString();
    checar("Dia inteiro: começa 00:00 de São Paulo e dura 1440 min", r.status === 201 && r.body.inicio === meiaNoite && r.body.duracao_minutos === 1440,
      `${r.body?.inicio} / ${r.body?.duracao_minutos}`);
    const diaInteiro = r.body;

    r = await req("POST", "/eventos", { titulo: "[TESTE] Daqui a 3 dias", inicio: daqui(3 * DIA).toISOString(), duracao_minutos: 30 });
    ids.eventos.push(r.body?.id);
    const longe = r.body;

    const periodo = `inicio=${new Date().toISOString()}&fim=${new Date(Date.now() + 7 * DIA).toISOString()}`;
    r = await req("GET", `/eventos?${periodo}`);
    checar("Período traz os 3 eventos, em ordem", [evento.id, longe.id, diaInteiro.id].every((id) => r.body.some((e) => e.id === id))
      && r.body.findIndex((e) => e.id === evento.id) < r.body.findIndex((e) => e.id === longe.id));
    checarStatus("Sem período → 400", await req("GET", "/eventos"), 400);
    checarStatus("Período maior que 62 dias → 400",
      await req("GET", `/eventos?inicio=${new Date().toISOString()}&fim=${new Date(Date.now() + 90 * DIA).toISOString()}`), 400);
    checarStatus("Buscar por id → 200", await req("GET", `/eventos/${evento.id}`), 200);
    checarStatus("ID inválido → 400", await req("GET", "/eventos/abc"), 400);
    checarStatus("Evento inexistente → 404", await req("GET", `/eventos/${UUID_INEXISTENTE}`), 404);

    r = await req("PUT", `/eventos/${longe.id}`, { inicio: daqui(3 * DIA + HORA).toISOString() });
    checar("Editar só o início (arrastar) mantém título e duração", r.status === 200 && r.body.titulo === longe.titulo && r.body.duracao_minutos === 30);
    checarStatus("Editar com título vazio → 400", await req("PUT", `/eventos/${longe.id}`, { titulo: "" }), 400);
    checarStatus("Editar inexistente → 404", await req("PUT", `/eventos/${UUID_INEXISTENTE}`, { titulo: "[TESTE] x" }), 404);
    r = await req("PUT", `/eventos/${diaInteiro.id}`, { dia_inteiro: false, inicio: daqui(5 * DIA).toISOString() });
    checar("Deixar de ser dia inteiro volta à duração padrão", r.body?.dia_inteiro === false && r.body?.duracao_minutos === 60, `${r.body?.duracao_minutos}`);

    console.log("\n== Resumo do Calendário (próximas 24h)");
    const semana = `inicioSemana=${new Date(Date.now() - DIA).toISOString()}&fimSemana=${new Date(Date.now() + 2 * DIA).toISOString()}`;
    r = await req("GET", `/entrevistas/resumo?${semana}`);
    checar("eventos24h traz o evento de daqui a 3h, separado das entrevistas", r.body.eventos24h?.some((e) => e.id === evento.id)
      && !r.body.semConfirmacao24h.some((e) => e.id === evento.id));
    checar("Evento de daqui a 3 dias não entra nas 24h", !r.body.eventos24h.some((e) => e.id === longe.id));

    console.log("\n== Lembrete: configuração e validações");
    r = await req("GET", "/lembretes/config");
    checar("Com as variáveis SMTP: configurado", r.body?.configurado === true && r.body.max_emails_por_envio === 10, JSON.stringify(r.body));
    r = await semSmtp.req("GET", "/lembretes/config");
    checar("Sem as variáveis SMTP: não configurado", r.body?.configurado === false);
    r = await semSmtp.req("POST", "/lembretes", { evento_id: evento.id, emails: [email("a")] });
    checarStatus("Enviar sem SMTP configurado → 503", r, 503);
    checarStatus("Sem e-mails → 400", await req("POST", "/lembretes", { evento_id: evento.id, emails: [] }), 400);
    checarStatus("11 e-mails → 400", await req("POST", "/lembretes",
      { evento_id: evento.id, emails: Array.from({ length: 11 }, (_, i) => email(`p${i}`)) }), 400);
    r = await req("POST", "/lembretes", { evento_id: evento.id, emails: [email("ok"), "sem-arroba.com"] });
    checar("E-mail com formato inválido → 400 (e nada é enviado)", r.status === 400 && r.body.erro.includes("sem-arroba.com"), r.body?.erro);
    checarStatus("Alarme inválido → 400", await req("POST", "/lembretes", { evento_id: evento.id, emails: [email("a")], alarmes: [7] }), 400);
    checarStatus("Sem evento nem entrevista → 400", await req("POST", "/lembretes", { emails: [email("a")] }), 400);
    checarStatus("Evento inexistente → 404", await req("POST", "/lembretes", { evento_id: UUID_INEXISTENTE, emails: [email("a")] }), 404);
    checar("Nenhum e-mail gravado até aqui", emailsGravados().length === 0);

    console.log("\n== Lembrete do evento: convite, atualização e cancelamento");
    ids.uids.push(`evento-${evento.id}@super-estagios`, `evento-${longe.id}@super-estagios`, `evento-${diaInteiro.id}@super-estagios`);
    let antes = emailsGravados().length;
    r = await req("POST", "/lembretes", { evento_id: evento.id, emails: [email("Responsavel"), email("responsavel"), ` ${email("gestora")} `] });
    checar("Envia para 2 e-mails (repetido e maiúsculas unificados)", r.status === 201 && r.body.enviados.length === 2
      && r.body.ativos.includes(email("responsavel")), `[${r.status}] ${r.body?.erro ?? r.body?.enviados}`);
    let msgs = novosEmails(antes);
    const uidEvento = `UID:evento-${evento.id}@super-estagios`;
    checar("2 mensagens REQUEST, uma por destinatário", msgs.length === 2 && msgs.every((m) => m.metodo === "REQUEST")
      && msgs.map((m) => m.para).sort().join() === [email("gestora"), email("responsavel")].join());
    checar(".ics: UID do evento, SEQUENCE:0, METHOD:REQUEST", msgs.every((m) => m.ics.includes(uidEvento) && m.ics.includes("SEQUENCE:0\r\n")
      && m.ics.includes("METHOD:REQUEST")));
    checar(".ics: alarmes padrão (1 dia e 1 hora antes) e fuso de São Paulo", msgs.every((m) => m.ics.includes("TRIGGER:-P1D")
      && m.ics.includes("TRIGGER:-PT1H") && m.ics.includes("DTSTART;TZID=America/Sao_Paulo:")));
    checar("MIME com text/calendar; method=REQUEST", msgs.every((m) => /text\/calendar;[^\n]*method=REQUEST/i.test(m.mime)));
    checar("Assunto e corpo em português, com título, data, hora e duração", msgs[0].assunto.startsWith("Lembrete: [TESTE] Reunião com a empresa — ")
      && ["Data:", "Hora:", "Duração: 1 h", "Pauta: contrato", "horário de Brasília"].every((t) => msgs[0].texto.includes(t)), msgs[0].assunto);

    r = await req("GET", `/lembretes?evento_id=${evento.id}`);
    checar("Histórico: 2 envios, 2 ativos, em dia", r.body.envios.length === 2 && r.body.ativos.length === 2 && r.body.desatualizado === false
      && r.body.envios[0].enviado_por?.id === teste.usuario.id);

    await req("PUT", `/eventos/${evento.id}`, { inicio: daqui(4 * HORA).toISOString() });
    r = await req("GET", `/lembretes?evento_id=${evento.id}`);
    checar("Mudou a hora → convite desatualizado", r.body.desatualizado === true);

    antes = emailsGravados().length;
    r = await req("POST", "/lembretes/reenviar", { evento_id: evento.id });
    msgs = novosEmails(antes);
    checar("Reenviar convite atualizado: 2 e-mails, mesmo UID, SEQUENCE:1", r.status === 200 && msgs.length === 2
      && msgs.every((m) => m.ics.includes(uidEvento) && m.ics.includes("SEQUENCE:1\r\n") && m.metodo === "REQUEST"), `[${r.status}] ${r.body?.erro ?? ""}`);
    checar("Reenvio mantém os alarmes e tem assunto \"Atualizado:\"", msgs.every((m) => m.ics.includes("TRIGGER:-P1D") && m.assunto.startsWith("Atualizado:")));
    checar("Depois do reenvio, em dia", r.body.desatualizado === false);
    checarStatus("Reenviar sem convite enviado → 409", await req("POST", "/lembretes/reenviar", { evento_id: longe.id }), 409);

    antes = emailsGravados().length;
    r = await req("DELETE", `/eventos/${evento.id}?cancelar_convite=1`);
    msgs = novosEmails(antes);
    checarStatus("Excluir com cancelamento → 204", r, 204);
    checar("CANCEL para os 2: METHOD:CANCEL, STATUS:CANCELLED, mesmo UID, SEQUENCE:2", msgs.length === 2 && msgs.every((m) => m.metodo === "CANCEL"
      && m.ics.includes("METHOD:CANCEL") && m.ics.includes("STATUS:CANCELLED") && m.ics.includes(uidEvento) && m.ics.includes("SEQUENCE:2\r\n")
      && /text\/calendar;[^\n]*method=CANCEL/i.test(m.mime) && m.assunto.startsWith("Cancelado:")));
    checar("Evento excluído; histórico de envios guardado sem o vínculo",
      !(await prisma.evento.findUnique({ where: { id: evento.id } }))
        && (await prisma.lembreteEmail.count({ where: { uid: `evento-${evento.id}@super-estagios`, evento_id: null } })) === 6);

    console.log("\n== Lembrete da entrevista");
    ids.empresa = (await req("POST", "/empresas", { nome: "[TESTE] Empresa Lembrete", setor: "Teste", nome_contato: "Teste",
      telefone_contato: "000", email_contato: "teste@teste.com" })).body.id;
    ids.vaga = (await req("POST", "/vagas", { codigo_vaga: String(900000 + Math.floor(Math.random() * 99999)), titulo: "[TESTE] Vaga Lembrete",
      descricao: "Teste", valor: 1000, empresa_id: ids.empresa })).body.id;
    const telefone = teste.telefone();
    r = await req("POST", "/candidatos", { nome_completo: "[TESTE] Estudante Lembrete", telefone, email: `aluno@${DOMINIO}`,
      curso: "CursoSigiloso", instituicao_ensino: "Teste", turno_estudo: "NOITE", vaga_id: ids.vaga });
    ids.estudante = r.body.id;
    const aplicacao = r.body.aplicacoes[0].id;
    ids.uids.push(`entrevista-${aplicacao}@super-estagios`);
    await req("PATCH", `/candidatos/${ids.estudante}`, { aplicacao_id: aplicacao, status_kanban: "ENTREVISTA_AGENDADA",
      data_hora_entrevista: daqui(2 * DIA).toISOString(), entrevista_formato: "ONLINE", entrevista_local: "https://meet.google.com/abc", entrevista_duracao: 45 });

    antes = emailsGravados().length;
    r = await req("POST", "/lembretes", { entrevista_id: aplicacao, emails: [email("empresa")], alarmes: [30] });
    msgs = novosEmails(antes);
    const uidEntrevista = `UID:entrevista-${aplicacao}@super-estagios`;
    checar("Convite da entrevista: UID próprio, SEQUENCE:0, alarme de 30 min, local", r.status === 201 && msgs.length === 1
      && msgs[0].ics.includes(uidEntrevista) && msgs[0].ics.includes("SEQUENCE:0\r\n") && msgs[0].ics.includes("TRIGGER:-PT30M")
      && msgs[0].ics.includes("LOCATION:https://meet.google.com/abc"), `[${r.status}] ${r.body?.erro ?? ""}`);
    const tudo = msgs[0].texto + msgs[0].ics;
    checar("E-mail sem telefone, e-mail ou curso do estudante (só o nome)", tudo.includes("[TESTE] Estudante Lembrete")
      && !tudo.includes(telefone) && !tudo.includes(`aluno@${DOMINIO}`) && !tudo.includes("CursoSigiloso"));

    await req("PATCH", `/entrevistas/${aplicacao}`, { acao: "reagendar", data_hora_entrevista: daqui(3 * DIA).toISOString() });
    r = await req("GET", `/lembretes?entrevista_id=${aplicacao}`);
    checar("Entrevista reagendada → convite desatualizado", r.body.desatualizado === true && r.body.cancelavel === false);
    antes = emailsGravados().length;
    r = await req("POST", "/lembretes/reenviar", { entrevista_id: aplicacao });
    msgs = novosEmails(antes);
    checar("Reenviar: mesmo UID, SEQUENCE:1", r.status === 200 && msgs.length === 1 && msgs[0].ics.includes(uidEntrevista)
      && msgs[0].ics.includes("SEQUENCE:1\r\n") && msgs[0].ics.includes("TRIGGER:-PT30M"));

    await req("PATCH", `/entrevistas/${aplicacao}`, { acao: "dispensar", motivo_recusa: "Teste de cancelamento" });
    r = await req("GET", `/lembretes?entrevista_id=${aplicacao}`);
    checar("Entrevista cancelada com convite ativo → cancelável", r.body.cancelado === true && r.body.cancelavel === true && r.body.desatualizado === false);
    checarStatus("Novo lembrete para entrevista cancelada → 409", await req("POST", "/lembretes", { entrevista_id: aplicacao, emails: [email("b")] }), 409);
    checarStatus("Reenviar entrevista cancelada → 409", await req("POST", "/lembretes/reenviar", { entrevista_id: aplicacao }), 409);
    antes = emailsGravados().length;
    r = await req("POST", "/lembretes/cancelar", { entrevista_id: aplicacao });
    msgs = novosEmails(antes);
    checar("Cancelamento: METHOD:CANCEL, SEQUENCE:2", r.status === 200 && msgs.length === 1 && msgs[0].ics.includes("METHOD:CANCEL")
      && msgs[0].ics.includes(uidEntrevista) && msgs[0].ics.includes("SEQUENCE:2\r\n"));
    checar("Depois do cancelamento: ninguém ativo", r.body.ativos.length === 0 && r.body.cancelavel === false);
    checarStatus("Cancelar de novo → 409", await req("POST", "/lembretes/cancelar", { entrevista_id: aplicacao }), 409);

    console.log("\n== Limite de envios por hora");
    const enviados = await prisma.lembreteEmail.count({ where: { enviado_por_id: teste.usuario.id, enviado_em: { gte: new Date(Date.now() - HORA) } } });
    const faltam = LIMITE_POR_HORA - enviados - 1;
    // Simula envios anteriores na última hora (registros [TESTE], sem mandar e-mail).
    await prisma.lembreteEmail.createMany({
      data: Array.from({ length: faltam }, (_, i) => ({ email_destino: email(`limite${i}`), enviado_por_id: teste.usuario.id, uid: UID_LIMITE,
        sequence: 0, inicio_convite: new Date(), fim_convite: new Date() })),
    });
    antes = emailsGravados().length;
    r = await req("POST", "/lembretes", { evento_id: longe.id, emails: [email("c"), email("d")] });
    checar(`Passaria de ${LIMITE_POR_HORA} na hora → 429, nada enviado`, r.status === 429 && novosEmails(antes).length === 0, `[${r.status}] ${r.body?.erro}`);
    r = await req("POST", "/lembretes", { evento_id: longe.id, emails: [email("c")] });
    checarStatus(`Exatamente ${LIMITE_POR_HORA} → 201`, r, 201);
    checarStatus("Depois do limite → 429", await req("POST", "/lembretes", { evento_id: longe.id, emails: [email("d")] }), 429);

    console.log("\n== Nenhum e-mail real");
    checar("Todas as mensagens foram para o domínio de teste", emailsGravados().every((m) => m.para.endsWith(`@${DOMINIO}`)), `${emailsGravados().length} mensagens`);
  } finally {
    await prisma.lembreteEmail.deleteMany({ where: { uid: { in: ids.uids } } }).catch(() => {});
    await prisma.evento.deleteMany({ where: { id: { in: ids.eventos.filter(Boolean) } } }).catch(() => {});
    if (ids.estudante) {
      await prisma.aplicacao.deleteMany({ where: { estudante_id: ids.estudante } }).catch(() => {});
      await prisma.estudante.delete({ where: { id: ids.estudante } }).catch(() => {});
    }
    if (ids.vaga) await prisma.vaga.delete({ where: { id: ids.vaga } }).catch(() => {});
    if (ids.empresa) await prisma.empresa.delete({ where: { id: ids.empresa } }).catch(() => {});
    const sobras = await prisma.evento.count({ where: { titulo: { startsWith: "[TESTE]" } } })
      + await prisma.lembreteEmail.count({ where: { email_destino: { endsWith: `@${DOMINIO}` } } })
      + await prisma.estudante.count({ where: { nome_completo: { startsWith: "[TESTE]" } } })
      + await prisma.vaga.count({ where: { titulo: { startsWith: "[TESTE]" } } })
      + await prisma.empresa.count({ where: { nome: { startsWith: "[TESTE]" } } });
    console.log(`\nRegistros [TESTE] restantes: ${sobras}`);
    if (sobras) teste.falhas++;
    await teste.removerUsuario();
    await semSmtp.removerUsuario();
    await prisma.$disconnect();
    servidor.kill();
    servidorSemSmtp.kill();
    fs.rmSync(ARQUIVO_EMAILS, { force: true });
  }
  const falhas = teste.falhas + semSmtp.falhas;
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
  process.exitCode = falhas ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
