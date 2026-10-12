// Testes dos ajustes de cadastro: telefone repetido (409), instituição opcional (NULL), código da vaga com 5 ou 6 dígitos
// (e ordem numérica na lista) e encerrar a vaga depois de uma contratação ("Vaga preenchida").
// Sobe a API na porta 3389, cria registros "[TESTE]" e remove tudo no final.
// ATENÇÃO: grava e apaga dados no banco do DATABASE_URL (só os registros que o próprio teste cria).
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const BACKEND = path.resolve(__dirname, "..");
process.chdir(BACKEND);
require("dotenv").config();
const prisma = require("../src/prisma");
const { criarTeste } = require("./lib/teste");

const PORT = 3389;
const DIA = 24 * 60 * 60 * 1000;
const ids = { empresa: null, vagas: [], estudantes: [] };
const teste = criarTeste(PORT);
const { req, checar, checarStatus, esperarServidor } = teste;

// "003389xxxxxxx" → "(00) 33891-xxxxxx": mesmo número, outra formatação.
const formatar = (digitos) => `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;

async function estudante(dados) {
  const r = await req("POST", "/candidatos", { curso: "Teste", instituicao_ensino: "Teste", ...dados });
  if (r.body?.id) ids.estudantes.push(r.body.id);
  return r;
}

// Código livre com 5 ou 6 dígitos (sorteado e conferido no banco).
async function codigoLivre(tamanho) {
  for (;;) {
    const codigo = String(crypto.randomInt(9 * 10 ** (tamanho - 1)) + 10 ** (tamanho - 1));
    if (!(await prisma.vaga.findUnique({ where: { codigo_vaga: codigo } }))) return codigo;
  }
}

async function vaga(codigo, titulo = "[TESTE] Vaga Cadastros") {
  const r = await req("POST", "/vagas", { codigo_vaga: codigo, titulo, descricao: "Teste", valor: 1000, empresa_id: ids.empresa });
  if (r.body?.id) ids.vagas.push(r.body.id);
  return r;
}

async function main() {
  const server = spawn(process.execPath, ["server.js"], { env: { ...process.env, PORT }, stdio: "ignore" });
  try {
    await esperarServidor();
    const empresa = await req("POST", "/empresas", { nome: "[TESTE] Empresa Cadastros", setor: "Teste", nome_contato: "Teste",
      telefone_contato: "000", email_contato: "teste@teste.com" });
    ids.empresa = empresa.body.id;

    console.log("\n== Telefone repetido (só os dígitos)");
    const telefoneA = teste.telefone();
    let r = await estudante({ nome_completo: "[TESTE] Estudante A", telefone: formatar(telefoneA) });
    checarStatus("Cadastro com telefone formatado", r, 201);
    const a = r.body;
    r = await estudante({ nome_completo: "[TESTE] Estudante Repetido", telefone: telefoneA });
    checarStatus("Mesmo número sem formatação → 409", r, 409);
    checar("409 traz o nome no erro e o estudante existente (id e nome)",
      r.body?.erro?.includes("[TESTE] Estudante A") && r.body?.estudante_existente?.id === a.id
        && r.body?.estudante_existente?.nome_completo === "[TESTE] Estudante A", JSON.stringify(r.body));
    r = await estudante({ nome_completo: "[TESTE] Estudante B", telefone: teste.telefone() });
    checarStatus("Outro número → 201", r, 201);
    const b = r.body;
    r = await req("PUT", `/candidatos/${b.id}`, { nome_completo: b.nome_completo, telefone: ` ${telefoneA.slice(0, 2)} ${telefoneA.slice(2)} `,
      curso: "Teste", instituicao_ensino: "Teste" });
    checarStatus("Editar B para o número de A → 409", r, 409);
    checar("…apontando para A", r.body?.estudante_existente?.id === a.id);
    checar("B não foi alterado", (await prisma.estudante.findUnique({ where: { id: b.id } })).telefone === b.telefone);
    r = await req("PUT", `/candidatos/${a.id}`, { nome_completo: a.nome_completo, telefone: telefoneA, curso: "Teste", instituicao_ensino: "Teste" });
    checarStatus("Editar A mantendo o próprio número (outra formatação) → 200", r, 200);

    console.log("\n== Instituição de ensino opcional");
    r = await req("POST", "/candidatos", { nome_completo: "[TESTE] Sem instituição", telefone: teste.telefone(), curso: "Teste" });
    if (r.body?.id) ids.estudantes.push(r.body.id);
    checar("Sem instituição → 201, gravada como null", r.status === 201 && r.body.instituicao_ensino === null, `[${r.status}] ${r.body?.erro ?? ""}`);
    r = await req("POST", "/candidatos", { nome_completo: "[TESTE] Instituição null", telefone: teste.telefone(), curso: "Teste",
      instituicao_ensino: null });
    if (r.body?.id) ids.estudantes.push(r.body.id);
    checar("Instituição null (formulário em branco) → 201, null", r.status === 201 && r.body.instituicao_ensino === null, `[${r.status}] ${r.body?.erro ?? ""}`);
    r = await req("PUT", `/candidatos/${a.id}`, { nome_completo: a.nome_completo, telefone: telefoneA, curso: "Teste", instituicao_ensino: null });
    checar("Editar apagando a instituição → 200, null", r.status === 200 && r.body.instituicao_ensino === null, `[${r.status}] ${r.body?.erro ?? ""}`);
    r = await req("POST", "/candidatos", { nome_completo: "[TESTE] Sem curso", telefone: teste.telefone() });
    if (r.body?.id) ids.estudantes.push(r.body.id);
    checar("Sem curso continua → 400", r.status === 400 && r.body.erro === "Informe nome, telefone e curso.", `[${r.status}] ${r.body?.erro}`);

    console.log("\n== Código da vaga com 5 ou 6 dígitos");
    const cinco = await codigoLivre(5);
    r = await vaga(cinco);
    checarStatus(`5 dígitos (${cinco}) → 201`, r, 201);
    const vagaCinco = r.body;
    const seis = await codigoLivre(6);
    r = await vaga(seis);
    checarStatus(`6 dígitos (${seis}) → 201`, r, 201);
    const vagaSeis = r.body;
    for (const invalido of ["1234", "1234567", "12a45", "12 345"]) {
      r = await vaga(invalido);
      checar(`"${invalido}" → 400 com a regra nova`, r.status === 400 && r.body.erro === "O código da vaga deve ter 5 ou 6 dígitos.",
        `[${r.status}] ${r.body?.erro}`);
    }
    const outroCinco = await codigoLivre(5);
    r = await req("PUT", `/vagas/${vagaSeis.id}`, { codigo_vaga: outroCinco, titulo: vagaSeis.titulo, descricao: "Teste", valor: 1000,
      empresa_id: ids.empresa });
    checar("Editar de 6 para 5 dígitos → 200", r.status === 200 && r.body.codigo_vaga === outroCinco, `[${r.status}] ${r.body?.erro ?? ""}`);
    r = await req("PUT", `/vagas/${vagaSeis.id}`, { codigo_vaga: "1234", titulo: vagaSeis.titulo, descricao: "Teste", valor: 1000,
      empresa_id: ids.empresa });
    checarStatus("Editar para 4 dígitos → 400", r, 400);
    r = await req("GET", "/vagas");
    const codigos = r.body.map((item) => Number(item.codigo_vaga));
    checar("GET /vagas em ordem numérica do Nº (5 dígitos antes de 6)", codigos.every((n, i) => i === 0 || codigos[i - 1] <= n));
    checar("Vaga de 5 dígitos aparece na lista", r.body.some((item) => item.id === vagaCinco.id && item.codigo_vaga === cinco));

    console.log("\n== Contratou → encerrar a vaga (\"Vaga preenchida\")");
    const candidatos = [];
    for (const nome of ["Contratado", "Enviado", "Entrevista"]) {
      r = await estudante({ nome_completo: `[TESTE] ${nome}`, telefone: teste.telefone(), vaga_id: vagaCinco.id });
      candidatos.push({ id: r.body.id, aplicacao: r.body.aplicacoes[0].id });
    }
    const [contratado, enviado, entrevista] = candidatos;
    await req("PATCH", `/candidatos/${entrevista.id}`, { aplicacao_id: entrevista.aplicacao, status_kanban: "ENTREVISTA_AGENDADA",
      data_hora_entrevista: new Date(Date.now() + 2 * DIA).toISOString() });
    r = await req("GET", `/entrevistas?inicio=${new Date().toISOString()}&fim=${new Date(Date.now() + 7 * DIA).toISOString()}`);
    const noCalendario = r.body.find((item) => item.id === entrevista.aplicacao);
    checar("Calendário recebe empresa e estudante da entrevista",
      noCalendario?.vaga?.empresa?.nome === "[TESTE] Empresa Cadastros" && noCalendario?.estudante?.nome_completo === "[TESTE] Entrevista");
    r = await req("PATCH", `/candidatos/${contratado.id}`, { aplicacao_id: contratado.aplicacao, status_kanban: "APROVADO" });
    checar("Mover para Contratado → 200", r.status === 200 && r.body.status_kanban === "APROVADO", `[${r.status}]`);
    r = await req("PATCH", `/vagas/${vagaCinco.id}`, { status: "FECHADA", motivo: "Vaga preenchida" });
    checar("Encerrar vaga → Fechada, 2 dispensados", r.status === 200 && r.body.status === "FECHADA" && r.body.dispensados === 2,
      `[${r.status}] ${r.body?.dispensados}`);
    const [c, e, i] = await Promise.all(candidatos.map((x) => prisma.aplicacao.findUnique({ where: { id: x.aplicacao } })));
    checar("Em andamento → Dispensado com \"Vaga preenchida\"",
      [e, i].every((x) => x.status_kanban === "RECUSADO" && x.motivo_recusa === "Vaga preenchida"));
    checar("Contratado continua contratado", c.status_kanban === "APROVADO" && c.data_aprovacao !== null);
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
