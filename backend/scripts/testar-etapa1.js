// Testes da Etapa 1 (PUT/DELETE). Sobe a API na porta 3399, cria registros "[TESTE]" e remove tudo no final.
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
const criados = { empresa: null, vaga: null, estudante: null, aplicacao: null };
const teste = criarTeste(PORT);
const { req, checarStatus: checar, esperarServidor } = teste;

async function main() {
  const server = spawn(process.execPath, ["server.js"], { env: { ...process.env, PORT }, stdio: "ignore" });
  try {
    await esperarServidor();

    console.log("\n== Validação (nada chega ao banco)");
    checar("PUT /empresas/abc → 400", await req("PUT", "/empresas/abc", {}), 400);
    checar("DELETE /vagas/abc → 400", await req("DELETE", "/vagas/abc"), 400);
    checar("PUT /candidatos/:id sem campos → 400", await req("PUT", `/candidatos/${UUID_INEXISTENTE}`, {}), 400);
    checar("DELETE /empresas/<inexistente> → 404", await req("DELETE", `/empresas/${UUID_INEXISTENTE}`), 404);
    checar("PUT /empresas/<inexistente> → 404", await req("PUT", `/empresas/${UUID_INEXISTENTE}`,
      { nome: "x", setor: "x", nome_contato: "x", telefone_contato: "x", email_contato: "x@x.com" }), 404);

    console.log("\n== Cria registros de teste");
    let r = await req("POST", "/empresas", { nome: "[TESTE] Empresa", setor: "Teste", nome_contato: "Teste",
      telefone_contato: "000", email_contato: "teste@teste.com" });
    criados.empresa = r.body.id;
    checar("POST empresa de teste → 201", r, 201);

    const codigo = String(900000 + Math.floor(Math.random() * 99999)).slice(0, 6);
    r = await req("POST", "/vagas", { codigo_vaga: codigo, titulo: "[TESTE] Vaga", descricao: "Teste",
      valor: 1000, empresa_id: criados.empresa });
    criados.vaga = r.body.id;
    checar("POST vaga de teste → 201", r, 201);

    r = await req("POST", "/candidatos", { nome_completo: "[TESTE] Estudante", telefone: "000", curso: "Teste",
      instituicao_ensino: "Teste", horario_estudo: "MANHA", vaga_id: criados.vaga,
      anotacoes_recrutador: "Anotação criada no POST" });
    criados.estudante = r.body.id;
    criados.aplicacao = r.body.aplicacoes?.[0]?.id;
    checar("POST estudante de teste (com aplicação) → 201", r, 201);

    console.log("\n== PUT");
    r = await req("PUT", `/empresas/${criados.empresa}`, { nome: "[TESTE] Empresa editada", setor: "Teste",
      nome_contato: "Teste", telefone_contato: "111", email_contato: "teste@teste.com" });
    checar(`PUT empresa → 200 (nome="${r.body?.nome}")`, r, 200);
    r = await req("PUT", `/vagas/${criados.vaga}`, { codigo_vaga: codigo, titulo: "[TESTE] Vaga editada",
      descricao: "Teste", valor: 1500.5, empresa_id: criados.empresa });
    checar(`PUT vaga → 200 (valor=${r.body?.valor})`, r, 200);
    r = await req("PUT", `/candidatos/${criados.estudante}`, { nome_completo: "[TESTE] Estudante", telefone: "000",
      curso: "Teste", instituicao_ensino: "Teste", horario_estudo: "NOITE",
      anotacoes_recrutador: "Texto longo ".repeat(500).trim() });
    checar(`PUT candidato → 200 (anotacoes=${r.body?.anotacoes_recrutador?.length} chars)`, r, 200);

    console.log("\n== DELETE bloqueado (409)");
    checar("DELETE empresa com vaga → 409", await req("DELETE", `/empresas/${criados.empresa}`), 409);
    checar("DELETE vaga com aplicação → 409", await req("DELETE", `/vagas/${criados.vaga}`), 409);
    checar("DELETE estudante com aplicação → 409", await req("DELETE", `/candidatos/${criados.estudante}`), 409);

    console.log("\n== DELETE liberado (204) após remover a aplicação de teste");
    await prisma.aplicacao.delete({ where: { id: criados.aplicacao } });
    criados.aplicacao = null;
    checar("DELETE estudante → 204", await req("DELETE", `/candidatos/${criados.estudante}`), 204);
    criados.estudante = null;
    checar("DELETE vaga → 204", await req("DELETE", `/vagas/${criados.vaga}`), 204);
    criados.vaga = null;
    checar("DELETE empresa → 204", await req("DELETE", `/empresas/${criados.empresa}`), 204);
    criados.empresa = null;
  } finally {
    // Limpeza de segurança caso algum passo tenha falhado no meio.
    if (criados.aplicacao) await prisma.aplicacao.delete({ where: { id: criados.aplicacao } }).catch(() => {});
    if (criados.estudante) await prisma.estudante.delete({ where: { id: criados.estudante } }).catch(() => {});
    if (criados.vaga) await prisma.vaga.delete({ where: { id: criados.vaga } }).catch(() => {});
    if (criados.empresa) await prisma.empresa.delete({ where: { id: criados.empresa } }).catch(() => {});
    const sobras = await prisma.empresa.count({ where: { nome: { startsWith: "[TESTE]" } } });
    console.log(`\nRegistros [TESTE] restantes: ${sobras}`);
    await prisma.$disconnect();
    server.kill();
  }
  console.log(teste.falhas ? `\n${teste.falhas} FALHA(S)` : "\nTodos os testes passaram.");
  process.exitCode = teste.falhas ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
