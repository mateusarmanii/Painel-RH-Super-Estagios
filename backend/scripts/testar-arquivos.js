// Testes do currículo do estudante (guardado no banco, tabela Arquivo): envio de PDF, DOC e DOCX; recusa de arquivo
// grande e de tipo falso (extensão .pdf com conteúdo de imagem); download só com login (sem login → 401); troca,
// remoção e exclusão do estudante apagando o arquivo; listagens sem o conteúdo; currículo nunca sai pela rota pública
// da logo. Sobe a API na porta 3385, cria registros "[TESTE]" e remove tudo no final.
// ATENÇÃO: grava e apaga dados no banco do DATABASE_URL (só os registros que o próprio teste cria).
const path = require("path");
const { spawn } = require("child_process");

const BACKEND = path.resolve(__dirname, "..");
process.chdir(BACKEND);
require("dotenv").config();
const prisma = require("../src/prisma");
const { criarTeste } = require("./lib/teste");

const PORT = 3385;
const MB = 1024 * 1024;
const UUID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";
const ids = { estudantes: [], vagas: [], empresa: null };
const teste = criarTeste(PORT);
const { BASE, req, checar, checarStatus, esperarServidor } = teste;

const TIPO_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Arquivos mínimos com a assinatura de cada formato.
const PDF = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
// Cabeçalho de ZIP com o nome do primeiro arquivo (DOCX tem "word/document.xml"; XLSX, "xl/workbook.xml").
function zipCom(nome) {
  const cabecalho = Buffer.alloc(30);
  cabecalho.writeUInt32LE(0x04034b50, 0);
  cabecalho.writeUInt16LE(Buffer.byteLength(nome), 26);
  return Buffer.concat([cabecalho, Buffer.from(nome), Buffer.from("<xml/>")]);
}
const DOCX = zipCom("word/document.xml");
const XLSX = zipCom("xl/workbook.xml");
// Arquivo OLE (Word 97-2003) com o fluxo "WordDocument" no diretório.
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const DOC = Buffer.concat([OLE, Buffer.alloc(504), Buffer.from("WordDocument", "utf16le"), Buffer.alloc(64)]);
const XLS = Buffer.concat([OLE, Buffer.alloc(504), Buffer.from("Workbook", "utf16le"), Buffer.alloc(64)]);

// Soma do que foi aceito e gravado no banco durante o teste (para o relatório de espaço).
let bytesGravados = 0;

async function enviarCurriculo(estudanteId, buffer, nome, tipo, { token } = {}) {
  const form = new FormData();
  form.append("curriculo", new Blob([buffer], { type: tipo }), nome);
  const res = await fetch(`${BASE}/candidatos/${estudanteId}/curriculo`, {
    method: "POST",
    body: form,
    headers: teste.cabecalhos(token === undefined ? teste.token : token),
  });
  const body = await res.json().catch(() => null);
  if (res.status === 200) bytesGravados += buffer.length;
  return { status: res.status, body };
}

const baixar = (estudanteId, token = teste.token) => fetch(`${BASE}/candidatos/${estudanteId}/curriculo`, { headers: teste.cabecalhos(token) });
const arquivoExiste = async (id) => Boolean(id) && (await prisma.arquivo.count({ where: { id } })) === 1;
const arquivosDoTeste = () => prisma.arquivo.count({ where: { enviado_por_id: teste.usuario.id } });
const curriculoNoBanco = async (estudanteId) =>
  (await prisma.estudante.findUnique({ where: { id: estudanteId }, select: { curriculo_arquivo_id: true } }))?.curriculo_arquivo_id;

async function criarEstudante(nome) {
  const r = await req("POST", "/candidatos", { nome_completo: nome, telefone: teste.telefone(), curso: "Teste" });
  if (r.body?.id) ids.estudantes.push(r.body.id);
  return r.body;
}

async function main() {
  const server = spawn(process.execPath, ["server.js"], { env: { ...process.env, PORT }, stdio: "ignore" });
  try {
    await esperarServidor();

    console.log("\n== Preparação (registros [TESTE])");
    const estudante = await criarEstudante("[TESTE] Estudante Currículo");
    checar("Estudante novo começa sem currículo", estudante?.curriculo_arquivo_id === null);

    console.log("\n== Envio válido (PDF)");
    let r = await enviarCurriculo(estudante.id, PDF, "Currículo João.pdf", "application/pdf");
    const pdfId = r.body?.curriculo?.id;
    checar("PDF aceito → 200 com o resumo do arquivo",
      r.status === 200 && r.body.curriculo_arquivo_id === pdfId && r.body.curriculo.mime === "application/pdf"
        && r.body.curriculo.tamanho_bytes === PDF.length,
      `[${r.status}] ${r.body?.erro ?? ""}`);
    checar("Nome original guardado com acento", r.body?.curriculo?.nome_original === "Currículo João.pdf", r.body?.curriculo?.nome_original);
    checar("Resposta não traz o conteúdo", !JSON.stringify(r.body).includes("conteudo"));
    const salvo = await prisma.arquivo.findUnique({ where: { id: pdfId ?? UUID_INEXISTENTE } });
    checar("Gravado no banco como CURRICULO, com o conteúdo enviado e quem enviou",
      salvo?.tipo === "CURRICULO" && Buffer.from(salvo.conteudo).equals(PDF) && salvo.enviado_por_id === teste.usuario.id);

    console.log("\n== Listagens (só o resumo, nunca o conteúdo)");
    r = await req("GET", "/candidatos");
    const naLista = r.body.find((e) => e.id === estudante.id);
    checar("GET /candidatos traz curriculo { id, nome_original, mime, tamanho_bytes }",
      naLista?.curriculo?.id === pdfId && naLista.curriculo.nome_original === "Currículo João.pdf");
    checar("GET /candidatos não traz o conteúdo de nenhum arquivo", !JSON.stringify(r.body).includes("conteudo"));
    r = await req("GET", `/candidatos/${estudante.id}`);
    checar("Perfil (GET /candidatos/:id) traz o currículo sem o conteúdo",
      r.body?.curriculo?.id === pdfId && !("conteudo" in (r.body?.curriculo ?? {})));

    // Kanban: candidatura numa vaga [TESTE].
    const empresa = await req("POST", "/empresas", { nome: "[TESTE] Empresa Currículo", nome_contato: "Teste", telefone_contato: "000",
      email_contato: "teste@teste.com" });
    ids.empresa = empresa.body?.id;
    const vaga = await req("POST", "/vagas", { codigo_vaga: String(900000 + Math.floor(Math.random() * 99999)), titulo: "[TESTE] Vaga Currículo",
      descricao: "Teste", valor: 1000, empresa_id: ids.empresa });
    if (vaga.body?.id) ids.vagas.push(vaga.body.id);
    await req("POST", `/candidatos/${estudante.id}/candidaturas`, { vaga_id: vaga.body?.id });
    r = await req("GET", `/vagas/${vaga.body?.id}/candidatos`);
    checar("Kanban (GET /vagas/:id/candidatos) traz o currículo do estudante sem o conteúdo",
      r.body?.[0]?.estudante?.curriculo?.id === pdfId && !JSON.stringify(r.body).includes("conteudo"));

    console.log("\n== Download");
    let res = await baixar(estudante.id);
    let bytes = Buffer.from(await res.arrayBuffer());
    checar("Com login → 200, application/pdf, mesmo conteúdo",
      res.status === 200 && res.headers.get("content-type") === "application/pdf" && bytes.equals(PDF),
      `[${res.status}] ${res.headers.get("content-type")}`);
    checar("PDF vai como inline, com o nome original", (res.headers.get("content-disposition") ?? "").startsWith("inline;")
      && res.headers.get("content-disposition").includes("Curr%C3%ADculo%20Jo%C3%A3o.pdf"), res.headers.get("content-disposition"));
    checar("Sem cache compartilhado (private, no-store) e com nosniff",
      res.headers.get("cache-control") === "private, no-store" && res.headers.get("x-content-type-options") === "nosniff",
      res.headers.get("cache-control"));
    res = await baixar(estudante.id, null);
    checar("Download sem login → 401", res.status === 401, `[${res.status}]`);
    res = await baixar(estudante.id, "token-falso");
    checar("Download com token inválido → 401", res.status === 401, `[${res.status}]`);
    res = await fetch(`${BASE}/arquivos/logo/${pdfId}`);
    checar("Currículo não sai pela rota pública da logo (404)", res.status === 404, `[${res.status}]`);
    r = await enviarCurriculo(estudante.id, PDF, "x.pdf", "application/pdf", { token: null });
    checar("Envio sem login → 401", r.status === 401, `[${r.status}]`);

    console.log("\n== Recusas (o currículo atual continua)");
    const antesDasRecusas = await arquivosDoTeste();
    const recusas = [
      ["Tipo falso: extensão .pdf com conteúdo de imagem (PNG) → 415", PNG, "curriculo.pdf", "application/pdf", 415],
      ["Texto com nome .docx → 415", Buffer.from("não sou um documento"), "curriculo.docx", TIPO_DOCX, 415],
      ["Planilha XLSX com nome .docx → 415", XLSX, "curriculo.docx", TIPO_DOCX, 415],
      ["Planilha XLS com nome .doc → 415", XLS, "curriculo.doc", "application/msword", 415],
      ["Arquivo grande (5 MB + 1 byte) → 413", Buffer.concat([PDF, Buffer.alloc(5 * MB + 1 - PDF.length)]), "grande.pdf", "application/pdf", 413],
    ];
    for (const [nome, buffer, arquivoNome, tipo, esperado] of recusas) {
      r = await enviarCurriculo(estudante.id, buffer, arquivoNome, tipo);
      checarStatus(nome, r, esperado);
    }
    checar("Recusas não gravaram nada no banco", (await arquivosDoTeste()) === antesDasRecusas);
    checar("O currículo continua o PDF", (await curriculoNoBanco(estudante.id)) === pdfId);
    const semArquivo = await fetch(`${BASE}/candidatos/${estudante.id}/curriculo`, { method: "POST", body: new FormData(), headers: teste.cabecalhos() });
    checar("Sem arquivo → 400", semArquivo.status === 400, `[${semArquivo.status}]`);
    r = await enviarCurriculo(UUID_INEXISTENTE, PDF, "x.pdf", "application/pdf");
    checarStatus("Estudante inexistente → 404", r, 404);
    r = await enviarCurriculo("abc", PDF, "x.pdf", "application/pdf");
    checarStatus("ID inválido → 400", r, 400);

    console.log("\n== Troca");
    r = await enviarCurriculo(estudante.id, DOCX, "curriculo final.docx", TIPO_DOCX);
    const docxId = r.body?.curriculo?.id;
    checar("DOCX aceito e substitui o PDF", r.status === 200 && docxId && docxId !== pdfId && r.body.curriculo.mime === TIPO_DOCX,
      `[${r.status}] ${r.body?.erro ?? ""}`);
    checar("PDF anterior apagado do banco", !(await arquivoExiste(pdfId)));
    res = await baixar(estudante.id);
    bytes = Buffer.from(await res.arrayBuffer());
    checar("DOCX baixa como anexo (attachment) com o nome original",
      (res.headers.get("content-disposition") ?? "").startsWith("attachment;") && res.headers.get("content-disposition").includes("curriculo final.docx")
        && res.headers.get("content-type") === TIPO_DOCX && bytes.equals(DOCX),
      res.headers.get("content-disposition"));
    r = await enviarCurriculo(estudante.id, DOC, "antigo.doc", "application/msword");
    const docId = r.body?.curriculo?.id;
    checar("DOC aceito (Word 97-2003)", r.status === 200 && r.body.curriculo.mime === "application/msword", `[${r.status}] ${r.body?.erro ?? ""}`);
    checar("DOCX anterior apagado do banco", !(await arquivoExiste(docxId)));
    r = await enviarCurriculo(estudante.id, Buffer.concat([PDF, Buffer.alloc(5 * MB - PDF.length)]), "limite.pdf", "application/pdf");
    const limiteId = r.body?.curriculo?.id;
    checarStatus("Arquivo com exatamente 5 MB é aceito", r, 200);
    checar("DOC anterior apagado do banco", !(await arquivoExiste(docId)));
    r = await enviarCurriculo(estudante.id, PDF, "../../etc/passwd.pdf", "application/pdf");
    checar("Nome com caminho é limpo (só o nome do arquivo)", r.body?.curriculo?.nome_original === "passwd.pdf", r.body?.curriculo?.nome_original);
    checar("Só o currículo atual fica no banco", (await arquivosDoTeste()) === 1 && !(await arquivoExiste(limiteId)),
      `${await arquivosDoTeste()} arquivo(s)`);
    const atualId = r.body?.curriculo?.id;

    r = await req("PUT", `/candidatos/${estudante.id}`, { nome_completo: "[TESTE] Estudante Currículo", telefone: estudante.telefone, curso: "Outro" });
    checar("Editar os dados do estudante não mexe no currículo", r.status === 200 && r.body?.curriculo_arquivo_id === atualId,
      `[${r.status}] ${r.body?.curriculo_arquivo_id}`);

    console.log("\n== Remoção");
    r = await req("DELETE", `/candidatos/${estudante.id}/curriculo`);
    checar("DELETE do currículo → 200, sem currículo", r.status === 200 && r.body?.curriculo_arquivo_id === null, `[${r.status}]`);
    checar("Arquivo apagado do banco ao remover", !(await arquivoExiste(atualId)));
    res = await baixar(estudante.id);
    checar("Download depois de remover → 404", res.status === 404, `[${res.status}]`);
    r = await req("DELETE", `/candidatos/${estudante.id}/curriculo`);
    checarStatus("Remover de novo (já sem currículo) não dá erro", r, 200);
    r = await req("DELETE", `/candidatos/${estudante.id}/curriculo`, undefined, { token: null });
    checarStatus("Remover sem login → 401", r, 401);
    r = await req("DELETE", `/candidatos/${UUID_INEXISTENTE}/curriculo`);
    checarStatus("Remover de estudante inexistente → 404", r, 404);

    console.log("\n== Excluir o estudante apaga o currículo");
    const outro = await criarEstudante("[TESTE] Estudante Currículo 2");
    r = await enviarCurriculo(outro.id, PDF, "cv.pdf", "application/pdf");
    const outroId = r.body?.curriculo?.id;
    r = await req("DELETE", `/candidatos/${outro.id}`);
    checarStatus("Estudante excluído (204)", r, 204);
    checar("Currículo apagado do banco junto", outroId && !(await arquivoExiste(outroId)));
  } finally {
    // Apaga candidaturas, estudantes (e currículos), vaga e empresa [TESTE].
    const restantes = await prisma.estudante.findMany({ where: { id: { in: ids.estudantes } }, select: { curriculo_arquivo_id: true } });
    await prisma.aplicacao.deleteMany({ where: { estudante_id: { in: ids.estudantes } } }).catch(() => {});
    await prisma.estudante.deleteMany({ where: { id: { in: ids.estudantes } } }).catch(() => {});
    const curriculos = restantes.map((e) => e.curriculo_arquivo_id).filter(Boolean);
    if (curriculos.length) await prisma.arquivo.deleteMany({ where: { id: { in: curriculos } } });
    await prisma.vaga.deleteMany({ where: { id: { in: ids.vagas } } }).catch(() => {});
    if (ids.empresa) await prisma.empresa.delete({ where: { id: ids.empresa } }).catch(() => {});

    const sobras = await prisma.estudante.count({ where: { nome_completo: { startsWith: "[TESTE]" } } })
      + await prisma.vaga.count({ where: { titulo: { startsWith: "[TESTE]" } } })
      + await prisma.empresa.count({ where: { nome: { startsWith: "[TESTE]" } } });
    const arquivosSobrando = teste.usuario ? await arquivosDoTeste() : 0;
    console.log(`\nRegistros [TESTE] restantes: ${sobras} | arquivos do teste restantes no banco: ${arquivosSobrando}`);
    console.log(`Espaço: ${(bytesGravados / MB).toFixed(2)} MB gravados e apagados durante o teste.`);
    if (sobras || arquivosSobrando) teste.falhas++;
    await teste.removerUsuario();
    await prisma.$disconnect();
    server.kill();
  }
  console.log(teste.falhas ? `\n${teste.falhas} FALHA(S)` : "\nTodos os testes passaram.");
  process.exitCode = teste.falhas ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
