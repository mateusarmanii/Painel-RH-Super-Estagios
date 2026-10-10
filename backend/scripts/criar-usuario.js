// Cria um usuário do painel pelo terminal (não existe cadastro público): npm run usuario:criar
// Usa o banco do DATABASE_URL (do .env, ou da variável de ambiente, que tem prioridade).
const path = require("path");
const readline = require("readline");

process.chdir(path.resolve(__dirname, ".."));
require("dotenv").config();
const prisma = require("../src/prisma");
const { TAMANHO_MINIMO_SENHA, papeis, normalizarEmail, gerarHash } = require("../src/auth");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
let ocultar = false;
// Enquanto ocultar = true, o que é digitado não aparece na tela (para a senha).
rl._writeToOutput = (texto) => {
  if (!ocultar) process.stdout.write(texto);
};

// Lê as respostas linha a linha (funciona digitando ou com a entrada redirecionada).
const linhas = rl[Symbol.asyncIterator]();

async function perguntar(pergunta, { secreta = false } = {}) {
  process.stdout.write(pergunta);
  ocultar = secreta;
  const { value, done } = await linhas.next();
  ocultar = false;
  if (secreta) process.stdout.write("\n");
  if (done) throw new Error("Entrada encerrada antes de responder todas as perguntas.");
  return value;
}

// "postgresql://usuario:senha@host:5432/banco?..." → "host:5432/banco" (sem usuário e senha).
function descreverBanco(url) {
  try {
    const { host, pathname } = new URL(url);
    return `${host}${pathname}`;
  } catch {
    return "(DATABASE_URL inválida)";
  }
}

async function main() {
  console.log(`Criar usuário do painel — banco: ${descreverBanco(process.env.DATABASE_URL)}\n`);

  const nome = (await perguntar("Nome: ")).trim();
  if (!nome) throw new Error("Informe o nome.");

  const email = normalizarEmail(await perguntar("E-mail: "));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido.");
  if (await prisma.usuario.findUnique({ where: { email } })) throw new Error(`Já existe um usuário com o e-mail ${email}.`);

  const senha = await perguntar(`Senha (mínimo ${TAMANHO_MINIMO_SENHA} caracteres): `, { secreta: true });
  if (senha.length < TAMANHO_MINIMO_SENHA) throw new Error(`A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`);
  if (senha !== senha.trim()) throw new Error("A senha não pode começar nem terminar com espaço.");
  if ((await perguntar("Repita a senha: ", { secreta: true })) !== senha) throw new Error("As senhas não conferem.");

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
    rl.close();
    await prisma.$disconnect();
  });
