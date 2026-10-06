// Testes da Agenda (Frente B): agendamento com formato/local (opcional)/duração/entrevistador, status da entrevista,
// conflito de horário, período (?inicio&fim), resumo do topo e ações do painel.
// Sobe a API na porta 3394, cria registros "[TESTE]" e remove tudo no final.
// ATENÇÃO: grava e apaga dados no banco do DATABASE_URL (só os registros que o próprio teste cria).
const path = require("path");
const { spawn } = require("child_process");

const BACKEND = path.resolve(__dirname, "..");
process.chdir(BACKEND);
require("dotenv").config();
const prisma = require("../src/prisma");

const PORT = 3394;
const BASE = `http://localhost:${PORT}`;
const UUID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const ids = { empresa: null, vagas: [], estudantes: [] };
let falhas = 0;

async function req(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

function checar(nome, condicao, detalhe = "") {
  if (!condicao) falhas++;
  console.log(`${condicao ? "PASS" : "FAIL"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
}

async function esperarServidor() {
  for (let i = 0; i < 50; i++) {
    try { await fetch(BASE + "/"); return; } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  throw new Error("API não subiu");
}

const codigo = () => String(900000 + Math.floor(Math.random() * 99999));
// Horários "redondos" a partir de agora, para não depender do minuto em que o teste roda.
const daqui = (ms) => new Date(Math.ceil((Date.now() + ms) / (5 * 60 * 1000)) * 5 * 60 * 1000);

async function criarVaga(titulo) {
  const r = await req("POST", "/vagas", { codigo_vaga: codigo(), titulo, descricao: "Teste", valor: 1000, empresa_id: ids.empresa });
  ids.vagas.push(r.body.id);
  return r.body;
}

// Estudante [TESTE] inscrito na vaga; devolve { id, aplicacao }.
async function estudante(nome, vagaId) {
  const r = await req("POST", "/candidatos", { nome_completo: `[TESTE] ${nome}`, telefone: "31988887777", curso: "Teste",
    instituicao_ensino: "Teste", turno_estudo: "NOITE", vaga_id: vagaId });
  ids.estudantes.push(r.body.id);
  return { id: r.body.id, aplicacao: r.body.aplicacoes[0].id };
}

const agendar = (e, aplicacao, quando, extra = {}) => req("PATCH", `/candidatos/${e}`, {
  aplicacao_id: aplicacao, status_kanban: "ENTREVISTA_AGENDADA", data_hora_entrevista: quando.toISOString(), ...extra });
const acao = (aplicacao, corpo) => req("PATCH", `/entrevistas/${aplicacao}`, corpo);
const semana = () => `inicioSemana=${new Date(Date.now() - DIA).toISOString()}&fimSemana=${new Date(Date.now() + 2 * DIA).toISOString()}`;

async function main() {
  const server = spawn(process.execPath, ["server.js"], { env: { ...process.env, PORT }, stdio: "ignore" });
  try {
    await esperarServidor();

    console.log("\n== Preparação (registros [TESTE])");
    const empresa = await req("POST", "/empresas", { nome: "[TESTE] Empresa Agenda", setor: "Teste", nome_contato: "Teste",
      telefone_contato: "000", email_contato: "teste@teste.com" });
    ids.empresa = empresa.body.id;
    const vagaA = await criarVaga("[TESTE] Vaga Agenda A");
    const vagaB = await criarVaga("[TESTE] Vaga Agenda B");
    const x = await estudante("Agenda X", vagaA.id);
    const xB = (await req("POST", `/candidatos/${x.id}/candidaturas`, { vaga_id: vagaB.id })).body.id;
    const y = await estudante("Agenda Y", vagaA.id);
    const z = await estudante("Agenda Z", vagaA.id);
    const w = await estudante("Agenda W", vagaA.id);
    const k = await estudante("Agenda K", vagaA.id);
    const v = await estudante("Agenda V", vagaB.id);
    const resumoAntes = (await req("GET", `/entrevistas/resumo?${semana()}`)).body;
    console.log("ok: 1 empresa, 2 vagas, 6 estudantes (X inscrito nas duas vagas)");

    console.log("\n== Agendar pelo Kanban com os detalhes");
    const horaA = daqui(3 * HORA);
    let r = await agendar(x.id, x.aplicacao, horaA, { entrevista_formato: "ONLINE", entrevista_local: "https://meet.google.com/abc-defg-hij",
      entrevista_duracao: 60, entrevistador: "Renata" });
    checar("Agenda com formato, link, duração e entrevistador",
      r.status === 200 && r.body.entrevista_formato === "ONLINE" && r.body.entrevista_local === "https://meet.google.com/abc-defg-hij"
        && r.body.entrevista_duracao === 60 && r.body.entrevistador === "Renata", `[${r.status}] ${r.body?.erro ?? ""}`);
    checar("Começa como Aguardando, sem conflito", r.body.entrevista_status === "AGUARDANDO" && r.body.conflitos.length === 0);
    r = await agendar(y.id, y.aplicacao, daqui(5 * HORA), { entrevista_formato: "VIDEO" });
    checar("Formato inválido → 400", r.status === 400, `[${r.status}] ${r.body?.erro}`);
    r = await agendar(y.id, y.aplicacao, daqui(5 * HORA), { entrevista_duracao: 10 });
    checar("Duração de 10 min → 400", r.status === 400, `[${r.status}] ${r.body?.erro}`);
    r = await agendar(x.id, xB, new Date(horaA.getTime() + 30 * 60 * 1000), { entrevista_formato: "PRESENCIAL", entrevista_local: "Av. Afonso Pena, 1000" });
    checar("Duração padrão de 45 min", r.body?.entrevista_duracao === 45, `${r.body?.entrevista_duracao}`);
    checar("Aviso de conflito: mesmo estudante, horários que se sobrepõem", r.status === 200 && r.body.conflitos.length === 1
      && r.body.conflitos[0].id === x.aplicacao, JSON.stringify(r.body?.conflitos));

    console.log("\n== Lista por período");
    const inicioDia = new Date(horaA.getTime() - 2 * HORA).toISOString();
    const fimDia = new Date(horaA.getTime() + 4 * HORA).toISOString();
    r = await req("GET", `/entrevistas?inicio=${inicioDia}&fim=${fimDia}`);
    const doX = r.body.filter((e) => e.estudante.id === x.id);
    checar("Período traz as duas entrevistas do X, marcadas como conflito",
      doX.length === 2 && doX.every((e) => e.conflito_com.length === 1), JSON.stringify(doX.map((e) => e.conflito_com)));
    checar("Cada entrevista traz status, formato, local, empresa (com logo_url) e telefone",
      doX.every((e) => e.status_exibido === "AGUARDANDO" && e.entrevista_formato && e.entrevista_local
        && "logo_url" in e.vaga.empresa && e.estudante.telefone));
    r = await req("GET", "/entrevistas?inicio=abc&fim=def");
    checar("Período inválido → 400", r.status === 400, `[${r.status}]`);
    r = await req("GET", `/entrevistas?inicio=${new Date().toISOString()}&fim=${new Date(Date.now() + 90 * DIA).toISOString()}`);
    checar("Período maior que 62 dias → 400", r.status === 400, `[${r.status}]`);
    r = await req("GET", "/entrevistas");
    checar("Sem período continua trazendo as futuras (Dashboard)", r.body.some((e) => e.id === x.aplicacao) && r.body.some((e) => e.id === xB));

    console.log("\n== Resumo do topo");
    r = await req("GET", `/entrevistas/resumo?${semana()}`);
    checar("Próximas 24h sem confirmação incluem as duas do X",
      [x.aplicacao, xB].every((id) => r.body.semConfirmacao24h.some((e) => e.id === id)));
    checar("Total da semana subiu 2", r.body.semana === resumoAntes.semana + 2, `${resumoAntes.semana} → ${r.body.semana}`);
    r = await req("GET", "/entrevistas/resumo");
    checar("Resumo sem a semana → 400", r.status === 400, `[${r.status}]`);

    console.log("\n== Ações do painel");
    r = await acao(x.aplicacao, { acao: "confirmar" });
    checar("Confirmar → Confirmada", r.status === 200 && r.body.entrevista_status === "CONFIRMADA" && r.body.status_exibido === "CONFIRMADA");
    r = await req("GET", `/entrevistas/resumo?${semana()}`);
    checar("Confirmada sai do alerta de 24h", !r.body.semConfirmacao24h.some((e) => e.id === x.aplicacao));
    r = await acao(x.aplicacao, { acao: "realizada" });
    checar("Realizada antes do horário → 409", r.status === 409, `[${r.status}] ${r.body?.erro}`);
    r = await acao(x.aplicacao, { acao: "nao_compareceu" });
    checar("Não compareceu antes do horário → 409", r.status === 409, `[${r.status}] ${r.body?.erro}`);
    r = await acao(xB, { acao: "reagendar", data_hora_entrevista: new Date(Date.now() - HORA).toISOString() });
    checar("Reagendar para o passado → 400", r.status === 400, `[${r.status}] ${r.body?.erro}`);
    r = await acao(xB, { acao: "reagendar", data_hora_entrevista: daqui(DIA + 3 * HORA).toISOString(), entrevistador: "Carlos" });
    checar("Reagendar: nova data, volta a Aguardando, sem conflito e mantém formato/local",
      r.status === 200 && r.body.entrevista_status === "AGUARDANDO" && r.body.conflitos.length === 0
        && r.body.entrevista_formato === "PRESENCIAL" && r.body.entrevistador === "Carlos", `[${r.status}] ${r.body?.erro ?? ""}`);
    r = await acao(xB, { acao: "remarcar" });
    checar("Ação inválida → 400", r.status === 400, `[${r.status}]`);
    r = await acao(UUID_INEXISTENTE, { acao: "confirmar" });
    checar("Entrevista inexistente → 404", r.status === 404, `[${r.status}]`);
    r = await acao(w.aplicacao, { acao: "confirmar" });
    checar("Candidatura sem entrevista → 404", r.status === 404, `[${r.status}]`);

    await agendar(y.id, y.aplicacao, new Date(Date.now() - 2 * DIA));
    r = await acao(y.aplicacao, { acao: "realizada" });
    checar("Realizada → candidato vai para Em análise", r.status === 200 && r.body.entrevista_status === "REALIZADA"
      && r.body.status_kanban === "AGUARDANDO_RETORNO", `[${r.status}] ${r.body?.status_kanban}`);
    r = await acao(y.aplicacao, { acao: "confirmar" });
    checar("Depois de encerrada, novas ações → 409", r.status === 409, `[${r.status}]`);

    await agendar(z.id, z.aplicacao, new Date(Date.now() - DIA));
    r = await acao(z.aplicacao, { acao: "nao_compareceu" });
    checar("Não compareceu → continua na etapa Entrevista", r.status === 200 && r.body.entrevista_status === "NAO_COMPARECEU"
      && r.body.status_kanban === "ENTREVISTA_AGENDADA");
    r = await acao(z.aplicacao, { acao: "confirmar" });
    checar("Confirmar quem não compareceu → 409 (reagendar antes)", r.status === 409, `[${r.status}]`);
    r = await acao(z.aplicacao, { acao: "dispensar" });
    checar("Dispensar sem motivo → 400", r.status === 400, `[${r.status}]`);
    r = await acao(z.aplicacao, { acao: "dispensar", motivo_recusa: "Não compareceu à entrevista" });
    checar("Dispensar quem faltou: Dispensado e mantém Não compareceu", r.status === 200 && r.body.status_kanban === "RECUSADO"
      && r.body.entrevista_status === "NAO_COMPARECEU" && r.body.motivo_recusa === "Não compareceu à entrevista");
    r = await acao(x.aplicacao, { acao: "dispensar", motivo_recusa: "Aceitou outra proposta" });
    checar("Dispensar com entrevista confirmada → Cancelada", r.status === 200 && r.body.entrevista_status === "CANCELADA");

    r = await req("GET", `/entrevistas/resumo?${semana()}`);
    checar("Comparecimento: +1 realizada e +1 falta", r.body.comparecimento.realizadas === resumoAntes.comparecimento.realizadas + 1
      && r.body.comparecimento.faltas === resumoAntes.comparecimento.faltas + 1, JSON.stringify(r.body.comparecimento));

    console.log("\n== Local ou link opcional");
    const semLocalP = await estudante("Agenda Sem Local P", vagaA.id);
    const semLocalO = await estudante("Agenda Sem Local O", vagaA.id);
    r = await agendar(semLocalP.id, semLocalP.aplicacao, daqui(4 * DIA), { entrevista_formato: "PRESENCIAL", entrevista_local: null });
    checar("Presencial sem endereço → 200, local vazio", r.status === 200 && r.body.entrevista_local === null
      && r.body.entrevista_formato === "PRESENCIAL", `[${r.status}] ${r.body?.erro ?? r.body?.entrevista_local}`);
    r = await agendar(semLocalO.id, semLocalO.aplicacao, daqui(4 * DIA + 2 * HORA), { entrevista_formato: "ONLINE", entrevista_local: "" });
    checar("Online sem link → 200, local vazio", r.status === 200 && r.body.entrevista_local === null
      && r.body.entrevista_formato === "ONLINE", `[${r.status}] ${r.body?.erro ?? r.body?.entrevista_local}`);
    r = await req("GET", "/entrevistas");
    checar("Entrevistas sem local aparecem na Agenda",
      [semLocalP.aplicacao, semLocalO.aplicacao].every((id) => r.body.some((e) => e.id === id && e.entrevista_local === null)));
    r = await acao(semLocalP.aplicacao, { acao: "reagendar", data_hora_entrevista: daqui(5 * DIA).toISOString(),
      entrevista_formato: "PRESENCIAL", entrevista_local: null });
    checar("Reagendar sem local → 200", r.status === 200 && r.body.entrevista_local === null, `[${r.status}] ${r.body?.erro ?? ""}`);
    r = await acao(semLocalO.aplicacao, { acao: "reagendar", data_hora_entrevista: daqui(5 * DIA + 2 * HORA).toISOString(),
      entrevista_local: "https://meet.google.com/xyz" });
    checar("Reagendar preenchendo o link depois → 200", r.status === 200 && r.body.entrevista_local === "https://meet.google.com/xyz",
      `[${r.status}] ${r.body?.erro ?? ""}`);

    console.log("\n== Mover pelo Kanban dá desfecho à entrevista");
    await agendar(w.id, w.aplicacao, daqui(2 * DIA));
    r = await req("PATCH", `/candidatos/${w.id}`, { aplicacao_id: w.aplicacao, status_kanban: "AGUARDANDO_RETORNO" });
    checar("Entrevista → Em análise: Realizada", r.body?.entrevista_status === "REALIZADA", `${r.body?.entrevista_status}`);
    await agendar(k.id, k.aplicacao, daqui(2 * DIA));
    r = await req("PATCH", `/candidatos/${k.id}`, { aplicacao_id: k.aplicacao, status_kanban: "ENVIADO_EMPRESA" });
    checar("Entrevista → Enviado à empresa: Cancelada", r.body?.entrevista_status === "CANCELADA", `${r.body?.entrevista_status}`);
    r = await agendar(k.id, k.aplicacao, daqui(3 * DIA));
    checar("Agendar de novo volta a Aguardando", r.body?.entrevista_status === "AGUARDANDO");

    console.log("\n== Fechar a vaga cancela as entrevistas em aberto");
    await agendar(v.id, v.aplicacao, daqui(2 * DIA));
    await req("PATCH", `/vagas/${vagaB.id}`, { status: "FECHADA" });
    const depois = await prisma.aplicacao.findUnique({ where: { id: v.aplicacao } });
    checar("Entrevista da vaga fechada fica Cancelada", depois.entrevista_status === "CANCELADA" && depois.status_kanban === "RECUSADO",
      `${depois.entrevista_status} / ${depois.status_kanban}`);

    console.log("\n== Dashboard e Agenda contam as mesmas entrevistas");
    const metricas = await req("GET", "/dashboard-metrics");
    const futuras = await req("GET", "/entrevistas");
    checar("Card de entrevistas = entrevistas futuras em aberto", metricas.body.metrics.scheduledInterviews === futuras.body.length,
      `${metricas.body.metrics.scheduledInterviews} x ${futuras.body.length}`);
  } finally {
    await prisma.aplicacao.deleteMany({ where: { estudante_id: { in: ids.estudantes } } }).catch(() => {});
    await prisma.estudante.deleteMany({ where: { id: { in: ids.estudantes } } }).catch(() => {});
    await prisma.vaga.deleteMany({ where: { id: { in: ids.vagas } } }).catch(() => {});
    if (ids.empresa) await prisma.empresa.delete({ where: { id: ids.empresa } }).catch(() => {});
    const sobras = await prisma.estudante.count({ where: { nome_completo: { startsWith: "[TESTE]" } } })
      + await prisma.vaga.count({ where: { titulo: { startsWith: "[TESTE]" } } })
      + await prisma.empresa.count({ where: { nome: { startsWith: "[TESTE]" } } });
    console.log(`\nRegistros [TESTE] restantes: ${sobras}`);
    if (sobras) falhas++;
    await prisma.$disconnect();
    server.kill();
  }
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
  process.exitCode = falhas ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
