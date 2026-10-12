// Testes da Parte 4 (campos novos nos cadastros): setor da empresa opcional; CEP, cidade e bairro do estudante;
// instituição NULL; horário, endereço, modalidade e preferência interna (sexo) da vaga.
// Sobe a API na porta 3386, cria registros "[TESTE]" e remove tudo no final.
// ATENÇÃO: grava e apaga dados no banco do DATABASE_URL (só os registros que o próprio teste cria).
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const BACKEND = path.resolve(__dirname, "..");
process.chdir(BACKEND);
require("dotenv").config();
const prisma = require("../src/prisma");
const { criarTeste } = require("./lib/teste");

const PORT = 3386;
const DIA = 24 * 60 * 60 * 1000;
const ids = { empresas: [], vagas: [], estudantes: [] };
const teste = criarTeste(PORT);
const { req, checar, checarStatus, esperarServidor } = teste;
const detalhe = (r) => `[${r.status}] ${r.body?.erro ?? ""}`;

const dadosEmpresa = { nome_contato: "Teste", telefone_contato: "000", email_contato: "teste@teste.com" };

async function empresa(dados) {
  const r = await req("POST", "/empresas", { nome: "[TESTE] Empresa Campos", ...dadosEmpresa, ...dados });
  if (r.body?.id) ids.empresas.push(r.body.id);
  return r;
}

async function estudante(dados) {
  const r = await req("POST", "/candidatos", { nome_completo: "[TESTE] Estudante Campos", telefone: teste.telefone(), curso: "Teste", ...dados });
  if (r.body?.id) ids.estudantes.push(r.body.id);
  return r;
}

async function codigoLivre() {
  for (;;) {
    const codigo = String(crypto.randomInt(900000) + 100000);
    if (!(await prisma.vaga.findUnique({ where: { codigo_vaga: codigo } }))) return codigo;
  }
}

const dadosVaga = async () => ({ codigo_vaga: await codigoLivre(), titulo: "[TESTE] Vaga Campos", descricao: "Teste", valor: 1000,
  empresa_id: ids.empresas[0] });

async function vaga(dados) {
  const r = await req("POST", "/vagas", { ...(await dadosVaga()), ...dados });
  if (r.body?.id) ids.vagas.push(r.body.id);
  return r;
}

async function main() {
  const server = spawn(process.execPath, ["server.js"], { env: { ...process.env, PORT }, stdio: "ignore" });
  try {
    await esperarServidor();

    console.log("\n== Empresa: setor opcional");
    let r = await empresa({ setor: "Tecnologia" });
    checar("Com setor → 201", r.status === 201 && r.body.setor === "Tecnologia", detalhe(r));
    const comSetor = r.body;
    r = await empresa({});
    checar("Sem setor → 201, setor null (não 'Nao informado')", r.status === 201 && r.body.setor === null, detalhe(r));
    r = await empresa({ setor: "   " });
    checar("Setor só com espaços → 201, null", r.status === 201 && r.body.setor === null, detalhe(r));
    r = await req("PUT", `/empresas/${comSetor.id}`, { nome: comSetor.nome, ...dadosEmpresa, setor: null });
    checar("Editar apagando o setor → 200, null", r.status === 200 && r.body.setor === null, detalhe(r));
    r = await req("PUT", `/empresas/${comSetor.id}`, { nome: comSetor.nome, ...dadosEmpresa, setor: "Saúde" });
    checar("Editar voltando o setor → 200", r.status === 200 && r.body.setor === "Saúde", detalhe(r));
    r = await req("POST", "/empresas", { ...dadosEmpresa, setor: "Teste" });
    checarStatus("Sem nome continua → 400", r, 400);

    console.log("\n== Estudante: CEP, cidade e bairro");
    r = await estudante({ cep: "30130-010", cidade: "Belo Horizonte", bairro: "Centro" });
    checar("CEP com máscara → 201, guardado só com os 8 dígitos",
      r.status === 201 && r.body.cep === "30130010" && r.body.cidade === "Belo Horizonte" && r.body.bairro === "Centro", detalhe(r));
    const comCep = r.body;
    r = await estudante({ cep: "01310100" });
    checar("CEP só com dígitos → 201", r.status === 201 && r.body.cep === "01310100" && r.body.cidade === null, detalhe(r));
    r = await estudante({});
    checar("Sem CEP, cidade e bairro → 201, tudo null",
      r.status === 201 && r.body.cep === null && r.body.cidade === null && r.body.bairro === null, detalhe(r));
    for (const invalido of ["1234", "301300100", "abcde-fgh", 12345678901]) {
      r = await estudante({ cep: invalido });
      checar(`CEP ${JSON.stringify(invalido)} → 400`, r.status === 400 && r.body.erro === "CEP inválido: use 8 dígitos.", detalhe(r));
    }
    r = await estudante({ cep: { numero: "30130010" } });
    checarStatus("CEP que não é texto → 400", r, 400);
    r = await estudante({ cidade: "x".repeat(101) });
    checarStatus("Cidade com mais de 100 caracteres → 400", r, 400);
    r = await estudante({ bairro: 123 });
    checarStatus("Bairro que não é texto → 400", r, 400);

    const edicao = { nome_completo: comCep.nome_completo, telefone: comCep.telefone, curso: "Teste" };
    r = await req("PUT", `/candidatos/${comCep.id}`, edicao);
    checar("Editar sem mandar CEP/cidade/bairro mantém os valores", r.status === 200 && r.body.cep === "30130010" && r.body.bairro === "Centro",
      detalhe(r));
    r = await req("PUT", `/candidatos/${comCep.id}`, { ...edicao, cep: "", cidade: null, bairro: "" });
    checar("Editar apagando CEP, cidade e bairro → 200, null",
      r.status === 200 && r.body.cep === null && r.body.cidade === null && r.body.bairro === null, detalhe(r));
    r = await req("PUT", `/candidatos/${comCep.id}`, { ...edicao, cep: "30140-071", cidade: " Belo Horizonte ", bairro: "Savassi" });
    checar("Editar com CEP novo → 200 (texto aparado)",
      r.status === 200 && r.body.cep === "30140071" && r.body.cidade === "Belo Horizonte" && r.body.bairro === "Savassi", detalhe(r));
    r = await req("PUT", `/candidatos/${comCep.id}`, { ...edicao, cep: "123" });
    checarStatus("Editar com CEP inválido → 400", r, 400);
    r = await req("GET", `/candidatos/${comCep.id}`);
    checar("Perfil (GET /candidatos/:id) traz CEP, cidade e bairro",
      r.body?.cep === "30140071" && r.body?.cidade === "Belo Horizonte" && r.body?.bairro === "Savassi");
    r = await req("GET", "/candidatos");
    checar("Lista (GET /candidatos) traz CEP, cidade e bairro", r.body?.some((item) => item.id === comCep.id && item.cep === "30140071"));

    console.log("\n== Estudante: instituição NULL");
    r = await estudante({ instituicao_ensino: "" });
    checar("Instituição vazia → 201, null", r.status === 201 && r.body.instituicao_ensino === null, detalhe(r));
    r = await estudante({ instituicao_ensino: "UFMG" });
    checar("Instituição preenchida → 201", r.status === 201 && r.body.instituicao_ensino === "UFMG", detalhe(r));
    const vazias = await prisma.estudante.count({ where: { instituicao_ensino: "" } });
    checar("Nenhum estudante com instituição '' no banco (migration converteu para NULL)", vazias === 0, `${vazias}`);

    console.log("\n== Vaga: horário, endereço, modalidade e preferência interna");
    r = await vaga({ turno: "MANHA", horario: "08h às 14h", cep: "30130-010", cidade: "Belo Horizonte", bairro: "Centro",
      modalidade: "HIBRIDA", sexo_preferencia: "FEMININO" });
    checar("Vaga com todos os campos novos → 201",
      r.status === 201 && r.body.turno === "MANHA" && r.body.horario === "08h às 14h" && r.body.cep === "30130010"
        && r.body.cidade === "Belo Horizonte" && r.body.bairro === "Centro" && r.body.modalidade === "HIBRIDA"
        && r.body.sexo_preferencia === "FEMININO", detalhe(r));
    const completa = r.body;
    r = await vaga({});
    checar("Vaga sem os campos novos → 201, tudo null",
      r.status === 201 && ["horario", "cep", "cidade", "bairro", "modalidade", "sexo_preferencia"].every((campo) => r.body[campo] === null),
      detalhe(r));
    for (const modalidade of ["PRESENCIAL", "HOME_OFFICE"]) {
      r = await vaga({ modalidade });
      checar(`Modalidade ${modalidade} → 201`, r.status === 201 && r.body.modalidade === modalidade, detalhe(r));
    }
    r = await vaga({ sexo_preferencia: "MASCULINO" });
    checar("Preferência MASCULINO → 201", r.status === 201 && r.body.sexo_preferencia === "MASCULINO", detalhe(r));
    for (const [nome, dados] of [
      ["Modalidade inválida", { modalidade: "REMOTO" }],
      ["Preferência inválida", { sexo_preferencia: "OUTRO" }],
      ["CEP inválido", { cep: "3013001" }],
      ["Horário com mais de 100 caracteres", { horario: "x".repeat(101) }],
      ["Turno inválido continua", { turno: "NOITE" }],
    ]) {
      r = await vaga(dados);
      checarStatus(`${nome} → 400`, r, 400);
    }

    const edicaoVaga = { codigo_vaga: completa.codigo_vaga, titulo: completa.titulo, descricao: "Teste", valor: 1000, empresa_id: ids.empresas[0] };
    r = await req("PUT", `/vagas/${completa.id}`, edicaoVaga);
    checar("Editar sem mandar os campos novos mantém os valores",
      r.status === 200 && r.body.horario === "08h às 14h" && r.body.sexo_preferencia === "FEMININO", detalhe(r));
    r = await req("PUT", `/vagas/${completa.id}`, { ...edicaoVaga, horario: "13h às 19h", modalidade: "HOME_OFFICE", sexo_preferencia: "MASCULINO",
      cep: "01310-100", cidade: "São Paulo", bairro: "Bela Vista" });
    checar("Editar trocando os campos novos → 200",
      r.status === 200 && r.body.horario === "13h às 19h" && r.body.modalidade === "HOME_OFFICE" && r.body.sexo_preferencia === "MASCULINO"
        && r.body.cep === "01310100" && r.body.cidade === "São Paulo", detalhe(r));
    r = await req("PUT", `/vagas/${completa.id}`, { ...edicaoVaga, horario: "", modalidade: null, sexo_preferencia: "", cep: null, cidade: "",
      bairro: null });
    checar("Editar apagando os campos novos → 200, null",
      r.status === 200 && ["horario", "cep", "cidade", "bairro", "modalidade", "sexo_preferencia"].every((campo) => r.body[campo] === null),
      detalhe(r));
    r = await req("PUT", `/vagas/${completa.id}`, { ...edicaoVaga, sexo_preferencia: "FEMININO", modalidade: "PRESENCIAL", horario: "08h às 14h",
      bairro: "Centro", cidade: "Belo Horizonte" });
    checarStatus("Editar de volta para FEMININO → 200", r, 200);
    r = await req("PUT", `/vagas/${completa.id}`, { ...edicaoVaga, modalidade: "QUALQUER" });
    checarStatus("Editar com modalidade inválida → 400", r, 400);

    r = await req("GET", "/vagas");
    const naLista = r.body?.find((item) => item.id === completa.id);
    checar("GET /vagas traz horário, cidade, bairro, modalidade e preferência (para o card e o CSV)",
      naLista?.horario === "08h às 14h" && naLista?.bairro === "Centro" && naLista?.cidade === "Belo Horizonte"
        && naLista?.modalidade === "PRESENCIAL" && naLista?.sexo_preferencia === "FEMININO");

    console.log("\n== Preferência interna fora do que chega ao candidato");
    r = await estudante({ vaga_id: completa.id });
    const candidato = r.body;
    await req("PATCH", `/candidatos/${candidato.id}`, { aplicacao_id: candidato.aplicacoes[0].id, status_kanban: "ENTREVISTA_AGENDADA",
      data_hora_entrevista: new Date(Date.now() + 2 * DIA).toISOString() });
    r = await req("GET", `/entrevistas?inicio=${new Date().toISOString()}&fim=${new Date(Date.now() + 7 * DIA).toISOString()}`);
    const entrevista = r.body?.find((item) => item.id === candidato.aplicacoes[0].id);
    checar("Entrevista aparece no Calendário (base da mensagem de WhatsApp)", Boolean(entrevista), detalhe(r));
    checar("…sem a preferência da empresa nos dados da vaga", entrevista && !JSON.stringify(entrevista).includes("sexo_preferencia")
      && !JSON.stringify(entrevista).includes("FEMININO"));
  } finally {
    await prisma.aplicacao.deleteMany({ where: { estudante_id: { in: ids.estudantes } } }).catch(() => {});
    await prisma.estudante.deleteMany({ where: { id: { in: ids.estudantes } } }).catch(() => {});
    await prisma.vaga.deleteMany({ where: { id: { in: ids.vagas } } }).catch(() => {});
    await prisma.empresa.deleteMany({ where: { id: { in: ids.empresas } } }).catch(() => {});
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
