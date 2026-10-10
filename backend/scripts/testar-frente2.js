// Testes da Frente 2: campos novos do estudante (turno de estudo, disponibilidade, semestre, formatura, nascimento),
// turno da vaga e observação da candidatura. Sobe a API na porta 3396, cria registros "[TESTE]" e remove tudo no final.
// ATENÇÃO: grava e apaga dados no banco do DATABASE_URL (só os registros que o próprio teste cria).
const path = require("path");
const { spawn } = require("child_process");

const BACKEND = path.resolve(__dirname, "..");
process.chdir(BACKEND);
require("dotenv").config();
const prisma = require("../src/prisma");
const { criarTeste } = require("./lib/teste");

const PORT = 3396;
const UUID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";
const ids = { empresa: null, vagas: [], estudantes: [] };
const teste = criarTeste(PORT);
const { req, checar, esperarServidor } = teste;

const codigo = () => String(900000 + Math.floor(Math.random() * 99999));
const dia = (iso) => iso?.slice(0, 10);

async function main() {
  const server = spawn(process.execPath, ["server.js"], { env: { ...process.env, PORT }, stdio: "ignore" });
  try {
    await esperarServidor();

    console.log("\n== Preparação (registros [TESTE])");
    const empresa = await req("POST", "/empresas", { nome: "[TESTE] Empresa Frente 2", setor: "Teste", nome_contato: "Teste",
      telefone_contato: "000", email_contato: "teste@teste.com" });
    ids.empresa = empresa.body.id;
    const base = { titulo: "[TESTE] Vaga Frente 2", descricao: "Teste", valor: 1000, empresa_id: ids.empresa };

    console.log("\n== Turno da vaga");
    let r = await req("POST", "/vagas", { ...base, codigo_vaga: codigo(), turno: "TARDE" });
    if (r.body?.id) ids.vagas.push(r.body.id);
    const vaga = r.body;
    checar("Cria vaga com turno Tarde", r.status === 201 && vaga.turno === "TARDE", `[${r.status}] ${vaga?.turno}`);
    r = await req("POST", "/vagas", { ...base, codigo_vaga: codigo() });
    if (r.body?.id) ids.vagas.push(r.body.id);
    checar("Turno é opcional (sem turno → null)", r.status === 201 && r.body.turno === null, `[${r.status}] ${r.body?.turno}`);
    r = await req("POST", "/vagas", { ...base, codigo_vaga: codigo(), turno: "NOITE" });
    if (r.body?.id) ids.vagas.push(r.body.id);
    checar("Turno inválido (Noite não vale para vaga) → 400", r.status === 400, `[${r.status}] ${r.body?.erro}`);
    r = await req("PUT", `/vagas/${vaga.id}`, { ...base, codigo_vaga: vaga.codigo_vaga, turno: "INTEGRAL" });
    checar("Edita o turno para Integral", r.body?.turno === "INTEGRAL", `${r.body?.turno}`);
    r = await req("PUT", `/vagas/${vaga.id}`, { ...base, codigo_vaga: vaga.codigo_vaga });
    checar("Editar sem mandar o turno não apaga", r.body?.turno === "INTEGRAL", `${r.body?.turno}`);
    r = await req("PUT", `/vagas/${vaga.id}`, { ...base, codigo_vaga: vaga.codigo_vaga, turno: "" });
    checar("Turno vazio apaga", r.body?.turno === null, `${r.body?.turno}`);
    r = await req("GET", "/vagas");
    checar("GET /vagas traz o turno", r.body.some((v) => v.id === vaga.id && "turno" in v));

    console.log("\n== Campos novos do estudante");
    const estudante = { nome_completo: "[TESTE] Estudante Frente 2", telefone: "31988887777", curso: "Teste",
      instituicao_ensino: "Teste", vaga_id: vaga.id };
    r = await req("POST", "/candidatos", { ...estudante, turno_estudo: "EAD", disponibilidade: ["NOITE", "MANHA", "MANHA"],
      semestre_atual: 5, previsao_formatura: "2027-06", data_nascimento: "2004-03-15" });
    if (r.body?.id) ids.estudantes.push(r.body.id);
    const e = r.body;
    checar("Cria estudante com todos os campos novos", r.status === 201, `[${r.status}] ${r.body?.erro ?? ""}`);
    checar("Turno de estudo EAD", e?.turno_estudo === "EAD");
    checar("Disponibilidade sem repetição e na ordem Manhã/Tarde/Noite",
      JSON.stringify(e?.disponibilidade) === JSON.stringify(["MANHA", "NOITE"]), JSON.stringify(e?.disponibilidade));
    checar("Semestre 5", e?.semestre_atual === 5);
    checar("Previsão de formatura = 1º dia do mês", dia(e?.previsao_formatura) === "2027-06-01", e?.previsao_formatura);
    checar("Data de nascimento", dia(e?.data_nascimento) === "2004-03-15", e?.data_nascimento);
    checar("Horário antigo fica vazio quando não é enviado", e?.horario_estudo === null, `${e?.horario_estudo}`);

    r = await req("POST", "/candidatos", { ...estudante, horario_estudo: "TARDE" });
    if (r.body?.id) ids.estudantes.push(r.body.id);
    checar("Compatibilidade: só o horário antigo preenche o turno de estudo",
      r.status === 201 && r.body.turno_estudo === "TARDE" && r.body.disponibilidade.length === 0,
      `[${r.status}] ${r.body?.turno_estudo}`);

    const invalidos = [
      ["turno de estudo", { turno_estudo: "MADRUGADA" }],
      ["disponibilidade com Integral", { disponibilidade: ["INTEGRAL"] }],
      ["disponibilidade que não é lista", { disponibilidade: "MANHA" }],
      ["semestre 0", { semestre_atual: 0 }],
      ["semestre 4.5", { semestre_atual: 4.5 }],
      ["formatura 2027-13", { previsao_formatura: "2027-13" }],
      ["formatura com dia", { previsao_formatura: "2027-06-10" }],
      ["nascimento 31/02", { data_nascimento: "2004-02-31" }],
      ["nascimento no futuro", { data_nascimento: "2999-01-01" }],
      ["horário antigo inválido", { horario_estudo: "EAD" }],
    ];
    for (const [nome, campos] of invalidos) {
      r = await req("POST", "/candidatos", { ...estudante, ...campos });
      if (r.body?.id) ids.estudantes.push(r.body.id);
      checar(`Recusa ${nome} → 400`, r.status === 400, `[${r.status}] ${r.body?.erro}`);
    }

    const edicao = { nome_completo: e.nome_completo, telefone: e.telefone, curso: e.curso, instituicao_ensino: e.instituicao_ensino };
    r = await req("PUT", `/candidatos/${e.id}`, { ...edicao, semestre_atual: "6" });
    checar("Editar sem mandar os outros campos não apaga nada",
      r.body?.semestre_atual === 6 && r.body?.turno_estudo === "EAD" && r.body?.disponibilidade.length === 2
        && dia(r.body?.data_nascimento) === "2004-03-15", JSON.stringify(r.body));
    r = await req("PUT", `/candidatos/${e.id}`, { ...edicao, turno_estudo: "", disponibilidade: [], semestre_atual: "",
      previsao_formatura: "", data_nascimento: null });
    checar("Valores vazios apagam todos os campos novos",
      r.body?.turno_estudo === null && r.body?.disponibilidade.length === 0 && r.body?.semestre_atual === null
        && r.body?.previsao_formatura === null && r.body?.data_nascimento === null, JSON.stringify(r.body));

    console.log("\n== Observação da candidatura");
    const aplicacao = e.aplicacoes[0];
    const url = `/candidatos/${e.id}/candidaturas/${aplicacao.id}/observacao`;
    r = await req("PUT", url, { observacao: "  Prefere estágio no centro.  " });
    checar("Salva a observação (sem os espaços extras)", r.status === 200 && r.body.observacao === "Prefere estágio no centro.",
      `[${r.status}] ${r.body?.observacao ?? r.body?.erro}`);
    r = await req("GET", `/vagas/${vaga.id}/candidatos`);
    checar("Kanban da vaga traz a observação", r.body.find((a) => a.id === aplicacao.id)?.observacao === "Prefere estágio no centro.");
    r = await req("GET", "/candidatos");
    checar("Lista de estudantes traz a observação nas candidaturas",
      r.body.find((x) => x.id === e.id)?.aplicacoes[0]?.observacao === "Prefere estágio no centro.");
    r = await req("PUT", url, { observacao: "x".repeat(1001) });
    checar("Observação com mais de 1000 caracteres → 400", r.status === 400, `[${r.status}] ${r.body?.erro}`);
    r = await req("PUT", url, {});
    checar("Sem o campo observação → 400", r.status === 400, `[${r.status}] ${r.body?.erro}`);
    r = await req("PUT", `/candidatos/${e.id}/candidaturas/${UUID_INEXISTENTE}/observacao`, { observacao: "x" });
    checar("Candidatura de outro estudante/inexistente → 404", r.status === 404, `[${r.status}]`);
    r = await req("PUT", `/candidatos/${e.id}/candidaturas/abc/observacao`, { observacao: "x" });
    checar("ID inválido → 400", r.status === 400, `[${r.status}]`);

    r = await req("PATCH", `/candidatos/${e.id}`, { aplicacao_id: aplicacao.id, status_kanban: "RECUSADO" });
    checar("Dispensar continua exigindo o motivo, mesmo com observação", r.status === 400, `[${r.status}] ${r.body?.erro}`);
    r = await req("PATCH", `/candidatos/${e.id}`, { aplicacao_id: aplicacao.id, status_kanban: "RECUSADO", motivo_recusa: "Teste" });
    const depois = await prisma.aplicacao.findUnique({ where: { id: aplicacao.id } });
    checar("Mudar de etapa mantém a observação", r.status === 200 && depois.observacao === "Prefere estágio no centro.",
      `${depois?.observacao}`);
    r = await req("PUT", url, { observacao: "" });
    checar("Observação vazia apaga", r.status === 200 && r.body.observacao === null, `${r.body?.observacao}`);
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
