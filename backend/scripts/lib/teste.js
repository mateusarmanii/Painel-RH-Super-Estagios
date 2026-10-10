// Funções comuns dos scripts de teste: chamada à API (com login), PASS/FAIL e espera da API subir.
// Uso: const teste = criarTeste(PORT); const { BASE, req, checar, esperarServidor } = teste;
// esperarServidor() também cria um usuário "[TESTE]" temporário e faz login; no finally de cada script,
// teste.removerUsuario() apaga esse usuário. teste.falhas conta os FAIL (os scripts também somam sobras nele).
const crypto = require("crypto");
const prisma = require("../../src/prisma");
const { gerarHash } = require("../../src/auth");

function criarTeste(port) {
  const BASE = `http://localhost:${port}`;
  const teste = { BASE, falhas: 0, token: null, usuario: null };

  // Cabeçalho de login para chamadas feitas com fetch direto (ex.: envio de arquivo).
  teste.cabecalhos = (token = teste.token) => (token ? { Authorization: `Bearer ${token}` } : {});

  // Chama a API com corpo em JSON (se houver) e devolve { status, body }.
  // Por padrão envia o token do usuário de teste; { token: null } chama sem login, { token: "x" } usa outro token.
  teste.req = async function req(method, url, body, { token = teste.token } = {}) {
    const res = await fetch(BASE + url, {
      method,
      headers: { "Content-Type": "application/json", ...teste.cabecalhos(token) },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
  };

  teste.checar = function checar(nome, condicao, detalhe = "") {
    if (!condicao) teste.falhas++;
    console.log(`${condicao ? "PASS" : "FAIL"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  };

  // Variante que compara o status HTTP e mostra a mensagem de erro da API.
  teste.checarStatus = function checarStatus(nome, r, esperado) {
    const ok = r.status === esperado;
    if (!ok) teste.falhas++;
    const msg = r.body?.erro ? ` — "${r.body.erro}"` : "";
    console.log(`${ok ? "PASS" : "FAIL"} [${r.status}] ${nome}${msg}`);
  };

  // Cria um usuário [TESTE] direto no banco (e-mail único por execução) e devolve { id, email, senha }.
  teste.criarUsuario = async function criarUsuario({ papel = "RECRUTADOR", ativo = true } = {}) {
    const email = `teste-${port}-${crypto.randomUUID()}@teste.local`;
    const senha = crypto.randomBytes(18).toString("base64url");
    const usuario = await prisma.usuario.create({
      data: { nome: "[TESTE] Usuário", email, senha_hash: await gerarHash(senha), papel, ativo },
      select: { id: true, email: true },
    });
    return { ...usuario, senha };
  };

  teste.esperarServidor = async function esperarServidor() {
    let subiu = false;
    for (let i = 0; i < 50 && !subiu; i++) {
      try { await fetch(BASE + "/"); subiu = true; } catch { await new Promise((r) => setTimeout(r, 200)); }
    }
    if (!subiu) throw new Error("API não subiu");

    teste.usuario = await teste.criarUsuario();
    const r = await teste.req("POST", "/auth/login", { email: teste.usuario.email, senha: teste.usuario.senha }, { token: null });
    if (r.status !== 200 || !r.body?.token) throw new Error(`Login de teste falhou: [${r.status}] ${r.body?.erro ?? ""}`);
    teste.token = r.body.token;
  };

  // Apaga os usuários [TESTE] criados por este script (os e-mails levam a porta, então não esbarra em outro teste).
  teste.removerUsuario = () => prisma.usuario.deleteMany({ where: { email: { startsWith: `teste-${port}-`, endsWith: "@teste.local" } } });

  return teste;
}

module.exports = { criarTeste };
