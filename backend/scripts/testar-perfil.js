// Testes do perfil do estudante (GET /candidatos/:id): dados, candidaturas com vaga/empresa/logo, entrevista,
// observação e motivo da dispensa. Sobe a API na porta 3392, cria registros "[TESTE]" e remove tudo no final.
// ATENÇÃO: grava e apaga dados no banco do DATABASE_URL (só os registros que o próprio teste cria).
const path = require("path");
const { spawn } = require("child_process");

const BACKEND = path.resolve(__dirname, "..");
process.chdir(BACKEND);
require("dotenv").config();
const prisma = require("../src/prisma");

const PORT = 3392;
const BASE = `http://localhost:${PORT}`;
const UUID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";
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

async function criarVaga(titulo, turno) {
  const r = await req("POST", "/vagas", { codigo_vaga: String(900000 + Math.floor(Math.random() * 99999)), titulo,
    descricao: "Teste", valor: 1000, empresa_id: ids.empresa, turno });
  ids.vagas.push(r.body.id);
  return r.body;
}

async function main() {
  const server = spawn(process.execPath, ["server.js"], { env: { ...process.env, PORT }, stdio: "ignore" });
  try {
    await esperarServidor();

    console.log("\n== Preparação (registros [TESTE])");
    const empresa = await req("POST", "/empresas", { nome: "[TESTE] Empresa Perfil", setor: "Teste", nome_contato: "Teste",
      telefone_contato: "000", email_contato: "teste@teste.com" });
    ids.empresa = empresa.body.id;
    const vagaA = await criarVaga("[TESTE] Vaga Perfil A", "TARDE");
    const vagaB = await criarVaga("[TESTE] Vaga Perfil B", "MANHA");
    const criado = await req("POST", "/candidatos", { nome_completo: "[TESTE] Estudante Perfil", telefone: "31988887777",
      curso: "Direito", instituicao_ensino: "UFMG", turno_estudo: "NOITE", disponibilidade: ["MANHA", "TARDE"], semestre_atual: 8,
      previsao_formatura: "2027-03", data_nascimento: "2009-01-10", vaga_id: vagaA.id });
    ids.estudantes.push(criado.body.id);
    const estudanteId = criado.body.id;
    const aplicacaoA = criado.body.aplicacoes[0].id;
    await req("PATCH", `/candidatos/${estudanteId}`, { aplicacao_id: aplicacaoA, status_kanban: "ENTREVISTA_AGENDADA",
      data_hora_entrevista: new Date(Date.now() + 86400000).toISOString(), entrevista_formato: "PRESENCIAL", entrevista_local: "Rua A, 10" });
    await req("PUT", `/candidatos/${estudanteId}/candidaturas/${aplicacaoA}/observacao`, { observacao: "Prefere à tarde" });
    const b = await req("POST", `/candidatos/${estudanteId}/candidaturas`, { vaga_id: vagaB.id });
    await req("PATCH", `/candidatos/${estudanteId}`, { aplicacao_id: b.body.id, status_kanban: "RECUSADO", motivo_recusa: "Sem vaga no período" });
    console.log("ok: estudante com uma entrevista agendada (com observação) e uma dispensa");

    console.log("\n== GET /candidatos/:id");
    const r = await req("GET", `/candidatos/${estudanteId}`);
    checar("Perfil encontrado com os campos novos", r.status === 200 && r.body.turno_estudo === "NOITE" && r.body.semestre_atual === 8
      && r.body.disponibilidade.length === 2 && r.body.previsao_formatura.startsWith("2027-03") && r.body.data_nascimento.startsWith("2009-01-10"),
      `[${r.status}]`);
    checar("Traz as duas candidaturas, a mais recente primeiro", r.body.aplicacoes?.length === 2 && r.body.aplicacoes[0].id === b.body.id);
    const a = r.body.aplicacoes.find((x) => x.id === aplicacaoA);
    checar("Candidatura traz entrevista (status, formato, local) e observação",
      a.entrevista_status === "AGUARDANDO" && a.entrevista_formato === "PRESENCIAL" && a.entrevista_local === "Rua A, 10"
        && a.observacao === "Prefere à tarde");
    checar("Vaga com turno, status e empresa (com logo_url)",
      a.vaga.turno === "TARDE" && a.vaga.status === "ABERTA" && a.vaga.empresa.nome === "[TESTE] Empresa Perfil" && "logo_url" in a.vaga.empresa);
    const dispensa = r.body.aplicacoes.find((x) => x.id === b.body.id);
    checar("Dispensa com motivo e data (updated_at)", dispensa.motivo_recusa === "Sem vaga no período" && Boolean(dispensa.updated_at));
    let x = await req("GET", `/candidatos/${UUID_INEXISTENTE}`);
    checar("Estudante inexistente → 404", x.status === 404, `[${x.status}]`);
    x = await req("GET", "/candidatos/abc");
    checar("ID inválido → 400", x.status === 400, `[${x.status}]`);
    x = await req("GET", "/candidatos");
    checar("A lista de estudantes continua funcionando", x.status === 200 && Array.isArray(x.body));
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
