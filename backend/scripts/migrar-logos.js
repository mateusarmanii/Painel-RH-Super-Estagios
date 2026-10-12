// Copia para o banco (tabela Arquivo) as logos que ainda estão na pasta antiga backend/uploads/logos e liga cada
// empresa à sua logo (logo_arquivo_id): npm run logos:migrar
// Só mexe em empresas com logo_url "/uploads/logos/..." e ainda sem logo no banco; pode rodar mais de uma vez.
// Os arquivos da pasta não são apagados, e a logo_url fica como está (deixou de ser usada).
// Usa o banco do DATABASE_URL (do .env, ou da variável de ambiente, que tem prioridade).
const fs = require("fs");
const path = require("path");

process.chdir(path.resolve(__dirname, ".."));
require("dotenv").config();
const prisma = require("../src/prisma");
const { formatoDaImagem, gravarArquivo } = require("../src/arquivos");
const { PASTA_LOGOS, URL_LOGOS, arquivoDaLogoAntiga } = require("../src/logos");
const { criarTerminal, descreverBanco } = require("./lib/terminal");

const TAMANHO_MAXIMO = 2 * 1024 * 1024;
const { perguntar, fechar } = criarTerminal();

async function main() {
  console.log(`Migrar logos da pasta para o banco — banco: ${descreverBanco(process.env.DATABASE_URL)}`);
  console.log(`Pasta: ${PASTA_LOGOS}\n`);

  const empresas = await prisma.empresa.findMany({
    where: { logo_arquivo_id: null, logo_url: { startsWith: `${URL_LOGOS}/` } },
    select: { id: true, nome: true, logo_url: true },
    orderBy: { nome: "asc" },
  });

  // Separa o que dá para copiar do que não dá (arquivo sumido, grande demais ou que não é PNG/JPG/WEBP).
  const copiar = [];
  const ignorar = [];
  for (const empresa of empresas) {
    const caminho = arquivoDaLogoAntiga(empresa.logo_url);
    if (!caminho || !fs.existsSync(caminho)) {
      ignorar.push([empresa, "arquivo não existe mais na pasta"]);
      continue;
    }
    const conteudo = fs.readFileSync(caminho);
    const formato = formatoDaImagem(conteudo);
    if (conteudo.length > TAMANHO_MAXIMO) ignorar.push([empresa, "arquivo maior que 2 MB"]);
    else if (!formato) ignorar.push([empresa, "não é PNG, JPG nem WEBP"]);
    else copiar.push({ empresa, conteudo, formato, nome: path.basename(caminho) });
  }

  console.log(`Empresas com logo só na pasta: ${empresas.length}`);
  for (const { empresa, conteudo } of copiar) console.log(`  copiar  ${empresa.nome} (${(conteudo.length / 1024).toFixed(1)} KB)`);
  for (const [empresa, motivo] of ignorar) console.log(`  ignorar ${empresa.nome} — ${motivo}`);
  if (!copiar.length) {
    console.log("\nNada para copiar.");
    return;
  }

  const confirma = (await perguntar(`\nGravar ${copiar.length} logo(s) no banco ${descreverBanco(process.env.DATABASE_URL)}? (s/N) `))
    .trim()
    .toLowerCase();
  if (confirma !== "s") {
    console.log("Nada foi gravado.");
    return;
  }

  let copiadas = 0;
  for (const { empresa, conteudo, formato, nome } of copiar) {
    // Uma transação por empresa: se uma falhar, as outras continuam.
    try {
      await prisma.$transaction(async (tx) => {
        const arquivo = await gravarArquivo(tx, "LOGO", {
          nome_original: nome,
          mime: formato.mime,
          tamanho_bytes: conteudo.length,
          conteudo,
        });
        // Só liga se a empresa continua sem logo no banco (alguém pode ter enviado outra enquanto isso).
        const { count } = await tx.empresa.updateMany({
          where: { id: empresa.id, logo_arquivo_id: null },
          data: { logo_arquivo_id: arquivo.id },
        });
        if (!count) throw new Error("a empresa já tem logo no banco");
      });
      copiadas++;
    } catch (error) {
      console.log(`  falhou  ${empresa.nome} — ${error.message}`);
    }
  }
  console.log(`\n${copiadas} de ${copiar.length} logo(s) copiada(s) para o banco.`);
}

main()
  .catch((error) => {
    console.error(`\nErro: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    fechar();
    await prisma.$disconnect();
  });
