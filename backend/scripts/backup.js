// Backup do banco do DATABASE_URL com o pg_dump (formato custom, restaurável com pg_restore).
// Uso: npm run backup            → backend/backups/superestagios-AAAA-MM-DD-HHMM.dump
// Variáveis opcionais: PG_DUMP (caminho do pg_dump, se não estiver no PATH), BACKUP_PASTA (outra pasta),
// BACKUP_MANTER (quantos arquivos guardar; padrão 14 — os mais antigos são apagados).
// Para automatizar: Agendador de Tarefas do Windows (ou cron) chamando "npm run backup" uma vez por dia.
// Restaurar (num banco vazio): pg_restore --clean --if-exists --no-owner -d "<DATABASE_URL>" arquivo.dump
// Só lê o banco; não grava nada nele.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

process.chdir(path.resolve(__dirname, ".."));
require("dotenv").config();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não configurada no .env.");
  process.exit(1);
}

const pasta = path.resolve(process.env.BACKUP_PASTA || "backups");
const manter = Math.max(1, Number(process.env.BACKUP_MANTER) || 14);
fs.mkdirSync(pasta, { recursive: true });

const agora = new Date();
const dois = (n) => String(n).padStart(2, "0");
const nome = `superestagios-${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}-${dois(agora.getHours())}${dois(agora.getMinutes())}.dump`;
const destino = path.join(pasta, nome);

// O pg_dump não aceita o parâmetro "schema" da URL do Prisma: tira os parâmetros da URL.
const conexao = new URL(url);
const schema = conexao.searchParams.get("schema");
conexao.search = "";

const argumentos = ["--format=custom", "--no-owner", "--file", destino, ...(schema ? ["--schema", schema] : []), conexao.toString()];
const resultado = spawnSync(process.env.PG_DUMP || "pg_dump", argumentos, { stdio: "inherit" });

if (resultado.error?.code === "ENOENT") {
  console.error("pg_dump não encontrado. Instale as ferramentas do PostgreSQL ou informe o caminho em PG_DUMP no .env.");
  process.exit(1);
}
if (resultado.status !== 0) {
  fs.rmSync(destino, { force: true });
  console.error("O backup falhou (veja a mensagem acima).");
  process.exit(1);
}

const tamanho = fs.statSync(destino).size;
console.log(`Backup salvo: ${destino} (${(tamanho / 1024 / 1024).toFixed(2)} MB)`);

const antigos = fs.readdirSync(pasta).filter((arquivo) => /^superestagios-.*\.dump$/.test(arquivo)).sort().reverse().slice(manter);
for (const arquivo of antigos) {
  fs.rmSync(path.join(pasta, arquivo));
  console.log(`Removido (mais antigo que os ${manter} últimos): ${arquivo}`);
}
