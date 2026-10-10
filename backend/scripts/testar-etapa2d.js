// Testes da Etapa 2D (histórico no GET /candidatos e reagendamento). Sobe a API na porta 3399,
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
const DIA_MS = 24 * 60 * 60 * 1000;
const ids = { empresa: null, vagas: [], estudante: null };
const teste = criarTeste(PORT);
const { req, checar, esperarServidor } = teste;

async function main() {
  const server = spawn(process.execPath, ["server.js"], { env: { ...process.env, PORT }, stdio: "ignore" });
  try {
    await esperarServidor();

    console.log("\n== Preparação (registros [TESTE])");
    const empresa = await req("POST", "/empresas", { nome: "[TESTE] Empresa 2D", setor: "Teste", nome_contato: "Teste",
      telefone_contato: "000", email_contato: "teste@teste.com" });
    ids.empresa = empresa.body.id;
    for (const titulo of ["[TESTE] Vaga 2D A", "[TESTE] Vaga 2D B"]) {
      const codigo = String(900000 + Math.floor(Math.random() * 99999));
      const vaga = await req("POST", "/vagas", { codigo_vaga: codigo, titulo, descricao: "Teste", valor: 1000, empresa_id: ids.empresa });
      if (vaga.status !== 201) throw new Error(`Falha ao criar vaga: ${vaga.body?.erro}`);
      ids.vagas.push(vaga.body);
    }
    const estudante = await req("POST", "/candidatos", { nome_completo: "[TESTE] Estudante 2D", telefone: "000",
      curso: "Teste", instituicao_ensino: "Teste", horario_estudo: "TARDE", vaga_id: ids.vagas[0].id });
    ids.estudante = estudante.body.id;
    const aplicacaoA = estudante.body.aplicacoes[0];
    // A API só cria uma candidatura por cadastro; a segunda é criada direto para testar o histórico com 2 vagas.
    const aplicacaoB = await prisma.aplicacao.create({ data: { vaga_id: ids.vagas[1].id, estudante_id: ids.estudante } });
    console.log("ok: 1 empresa, 2 vagas, 1 estudante com 2 candidaturas");

    await req("PATCH", `/candidatos/${ids.estudante}`, { aplicacao_id: aplicacaoA.id, status_kanban: "RECUSADO",
      motivo_recusa: "Perfil não aderente" });

    console.log("\n== GET /candidatos (histórico)");
    let r = await req("GET", "/candidatos");
    const doTeste = r.body.find((e) => e.id === ids.estudante);
    checar("Status 200 e estudante presente", r.status === 200 && Boolean(doTeste), `[${r.status}]`);
    checar("Traz as 2 candidaturas", doTeste?.aplicacoes.length === 2, `${doTeste?.aplicacoes.length}`);
    const histA = doTeste?.aplicacoes.find((a) => a.id === aplicacaoA.id);
    checar("Candidatura traz título, Nº e empresa da vaga",
      histA?.vaga?.titulo === "[TESTE] Vaga 2D A" && histA?.vaga?.codigo_vaga === ids.vagas[0].codigo_vaga
        && histA?.vaga?.empresa?.nome === "[TESTE] Empresa 2D",
      JSON.stringify(histA?.vaga));
    checar("Candidatura traz o motivo da dispensa", histA?.motivo_recusa === "Perfil não aderente", `"${histA?.motivo_recusa}"`);
    checar("Candidatura traz created_at e data_aprovacao", histA && "created_at" in histA && "data_aprovacao" in histA);
    const datas = doTeste?.aplicacoes.map((a) => new Date(a.created_at).getTime()) ?? [];
    checar("Ordenadas da mais recente para a mais antiga", datas.every((d, i) => i === 0 || datas[i - 1] >= d));

    console.log("\n== Reagendar (PATCH com nova data mantendo ENTREVISTA_AGENDADA)");
    const primeira = new Date(Date.now() + 2 * DIA_MS);
    const nova = new Date(Date.now() + 5 * DIA_MS);
    r = await req("PATCH", `/candidatos/${ids.estudante}`, { aplicacao_id: aplicacaoB.id, status_kanban: "ENTREVISTA_AGENDADA",
      data_hora_entrevista: primeira.toISOString() });
    checar("Agendar → 200", r.status === 200, `[${r.status}] ${r.body?.erro ?? ""}`);
    r = await req("PATCH", `/candidatos/${ids.estudante}`, { aplicacao_id: aplicacaoB.id, status_kanban: "ENTREVISTA_AGENDADA",
      data_hora_entrevista: nova.toISOString() });
    checar("Reagendar → 200 com a nova data", r.status === 200 && new Date(r.body.data_hora_entrevista).getTime() === nova.getTime(),
      `[${r.status}] ${r.body?.data_hora_entrevista}`);
    r = await req("GET", "/entrevistas");
    const naAgenda = r.body.filter((e) => e.id === aplicacaoB.id);
    checar("/entrevistas mostra a entrevista uma vez, com a nova data",
      naAgenda.length === 1 && new Date(naAgenda[0].data_hora_entrevista).getTime() === nova.getTime(),
      naAgenda.map((e) => e.data_hora_entrevista).join(", "));
    checar("/entrevistas traz o id da vaga e o telefone (usados pela Agenda)",
      naAgenda[0]?.vaga?.id === ids.vagas[1].id && naAgenda[0]?.estudante?.telefone === "000");
  } finally {
    if (ids.estudante) {
      await prisma.aplicacao.deleteMany({ where: { estudante_id: ids.estudante } }).catch(() => {});
      await prisma.estudante.delete({ where: { id: ids.estudante } }).catch(() => {});
    }
    await prisma.vaga.deleteMany({ where: { id: { in: ids.vagas.map((v) => v.id) } } }).catch(() => {});
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
