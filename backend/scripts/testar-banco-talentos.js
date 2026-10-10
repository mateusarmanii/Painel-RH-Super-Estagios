// Testes do Banco de Talentos ("Indicar para vaga", dados da dispensa e cadastro sem vaga). Sobe a API na porta 3399,
// cria registros "[TESTE]" e remove tudo no final.
// ATENÇÃO: grava e apaga dados no banco do DATABASE_URL (só os registros que o próprio teste cria).
const path = require("path");
const { spawn } = require("child_process");

const BACKEND = path.resolve(__dirname, "..");
process.chdir(BACKEND);
require("dotenv").config();
const prisma = require("../src/prisma");
const { criarTeste } = require("./lib/teste");

const PORT = 3399;
const UUID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";
const ids = { empresa: null, vagas: [], estudante: null, semVaga: [] };
const teste = criarTeste(PORT);
const { req, checar, esperarServidor } = teste;

async function criarVaga(titulo) {
  const codigo = String(900000 + Math.floor(Math.random() * 99999));
  const r = await req("POST", "/vagas", { codigo_vaga: codigo, titulo, descricao: "Teste", valor: 1000, empresa_id: ids.empresa });
  if (r.status !== 201) throw new Error(`Falha ao criar vaga: ${r.body?.erro}`);
  ids.vagas.push(r.body.id);
  return r.body;
}

async function main() {
  const server = spawn(process.execPath, ["server.js"], { env: { ...process.env, PORT }, stdio: "ignore" });
  try {
    await esperarServidor();

    console.log("\n== Preparação (registros [TESTE])");
    const empresa = await req("POST", "/empresas", { nome: "[TESTE] Empresa Banco", setor: "Teste", nome_contato: "Teste",
      telefone_contato: "000", email_contato: "teste@teste.com" });
    ids.empresa = empresa.body.id;
    const vagaOrigem = await criarVaga("[TESTE] Vaga de origem");
    const vagaNova = await criarVaga("[TESTE] Vaga nova");
    const vagaFechada = await criarVaga("[TESTE] Vaga fechada");
    await req("PATCH", `/vagas/${vagaFechada.id}`, { status: "FECHADA" });
    const estudante = await req("POST", "/candidatos", { nome_completo: "[TESTE] Estudante Banco", telefone: "000",
      curso: "Teste", instituicao_ensino: "Teste", horario_estudo: "NOITE", vaga_id: vagaOrigem.id });
    ids.estudante = estudante.body.id;
    const aplicacaoOrigem = estudante.body.aplicacoes[0];
    await req("PATCH", `/candidatos/${ids.estudante}`, { aplicacao_id: aplicacaoOrigem.id, status_kanban: "RECUSADO",
      motivo_recusa: "Perfil não aderente" });
    console.log("ok: 1 empresa, 3 vagas (1 fechada), 1 estudante dispensado");

    console.log("\n== GET /candidatos traz a data da dispensa");
    let r = await req("GET", "/candidatos");
    const dispensa = r.body.find((e) => e.id === ids.estudante)?.aplicacoes.find((a) => a.id === aplicacaoOrigem.id);
    checar("Candidatura dispensada traz updated_at e motivo",
      Boolean(dispensa?.updated_at) && dispensa?.motivo_recusa === "Perfil não aderente", `${dispensa?.updated_at}`);

    console.log("\n== POST /candidatos/:id/candidaturas (Indicar para vaga)");
    r = await req("POST", "/candidatos/abc/candidaturas", { vaga_id: vagaNova.id });
    checar("ID de candidato inválido → 400", r.status === 400, `[${r.status}] ${r.body?.erro}`);
    r = await req("POST", `/candidatos/${ids.estudante}/candidaturas`, {});
    checar("Sem vaga_id → 400", r.status === 400, `[${r.status}] ${r.body?.erro}`);
    r = await req("POST", `/candidatos/${UUID_INEXISTENTE}/candidaturas`, { vaga_id: vagaNova.id });
    checar("Candidato inexistente → 404", r.status === 404, `[${r.status}] ${r.body?.erro}`);
    r = await req("POST", `/candidatos/${ids.estudante}/candidaturas`, { vaga_id: UUID_INEXISTENTE });
    checar("Vaga inexistente → 404", r.status === 404, `[${r.status}] ${r.body?.erro}`);
    r = await req("POST", `/candidatos/${ids.estudante}/candidaturas`, { vaga_id: vagaFechada.id });
    checar("Vaga fechada → 409", r.status === 409, `[${r.status}] ${r.body?.erro}`);
    r = await req("POST", `/candidatos/${ids.estudante}/candidaturas`, { vaga_id: vagaNova.id });
    checar("Vaga aberta → 201 em ENVIADO_EMPRESA",
      r.status === 201 && r.body.status_kanban === "ENVIADO_EMPRESA" && r.body.vaga?.titulo === "[TESTE] Vaga nova",
      `[${r.status}] ${r.body?.status_kanban ?? r.body?.erro}`);
    r = await req("POST", `/candidatos/${ids.estudante}/candidaturas`, { vaga_id: vagaNova.id });
    checar("Indicar de novo para a mesma vaga → 409", r.status === 409, `[${r.status}] ${r.body?.erro}`);
    r = await req("POST", `/candidatos/${ids.estudante}/candidaturas`, { vaga_id: vagaOrigem.id });
    checar("Vaga em que já foi dispensado → 409 (sem duplicata)", r.status === 409, `[${r.status}] ${r.body?.erro}`);

    const total = await prisma.aplicacao.count({ where: { estudante_id: ids.estudante } });
    checar("Estudante ficou com exatamente 2 candidaturas", total === 2, `${total}`);
    r = await req("GET", `/vagas/${vagaNova.id}/candidatos`);
    checar("Indicação aparece no Kanban da vaga nova", r.body.some((a) => a.estudante.id === ids.estudante));

    console.log("\n== Cadastro de estudante sem vaga");
    const semVaga = { telefone: "000", curso: "Teste", instituicao_ensino: "Teste" };
    r = await req("POST", "/candidatos", { ...semVaga, nome_completo: "[TESTE] Sem vaga" });
    if (r.body?.id) ids.semVaga.push(r.body.id);
    checar("Sem vaga_id → 201, sem nenhuma candidatura",
      r.status === 201 && r.body.aplicacoes.length === 0, `[${r.status}] ${r.body?.erro ?? r.body?.aplicacoes?.length}`);
    const idSemVaga = r.body?.id;
    r = await req("POST", "/candidatos", { ...semVaga, nome_completo: "[TESTE] Sem vaga (vazio)", vaga_id: "" });
    if (r.body?.id) ids.semVaga.push(r.body.id);
    checar("vaga_id vazio → 201, sem candidatura", r.status === 201 && r.body.aplicacoes.length === 0, `[${r.status}] ${r.body?.erro ?? ""}`);
    r = await req("POST", "/candidatos", { ...semVaga, nome_completo: "[TESTE] Vaga inválida", vaga_id: "abc" });
    if (r.body?.id) ids.semVaga.push(r.body.id);
    checar("vaga_id inválido → 400", r.status === 400, `[${r.status}] ${r.body?.erro}`);
    r = await req("POST", "/candidatos", { ...semVaga, nome_completo: "[TESTE] Vaga fechada", vaga_id: vagaFechada.id });
    if (r.body?.id) ids.semVaga.push(r.body.id);
    checar("Cadastro em vaga fechada continua → 409", r.status === 409, `[${r.status}] ${r.body?.erro}`);
    r = await req("POST", "/candidatos", { telefone: "000", curso: "Teste", nome_completo: "[TESTE] Sem instituição" });
    if (r.body?.id) ids.semVaga.push(r.body.id);
    checar("Sem instituição continua → 400", r.status === 400, `[${r.status}] ${r.body?.erro}`);
    r = await req("GET", "/candidatos");
    checar("Aparece em Estudantes com 0 candidaturas",
      r.body.some((e) => e.id === idSemVaga && e.aplicacoes.length === 0));
    r = await req("POST", `/candidatos/${idSemVaga}/candidaturas`, { vaga_id: vagaNova.id });
    checar("Depois pode ser indicado para uma vaga → 201", r.status === 201 && r.body.status_kanban === "ENVIADO_EMPRESA",
      `[${r.status}] ${r.body?.erro ?? ""}`);
  } finally {
    for (const id of [ids.estudante, ...ids.semVaga].filter(Boolean)) {
      await prisma.aplicacao.deleteMany({ where: { estudante_id: id } }).catch(() => {});
      await prisma.estudante.delete({ where: { id } }).catch(() => {});
    }
    await prisma.vaga.deleteMany({ where: { id: { in: ids.vagas } } }).catch(() => {});
    if (ids.empresa) await prisma.empresa.delete({ where: { id: ids.empresa } }).catch(() => {});
    const sobras = await prisma.estudante.count({ where: { nome_completo: { startsWith: "[TESTE]" } } })
      + await prisma.vaga.count({ where: { titulo: { startsWith: "[TESTE]" } } })
      + await prisma.empresa.count({ where: { nome: { startsWith: "[TESTE]" } } });
    console.log(`\nRegistros [TESTE] restantes: ${sobras}`);
    if (sobras) teste.falhas++;
    await prisma.$disconnect();
    server.kill();
  }
  console.log(teste.falhas ? `\n${teste.falhas} FALHA(S)` : "\nTodos os testes passaram.");
  process.exitCode = teste.falhas ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
