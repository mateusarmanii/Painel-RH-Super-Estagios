// Testes de suspender, fechar e reabrir vagas: o que acontece com candidatos, entrevistas e motivos.
// Sobe a API na porta 3393, cria registros "[TESTE]" e remove tudo no final.
// ATENÇÃO: grava e apaga dados no banco do DATABASE_URL (só os registros que o próprio teste cria).
const path = require("path");
const { spawn } = require("child_process");

const BACKEND = path.resolve(__dirname, "..");
process.chdir(BACKEND);
require("dotenv").config();
const prisma = require("../src/prisma");
const { criarTeste } = require("./lib/teste");

const PORT = 3393;
const UUID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";
const DIA = 24 * 60 * 60 * 1000;
const ids = { empresa: null, vagas: [], estudantes: [] };
const teste = criarTeste(PORT);
const { req, checar, esperarServidor } = teste;

async function criarVaga(titulo) {
  const r = await req("POST", "/vagas", { codigo_vaga: String(900000 + Math.floor(Math.random() * 99999)), titulo,
    descricao: "Teste", valor: 1000, empresa_id: ids.empresa });
  ids.vagas.push(r.body.id);
  return r.body;
}

async function candidato(nome, vagaId, etapa, extra = {}) {
  const r = await req("POST", "/candidatos", { nome_completo: `[TESTE] ${nome}`, telefone: "31988887777", curso: "Teste",
    instituicao_ensino: "Teste", vaga_id: vagaId });
  ids.estudantes.push(r.body.id);
  const aplicacao = r.body.aplicacoes[0].id;
  if (etapa !== "ENVIADO_EMPRESA") {
    await req("PATCH", `/candidatos/${r.body.id}`, { aplicacao_id: aplicacao, status_kanban: etapa, ...extra });
  }
  return { id: r.body.id, aplicacao };
}

const aplicacao = (id) => prisma.aplicacao.findUnique({ where: { id } });

async function main() {
  const server = spawn(process.execPath, ["server.js"], { env: { ...process.env, PORT }, stdio: "ignore" });
  try {
    await esperarServidor();

    console.log("\n== Preparação (registros [TESTE])");
    const empresa = await req("POST", "/empresas", { nome: "[TESTE] Empresa Status", setor: "Teste", nome_contato: "Teste",
      telefone_contato: "000", email_contato: "teste@teste.com" });
    ids.empresa = empresa.body.id;
    const vaga = await criarVaga("[TESTE] Vaga Status");
    const enviado = await candidato("Enviado", vaga.id, "ENVIADO_EMPRESA");
    const entrevista = await candidato("Entrevista", vaga.id, "ENTREVISTA_AGENDADA",
      { data_hora_entrevista: new Date(Date.now() + 2 * DIA).toISOString(), entrevista_formato: "ONLINE", entrevista_local: "https://meet" });
    const contratado = await candidato("Contratado", vaga.id, "APROVADO");
    const dispensado = await candidato("Dispensado", vaga.id, "RECUSADO", { motivo_recusa: "Perfil não aderente" });
    console.log("ok: 1 vaga com enviado, entrevista, contratado e dispensado");

    console.log("\n== Suspender e reabrir");
    let r = await req("PATCH", `/vagas/${vaga.id}`, { status: "SUSPENSA" });
    checar("Suspender → status Suspensa, sem dispensar ninguém", r.status === 200 && r.body.status === "SUSPENSA" && r.body.dispensados === 0,
      `[${r.status}] ${r.body?.status}`);
    checar("Candidatos continuam onde estavam",
      (await aplicacao(enviado.aplicacao)).status_kanban === "ENVIADO_EMPRESA"
        && (await aplicacao(entrevista.aplicacao)).entrevista_status === "AGUARDANDO");
    const extra = await req("POST", "/candidatos", { nome_completo: "[TESTE] Novo", telefone: "000", curso: "Teste",
      instituicao_ensino: "Teste", vaga_id: vaga.id });
    if (extra.body?.id) ids.estudantes.push(extra.body.id);
    checar("Vaga suspensa não recebe novos candidatos (409)", extra.status === 409, `[${extra.status}]`);
    r = await req("PATCH", `/vagas/${vaga.id}`, { status: "ABERTA" });
    checar("Reabrir → Aberta", r.status === 200 && r.body.status === "ABERTA");

    console.log("\n== Fechar");
    r = await req("PATCH", `/vagas/${vaga.id}`, { status: "FECHADA", motivo: "x".repeat(501) });
    checar("Motivo com mais de 500 caracteres → 400", r.status === 400, `[${r.status}]`);
    const antes = Date.now();
    r = await req("PATCH", `/vagas/${vaga.id}`, { status: "FECHADA", motivo: "" });
    checar("Fechar → Fechada, 2 dispensados e 1 entrevista cancelada",
      r.status === 200 && r.body.status === "FECHADA" && r.body.dispensados === 2 && r.body.entrevistasCanceladas === 1,
      `[${r.status}] ${JSON.stringify({ d: r.body?.dispensados, e: r.body?.entrevistasCanceladas })}`);
    const [a, b, c, d] = await Promise.all([enviado, entrevista, contratado, dispensado].map((x) => aplicacao(x.aplicacao)));
    checar("Em andamento → Dispensado com o motivo padrão",
      [a, b].every((x) => x.status_kanban === "RECUSADO" && x.motivo_recusa === "Vaga encerrada pela empresa"));
    checar("Data da dispensa preenchida (updated_at)", [a, b].every((x) => x.updated_at.getTime() >= antes - 1000));
    checar("Entrevista em aberto → Cancelada", b.entrevista_status === "CANCELADA");
    checar("Contratado não muda", c.status_kanban === "APROVADO" && c.data_aprovacao !== null);
    checar("Quem já estava dispensado mantém o próprio motivo", d.motivo_recusa === "Perfil não aderente");

    const outra = await criarVaga("[TESTE] Vaga Status 2");
    const x = await candidato("Outro", outra.id, "AGUARDANDO_RETORNO");
    r = await req("PATCH", `/vagas/${outra.id}`, { status: "FECHADA", motivo: "Empresa congelou contratações" });
    checar("Fechar com motivo próprio", (await aplicacao(x.aplicacao)).motivo_recusa === "Empresa congelou contratações");

    console.log("\n== Validações e exclusão bloqueada");
    r = await req("PATCH", `/vagas/${vaga.id}`, { status: "PAUSADA" });
    checar("Status inválido → 400", r.status === 400, `[${r.status}]`);
    r = await req("PATCH", "/vagas/abc", { status: "ABERTA" });
    checar("ID inválido → 400", r.status === 400, `[${r.status}]`);
    r = await req("PATCH", `/vagas/${UUID_INEXISTENTE}`, { status: "ABERTA" });
    checar("Vaga inexistente → 404", r.status === 404, `[${r.status}]`);
    r = await req("DELETE", `/vagas/${vaga.id}`);
    checar("Excluir vaga com candidaturas → 409 explicando", r.status === 409 && /candidatura/.test(r.body.erro), `[${r.status}] ${r.body?.erro}`);
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
    await prisma.$disconnect();
    server.kill();
  }
  console.log(teste.falhas ? `\n${teste.falhas} FALHA(S)` : "\nTodos os testes passaram.");
  process.exitCode = teste.falhas ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
