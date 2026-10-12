// Testes da logo da empresa (guardada no banco, tabela Arquivo): envio, troca e remoção; recusa de SVG, de formato
// falso e de arquivo acima de 2 MB; logo pública servida como imagem e com cache; logos antigas apagadas do banco;
// arquivo da pasta antiga (logo_url) apagado ao trocar. Sobe a API na porta 3395, cria registros "[TESTE]"
// e remove tudo no final.
// ATENÇÃO: grava e apaga dados no banco do DATABASE_URL (só os registros que o próprio teste cria).
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const BACKEND = path.resolve(__dirname, "..");
process.chdir(BACKEND);
require("dotenv").config();
const prisma = require("../src/prisma");
const { criarTeste } = require("./lib/teste");
const { PASTA_LOGOS } = require("../src/logos");

const PORT = 3395;
const UUID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";
const ids = { empresas: [] };
const teste = criarTeste(PORT);
const { BASE, req: json, checar, esperarServidor } = teste;

// Imagens 1x1 de verdade.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const JPG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/" +
    "yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=",
  "base64",
);
const WEBP = Buffer.from("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "base64");
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

async function enviarLogo(empresaId, buffer, nome, tipo) {
  const form = new FormData();
  form.append("logo", new Blob([buffer], { type: tipo }), nome);
  const res = await fetch(`${BASE}/empresas/${empresaId}/logo`, { method: "POST", body: form, headers: teste.cabecalhos() });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const arquivoExiste = async (id) => Boolean(id) && (await prisma.arquivo.count({ where: { id } })) === 1;
// Arquivos gravados pelo usuário [TESTE] deste script (as recusas não podem deixar nenhum).
const arquivosDoTeste = () => prisma.arquivo.count({ where: { enviado_por_id: teste.usuario.id } });
const logoDe = async (empresaId) => (await json("GET", "/empresas")).body.find((e) => e.id === empresaId)?.logo_arquivo_id;

async function criarEmpresa(nome) {
  const r = await json("POST", "/empresas", { nome, setor: "Teste", nome_contato: "Teste", telefone_contato: "000",
    email_contato: "teste@teste.com" });
  ids.empresas.push(r.body.id);
  return r.body;
}

async function main() {
  const server = spawn(process.execPath, ["server.js"], { env: { ...process.env, PORT }, stdio: "ignore" });
  let arquivoAntigo = null;
  try {
    await esperarServidor();

    console.log("\n== Preparação (registros [TESTE])");
    const empresa = await criarEmpresa("[TESTE] Empresa Logo");
    checar("Empresa nova começa sem logo", empresa.logo_arquivo_id === null);

    console.log("\n== Envio");
    let r = await enviarLogo(empresa.id, PNG, "logo.png", "image/png");
    const logoPng = r.body?.logo_arquivo_id;
    checar("PNG aceito → 200 com logo_arquivo_id", r.status === 200 && /^[0-9a-f-]{36}$/.test(logoPng ?? ""),
      `[${r.status}] ${logoPng ?? r.body?.erro}`);
    const salvo = await prisma.arquivo.findUnique({ where: { id: logoPng ?? UUID_INEXISTENTE } });
    checar("Gravada no banco como LOGO, image/png, com o tamanho e o conteúdo enviados",
      salvo?.tipo === "LOGO" && salvo.mime === "image/png" && salvo.tamanho_bytes === PNG.length && Buffer.from(salvo.conteudo).equals(PNG),
      `${salvo?.tipo} ${salvo?.mime} ${salvo?.tamanho_bytes}`);
    checar("Registra quem enviou", salvo?.enviado_por_id === teste.usuario.id);
    checar("Resposta da empresa não traz o conteúdo do arquivo", !JSON.stringify(r.body).includes("conteudo"));
    let arquivo = await fetch(`${BASE}/arquivos/logo/${logoPng}`);
    const bytes = Buffer.from(await arquivo.arrayBuffer());
    checar("Logo pública (sem login) servida como imagem, com o mesmo conteúdo",
      arquivo.status === 200 && arquivo.headers.get("content-type") === "image/png" && bytes.equals(PNG),
      `[${arquivo.status}] ${arquivo.headers.get("content-type")}`);
    checar("Resposta com nosniff", arquivo.headers.get("x-content-type-options") === "nosniff");
    checar("Cache no navegador (public, immutable)",
      /public/.test(arquivo.headers.get("cache-control")) && /immutable/.test(arquivo.headers.get("cache-control")),
      arquivo.headers.get("cache-control"));
    checar("GET /empresas traz o logo_arquivo_id", (await logoDe(empresa.id)) === logoPng);

    console.log("\n== Troca");
    r = await enviarLogo(empresa.id, JPG, "foto.jpeg", "image/jpeg");
    const logoJpg = r.body?.logo_arquivo_id;
    checar("JPG aceito e substitui a anterior", r.status === 200 && logoJpg && logoJpg !== logoPng, `[${r.status}] ${r.body?.erro ?? ""}`);
    checar("Logo anterior apagada do banco", !(await arquivoExiste(logoPng)));
    arquivo = await fetch(`${BASE}/arquivos/logo/${logoPng}`);
    checar("Logo anterior não é mais servida (404)", arquivo.status === 404, `[${arquivo.status}]`);
    arquivo = await fetch(`${BASE}/arquivos/logo/${logoJpg}`);
    checar("JPG servido como image/jpeg", arquivo.headers.get("content-type") === "image/jpeg", arquivo.headers.get("content-type"));
    r = await enviarLogo(empresa.id, WEBP, "logo.webp", "image/webp");
    const logoWebp = r.body?.logo_arquivo_id;
    checar("WEBP aceito", r.status === 200 && Boolean(logoWebp), `[${r.status}] ${r.body?.erro ?? ""}`);

    console.log("\n== Recusas (a logo atual continua)");
    const recusas = [
      ["SVG → 415", SVG, "logo.svg", "image/svg+xml", 415],
      ["Texto com nome .png e tipo image/png (formato falso) → 415", Buffer.from("não sou uma imagem"), "logo.png", "image/png", 415],
      ["PDF com nome .png → 415", Buffer.from("%PDF-1.4\n%%EOF"), "logo.png", "image/png", 415],
      ["GIF → 415", Buffer.from("GIF89a\x01\x00\x01\x00\x00\x00\x00;", "latin1"), "logo.gif", "image/gif", 415],
      ["Arquivo com 2 MB + 1 byte → 413", Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024 + 1 - PNG.length)]), "grande.png", "image/png", 413],
    ];
    const antesDasRecusas = await arquivosDoTeste();
    for (const [nome, buffer, arquivoNome, tipo, esperado] of recusas) {
      r = await enviarLogo(empresa.id, buffer, arquivoNome, tipo);
      checar(nome, r.status === esperado, `[${r.status}] ${r.body?.erro}`);
    }
    checar("Recusas não gravaram nada no banco", (await arquivosDoTeste()) === antesDasRecusas);
    checar("Depois das recusas, a empresa continua com a logo WEBP", (await logoDe(empresa.id)) === logoWebp);
    r = await enviarLogo(empresa.id, Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024 - PNG.length)]), "limite.png", "image/png");
    checar("Arquivo com exatamente 2 MB é aceito", r.status === 200, `[${r.status}] ${r.body?.erro}`);
    const logoLimite = r.body?.logo_arquivo_id;
    checar("Só a última logo da empresa fica no banco", (await arquivosDoTeste()) === 1, `${await arquivosDoTeste()} arquivo(s)`);

    const vazio = new FormData();
    let res = await fetch(`${BASE}/empresas/${empresa.id}/logo`, { method: "POST", body: vazio, headers: teste.cabecalhos() });
    checar("Sem arquivo → 400", res.status === 400, `[${res.status}]`);
    r = await enviarLogo(UUID_INEXISTENTE, PNG, "logo.png", "image/png");
    checar("Empresa inexistente → 404", r.status === 404, `[${r.status}]`);
    r = await enviarLogo("abc", PNG, "logo.png", "image/png");
    checar("ID inválido → 400", r.status === 400, `[${r.status}]`);
    res = await fetch(`${BASE}/empresas/${empresa.id}/logo`, { method: "POST", body: vazio });
    checar("Enviar logo sem login → 401", res.status === 401, `[${res.status}]`);
    res = await fetch(`${BASE}/arquivos/logo/${UUID_INEXISTENTE}`);
    checar("Logo inexistente → 404 (sem pedir login)", res.status === 404, `[${res.status}]`);
    res = await fetch(`${BASE}/arquivos/logo/..%2fserver.js`);
    checar("Id inválido na URL da logo → 404", res.status === 404, `[${res.status}]`);
    res = await fetch(`${BASE}/uploads/logos/x.png`);
    checar("Pasta antiga não é mais servida", res.status === 401 || res.status === 404, `[${res.status}]`);

    console.log("\n== Logo antiga da pasta (logo_url) é limpa ao trocar");
    fs.mkdirSync(PASTA_LOGOS, { recursive: true });
    const nomeAntigo = `${crypto.randomUUID()}.png`;
    arquivoAntigo = path.join(PASTA_LOGOS, nomeAntigo);
    fs.writeFileSync(arquivoAntigo, PNG);
    await prisma.empresa.update({ where: { id: empresa.id }, data: { logo_url: `/uploads/logos/${nomeAntigo}` } });
    r = await enviarLogo(empresa.id, PNG, "nova.png", "image/png");
    checar("Troca zera a logo_url antiga", r.status === 200 && r.body?.logo_url === null, `[${r.status}] ${r.body?.logo_url}`);
    checar("Arquivo antigo da pasta foi apagado", !fs.existsSync(arquivoAntigo));
    checar("Logo anterior (2 MB) apagada do banco", !(await arquivoExiste(logoLimite)));

    console.log("\n== Remoção");
    const logoAtual = r.body?.logo_arquivo_id;
    r = await json("DELETE", `/empresas/${empresa.id}/logo`);
    checar("DELETE da logo → logo_arquivo_id vazio", r.status === 200 && r.body.logo_arquivo_id === null, `[${r.status}]`);
    checar("Arquivo apagado do banco ao remover a logo", !(await arquivoExiste(logoAtual)));
    r = await json("DELETE", `/empresas/${empresa.id}/logo`);
    checar("Remover de novo (já sem logo) não dá erro", r.status === 200, `[${r.status}]`);

    console.log("\n== Excluir a empresa apaga a logo");
    const outra = await criarEmpresa("[TESTE] Empresa Logo 2");
    r = await enviarLogo(outra.id, PNG, "logo.png", "image/png");
    const logoOutra = r.body?.logo_arquivo_id;
    r = await json("DELETE", `/empresas/${outra.id}`);
    checar("Empresa excluída (204)", r.status === 204, `[${r.status}]`);
    checar("Logo apagada do banco junto", logoOutra && !(await arquivoExiste(logoOutra)));

    console.log("\n== Editar a empresa não mexe na logo");
    r = await enviarLogo(empresa.id, PNG, "logo.png", "image/png");
    const logoFinal = r.body?.logo_arquivo_id;
    r = await json("PUT", `/empresas/${empresa.id}`, { nome: "[TESTE] Empresa Logo", setor: "Outro", nome_contato: "Teste",
      telefone_contato: "000", email_contato: "teste@teste.com" });
    checar("PUT dos dados mantém a logo", r.body?.logo_arquivo_id === logoFinal, `${r.body?.logo_arquivo_id}`);
  } finally {
    // Apaga as empresas [TESTE] e as logos delas (no banco e o arquivo de teste na pasta, se sobrou).
    if (arquivoAntigo) fs.rmSync(arquivoAntigo, { force: true });
    const restantes = await prisma.empresa.findMany({ where: { id: { in: ids.empresas } }, select: { id: true, logo_arquivo_id: true } });
    for (const empresa of restantes) {
      await prisma.empresa.delete({ where: { id: empresa.id } }).catch(() => {});
      if (empresa.logo_arquivo_id) await prisma.arquivo.deleteMany({ where: { id: empresa.logo_arquivo_id } });
    }
    const sobras = await prisma.empresa.count({ where: { nome: { startsWith: "[TESTE]" } } });
    const arquivosSobrando = teste.usuario ? await arquivosDoTeste() : 0;
    console.log(`\nRegistros [TESTE] restantes: ${sobras} | arquivos do teste restantes no banco: ${arquivosSobrando}`);
    if (sobras || arquivosSobrando) teste.falhas++;
    await teste.removerUsuario();
    await prisma.$disconnect();
    server.kill();
  }
  console.log(teste.falhas ? `\n${teste.falhas} FALHA(S)` : "\nTodos os testes passaram.");
  process.exitCode = teste.falhas ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
