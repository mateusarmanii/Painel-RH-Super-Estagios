// Testes da Etapa 2A. Sobe a API na porta 3399, cria registros "[TESTE]" e remove tudo no final.
// ATENÇÃO: grava e apaga dados no banco do DATABASE_URL (só os registros que o próprio teste cria).
const path = require("path");
const { spawn } = require("child_process");

const BACKEND = path.resolve(__dirname, "..");
process.chdir(BACKEND);
require("dotenv").config();
const prisma = require("../src/prisma");

const PORT = 3399;
const BASE = `http://localhost:${PORT}`;
const DIA_MS = 24 * 60 * 60 * 1000;
const UUID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";
const CURSO_TESTE = "[TESTE] Curso 2A";
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

const diasAtras = (dias) => new Date(Date.now() - dias * DIA_MS);
const diasAFrente = (dias) => new Date(Date.now() + dias * DIA_MS);

async function criarVaga(titulo) {
  const codigo = String(900000 + Math.floor(Math.random() * 99999));
  const r = await req("POST", "/vagas", { codigo_vaga: codigo, titulo, descricao: "Teste", valor: 1000, empresa_id: ids.empresa });
  if (r.status !== 201) throw new Error(`Falha ao criar vaga: ${r.body?.erro}`);
  ids.vagas.push(r.body.id);
  return r.body;
}

async function criarEstudante(nome, vagaId, curso = CURSO_TESTE) {
  const r = await req("POST", "/candidatos", { nome_completo: nome, telefone: "000", curso,
    instituicao_ensino: "Teste", horario_estudo: "MANHA", vaga_id: vagaId });
  if (r.status !== 201) throw new Error(`Falha ao criar estudante: ${r.body?.erro}`);
  ids.estudantes.push(r.body.id);
  return { estudante: r.body, aplicacao: r.body.aplicacoes[0] };
}

const patchStatus = (alvo, status_kanban, extra = {}) =>
  req("PATCH", `/candidatos/${alvo.estudante.id}`, { aplicacao_id: alvo.aplicacao.id, status_kanban, ...extra });

async function main() {
  const server = spawn(process.execPath, ["server.js"], { env: { ...process.env, PORT }, stdio: "ignore" });
  try {
    await esperarServidor();

    console.log("\n== Preparação (registros [TESTE])");
    const empresa = await req("POST", "/empresas", { nome: "[TESTE] Empresa 2A", setor: "Teste", nome_contato: "Teste",
      telefone_contato: "000", email_contato: "teste@teste.com" });
    ids.empresa = empresa.body.id;
    const vagaA = await criarVaga("[TESTE] Vaga A (antiga, com entrevista)");
    const vagaB = await criarVaga("[TESTE] Vaga B");
    const vagaC = await criarVaga("[TESTE] Vaga C (antiga, sem entrevista)");
    const vagaD = await criarVaga("[TESTE] Vaga D (nova, sem entrevista)");
    const x = await criarEstudante("[TESTE] Estudante X", vagaA.id);
    const y = await criarEstudante("[TESTE] Estudante Y", vagaA.id);
    // Mesmo curso com grafias diferentes: devem ser agrupados como "[TESTE] Curso 2A".
    const z = await criarEstudante("[TESTE] Estudante Z", vagaB.id, "[teste] curso 2a  ");
    const w = await criarEstudante("[TESTE] Estudante W", vagaB.id, "  [TESTE]   CURSO 2Á");
    console.log("ok: 1 empresa, 4 vagas, 4 estudantes/aplicações");

    console.log("\n== Defaults da migration");
    const aplX = await prisma.aplicacao.findUnique({ where: { id: x.aplicacao.id } });
    checar("Aplicação nova tem created_at e updated_at", aplX.created_at instanceof Date && aplX.updated_at instanceof Date);
    checar("Aplicação nova tem data_aprovacao nula", aplX.data_aprovacao === null);
    checar("Vaga nova tem created_at", (await prisma.vaga.findUnique({ where: { id: vagaA.id } })).created_at instanceof Date);

    console.log("\n== Unique (vaga_id, estudante_id)");
    try {
      await prisma.aplicacao.create({ data: { vaga_id: vagaA.id, estudante_id: x.estudante.id } });
      checar("Aplicação duplicada é rejeitada", false, "o banco aceitou a duplicata");
    } catch (error) {
      checar("Aplicação duplicada é rejeitada", error.code === "P2002", `código ${error.code}`);
    }

    console.log("\n== GET /vagas/:vagaId/candidatos");
    let r = await req("GET", "/vagas/abc/candidatos");
    checar("ID inválido → 400", r.status === 400, `[${r.status}]`);
    r = await req("GET", `/vagas/${UUID_INEXISTENTE}/candidatos`);
    checar("Vaga inexistente → 404", r.status === 404, `[${r.status}] ${r.body?.erro}`);
    r = await req("GET", `/vagas/${vagaA.id}/candidatos`);
    const nomesA = r.body.map((a) => a.estudante.nome_completo).sort();
    checar("Vaga A → só X e Y", r.status === 200 && nomesA.join() === "[TESTE] Estudante X,[TESTE] Estudante Y",
      `[${r.status}] ${nomesA.join(", ")}`);
    checar("Todas as aplicações são da vaga A", r.body.every((a) => a.vaga_id === vagaA.id));
    r = await req("GET", `/vagas/${vagaD.id}/candidatos`);
    checar("Vaga D (sem candidatos) → lista vazia", r.status === 200 && r.body.length === 0, `[${r.status}] ${r.body.length} itens`);

    console.log("\n== data_aprovacao no PATCH do Kanban");
    r = await patchStatus(x, "APROVADO");
    const primeiraAprovacao = r.body.data_aprovacao;
    checar("Mudar para APROVADO grava data_aprovacao", r.status === 200 && primeiraAprovacao !== null, primeiraAprovacao);
    await new Promise((resolve) => setTimeout(resolve, 20));
    r = await patchStatus(x, "APROVADO");
    checar("Repetir APROVADO não altera a data", r.body.data_aprovacao === primeiraAprovacao);
    r = await patchStatus(x, "AGUARDANDO_RETORNO");
    checar("Sair de APROVADO limpa data_aprovacao", r.body.data_aprovacao === null);
    r = await patchStatus(x, "APROVADO");
    checar("Voltar para APROVADO grava nova data", r.body.data_aprovacao !== null);

    console.log("\n== Validações do PATCH (data da entrevista e motivo da dispensa)");
    r = await patchStatus(y, "ENTREVISTA_AGENDADA");
    checar("ENTREVISTA_AGENDADA sem data → 400", r.status === 400, `[${r.status}] ${r.body?.erro}`);
    r = await patchStatus(y, "ENTREVISTA_AGENDADA", { data_hora_entrevista: "amanhã" });
    checar("ENTREVISTA_AGENDADA com data inválida → 400", r.status === 400, `[${r.status}] ${r.body?.erro}`);
    r = await patchStatus(y, "RECUSADO");
    checar("RECUSADO sem motivo → 400", r.status === 400, `[${r.status}] ${r.body?.erro}`);
    r = await patchStatus(y, "RECUSADO", { motivo_recusa: "   " });
    checar("RECUSADO com motivo em branco → 400", r.status === 400, `[${r.status}] ${r.body?.erro}`);
    r = await patchStatus(y, "RECUSADO", { motivo_recusa: "  Perfil não aderente  " });
    checar("RECUSADO com motivo → 200 e motivo salvo sem espaços extras",
      r.status === 200 && r.body.motivo_recusa === "Perfil não aderente", `[${r.status}] "${r.body?.motivo_recusa}"`);
    r = await patchStatus(y, "AGUARDANDO_RETORNO");
    checar("Sair de RECUSADO limpa o motivo", r.status === 200 && r.body.motivo_recusa === null, `[${r.status}]`);

    console.log("\n== GET /entrevistas");
    r = await patchStatus(y, "ENTREVISTA_AGENDADA", { data_hora_entrevista: diasAFrente(2).toISOString() });
    checar("ENTREVISTA_AGENDADA com data → 200 e data salva", r.status === 200 && r.body.data_hora_entrevista !== null,
      `[${r.status}] ${r.body?.data_hora_entrevista}`);
    await patchStatus(z, "ENTREVISTA_AGENDADA", { data_hora_entrevista: diasAFrente(1).toISOString() });
    await patchStatus(w, "ENTREVISTA_AGENDADA", { data_hora_entrevista: diasAtras(1).toISOString() });
    r = await req("GET", "/entrevistas");
    const datas = r.body.map((e) => new Date(e.data_hora_entrevista).getTime());
    checar("Status 200", r.status === 200, `[${r.status}]`);
    checar("Só datas futuras", datas.every((d) => d > Date.now()));
    checar("Ordenadas por data", datas.every((d, i) => i === 0 || datas[i - 1] <= d));
    const nomesTeste = r.body.map((e) => e.estudante.nome_completo).filter((n) => n.startsWith("[TESTE]"));
    checar("Z (amanhã) antes de Y (2 dias); W (passada) fora", nomesTeste.join() === "[TESTE] Estudante Z,[TESTE] Estudante Y",
      nomesTeste.join(", "));
    checar("Inclui vaga e empresa", r.body.some((e) => e.vaga?.empresa?.nome === "[TESTE] Empresa 2A"));

    console.log("\n== /dashboard-metrics");
    await prisma.vaga.update({ where: { id: vagaA.id }, data: { created_at: diasAtras(15) } });
    await prisma.vaga.update({ where: { id: vagaC.id }, data: { created_at: diasAtras(12) } });
    await prisma.aplicacao.update({ where: { id: x.aplicacao.id }, data: { created_at: diasAtras(14) } });
    r = await req("GET", "/dashboard-metrics");
    checar("Status 200", r.status === 200, `[${r.status}] ${r.body?.erro ?? ""}`);

    const contratacoes = await prisma.aplicacao.findMany({
      where: { status_kanban: "APROVADO", data_aprovacao: { not: null } },
      select: { created_at: true, data_aprovacao: true },
    });
    const esperado = Math.round((contratacoes.reduce((t, c) => t + (c.data_aprovacao - c.created_at), 0)
      / contratacoes.length / DIA_MS) * 10) / 10;
    checar("Tempo médio de contratação confere com o banco", r.body.metrics.tempoMedioContratacaoDias === esperado,
      `${r.body.metrics.tempoMedioContratacaoDias} dias (esperado ${esperado}; ${contratacoes.length} contratação(ões))`);

    const alertas = r.body.vagasEmAlerta;
    const alertaC = alertas.find((v) => v.id === vagaC.id);
    checar("Vaga C (12 dias, sem entrevista) está em alerta", Boolean(alertaC), alertaC && `${alertaC.diasAberta} dias aberta`);
    checar("Vaga A (15 dias, com entrevista) não está em alerta", !alertas.some((v) => v.id === vagaA.id));
    checar("Vaga D (nova) não está em alerta", !alertas.some((v) => v.id === vagaD.id));

    const cursoTeste = r.body.distribuicaoPorCurso.find((c) => c.curso === CURSO_TESTE);
    checar("Curso agrupado sem diferenciar maiúsculas/acentos/espaços (4 estudantes)", cursoTeste?.total === 4,
      `${cursoTeste?.total}`);
    const gruposTeste = r.body.distribuicaoPorCurso.filter((c) => c.curso.toLowerCase().includes("[teste]"));
    checar("Grafias diferentes não geram grupos extras", gruposTeste.length === 1,
      gruposTeste.map((c) => `"${c.curso}"`).join(", "));
    const somaCursos = r.body.distribuicaoPorCurso.reduce((t, c) => t + c.total, 0);
    const totalEstudantes = await prisma.estudante.count();
    checar("Soma por curso = total de estudantes", somaCursos === totalEstudantes, `${somaCursos} / ${totalEstudantes}`);
    console.log("\nDistribuição por curso:", JSON.stringify(r.body.distribuicaoPorCurso));
  } finally {
    await prisma.aplicacao.deleteMany({ where: { estudante_id: { in: ids.estudantes } } }).catch(() => {});
    await prisma.estudante.deleteMany({ where: { id: { in: ids.estudantes } } }).catch(() => {});
    await prisma.vaga.deleteMany({ where: { id: { in: ids.vagas } } }).catch(() => {});
    if (ids.empresa) await prisma.empresa.delete({ where: { id: ids.empresa } }).catch(() => {});
    const sobras = await prisma.estudante.count({ where: { nome_completo: { startsWith: "[TESTE]" } } })
      + await prisma.vaga.count({ where: { titulo: { startsWith: "[TESTE]" } } })
      + await prisma.empresa.count({ where: { nome: { startsWith: "[TESTE]" } } });
    console.log(`\nRegistros [TESTE] restantes: ${sobras}`);
    await prisma.$disconnect();
    server.kill();
  }
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
  process.exitCode = falhas ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
