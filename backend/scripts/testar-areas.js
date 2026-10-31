// Testes das áreas de curso/vaga e das vagas compatíveis (src/areas.js, src/compatibilidade.js,
// GET /candidatos/:id/vagas-compativeis, GET /vagas, GET /vagas/areas, POST /vagas/area-detectada, area_manual).
// Sobe a API na porta 3397, cria registros "[TESTE]" e remove tudo no final.
// ATENÇÃO: grava e apaga dados no banco do DATABASE_URL (só os registros que o próprio teste cria).
const path = require("path");
const { spawn } = require("child_process");

const BACKEND = path.resolve(__dirname, "..");
process.chdir(BACKEND);
require("dotenv").config();
const prisma = require("../src/prisma");
const { criarTeste } = require("./lib/teste");
const { areaDoCurso, areaDaVaga } = require("../src/compatibilidade");
const { AREAS } = require("../src/areas");

const PORT = 3397;
const UUID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";
const ids = { empresa: null, vagas: [], estudantes: [] };
const teste = criarTeste(PORT);
const { req, checar, checarStatus, esperarServidor } = teste;

async function criarVaga(titulo, extras = {}) {
  const r = await req("POST", "/vagas", { codigo_vaga: String(900000 + Math.floor(Math.random() * 99999)), titulo,
    descricao: "Teste", valor: 1000, empresa_id: ids.empresa, ...extras });
  if (r.status !== 201) throw new Error(`Vaga "${titulo}" não foi criada: [${r.status}] ${r.body?.erro ?? ""}`);
  ids.vagas.push(r.body.id);
  return r.body;
}

async function criarEstudante(curso, extras = {}) {
  const r = await req("POST", "/candidatos", { nome_completo: `[TESTE] Estudante ${curso}`, telefone: teste.telefone(), curso, ...extras });
  if (r.status !== 201) throw new Error(`Estudante "${curso}" não foi criado: [${r.status}] ${r.body?.erro ?? ""}`);
  ids.estudantes.push(r.body.id);
  return r.body;
}

const idsDe = (lista) => new Set(lista.map((item) => item.vaga.id));

function testarDicionario() {
  console.log("\n== Dicionário (sem banco)");
  const curso = (nome) => areaDoCurso(nome)?.id ?? null;
  checar("Curso sem diferenciar maiúsculas, acentos e espaços", curso("  ENGENHARIA   de software ") === "tecnologia"
    && curso("Análise e Desenvolvimento de Sistemas") === "tecnologia" && curso("analise e desenvolvimento de sistemas") === "tecnologia");
  checar("Abreviações de curso (ADS, ADM, RH)", curso("ADS") === "tecnologia" && curso("ADM") === "administracao" && curso("Gestão de RH") === "rh");
  checar("Curso específico vence o genérico (Técnico em Enfermagem → Saúde; Técnico em Informática → Tecnologia)",
    curso("Técnico em Enfermagem") === "saude" && curso("Técnico em Informática") === "tecnologia" && curso("Ensino Médio") === "ensino_medio");
  checar("Curso sem área conhecida → null", curso("Engenharia") === null && curso("") === null);

  const vaga = (titulo, descricao = "", setor = null) => areaDaVaga({ titulo, descricao, empresa: { setor } }).areas.map((area) => area.id);
  checar("Palavra inteira: \"ti\" não acha \"time\"", vaga("Estágio", "Trabalho em time, tipo presencial").length === 0);
  checar("\"Tem direito a vale\" e \"plano de saúde\" não definem área", vaga("Estágio", "Tem direito a vale-transporte e plano de saúde").length === 0);
  checar("\"Arquitetura de software\" não é Arquitetura", !vaga("Estágio", "Arquitetura de software e testes").includes("design"));
  checar("\"Direito administrativo\" é Jurídico, não Administrativo", vaga("Estágio em Direito Administrativo").join() === "juridico");
  checar("Uma palavra só na descrição não basta", vaga("Estágio", "Suporte técnico").length === 0);
  checar("Descrição + setor da empresa identificam", vaga("Estágio", "Suporte técnico", "Tecnologia").join() === "tecnologia");
  checar("Título pesa mais que a descrição", vaga("Estágio em Direito", "Apoio no atendimento ao público").join() === "juridico");
  checar("Mais de uma área quando o título cita as duas", vaga("Auxiliar administrativo financeiro").sort().join() === "atendimento,contabil");
  const motivo = areaDaVaga({ titulo: "Tecnologia GND", descricao: "" }).areas[0]?.motivo;
  checar("Motivo diz por onde a área foi identificada", motivo === "Área Tecnologia, identificada pelo título", motivo);

  const correlatas = (id) => new Set(AREAS.flatMap((area) => (area.id === id ? area.correlatas : area.correlatas.includes(id) ? [area.id] : [])));
  checar("Tecnologia não se relaciona com Jurídico nem com Saúde", !correlatas("tecnologia").has("juridico") && !correlatas("tecnologia").has("saude"));
  checar("Administração ↔ Contábil ↔ RH ↔ Logística; Produção ↔ Administração; Marketing ↔ Design",
    ["contabil", "rh", "logistica", "engenharia_producao"].every((id) => correlatas("administracao").has(id)) && correlatas("marketing").has("design"));
  const todos = AREAS.map((area) => area.id);
  checar("Ids de área únicos e correlatas existentes", new Set(todos).size === todos.length
    && AREAS.every((area) => area.correlatas.every((id) => todos.includes(id))));
}

async function main() {
  testarDicionario();
  const server = spawn(process.execPath, ["server.js"], { env: { ...process.env, PORT }, stdio: "ignore" });
  try {
    await esperarServidor();

    console.log("\n== Preparação (registros [TESTE])");
    const empresa = await req("POST", "/empresas", { nome: "[TESTE] Empresa Áreas", setor: null, nome_contato: "Teste",
      telefone_contato: "000", email_contato: "teste@teste.com" });
    ids.empresa = empresa.body.id;
    const direito = await criarVaga("[TESTE] Estágio em Direito");
    const recepcao = await criarVaga("[TESTE] Recepção");
    const tecnologia = await criarVaga("[TESTE] Tecnologia GND");
    const administracao = await criarVaga("[TESTE] Administração - Caiena");
    const contabeis = await criarVaga("[TESTE] Estágio em Ciências Contábeis");
    const manha = await criarVaga("[TESTE] Desenvolvedor Web", { turno: "MANHA" });
    const software = await criarEstudante("Engenharia de Software", { turno_estudo: "MANHA" });
    const adm = await criarEstudante("Administração");
    console.log("ok: 6 vagas e 2 estudantes");

    console.log("\n== Área manual (area_manual)");
    let r = await req("POST", "/vagas", { codigo_vaga: "999999", titulo: "[TESTE] X", descricao: "Teste", valor: 1, empresa_id: ids.empresa,
      area_manual: "astronomia" });
    checarStatus("Área manual inexistente → 400", r, 400);
    if (r.status === 201) ids.vagas.push(r.body.id);
    const manual = await criarVaga("[TESTE] Recepção (área corrigida)", { area_manual: "tecnologia" });
    checar("Vaga criada com area_manual", manual.area_manual === "tecnologia");

    console.log("\n== Engenharia de Software");
    r = await req("GET", `/candidatos/${software.id}/vagas-compativeis`);
    checar("Resposta com área do curso", r.status === 200 && r.body.area_curso?.id === "tecnologia", `[${r.status}]`);
    let compativeis = idsDe(r.body.compativeis);
    checar("× \"Estágio em Direito\" → não aparece", !compativeis.has(direito.id));
    checar("× \"Recepção\" → não aparece", !compativeis.has(recepcao.id));
    checar("× \"Tecnologia GND\" → aparece", compativeis.has(tecnologia.id));
    checar("× \"Administração - Caiena\" → não aparece", !compativeis.has(administracao.id));
    const tec = r.body.compativeis.find((item) => item.vaga.id === tecnologia.id);
    checar("Selo \"Curso\" com o motivo", tec?.tipo === "curso" && tec.motivo === "Área Tecnologia, identificada pelo título", tec?.motivo);
    checar("Área manual sobrepõe a detectada (Recepção corrigida para Tecnologia aparece)", compativeis.has(manual.id)
      && r.body.compativeis.find((item) => item.vaga.id === manual.id)?.motivo === "Área Tecnologia, definida manualmente pelo RH");
    checar("Vaga de manhã não aparece para quem estuda de manhã", !compativeis.has(manha.id)
      && r.body.outras.find((item) => item.vaga.id === manha.id)?.motivo === "Choca com o turno em que o estudante estuda");
    const foraDireito = r.body.outras.find((item) => item.vaga.id === direito.id);
    checar("As outras vagas vêm em \"outras\", com o motivo", foraDireito?.motivo === "Área diferente do curso", foraDireito?.motivo);
    const semAreaAntes = r.body.sem_area;

    console.log("\n== Administração");
    r = await req("GET", `/candidatos/${adm.id}/vagas-compativeis`);
    const doAdm = (vaga) => r.body.compativeis.find((item) => item.vaga.id === vaga.id);
    checar("× vaga de Contábeis → aparece como correlato", doAdm(contabeis)?.tipo === "correlato"
      && doAdm(contabeis).motivo === "Área Contábil e Financeiro, identificada pelo título; correlata a Administração e Gestão", doAdm(contabeis)?.motivo);
    checar("× \"Administração - Caiena\" → aparece como curso", doAdm(administracao)?.tipo === "curso");
    checar("× \"Estágio em Direito\" → não aparece", !doAdm(direito));
    checar("Mesma área antes das correlatas", r.body.compativeis[0]?.tipo === "curso");

    console.log("\n== Vaga sem área identificada");
    const generica = await criarVaga("[TESTE] Estágio", { descricao: "Vaga de estágio. Tem direito a vale-transporte." });
    r = await req("GET", `/candidatos/${software.id}/vagas-compativeis`);
    checar("Não aparece como compatível", !idsDe(r.body.compativeis).has(generica.id));
    checar("Entra no aviso (sem_area + 1)", r.body.sem_area === semAreaAntes + 1, `${semAreaAntes} → ${r.body.sem_area}`);
    checar("Fica em \"outras\" como \"Área não identificada\"",
      r.body.outras.find((item) => item.vaga.id === generica.id)?.motivo === "Área não identificada");

    console.log("\n== GET /vagas, áreas e detecção para o formulário");
    r = await req("GET", "/vagas");
    const lista = new Map(r.body.map((vaga) => [vaga.id, vaga]));
    checar("Cada vaga traz a área detectada", lista.get(direito.id)?.area?.areas?.[0]?.id === "juridico"
      && lista.get(generica.id)?.area?.areas?.length === 0);
    checar("Área manual: vale a manual e a detectada continua visível", lista.get(manual.id)?.area?.manual === "tecnologia"
      && lista.get(manual.id).area.areas[0].id === "tecnologia" && lista.get(manual.id).area.detectadas[0]?.id === "atendimento");
    r = await req("GET", "/vagas/areas");
    checar("GET /vagas/areas lista as áreas", r.status === 200 && r.body.some((area) => area.id === "tecnologia" && area.nome === "Tecnologia"));
    r = await req("POST", "/vagas/area-detectada", { titulo: "Estágio em Direito", descricao: "" });
    checar("POST /vagas/area-detectada detecta sem gravar", r.status === 200 && r.body.detectadas?.[0]?.id === "juridico");
    r = await req("POST", "/vagas/area-detectada", { titulo: 123 });
    checarStatus("Título que não é texto → 400", r, 400);

    console.log("\n== Corrigir e desfazer a área manual (PUT)");
    const dadosVaga = { codigo_vaga: generica.codigo_vaga, titulo: generica.titulo, descricao: generica.descricao, valor: 1000, empresa_id: ids.empresa };
    r = await req("PUT", `/vagas/${generica.id}`, { ...dadosVaga, area_manual: "tecnologia" });
    checar("PUT grava a área manual", r.status === 200 && r.body.area_manual === "tecnologia", `[${r.status}]`);
    r = await req("GET", `/candidatos/${software.id}/vagas-compativeis`);
    checar("Com a área corrigida, a vaga passa a aparecer", idsDe(r.body.compativeis).has(generica.id));
    r = await req("PUT", `/vagas/${generica.id}`, { ...dadosVaga, area_manual: null });
    checar("PUT com null apaga a área manual", r.status === 200 && r.body.area_manual === null);

    console.log("\n== Vaga em que já está inscrito e erros");
    await req("POST", `/candidatos/${software.id}/candidaturas`, { vaga_id: tecnologia.id });
    r = await req("GET", `/candidatos/${software.id}/vagas-compativeis`);
    checar("Vaga em que já está inscrito sai das duas listas", !idsDe(r.body.compativeis).has(tecnologia.id) && !idsDe(r.body.outras).has(tecnologia.id));
    r = await req("GET", `/candidatos/${UUID_INEXISTENTE}/vagas-compativeis`);
    checarStatus("Estudante inexistente → 404", r, 404);
    r = await req("GET", "/candidatos/abc/vagas-compativeis");
    checarStatus("ID inválido → 400", r, 400);
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
