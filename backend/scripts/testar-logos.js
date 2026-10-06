// Testes da logo da empresa: envio, troca e remoção; recusa de SVG, de formato falso e de arquivo acima de 2 MB;
// arquivo servido como imagem; arquivos antigos apagados. Sobe a API na porta 3395, cria registros "[TESTE]"
// e remove tudo no final (inclusive os arquivos de logo criados).
// ATENÇÃO: grava e apaga dados no banco do DATABASE_URL (só os registros que o próprio teste cria).
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const BACKEND = path.resolve(__dirname, "..");
process.chdir(BACKEND);
require("dotenv").config();
const prisma = require("../src/prisma");
const { PASTA_LOGOS } = require("../src/logos");

const PORT = 3395;
const BASE = `http://localhost:${PORT}`;
const UUID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";
const ids = { empresas: [] };
let falhas = 0;

// Imagens 1x1 de verdade.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const JPG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/" +
    "yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=",
  "base64",
);
const WEBP = Buffer.from("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "base64");
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

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

async function enviarLogo(empresaId, buffer, nome, tipo) {
  const form = new FormData();
  form.append("logo", new Blob([buffer], { type: tipo }), nome);
  const res = await fetch(`${BASE}/empresas/${empresaId}/logo`, { method: "POST", body: form });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function json(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const arquivoDe = (logoUrl) => path.join(PASTA_LOGOS, path.basename(logoUrl ?? "nada"));
const arquivosNaPasta = () => fs.readdirSync(PASTA_LOGOS).length;

async function criarEmpresa(nome) {
  const r = await json("POST", "/empresas", { nome, setor: "Teste", nome_contato: "Teste", telefone_contato: "000",
    email_contato: "teste@teste.com" });
  ids.empresas.push(r.body.id);
  return r.body;
}

async function main() {
  const server = spawn(process.execPath, ["server.js"], { env: { ...process.env, PORT }, stdio: "ignore" });
  const arquivosAntes = arquivosNaPasta();
  try {
    await esperarServidor();

    console.log("\n== Preparação (registros [TESTE])");
    const empresa = await criarEmpresa("[TESTE] Empresa Logo");
    checar("Empresa nova começa sem logo", empresa.logo_url === null);

    console.log("\n== Envio");
    let r = await enviarLogo(empresa.id, PNG, "logo.png", "image/png");
    const logoPng = r.body?.logo_url;
    checar("PNG aceito → 200 com logo_url única", r.status === 200 && /^\/uploads\/logos\/[0-9a-f-]{36}\.png$/.test(logoPng ?? ""),
      `[${r.status}] ${logoPng ?? r.body?.erro}`);
    checar("Arquivo gravado em backend/uploads/logos", fs.existsSync(arquivoDe(logoPng)));
    let arquivo = await fetch(BASE + logoPng);
    checar("Logo servida como imagem", arquivo.status === 200 && arquivo.headers.get("content-type") === "image/png",
      `[${arquivo.status}] ${arquivo.headers.get("content-type")}`);
    checar("Resposta com nosniff", arquivo.headers.get("x-content-type-options") === "nosniff");
    r = await json("GET", "/empresas");
    checar("GET /empresas traz a logo_url", r.body.find((e) => e.id === empresa.id)?.logo_url === logoPng);

    console.log("\n== Troca");
    r = await enviarLogo(empresa.id, JPG, "foto.jpeg", "image/jpeg");
    const logoJpg = r.body?.logo_url;
    checar("JPG aceito e substitui a anterior", r.status === 200 && logoJpg?.endsWith(".jpg") && logoJpg !== logoPng,
      `[${r.status}] ${logoJpg ?? r.body?.erro}`);
    checar("Arquivo da logo anterior foi apagado", !fs.existsSync(arquivoDe(logoPng)));
    arquivo = await fetch(BASE + logoPng);
    checar("Logo anterior não é mais servida (404)", arquivo.status === 404, `[${arquivo.status}]`);
    r = await enviarLogo(empresa.id, WEBP, "logo.webp", "image/webp");
    const logoWebp = r.body?.logo_url;
    checar("WEBP aceito", r.status === 200 && logoWebp?.endsWith(".webp"), `[${r.status}] ${logoWebp ?? r.body?.erro}`);

    console.log("\n== Recusas (a logo atual continua)");
    const recusas = [
      ["SVG → 415", SVG, "logo.svg", "image/svg+xml", 415],
      ["Texto com nome .png e tipo image/png (formato falso) → 415", Buffer.from("não sou uma imagem"), "logo.png", "image/png", 415],
      ["GIF → 415", Buffer.from("GIF89a\x01\x00\x01\x00\x00\x00\x00;", "latin1"), "logo.gif", "image/gif", 415],
      ["Arquivo com 2 MB + 1 byte → 413", Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024 + 1 - PNG.length)]), "grande.png", "image/png", 413],
    ];
    for (const [nome, buffer, arquivoNome, tipo, esperado] of recusas) {
      r = await enviarLogo(empresa.id, buffer, arquivoNome, tipo);
      checar(nome, r.status === esperado, `[${r.status}] ${r.body?.erro}`);
    }
    r = await enviarLogo(empresa.id, Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024 - PNG.length)]), "limite.png", "image/png");
    checar("Arquivo com exatamente 2 MB é aceito", r.status === 200, `[${r.status}] ${r.body?.erro}`);
    const logoLimite = r.body?.logo_url;
    r = await json("GET", "/empresas");
    checar("Depois das recusas, a empresa tem só a última logo aceita", r.body.find((e) => e.id === empresa.id)?.logo_url === logoLimite);
    checar("Recusas não deixaram arquivos na pasta (só 1 logo desta empresa)", arquivosNaPasta() === arquivosAntes + 1,
      `${arquivosNaPasta() - arquivosAntes} arquivo(s) novo(s)`);

    const form = new FormData();
    let res = await fetch(`${BASE}/empresas/${empresa.id}/logo`, { method: "POST", body: form });
    checar("Sem arquivo → 400", res.status === 400, `[${res.status}]`);
    r = await enviarLogo(UUID_INEXISTENTE, PNG, "logo.png", "image/png");
    checar("Empresa inexistente → 404", r.status === 404, `[${r.status}]`);
    r = await enviarLogo("abc", PNG, "logo.png", "image/png");
    checar("ID inválido → 400", r.status === 400, `[${r.status}]`);
    res = await fetch(`${BASE}/uploads/logos/..%2fserver.js`);
    checar("Não dá para sair da pasta de logos pela URL", res.status === 404 || res.status === 403, `[${res.status}]`);

    console.log("\n== Remoção");
    r = await json("DELETE", `/empresas/${empresa.id}/logo`);
    checar("DELETE da logo → logo_url vazia", r.status === 200 && r.body.logo_url === null, `[${r.status}]`);
    checar("Arquivo apagado ao remover a logo", !fs.existsSync(arquivoDe(logoLimite)));
    r = await json("DELETE", `/empresas/${empresa.id}/logo`);
    checar("Remover de novo (já sem logo) não dá erro", r.status === 200, `[${r.status}]`);

    console.log("\n== Excluir a empresa apaga a logo");
    const outra = await criarEmpresa("[TESTE] Empresa Logo 2");
    r = await enviarLogo(outra.id, PNG, "logo.png", "image/png");
    const logoOutra = r.body?.logo_url;
    r = await json("DELETE", `/empresas/${outra.id}`);
    checar("Empresa excluída (204)", r.status === 204, `[${r.status}]`);
    checar("Arquivo da logo apagado junto", logoOutra && !fs.existsSync(arquivoDe(logoOutra)));

    console.log("\n== Editar a empresa não mexe na logo");
    r = await enviarLogo(empresa.id, PNG, "logo.png", "image/png");
    const logoFinal = r.body?.logo_url;
    r = await json("PUT", `/empresas/${empresa.id}`, { nome: "[TESTE] Empresa Logo", setor: "Outro", nome_contato: "Teste",
      telefone_contato: "000", email_contato: "teste@teste.com" });
    checar("PUT dos dados mantém a logo", r.body?.logo_url === logoFinal, `${r.body?.logo_url}`);
  } finally {
    // Apaga as empresas [TESTE] e os arquivos de logo que sobrarem delas.
    const restantes = await prisma.empresa.findMany({ where: { id: { in: ids.empresas } }, select: { id: true, logo_url: true } });
    for (const empresa of restantes) {
      if (empresa.logo_url) fs.rmSync(arquivoDe(empresa.logo_url), { force: true });
      await prisma.empresa.delete({ where: { id: empresa.id } }).catch(() => {});
    }
    const sobras = await prisma.empresa.count({ where: { nome: { startsWith: "[TESTE]" } } });
    console.log(`\nRegistros [TESTE] restantes: ${sobras} | arquivos de logo a mais na pasta: ${arquivosNaPasta() - arquivosAntes}`);
    if (sobras || arquivosNaPasta() !== arquivosAntes) falhas++;
    await prisma.$disconnect();
    server.kill();
  }
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
  process.exitCode = falhas ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
