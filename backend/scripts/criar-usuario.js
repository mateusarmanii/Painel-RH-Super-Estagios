// Cria um usuário do painel pelo terminal (não existe cadastro público): npm run usuario:criar
// Usa o banco do DATABASE_URL (do .env, ou da variável de ambiente, que tem prioridade).
const path = require("path");

process.chdir(path.resolve(__dirname, ".."));
require("dotenv").config();
const prisma = require("../src/prisma");
const { papeis, normalizarEmail, gerarHash } = require("../src/auth");
const { criarTerminal, descreverBanco } = require("./lib/terminal");

const { perguntar, perguntarSenhaNova, fechar } = criarTerminal();

async function main() {
  console.log(`Criar usuário do painel — banco: ${descreverBanco(process.env.DATABASE_URL)}\n`);

  const nome = (await perguntar("Nome: ")).trim();
  if (!nome) throw new Error("Informe o nome.");

  const email = normalizarEmail(await perguntar("E-mail: "));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido.");
  if (await prisma.usuario.findUnique({ where: { email } })) throw new Error(`Já existe um usuário com o e-mail ${email}.`);

  const senha = await perguntarSenhaNova();

  const papel = ((await perguntar("Papel (admin/recrutador) [recrutador]: ")).trim() || "recrutador").toUpperCase();
  if (!papeis.includes(papel)) throw new Error("Papel inválido: use admin ou recrutador.");

  const confirma = (await perguntar(`\nCriar ${papel.toLowerCase()} "${nome}" <${email}>? (s/N) `)).trim().toLowerCase();
  if (confirma !== "s") {
    console.log("Nada foi criado.");
    return;
  }

  const usuario = await prisma.usuario.create({
    data: { nome, email, senha_hash: await gerarHash(senha), papel },
    select: { id: true, nome: true, email: true, papel: true },
  });
  console.log(`Usuário criado: ${usuario.nome} <${usuario.email}> (${usuario.papel.toLowerCase()}).`);
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
