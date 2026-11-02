// Testes dos motivos de dispensa padronizados (Aplicacao.motivo_categoria, src/motivos.js): a categoria é opcional
// no Kanban e no Calendário, fechar a vaga marca "vaga_encerrada" e o Dashboard agrupa por categoria
// (as sem categoria, pelo texto). Sobe a API na porta 3402, cria registros "[TESTE]" e remove tudo no final.
// ATENÇÃO: grava e apaga dados no banco do DATABASE_URL (só os registros que o próprio teste cria).
const path = require("path");
const { spawn } = require("child_process");

const BACKEND = path.resolve(__dirname, "..");
process.chdir(BACKEND);
require("dotenv").config();
const prisma = require("../src/prisma");
const { categorizarTexto } = require("../src/motivos");
const { criarTeste } = require("./lib/teste");

const PORT = 3402;
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
  const r = await req("POST", "/candidatos", { nome_completo: `[TESTE] ${nome}`, telefone: teste.telefone(), curso: "Teste", vaga_id: vagaId });
  ids.estudantes.push(r.body.id);
  return { id: r.body.id, aplicacao: r.body.aplicacoes[0].id };
}

const mover = (e, status_kanban, extra = {}) => req("PATCH", `/candidatos/${e.id}`, { aplicacao_id: e.aplicacao, status_kanban, ...extra });
const categoria = async (e) => (await prisma.aplicacao.findUnique({ where: { id: e.aplicacao }, select: { motivo_categoria: true } })).motivo_categoria;

async function main() {
  console.log("== Classificação pelo texto (sem banco)");
  const casos = [
    ["Reside muito dstante da vaga", "distancia"],
    ["Vaga preenchida", "vaga_encerrada"],
    ["Declinou no processo", "desistiu"],
    ["Indisponibilidade de horário", "horario"],
    ["~Valor não atrativo", "valor"],
    ["Não compareceu à entrevista", "nao_compareceu"],
    ["Mora em outra cidade", "distancia"],
    ["Problema na cidade dele", null],
    ["", null],
  ];
  for (const [texto, esperado] of casos) {
    checar(`"${texto}" → ${esperado}`, categorizarTexto(texto) === esperado, `${categorizarTexto(texto)}`);
  }

  const server = spawn(process.execPath, ["server.js"], { env: { ...process.env, PORT }, stdio: "ignore" });
  try {
    await esperarServidor();
    const empresa = await req("POST", "/empresas", { nome: "[TESTE] Empresa Motivos", setor: "Teste", nome_contato: "Teste",
      telefone_contato: "000", email_contato: "teste@teste.com" });
    ids.empresa = empresa.body.id;
    const vaga = await criarVaga("[TESTE] Vaga Motivos");
    const vagaFechar = await criarVaga("[TESTE] Vaga Motivos Fechar");

    console.log("\n== Kanban: categoria opcional");
    const a = await estudante("Motivos A", vaga.id);
    let r = await mover(a, "RECUSADO", { motivo_recusa: "Perfil sem inglês", motivo_categoria: "perfil" });
    checarStatus("Dispensar com categoria", r, 200);
    checar("Categoria gravada e devolvida", r.body.motivo_categoria === "perfil" && (await categoria(a)) === "perfil");

    const b = await estudante("Motivos B", vaga.id);
    r = await mover(b, "RECUSADO", { motivo_recusa: "Mora longe" });
    checarStatus("Dispensar sem categoria continua funcionando (opcional)", r, 200);
    checar("Sem categoria grava vazio", (await categoria(b)) === null);

    const c = await estudante("Motivos C", vaga.id);
    r = await mover(c, "RECUSADO", { motivo_recusa: "X", motivo_categoria: "nao_existe" });
    checarStatus("Categoria desconhecida → 400", r, 400);
    r = await mover(c, "RECUSADO", { motivo_categoria: "perfil" });
    checarStatus("Só a categoria, sem texto → 400 (o texto continua obrigatório)", r, 400);

    r = await mover(a, "ENVIADO_EMPRESA");
    checar("Sair de Dispensado limpa a categoria", r.status === 200 && (await categoria(a)) === null);
    r = await mover(a, "EM_TESTE", { motivo_categoria: "perfil" });
    checar("Categoria fora de Dispensado é ignorada", r.status === 200 && (await categoria(a)) === null);
    await mover(a, "RECUSADO", { motivo_recusa: "Aceitou outra proposta", motivo_categoria: "outra_proposta" });

    console.log("\n== Calendário: dispensar com categoria");
    const d = await estudante("Motivos D", vaga.id);
    await mover(d, "ENTREVISTA_AGENDADA", { data_hora_entrevista: new Date(Date.now() + 48 * HORA).toISOString() });
    r = await req("PATCH", `/entrevistas/${d.aplicacao}`, { acao: "dispensar", motivo_recusa: "Não veio", motivo_categoria: "nao_compareceu" });
    checar("Dispensar pela entrevista grava a categoria", r.status === 200 && (await categoria(d)) === "nao_compareceu", `[${r.status}]`);
    const e = await estudante("Motivos E", vaga.id);
    await mover(e, "ENTREVISTA_AGENDADA", { data_hora_entrevista: new Date(Date.now() + 48 * HORA).toISOString() });
    r = await req("PATCH", `/entrevistas/${e.aplicacao}`, { acao: "dispensar", motivo_recusa: "X", motivo_categoria: 5 });
    checarStatus("Categoria inválida na entrevista → 400", r, 400);

    console.log("\n== Fechar vaga marca 'Vaga encerrada'");
    const f = await estudante("Motivos F", vagaFechar.id);
    r = await req("PATCH", `/vagas/${vagaFechar.id}`, { status: "FECHADA", motivo: "Empresa desistiu da contratação" });
    checar("Dispensados ao fechar ficam com vaga_encerrada", r.status === 200 && (await categoria(f)) === "vaga_encerrada");

    console.log("\n== Dashboard agrupa por categoria");
    r = await req("GET", `/dashboard-metrics?periodo=7d&empresa=${ids.empresa}`);
    const motivos = Object.fromEntries(r.body.motivosDispensa.map((m) => [m.categoria ?? m.texto, m]));
    checar("Categoria escolhida conta como informada", motivos.outra_proposta?.total === 1 && motivos.outra_proposta?.estimadas === 0,
      JSON.stringify(motivos.outra_proposta));
    checar("Sem categoria, 'Mora longe' é classificado pelo texto (estimada)", motivos.distancia?.total === 1 && motivos.distancia?.estimadas === 1,
      JSON.stringify(motivos.distancia));
    checar("Fechar vaga aparece como 'Vaga encerrada'", motivos.vaga_encerrada?.texto === "Vaga encerrada" && motivos.vaga_encerrada?.total === 1);
    checar("Total dos motivos = dispensas do período", r.body.motivosDispensa.reduce((s, m) => s + m.total, 0) === r.body.periodo.dispensas.atual,
      `${r.body.periodo.dispensas.atual}`);
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
