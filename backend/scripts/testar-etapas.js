// Testes das etapas do Kanban (Parte 3): Candidato Contatado e Em Teste, fim do "Em análise" (AGUARDANDO_RETORNO),
// etapa inicial das candidaturas novas, validações do PATCH, funil do Dashboard e desfecho da entrevista.
// Sobe a API na porta 3387, cria registros "[TESTE]" e remove tudo no final.
// ATENÇÃO: grava e apaga dados no banco do DATABASE_URL (só os registros que o próprio teste cria).
const path = require("path");
const { spawn } = require("child_process");

const BACKEND = path.resolve(__dirname, "..");
process.chdir(BACKEND);
require("dotenv").config();
const prisma = require("../src/prisma");
const { criarTeste } = require("./lib/teste");

const PORT = 3387;
const DIA = 24 * 60 * 60 * 1000;
const ORDEM = ["CANDIDATO_CONTATADO", "ENVIADO_EMPRESA", "ENTREVISTA_AGENDADA", "EM_TESTE", "APROVADO"];
const ids = { empresa: null, vagas: [], estudantes: [] };
const teste = criarTeste(PORT);
const { req, checar, checarStatus, esperarServidor } = teste;

async function criarVaga(titulo) {
  const r = await req("POST", "/vagas", { codigo_vaga: String(900000 + Math.floor(Math.random() * 99999)), titulo,
    descricao: "Teste", valor: 1000, empresa_id: ids.empresa });
  ids.vagas.push(r.body.id);
  return r.body;
}

async function estudante(nome, vagaId) {
  const r = await req("POST", "/candidatos", { nome_completo: `[TESTE] ${nome}`, telefone: teste.telefone(), curso: "Teste",
    ...(vagaId && { vaga_id: vagaId }) });
  if (r.body?.id) ids.estudantes.push(r.body.id);
  return r;
}

const mover = (id, aplicacao, status_kanban, extra = {}) =>
  req("PATCH", `/candidatos/${id}`, { aplicacao_id: aplicacao, status_kanban, ...extra });

const funil = async () => {
  const r = await req("GET", "/dashboard-metrics");
  return r.body.funnel;
};

async function main() {
  const server = spawn(process.execPath, ["server.js"], { env: { ...process.env, PORT }, stdio: "ignore" });
  try {
    await esperarServidor();

    console.log("\n== Migration: nenhuma candidatura ficou em \"Em análise\"");
    const antigas = await prisma.aplicacao.count({ where: { status_kanban: "AGUARDANDO_RETORNO" } });
    checar("0 candidaturas em AGUARDANDO_RETORNO no banco", antigas === 0, `${antigas}`);

    const empresa = await req("POST", "/empresas", { nome: "[TESTE] Empresa Etapas", setor: "Teste", nome_contato: "Teste",
      telefone_contato: "000", email_contato: "teste@teste.com" });
    ids.empresa = empresa.body.id;
    const vaga = await criarVaga("[TESTE] Vaga Etapas");
    const outraVaga = await criarVaga("[TESTE] Vaga Etapas 2");
    const funilAntes = await funil();

    console.log("\n== Candidaturas novas começam em Candidato Contatado");
    let r = await estudante("Etapas A", vaga.id);
    checar("Cadastro com vaga → candidatura em CANDIDATO_CONTATADO",
      r.status === 201 && r.body.aplicacoes[0]?.status_kanban === "CANDIDATO_CONTATADO", `[${r.status}] ${r.body?.aplicacoes?.[0]?.status_kanban}`);
    const a = { id: r.body.id, aplicacao: r.body.aplicacoes[0].id };
    r = await req("POST", `/candidatos/${a.id}/candidaturas`, { vaga_id: outraVaga.id });
    checar("Indicar para vaga → CANDIDATO_CONTATADO", r.status === 201 && r.body.status_kanban === "CANDIDATO_CONTATADO",
      `[${r.status}] ${r.body?.status_kanban}`);
    r = await req("GET", `/vagas/${vaga.id}/candidatos`);
    checar("Kanban da vaga mostra a candidatura em Candidato Contatado",
      r.body.some((item) => item.id === a.aplicacao && item.status_kanban === "CANDIDATO_CONTATADO"));

    console.log("\n== PATCH: etapas novas não pedem nada; Em análise não é mais aceita");
    r = await mover(a.id, a.aplicacao, "ENVIADO_EMPRESA");
    checarStatus("Candidato Contatado → Enviado à Empresa", r, 200);
    r = await mover(a.id, a.aplicacao, "EM_TESTE");
    checar("→ Em Teste sem data nem motivo → 200", r.status === 200 && r.body.status_kanban === "EM_TESTE", `[${r.status}] ${r.body?.erro ?? ""}`);
    r = await mover(a.id, a.aplicacao, "CANDIDATO_CONTATADO");
    checar("→ Candidato Contatado (voltar) → 200", r.status === 200 && r.body.status_kanban === "CANDIDATO_CONTATADO", `[${r.status}]`);
    r = await mover(a.id, a.aplicacao, "AGUARDANDO_RETORNO");
    checarStatus("→ AGUARDANDO_RETORNO (Em análise) → 400", r, 400);
    checar("…e a candidatura não muda", (await prisma.aplicacao.findUnique({ where: { id: a.aplicacao } })).status_kanban === "CANDIDATO_CONTATADO");
    r = await mover(a.id, a.aplicacao, "ENTREVISTA_AGENDADA");
    checarStatus("Em Entrevista continua exigindo data", r, 400);
    r = await mover(a.id, a.aplicacao, "RECUSADO");
    checarStatus("Dispensado continua exigindo motivo", r, 400);

    console.log("\n== Desfecho da entrevista com Em Teste");
    r = await mover(a.id, a.aplicacao, "ENTREVISTA_AGENDADA", { data_hora_entrevista: new Date(Date.now() + 2 * DIA).toISOString() });
    checarStatus("Agendar entrevista", r, 200);
    r = await mover(a.id, a.aplicacao, "EM_TESTE");
    checar("Em Entrevista → Em Teste: entrevista Realizada", r.body?.entrevista_status === "REALIZADA", `${r.body?.entrevista_status}`);
    r = await mover(a.id, a.aplicacao, "ENTREVISTA_AGENDADA", { data_hora_entrevista: new Date(Date.now() + 3 * DIA).toISOString() });
    r = await mover(a.id, a.aplicacao, "CANDIDATO_CONTATADO");
    checar("Em Entrevista → Candidato Contatado: entrevista Cancelada", r.body?.entrevista_status === "CANCELADA", `${r.body?.entrevista_status}`);
    r = await mover(a.id, a.aplicacao, "ENTREVISTA_AGENDADA", { data_hora_entrevista: new Date(Date.now() - DIA).toISOString() });
    r = await req("PATCH", `/entrevistas/${a.aplicacao}`, { acao: "realizada" });
    checar("Calendário: \"Realizada\" leva o candidato para Em Teste", r.status === 200 && r.body.status_kanban === "EM_TESTE",
      `[${r.status}] ${r.body?.status_kanban}`);

    console.log("\n== Resumo da vaga e funil do Dashboard");
    const b = await estudante("Etapas B", vaga.id);
    r = await req("GET", "/vagas");
    const resumo = r.body.find((item) => item.id === vaga.id)?.resumo;
    checar("Resumo da vaga: 1 contatado e 1 em teste, os dois em processo",
      resumo?.por_etapa.CANDIDATO_CONTATADO === 1 && resumo?.por_etapa.EM_TESTE === 1 && resumo?.em_processo === 2
        && !("AGUARDANDO_RETORNO" in resumo.por_etapa), JSON.stringify(resumo));
    const funilDepois = await funil();
    checar("Funil com as 5 etapas, na ordem do Kanban", JSON.stringify(funilDepois.map((etapa) => etapa.status)) === JSON.stringify(ORDEM),
      funilDepois.map((etapa) => etapa.status).join(", "));
    const total = (lista, status) => lista.find((etapa) => etapa.status === status)?.total ?? 0;
    checar("Funil conta as novas candidaturas: +2 contatados (1 da outra vaga), +1 em teste",
      total(funilDepois, "CANDIDATO_CONTATADO") === total(funilAntes, "CANDIDATO_CONTATADO") + 2
        && total(funilDepois, "EM_TESTE") === total(funilAntes, "EM_TESTE") + 1,
      `contatados ${total(funilAntes, "CANDIDATO_CONTATADO")}→${total(funilDepois, "CANDIDATO_CONTATADO")}, `
        + `teste ${total(funilAntes, "EM_TESTE")}→${total(funilDepois, "EM_TESTE")}`);

    console.log("\n== Contratar e encerrar a vaga");
    r = await mover(b.body.id, b.body.aplicacoes[0].id, "APROVADO");
    checarStatus("Candidato Contatado → Contratado direto", r, 200);
    r = await req("PATCH", `/vagas/${vaga.id}`, { status: "FECHADA", motivo: "Vaga preenchida" });
    checar("Encerrar vaga dispensa quem está Em Teste", r.body?.dispensados === 1
      && (await prisma.aplicacao.findUnique({ where: { id: a.aplicacao } })).status_kanban === "RECUSADO", `${r.body?.dispensados}`);
  } finally {
    await prisma.aplicacao.deleteMany({ where: { estudante_id: { in: ids.estudantes } } }).catch(() => {});
    await prisma.estudante.deleteMany({ where: { id: { in: ids.estudantes } } }).catch(() => {});
    await prisma.vaga.deleteMany({ where: { id: { in: ids.vagas } } }).catch(() => {});
    if (ids.empresa) await prisma.empresa.delete({ where: { id: ids.empresa } }).catch(() => {});
    const sobras = await prisma.estudante.count({ where: { nome_completo: { startsWith: "[TESTE]" } } })
      + await prisma.vaga.count({ where: { titulo: { startsWith: "[TESTE]" } } })
      + await prisma.empresa.count({ where: { nome: { startsWith: "[TESTE]" } } });
    console.log(`\nRegistros [TESTE] restantes: ${sobras}`);
    if (sobras) teste.falhas++;
    await teste.removerUsuario();
    await prisma.$disconnect();
    server.kill();
  }
  console.log(teste.falhas ? `\n${teste.falhas} FALHA(S)` : "\nTodos os testes passaram.");
  process.exitCode = teste.falhas ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
