// Testes dos recursos opcionais (02/11/2026): estágio pós-contratação, contatos, modelos de mensagem, configurações,
// campos novos da vaga e do estudante, sugestões,
// ordem do Kanban, arquivar, anonimizar, administração, atividades, busca, notificações, relatório e nova senha.
// Sobe a API na porta 3403, cria registros "[TESTE]" e remove tudo no final (as configurações voltam como estavam).
// ATENÇÃO: grava e apaga dados no banco do DATABASE_URL (só os registros que o próprio teste cria).
const path = require("path");
const { spawn } = require("child_process");

const BACKEND = path.resolve(__dirname, "..");
process.chdir(BACKEND);
require("dotenv").config();
const prisma = require("../src/prisma");
const { tokenSenha } = require("../src/tokens");
const { situacaoEstagio } = require("../src/estagios");
const { criarTeste } = require("./lib/teste");

const PORT = 3403;
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const ids = { empresa: null, vagas: [], estudantes: [], modelos: [] };
const teste = criarTeste(PORT);
const { req, checar, checarStatus, esperarServidor } = teste;
const dia = (offset) => new Date(Date.now() + offset * DIA).toISOString().slice(0, 10);

async function criarVaga(titulo, extra = {}) {
  const r = await req("POST", "/vagas", { codigo_vaga: String(900000 + Math.floor(Math.random() * 99999)), titulo,
    descricao: "Estágio em desenvolvimento de software com React", valor: 1200, empresa_id: ids.empresa, ...extra });
  if (r.body?.id) ids.vagas.push(r.body.id);
  return r;
}

async function estudante(nome, vagaId, extra = {}) {
  const r = await req("POST", "/candidatos", { nome_completo: `[TESTE] ${nome}`, telefone: teste.telefone(), curso: "Engenharia de Software",
    ...(vagaId && { vaga_id: vagaId }), ...extra });
  if (r.body?.id) ids.estudantes.push(r.body.id);
  return { r, id: r.body?.id, aplicacao: r.body?.aplicacoes?.[0]?.id };
}

const mover = (e, status_kanban, extra = {}) => req("PATCH", `/candidatos/${e.id}`, { aplicacao_id: e.aplicacao, status_kanban, ...extra });

async function main() {
  console.log("== Regras do estágio (sem banco)");
  const hoje = new Date(Date.UTC(2026, 10, 2));
  let s = situacaoEstagio({ data_inicio: new Date(Date.UTC(2025, 3, 1)), data_fim: new Date(Date.UTC(2026, 10, 20)), tce_assinado: true, relatorios: [{ numero: 1 }] }, hoje);
  checar("Contrato terminando em 18 dias gera alerta", s.alertas.some((a) => a.tipo === "fim_proximo"), JSON.stringify(s.alertas.map((a) => a.texto)));
  checar("Desde 01/04/2025: 3 relatórios devidos, 1 entregue → 2 pendentes", s.relatoriosDevidos === 3 && s.relatoriosPendentes.join() === "2,3", `${s.relatoriosDevidos} / ${s.relatoriosPendentes}`);
  s = situacaoEstagio({ data_inicio: new Date(Date.UTC(2024, 11, 1)), tce_assinado: false, relatorios: [] }, hoje);
  checar("Perto dos 2 anos e sem TCE: alertas de limite e TCE", s.alertas.some((a) => a.tipo === "limite_2_anos") && s.alertas.some((a) => a.tipo === "tce"));
  s = situacaoEstagio({ data_inicio: new Date(Date.UTC(2024, 11, 1)), encerrado_em: new Date(Date.UTC(2025, 0, 1)), relatorios: [] }, hoje);
  checar("Estágio encerrado não gera alertas de prazo", s.alertas.length === 0, JSON.stringify(s.alertas));
  checar("Sem dados: nenhum alerta", situacaoEstagio({ tce_assinado: false, relatorios: [] }, hoje).alertas.length === 0);

  const server = spawn(process.execPath, ["server.js"], { env: { ...process.env, PORT }, stdio: "ignore" });
  const configAntes = await prisma.configuracao.findMany();
  try {
    await esperarServidor();
    const admin = await teste.criarUsuario({ papel: "ADMIN" });
    const loginAdmin = await req("POST", "/auth/login", { email: admin.email, senha: admin.senha }, { token: null });
    const tokenAdmin = loginAdmin.body.token;
    const comoAdmin = (method, url, body) => req(method, url, body, { token: tokenAdmin });

    const empresa = await req("POST", "/empresas", { nome: "[TESTE] Empresa Recursos", setor: "Tecnologia", nome_contato: "Teste",
      telefone_contato: "000", email_contato: "teste@teste.com" });
    ids.empresa = empresa.body.id;

    console.log("\n== Vaga: quantidade, prazo e responsável (opcionais)");
    let r = await criarVaga("[TESTE] Vaga Recursos", { quantidade: 2, prazo: dia(2), responsavel_id: teste.usuario.id, turno: "TARDE", cidade: "Belo Horizonte" });
    checarStatus("Vaga com os campos novos", r, 201);
    const vaga = r.body;
    checar("Campos gravados", vaga.quantidade === 2 && vaga.prazo?.slice(0, 10) === dia(2) && vaga.responsavel_id === teste.usuario.id);
    checarStatus("Quantidade 0 → 400", await criarVaga("[TESTE] Q", { quantidade: 0 }), 400);
    checarStatus("Prazo inválido → 400", await criarVaga("[TESTE] P", { prazo: "2026-02-30" }), 400);
    checarStatus("Sem os campos novos continua funcionando", await criarVaga("[TESTE] Vaga Simples"), 201);
    r = await req("GET", "/vagas");
    checar("GET /vagas traz o responsável", r.body.find((v) => v.id === vaga.id)?.responsavel?.id === teste.usuario.id);

    console.log("\n== Estudante: etiquetas (opcional)");
    const a = await estudante("Recursos A", vaga.id, { etiquetas: [" inglês avançado ", "Inglês Avançado", "tem CNH"], turno_estudo: "MANHA", cidade: "Belo Horizonte" });
    checarStatus("Cadastro com etiquetas", a.r, 201);
    const etiquetas = (await prisma.estudante.findUnique({ where: { id: a.id } })).etiquetas;
    checar("Etiquetas limpas e sem repetição", etiquetas.join("|") === "inglês avançado|tem CNH", etiquetas.join("|"));
    checarStatus("Etiqueta longa demais → 400", (await estudante("X", null, { etiquetas: ["x".repeat(31)] })).r, 400);

    console.log("\n== Sugestões e ordem do Kanban");
    const sugerido = await estudante("Recursos Sugerido", null, { turno_estudo: "MANHA", cidade: "Belo Horizonte" });
    r = await req("GET", `/vagas/${vaga.id}/sugestoes`);
    checar("Estudante compatível fora da vaga é sugerido", r.body.sugestoes?.some((x) => x.estudante.id === sugerido.id), `[${r.status}]`);
    checar("Quem já está na vaga não é sugerido", !r.body.sugestoes?.some((x) => x.estudante.id === a.id));
    const b = await estudante("Recursos B", vaga.id);
    r = await req("PUT", `/vagas/${vaga.id}/ordem`, { ids: [b.aplicacao, a.aplicacao] });
    checarStatus("Salvar ordem", r, 204);
    r = await req("GET", `/vagas/${vaga.id}/candidatos`);
    checar("Lista do Kanban segue a ordem salva", r.body[0]?.id === b.aplicacao, r.body.map((x) => x.estudante.nome_completo).join(", "));
    checarStatus("Ordem com candidatura de outra vaga → 400", await req("PUT", `/vagas/${vaga.id}/ordem`, { ids: [ids.vagas[0]] }), 400);

    console.log("\n== Painel só para a equipe");
    for (const caminho of ["/publico/vagas", "/publico/portal/qualquer", "/publico/entrevista/qualquer"]) {
      checarStatus(`${caminho} sem login → 401`, await req("GET", caminho, undefined, { token: null }), 401);
    }
    checarStatus("Cadastro público sem login → 401", await req("POST", "/publico/candidatura", { nome_completo: "[TESTE] Fora", telefone: teste.telefone(), curso: "X", consentimento: true }, { token: null }), 401);
    checarStatus("Com login, a rota pública também não existe → 404", await req("GET", "/publico/vagas"), 404);
    checarStatus("Link para empresa não pode ser gerado → 404", await req("POST", `/vagas/${vaga.id}/portal`), 404);

    console.log("\n== Entrevista e reagendamento");
    await mover(a, "ENVIADO_EMPRESA");
    await mover(a, "ENTREVISTA_AGENDADA", { data_hora_entrevista: new Date(Date.now() + 48 * HORA).toISOString() });
    r = await req("GET", `/modelos/contexto/${a.aplicacao}`);
    checar("Contexto da mensagem sem token de link externo", r.status === 200 && !("token_confirmacao" in r.body));
    r = await req("PATCH", `/entrevistas/${a.aplicacao}`, { acao: "reagendar", data_hora_entrevista: new Date(Date.now() + 72 * HORA).toISOString() });
    checarStatus("Reagendar", r, 200);

    console.log("\n== Estágio pós-contratação");
    checarStatus("Dados de estágio para quem não foi contratado → 409", await req("PUT", `/estagios/${b.aplicacao}`, { tce_assinado: true }), 409);
    await mover(a, "APROVADO");
    r = await req("PUT", `/estagios/${a.aplicacao}`, { data_inicio: dia(-200), data_fim: dia(10), taxa_agenciamento: 350.555 });
    checar("Salvar dados do estágio", r.status === 200 && r.body.taxa_agenciamento === 350.56 && r.body.situacao.alertas.some((x) => x.tipo === "fim_proximo"), `[${r.status}] ${r.body?.erro ?? ""}`);
    checar("Relatório do 1º semestre pendente", r.body.situacao.relatoriosPendentes.includes(1));
    checarStatus("Fim antes do início → 400", await req("PUT", `/estagios/${a.aplicacao}`, { data_fim: dia(-300) }), 400);
    r = await req("POST", `/estagios/${a.aplicacao}/relatorios`, { numero: 1 });
    checar("Marcar relatório como entregue", r.status === 201 && !r.body.situacao.relatoriosPendentes.includes(1));
    r = await req("GET", "/estagios");
    checar("GET /estagios lista o contratado com os dados", r.body.find((x) => x.id === a.aplicacao)?.estagio?.data_fim?.slice(0, 10) === dia(10));
    r = await req("GET", "/notificacoes");
    checar("Notificação de contrato terminando", r.body.some((n) => n.tipo === "estagio" && n.titulo.includes("Contrato termina")));

    console.log("\n== Contatos e próximo contato");
    r = await req("POST", "/contatos", { empresa_id: ids.empresa, tipo: "LIGACAO", texto: "Falar sobre nova vaga", proximo_contato: dia(0) });
    checarStatus("Registrar contato com empresa", r, 201);
    const contato = r.body;
    checarStatus("Anotação vazia → 400", await req("POST", "/contatos", { estudante_id: a.id, tipo: "NOTA" }), 400);
    checarStatus("Sem dono → 400", await req("POST", "/contatos", { tipo: "LIGACAO" }), 400);
    r = await req("GET", "/notificacoes");
    checar("Retorno combinado para hoje vira notificação", r.body.some((n) => n.id.startsWith(`retorno-${contato.id}`)));
    await req("PATCH", `/contatos/${contato.id}`, { proximo_contato: null });
    r = await req("GET", "/notificacoes");
    checar("Marcar retorno como feito tira a notificação", !r.body.some((n) => n.id.startsWith(`retorno-${contato.id}`)));
    r = await req("GET", `/contatos?empresa_id=${ids.empresa}`);
    checar("Lista de contatos da empresa", r.body.length === 1 && r.body[0].usuario?.nome === "[TESTE] Usuário");

    console.log("\n== Modelos de mensagem");
    r = await req("POST", "/modelos", { titulo: "[TESTE] Convite", texto: "Olá {primeiro_nome}, vaga {vaga}" });
    checarStatus("Criar modelo", r, 201);
    ids.modelos.push(r.body.id);
    checarStatus("Modelo sem texto → 400", await req("POST", "/modelos", { titulo: "[TESTE] X", texto: " " }), 400);
    checarStatus("Editar modelo", await req("PUT", `/modelos/${r.body.id}`, { titulo: "[TESTE] Convite 2", texto: "Oi" }), 200);

    console.log("\n== Configurações");
    checarStatus("Recrutador não muda configurações → 403", await req("PUT", "/configuracoes", { meta_contratacoes_mensal: 7 }), 403);
    r = await comoAdmin("PUT", "/configuracoes", { meta_contratacoes_mensal: 5 });
    checar("Admin define a meta", r.status === 200 && r.body.meta_contratacoes_mensal === 5);
    checarStatus("Meta inválida → 400", await comoAdmin("PUT", "/configuracoes", { meta_contratacoes_mensal: 0 }), 400);
    checarStatus("Página pública não é mais configurável → 400", await comoAdmin("PUT", "/configuracoes", { formulario_publico_ativo: true }), 400);

    console.log("\n== Dashboard: meta");
    r = await req("GET", `/dashboard-metrics?empresa=${ids.empresa}`);
    checar("Dashboard traz a meta e as contratações do mês", r.body.meta?.mensal === 5 && r.body.meta?.contratacoesMes === 1, JSON.stringify(r.body.meta));

    console.log("\n== Arquivar, anonimizar e administração");
    r = await req("PATCH", `/vagas/${ids.vagas[1]}/arquivo`, { arquivada: true });
    checar("Arquivar vaga", r.status === 200 && r.body.arquivada_em);
    checarStatus("Desarquivar", await req("PATCH", `/vagas/${ids.vagas[1]}/arquivo`, { arquivada: false }), 200);
    checarStatus("Arquivar empresa", await req("PATCH", `/empresas/${ids.empresa}/arquivo`, { arquivada: true }), 200);
    checarStatus("Arquivar estudante", await req("PATCH", `/candidatos/${b.id}/arquivo`, { arquivado: true }), 200);
    checarStatus("Recrutador não anonimiza → 403", await req("POST", `/candidatos/${b.id}/anonimizar`), 403);
    await req("POST", "/contatos", { estudante_id: b.id, tipo: "WHATSAPP", texto: "Dado pessoal" });
    r = await comoAdmin("POST", `/candidatos/${b.id}/anonimizar`);
    const anon = await prisma.estudante.findUnique({ where: { id: b.id }, include: { aplicacoes: true } });
    checar("Admin anonimiza: dados pessoais apagados, candidatura mantida", r.status === 200 && anon.nome_completo === "Estudante anonimizado"
      && anon.telefone === "" && anon.anonimizado_em && anon.aplicacoes.length === 1);
    checar("Registros de contato do anonimizado apagados", (await prisma.contato.count({ where: { estudante_id: b.id } })) === 0);
    checarStatus("Anonimizar de novo → 409", await comoAdmin("POST", `/candidatos/${b.id}/anonimizar`), 409);
    checarStatus("Recrutador não lista usuários → 403", await req("GET", "/usuarios"), 403);
    r = await comoAdmin("GET", "/usuarios");
    checar("Admin lista usuários (sem o hash)", r.status === 200 && r.body.length > 0 && r.body.every((u) => !("senha_hash" in u)));
    checarStatus("Admin não se desativa → 409", await comoAdmin("PATCH", `/usuarios/${admin.id}`, { ativo: false }), 409);
    r = await comoAdmin("PATCH", `/usuarios/${teste.usuario.id}`, { nome: "[TESTE] Usuário" });
    checarStatus("Admin edita outro usuário", r, 200);
    checarStatus("Admin lê o registro de atividades", await comoAdmin("GET", "/atividades?limite=5"), 200);
    r = await req("GET", "/usuarios/opcoes");
    checar("Qualquer usuário vê a lista curta de usuários (para o responsável)", r.status === 200 && r.body.every((u) => Object.keys(u).join() === "id,nome"));

    console.log("\n== Busca, relatório e nova senha");
    r = await req("GET", `/busca?q=${encodeURIComponent("Recursos A")}`);
    checar("Busca acha o estudante pelo nome", r.body.estudantes.some((e) => e.id === a.id));
    r = await req("GET", `/busca?q=${vaga.codigo_vaga}`);
    checar("Busca acha a vaga pelo Nº", r.body.vagas.some((v) => v.id === vaga.id));
    r = await req("GET", `/relatorios/empresa/${ids.empresa}`);
    checar("Relatório da empresa: 1 contratação e taxa somada", r.status === 200 && r.body.totais.contratacoes === 1 && r.body.totais.taxas === 350.56,
      `[${r.status}] ${JSON.stringify(r.body.totais ?? r.body)}`);
    checarStatus("Redefinir com token inválido → 400", await req("POST", "/auth/redefinir", { token: "x", senha: "uma-senha-longa" }, { token: null }), 400);
    const usuarioTeste = await prisma.usuario.findUnique({ where: { id: teste.usuario.id } });
    const linkSenha = tokenSenha(usuarioTeste);
    checarStatus("Senha curta → 400", await req("POST", "/auth/redefinir", { token: linkSenha, senha: "curta" }, { token: null }), 400);
    checarStatus("Redefinir senha com o link", await req("POST", "/auth/redefinir", { token: linkSenha, senha: "nova-senha-de-teste-123" }, { token: null }), 200);
    checarStatus("O mesmo link não vale duas vezes", await req("POST", "/auth/redefinir", { token: linkSenha, senha: "outra-senha-de-teste-123" }, { token: null }), 400);
    checarStatus("Entra com a nova senha", await req("POST", "/auth/login", { email: teste.usuario.email, senha: "nova-senha-de-teste-123" }, { token: null }), 200);
  } finally {
    await prisma.modeloMensagem.deleteMany({ where: { id: { in: ids.modelos } } }).catch(() => {});
    await prisma.aplicacao.deleteMany({ where: { estudante_id: { in: ids.estudantes } } }).catch(() => {});
    await prisma.estudante.deleteMany({ where: { id: { in: ids.estudantes } } }).catch(() => {});
    await prisma.vaga.deleteMany({ where: { id: { in: ids.vagas } } }).catch(() => {});
    if (ids.empresa) await prisma.empresa.delete({ where: { id: ids.empresa } }).catch(() => {});
    // Configurações voltam exatamente como estavam.
    await prisma.configuracao
      .deleteMany(configAntes.length ? { where: { chave: { notIn: configAntes.map((c) => c.chave) } } } : {})
      .catch(() => {});
    for (const c of configAntes) await prisma.configuracao.update({ where: { chave: c.chave }, data: { valor: c.valor } }).catch(() => {});
    const sobras = await prisma.estudante.count({ where: { nome_completo: { startsWith: "[TESTE]" } } })
      + await prisma.vaga.count({ where: { titulo: { startsWith: "[TESTE]" } } })
      + await prisma.empresa.count({ where: { nome: { startsWith: "[TESTE]" } } })
      + await prisma.modeloMensagem.count({ where: { titulo: { startsWith: "[TESTE]" } } });
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
