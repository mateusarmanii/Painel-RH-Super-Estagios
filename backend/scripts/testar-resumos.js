// Testes dos números dos cards de Vagas e Empresas (candidatos por etapa, dias em aberto, alerta,
// vagas abertas, em processo e contratados) e dos espaços extras tirados ao salvar. Sobe a API na porta 3398, cria registros "[TESTE]" e remove tudo no final.
// ATENÇÃO: grava e apaga dados no banco do DATABASE_URL (só os registros que o próprio teste cria).
const path = require("path");
const { spawn } = require("child_process");

const BACKEND = path.resolve(__dirname, "..");
process.chdir(BACKEND);
require("dotenv").config();
const prisma = require("../src/prisma");

const PORT = 3398;
const BASE = `http://localhost:${PORT}`;
const ids = { empresa: null, vagas: [], estudantes: [] };
let falhas = 0;

async function req(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
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

async function criarVaga(titulo) {
  const codigo = String(900000 + Math.floor(Math.random() * 99999));
  const r = await req("POST", "/vagas", { codigo_vaga: codigo, titulo, descricao: "Teste", valor: 1000, empresa_id: ids.empresa });
  if (r.status !== 201) throw new Error(`Falha ao criar vaga: ${r.body?.erro}`);
  ids.vagas.push(r.body.id);
  return r.body;
}

// Cria um estudante já candidato à vaga e move a candidatura para a etapa pedida.
async function candidato(vagaId, n, etapa, extra = {}) {
  const r = await req("POST", "/candidatos", { nome_completo: `[TESTE] Estudante ${n}`, telefone: "000",
    curso: "Teste", instituicao_ensino: "Teste", horario_estudo: "NOITE", vaga_id: vagaId });
  if (r.status !== 201) throw new Error(`Falha ao criar estudante: ${r.body?.erro}`);
  ids.estudantes.push(r.body.id);
  if (etapa !== "ENVIADO_EMPRESA") {
    const p = await req("PATCH", `/candidatos/${r.body.id}`, { aplicacao_id: r.body.aplicacoes[0].id, status_kanban: etapa, ...extra });
    if (p.status !== 200) throw new Error(`Falha ao mover para ${etapa}: ${p.body?.erro}`);
  }
}

async function main() {
  const server = spawn(process.execPath, ["server.js"], { env: { ...process.env, PORT }, stdio: "ignore" });
  try {
    await esperarServidor();

    console.log("\n== Preparação (registros [TESTE])");
    const empresa = await req("POST", "/empresas", { nome: "[TESTE] Empresa Resumos", setor: "Teste", nome_contato: "Teste",
      telefone_contato: "000", email_contato: "teste@teste.com" });
    ids.empresa = empresa.body.id;
    const vagaA = await criarVaga("[TESTE] Vaga com candidatos");
    const vagaB = await criarVaga("[TESTE] Vaga fechada");
    const vagaVazia = await criarVaga("[TESTE] Vaga sem candidatos");
    const vagaNova = await criarVaga("[TESTE] Vaga nova");

    const entrevista = new Date(Date.now() + 2 * 86400000).toISOString();
    await candidato(vagaA.id, 1, "ENVIADO_EMPRESA");
    await candidato(vagaA.id, 2, "ENVIADO_EMPRESA");
    await candidato(vagaA.id, 3, "ENTREVISTA_AGENDADA", { data_hora_entrevista: entrevista });
    await candidato(vagaA.id, 4, "ENTREVISTA_AGENDADA", { data_hora_entrevista: entrevista });
    await candidato(vagaA.id, 5, "RECUSADO", { motivo_recusa: "Teste" });
    await candidato(vagaB.id, 6, "APROVADO");
    await candidato(vagaB.id, 7, "AGUARDANDO_RETORNO");
    // Fechar a vaga dispensa quem ainda estava em processo (o estudante 7 vai para Dispensado).
    await req("PATCH", `/vagas/${vagaB.id}`, { status: "FECHADA" });
    // Só estas vagas [TESTE] ficam "antigas" (15 dias), para testar o alerta.
    await prisma.vaga.updateMany({
      where: { id: { in: [vagaA.id, vagaB.id, vagaVazia.id] } },
      data: { created_at: new Date(Date.now() - 15 * 86400000) },
    });
    console.log("ok: 1 empresa, 4 vagas (1 fechada, 3 com 15 dias), 7 candidaturas");

    console.log("\n== GET /vagas traz o resumo por etapa");
    let r = await req("GET", "/vagas");
    const a = r.body.find((v) => v.id === vagaA.id);
    checar("Vaga não devolve a lista bruta de candidaturas", a && !("aplicacoes" in a));
    checar("Total de candidatos da vaga", a?.resumo.total === 5, `${a?.resumo.total}`);
    checar("Candidatos por etapa",
      JSON.stringify(a?.resumo.por_etapa) === JSON.stringify({ ENVIADO_EMPRESA: 2, ENTREVISTA_AGENDADA: 2, AGUARDANDO_RETORNO: 0, APROVADO: 0, RECUSADO: 1 }),
      JSON.stringify(a?.resumo.por_etapa));
    checar("Em processo (enviado + entrevista + em análise)", a?.resumo.em_processo === 4, `${a?.resumo.em_processo}`);
    checar("Dias em aberto", a?.resumo.dias_aberta === 15, `${a?.resumo.dias_aberta}`);
    const vazia = r.body.find((v) => v.id === vagaVazia.id);
    const fechada = r.body.find((v) => v.id === vagaB.id);
    const nova = r.body.find((v) => v.id === vagaNova.id);
    checar("Vaga sem candidatos: total 0", vazia?.resumo.total === 0, JSON.stringify(vazia?.resumo));
    checar("Alerta: aberta há 15 dias sem ninguém em Entrevista", vazia?.resumo.em_alerta === true);
    checar("Sem alerta: aberta há 15 dias, mas com entrevista", a?.resumo.em_alerta === false);
    checar("Sem alerta: vaga fechada", fechada?.resumo.em_alerta === false);
    checar("Sem alerta: vaga nova (0 dias)", nova?.resumo.em_alerta === false && nova?.resumo.dias_aberta === 0);
    checar("Vaga continua trazendo a empresa", a?.empresa?.nome === "[TESTE] Empresa Resumos");

    console.log("\n== GET /empresas traz os três números");
    r = await req("GET", "/empresas");
    const e = r.body.find((item) => item.id === ids.empresa);
    checar("Vagas abertas (3 de 4)", e?.resumo.vagas_abertas === 3, `${e?.resumo.vagas_abertas}`);
    checar("Em processo (2 enviados + 2 em entrevista; a vaga fechada já dispensou o seu)", e?.resumo.em_processo === 4, `${e?.resumo.em_processo}`);
    checar("Contratados", e?.resumo.contratados === 1, `${e?.resumo.contratados}`);
    checar("Vagas da empresa continuam resumidas, sem candidaturas",
      e?.vagas.length === 4 && e.vagas.every((v) => !("aplicacoes" in v) && v.status && v.titulo));

    console.log("\n== Espaços extras no começo e no fim são tirados ao salvar");
    r = await req("PUT", `/empresas/${ids.empresa}`, { nome: "  [TESTE] Empresa Resumos  ", setor: " Saúde ",
      nome_contato: "  Ana  Paula ", telefone_contato: " (31) 98888-7777 ", email_contato: " ana@teste.com " });
    checar("Empresa: nome, setor, contato, telefone e e-mail aparados",
      r.body?.nome === "[TESTE] Empresa Resumos" && r.body?.setor === "Saúde" && r.body?.nome_contato === "Ana  Paula"
        && r.body?.telefone_contato === "(31) 98888-7777" && r.body?.email_contato === "ana@teste.com", JSON.stringify(r.body));
    r = await req("PUT", `/vagas/${vagaNova.id}`, { codigo_vaga: vagaNova.codigo_vaga, titulo: "  [TESTE] Vaga nova ",
      descricao: " Teste ", valor: 1000, empresa_id: ids.empresa });
    checar("Vaga: título e descrição aparados", r.body?.titulo === "[TESTE] Vaga nova" && r.body?.descricao === "Teste",
      `"${r.body?.titulo}"`);
    r = await req("POST", "/candidatos", { nome_completo: "   [TESTE] Estudante espaços  ", telefone: " 000 ",
      curso: " Direito ", instituicao_ensino: " UFMG ", horario_estudo: "NOITE", vaga_id: vagaNova.id });
    if (r.body?.id) ids.estudantes.push(r.body.id);
    checar("Estudante: nome, curso e instituição aparados",
      r.body?.nome_completo === "[TESTE] Estudante espaços" && r.body?.curso === "Direito" && r.body?.instituicao_ensino === "UFMG",
      `"${r.body?.nome_completo}"`);
    r = await req("POST", "/empresas", { nome: "    ", setor: "Teste", nome_contato: "Teste", telefone_contato: "000",
      email_contato: "teste@teste.com" });
    if (r.body?.id) await prisma.empresa.delete({ where: { id: r.body.id } });
    checar("Nome só com espaços é recusado como vazio", r.status === 400, `[${r.status}]`);
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
