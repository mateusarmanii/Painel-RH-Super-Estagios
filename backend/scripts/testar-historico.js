// Testes do histórico de etapas (HistoricoEtapa): gravado em toda mudança de etapa (cadastro com vaga, "Indicar para
// vaga", Kanban, ações do Calendário e fechar vaga), visível no perfil e usado pelo Dashboard.
// Sobe a API na porta 3401, cria registros "[TESTE]" e remove tudo no final.
// ATENÇÃO: grava e apaga dados no banco do DATABASE_URL (só os registros que o próprio teste cria).
const path = require("path");
const { spawn } = require("child_process");

const BACKEND = path.resolve(__dirname, "..");
process.chdir(BACKEND);
require("dotenv").config();
const prisma = require("../src/prisma");
const { criarTeste } = require("./lib/teste");

const PORT = 3401;
const HORA = 60 * 60 * 1000;
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

const historico = (aplicacaoId) =>
  prisma.historicoEtapa.findMany({ where: { aplicacao_id: aplicacaoId }, orderBy: { created_at: "asc" } });
const passos = (lista) => lista.map((item) => `${item.de_status ?? "∅"}→${item.para_status}`).join(", ");

async function main() {
  const server = spawn(process.execPath, ["server.js"], { env: { ...process.env, PORT }, stdio: "ignore" });
  try {
    await esperarServidor();

    const empresa = await req("POST", "/empresas", { nome: "[TESTE] Empresa Histórico", setor: "Teste", nome_contato: "Teste",
      telefone_contato: "000", email_contato: "teste@teste.com" });
    ids.empresa = empresa.body.id;
    const vaga = await criarVaga("[TESTE] Vaga Histórico");
    const outraVaga = await criarVaga("[TESTE] Vaga Histórico 2");

    console.log("\n== Candidatura nova grava a entrada");
    const a = await estudante("Histórico A", vaga.id);
    const appA = a.body.aplicacoes[0].id;
    let h = await historico(appA);
    checar("Cadastro com vaga: 1 registro ∅→Candidato Contatado", h.length === 1 && h[0].de_status === null
      && h[0].para_status === "CANDIDATO_CONTATADO", passos(h));
    checar("Registro guarda o usuário que fez", h[0]?.usuario_id === (await prisma.usuario.findFirst({
      where: { email: teste.usuario.email }, select: { id: true } }))?.id);

    const semVaga = await estudante("Histórico sem vaga");
    const indicacao = await req("POST", `/candidatos/${semVaga.body.id}/candidaturas`, { vaga_id: vaga.id });
    checarStatus("Indicar para vaga", indicacao, 201);
    h = await historico(indicacao.body.id);
    checar("Indicar para vaga: 1 registro ∅→Candidato Contatado", h.length === 1 && h[0].de_status === null, passos(h));

    console.log("\n== Kanban");
    await mover(a.body.id, appA, "ENVIADO_EMPRESA");
    const quando = new Date(Date.now() + 48 * HORA).toISOString();
    await mover(a.body.id, appA, "ENTREVISTA_AGENDADA", { data_hora_entrevista: quando });
    // Reagendar pelo Kanban (mesma etapa) não é mudança de etapa.
    await mover(a.body.id, appA, "ENTREVISTA_AGENDADA", { data_hora_entrevista: new Date(Date.now() + 72 * HORA).toISOString() });
    h = await historico(appA);
    checar("Duas mudanças registradas, reagendar não conta", passos(h)
      === "∅→CANDIDATO_CONTATADO, CANDIDATO_CONTATADO→ENVIADO_EMPRESA, ENVIADO_EMPRESA→ENTREVISTA_AGENDADA", passos(h));

    const invalido = await mover(a.body.id, appA, "RECUSADO");
    checarStatus("Dispensar sem motivo continua dando 400", invalido, 400);
    h = await historico(appA);
    checar("Mudança recusada (400) não grava histórico", h.length === 3, passos(h));

    console.log("\n== Calendário: Realizada e Dispensar");
    // Entrevista no passado para poder marcar "Realizada".
    await prisma.aplicacao.update({ where: { id: appA }, data: { data_hora_entrevista: new Date(Date.now() - HORA) } });
    let r = await req("PATCH", `/entrevistas/${appA}`, { acao: "realizada" });
    checarStatus("Realizada", r, 200);
    h = await historico(appA);
    checar("Realizada grava Em Entrevista→Em Teste", h.at(-1)?.de_status === "ENTREVISTA_AGENDADA" && h.at(-1)?.para_status === "EM_TESTE",
      passos(h));

    const b = await estudante("Histórico B", vaga.id);
    const appB = b.body.aplicacoes[0].id;
    await mover(b.body.id, appB, "ENTREVISTA_AGENDADA", { data_hora_entrevista: quando });
    r = await req("PATCH", `/entrevistas/${appB}`, { acao: "dispensar", motivo_recusa: "Perfil não aderente" });
    checarStatus("Dispensar pelo Calendário", r, 200);
    h = await historico(appB);
    checar("Dispensar grava Em Entrevista→Dispensado", h.at(-1)?.para_status === "RECUSADO" && h.at(-1)?.de_status === "ENTREVISTA_AGENDADA",
      passos(h));
    r = await req("PATCH", `/entrevistas/${appB}`, { acao: "confirmar" });
    h = await historico(appB);
    checar("Ação recusada (409) não grava histórico", r.status === 409 && h.length === 3, `[${r.status}] ${passos(h)}`);

    console.log("\n== Perfil traz o histórico");
    r = await req("GET", `/candidatos/${a.body.id}`);
    const doPerfil = r.body.aplicacoes?.find((item) => item.id === appA)?.historico ?? [];
    checar("GET /candidatos/:id inclui o histórico em ordem", doPerfil.length === 4
      && doPerfil[0].de_status === null && doPerfil[3].para_status === "EM_TESTE", `${doPerfil.length} registros`);
    checar("Histórico do perfil traz o nome de quem fez", doPerfil[0]?.usuario?.nome === "[TESTE] Usuário");

    console.log("\n== Fechar vaga grava a dispensa de cada um, com a etapa de origem");
    const c = await estudante("Histórico C", outraVaga.id);
    const d = await estudante("Histórico D", outraVaga.id);
    const appC = c.body.aplicacoes[0].id;
    const appD = d.body.aplicacoes[0].id;
    await mover(c.body.id, appC, "EM_TESTE");
    await mover(d.body.id, appD, "APROVADO");
    r = await req("PATCH", `/vagas/${outraVaga.id}`, { status: "FECHADA" });
    checarStatus("Fechar vaga", r, 200);
    h = await historico(appC);
    checar("Em Teste→Dispensado registrado ao fechar", h.at(-1)?.de_status === "EM_TESTE" && h.at(-1)?.para_status === "RECUSADO", passos(h));
    h = await historico(appD);
    checar("Contratado não é dispensado nem ganha registro ao fechar", h.at(-1)?.para_status === "APROVADO", passos(h));

    console.log("\n== Dashboard usa o histórico");
    r = await req("GET", `/dashboard-metrics?periodo=7d&empresa=${ids.empresa}`);
    checarStatus("Dashboard filtrado pela empresa de teste", r, 200);
    const conv = Object.fromEntries(r.body.conversao.map((etapa) => [etapa.status, etapa.total]));
    // A: até Em Teste; B: até Entrevista (dispensado); C: até Em Teste (dispensado); D: Contratado; indicação: Contatado.
    checar("Conversão exata com o histórico (5 → 4 → 4 → 3 → 1)",
      conv.CANDIDATO_CONTATADO === 5 && conv.ENVIADO_EMPRESA === 4 && conv.ENTREVISTA_AGENDADA === 4 && conv.EM_TESTE === 3
      && conv.APROVADO === 1, JSON.stringify(conv));
    // D passou por Enviado e Entrevista? Não: foi direto de Contatado para Contratado, mas "chegou" às etapas anteriores.
    checar("Todas as 5 candidaturas têm histórico completo", r.body.conversaoExata === 5, `${r.body.conversaoExata}`);
    checar("Dispensas no período contam as 2 (Calendário e fechar vaga)", r.body.periodo.dispensas.atual === 2,
      `${r.body.periodo.dispensas.atual}`);
    const tempos = Object.fromEntries(r.body.tempoPorEtapa.map((etapa) => [etapa.status, etapa.amostras]));
    checar("Tempo por etapa mede as saídas registradas", tempos.CANDIDATO_CONTATADO === 4 && tempos.ENTREVISTA_AGENDADA === 2
      && tempos.EM_TESTE === 1, JSON.stringify(tempos));
    const emTeste = r.body.funnel.find((etapa) => etapa.status === "EM_TESTE");
    checar("Lista da etapa usa a data de entrada (histórico)", emTeste.itens.some((item) => item.id === appA)
      && Math.abs(new Date(emTeste.itens.find((item) => item.id === appA).desde) - (await historico(appA)).at(-1).created_at) < 1000);

    console.log("\n== Excluir a candidatura apaga o histórico junto");
    await prisma.aplicacao.delete({ where: { id: appB } });
    checar("Histórico de B removido (cascade)", (await historico(appB)).length === 0);
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
