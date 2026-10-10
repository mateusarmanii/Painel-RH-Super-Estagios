// Testes do login: POST /auth/login, token JWT (inválido, expirado, outro segredo, "alg none"), rotas sem token,
// usuário inativo, logos públicas, CORS (desenvolvimento e produção) e limite de tentativas.
// Sobe a API nas portas 3391 e 3390 (modo produção), cria usuários "[TESTE]" e remove tudo no final.
// ATENÇÃO: grava e apaga dados no banco do DATABASE_URL (só os registros que o próprio teste cria).
const path = require("path");
const { spawn } = require("child_process");

const BACKEND = path.resolve(__dirname, "..");
process.chdir(BACKEND);
require("dotenv").config();
const jwt = require("jsonwebtoken");
const prisma = require("../src/prisma");
const { criarTeste } = require("./lib/teste");

const PORT = 3391;
const PORT_PRODUCAO = 3390;
const FRONTEND = "https://painel.exemplo.com";
const teste = criarTeste(PORT);
const { BASE, req, checar, esperarServidor } = teste;
const producao = criarTeste(PORT_PRODUCAO);

const base64url = (objeto) => Buffer.from(JSON.stringify(objeto)).toString("base64url");
const login = (email, senha) => req("POST", "/auth/login", { email, senha }, { token: null });
const origemLiberada = async (base, origem) => {
  const res = await fetch(`${base}/`, { headers: { Origin: origem } });
  return res.headers.get("access-control-allow-origin") === origem;
};

async function main() {
  const iniciar = (port, env) => spawn(process.execPath, ["server.js"], { env: { ...process.env, PORT: port, FRONTEND_URL: FRONTEND, ...env }, stdio: "ignore" });
  const server = iniciar(PORT, { NODE_ENV: "development" });
  const serverProducao = iniciar(PORT_PRODUCAO, { NODE_ENV: "production" });
  try {
    await esperarServidor();
    await producao.esperarServidor();
    const { id, email, senha } = teste.usuario;

    console.log("\n== Rotas sem token");
    checar("GET / continua público (200)", (await req("GET", "/", undefined, { token: null })).status === 200);
    for (const [method, url] of [["GET", "/vagas"], ["GET", "/candidatos"], ["GET", "/dashboard-metrics"], ["GET", "/entrevistas"],
      ["GET", "/auth/me"], ["POST", "/empresas"], ["DELETE", "/vagas/00000000-0000-4000-8000-000000000000"]]) {
      const r = await req(method, url, method === "POST" ? { nome: "[TESTE] Não deve ser criada" } : undefined, { token: null });
      checar(`${method} ${url} sem token → 401`, r.status === 401, `[${r.status}]`);
    }
    checar("POST sem token não criou nada", await prisma.empresa.count({ where: { nome: "[TESTE] Não deve ser criada" } }) === 0);
    const logo = await fetch(`${BASE}/uploads/logos/00000000-0000-4000-8000-000000000000.png`);
    checar("Logos são públicas: arquivo inexistente → 404 (não 401)", logo.status === 404, `[${logo.status}]`);

    console.log("\n== Token inválido");
    const segredo = process.env.JWT_SECRET;
    const agora = Math.floor(Date.now() / 1000);
    const tokens = {
      "texto qualquer": "abc.def.ghi",
      "assinado com outro segredo": jwt.sign({ papel: "ADMIN" }, "outro-segredo-qualquer-com-mais-de-32-caracteres", { subject: id, expiresIn: "8h" }),
      "expirado": jwt.sign({ papel: "RECRUTADOR", exp: agora - 60 }, segredo, { subject: id }),
      "sem assinatura (alg none)": `${base64url({ alg: "none", typ: "JWT" })}.${base64url({ sub: id, papel: "ADMIN", exp: agora + 3600 })}.`,
      "de usuário que não existe": jwt.sign({ papel: "ADMIN" }, segredo, { subject: "00000000-0000-4000-8000-000000000000", expiresIn: "8h" }),
    };
    for (const [nome, token] of Object.entries(tokens)) {
      const r = await req("GET", "/vagas", undefined, { token });
      checar(`Token ${nome} → 401`, r.status === 401, `[${r.status}]`);
    }
    const basic = await fetch(`${BASE}/vagas`, { headers: { Authorization: `Basic ${teste.token}` } });
    checar("Token sem o prefixo Bearer → 401", basic.status === 401, `[${basic.status}]`);

    console.log("\n== Login");
    let r = await login(email, senha);
    checar("Login certo → 200 com token", r.status === 200 && typeof r.body?.token === "string", `[${r.status}]`);
    checar("Resposta traz nome, e-mail e papel, sem o hash da senha",
      r.body?.usuario?.email === email && r.body?.usuario?.papel === "RECRUTADOR" && !("senha_hash" in (r.body?.usuario ?? {})));
    const dados = jwt.decode(r.body?.token);
    checar("Token vale 8 horas", dados && dados.exp - dados.iat === 8 * 60 * 60, `${dados?.exp - dados?.iat}s`);
    checar("Token do login acessa GET /vagas (200)", (await req("GET", "/vagas", undefined, { token: r.body?.token })).status === 200);
    r = await req("GET", "/auth/me");
    checar("GET /auth/me → usuário logado", r.status === 200 && r.body?.id === id && !("senha_hash" in (r.body ?? {})), `[${r.status}]`);
    r = await login(email.toUpperCase(), senha);
    checar("E-mail em maiúsculas também entra", r.status === 200, `[${r.status}]`);

    r = await login(email, `${senha}x`);
    checar("Senha errada → 401", r.status === 401 && r.body?.erro === "E-mail ou senha incorretos.", `[${r.status}] ${r.body?.erro}`);
    const senhaErrada = r.body?.erro;
    r = await login("ninguem-aqui@teste.local", senha);
    checar("E-mail inexistente → 401 com a mesma mensagem", r.status === 401 && r.body?.erro === senhaErrada, `[${r.status}]`);
    r = await login(email, "");
    checar("Sem senha → 400", r.status === 400, `[${r.status}]`);

    console.log("\n== Usuário desativado");
    const inativo = await teste.criarUsuario();
    const tokenAntes = (await login(inativo.email, inativo.senha)).body?.token;
    await prisma.usuario.update({ where: { id: inativo.id }, data: { ativo: false } });
    r = await login(inativo.email, inativo.senha);
    checar("Usuário inativo não entra (401, mesma mensagem)", r.status === 401 && r.body?.erro === senhaErrada, `[${r.status}]`);
    r = await req("GET", "/vagas", undefined, { token: tokenAntes });
    checar("Token emitido antes de desativar deixa de valer (401)", r.status === 401, `[${r.status}]`);

    console.log("\n== CORS");
    checar("Desenvolvimento: FRONTEND_URL liberado", await origemLiberada(BASE, FRONTEND));
    checar("Desenvolvimento: localhost liberado", await origemLiberada(BASE, "http://localhost:5173"));
    checar("Desenvolvimento: outro site bloqueado", !(await origemLiberada(BASE, "https://site-malicioso.com")));
    checar("Produção: FRONTEND_URL liberado", await origemLiberada(producao.BASE, FRONTEND));
    checar("Produção: localhost bloqueado", !(await origemLiberada(producao.BASE, "http://localhost:5173")));
    checar("Produção: outro site bloqueado", !(await origemLiberada(producao.BASE, "https://site-malicioso.com")));

    console.log("\n== Limite de tentativas (8 erros por e-mail em 15 min)");
    const alvo = await teste.criarUsuario();
    const status = [];
    for (let i = 0; i < 8; i++) status.push((await login(alvo.email, "senha-errada-123")).status);
    checar("8 senhas erradas → 401", status.every((s) => s === 401), status.join(","));
    r = await login(alvo.email, alvo.senha);
    checar("9ª tentativa bloqueada (429), mesmo com a senha certa", r.status === 429, `[${r.status}] ${r.body?.erro ?? ""}`);
    r = await login(email, senha);
    checar("Outro e-mail do mesmo IP continua entrando", r.status === 200, `[${r.status}]`);
  } finally {
    await teste.removerUsuario().catch(() => {});
    await producao.removerUsuario().catch(() => {});
    await prisma.empresa.deleteMany({ where: { nome: "[TESTE] Não deve ser criada" } }).catch(() => {});
    const sobras = await prisma.usuario.count({ where: { email: { endsWith: "@teste.local" } } });
    console.log(`\nUsuários [TESTE] restantes: ${sobras}`);
    if (sobras) teste.falhas++;
    await prisma.$disconnect();
    server.kill();
    serverProducao.kill();
  }
  const falhas = teste.falhas + producao.falhas;
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
  process.exitCode = falhas ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
