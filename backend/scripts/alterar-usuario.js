// Troca a senha de um usuário do painel, ou ativa/desativa o usuário, pelo terminal: npm run usuario:senha
// Usa o banco do DATABASE_URL (do .env, ou da variável de ambiente, que tem prioridade).
const path = require("path");

process.chdir(path.resolve(__dirname, ".."));
require("dotenv").config();
const prisma = require("../src/prisma");
const { normalizarEmail, gerarHash } = require("../src/auth");
const { criarTerminal, descreverBanco } = require("./lib/terminal");

const { perguntar, perguntarSenhaNova, fechar } = criarTerminal();

async function main() {
  const banco = descreverBanco(process.env.DATABASE_URL);
  console.log(`Alterar usuário do painel — banco: ${banco}\n`);

  const email = normalizarEmail(await perguntar("E-mail do usuário: "));
  const usuario = email && (await prisma.usuario.findUnique({ where: { email } }));
  if (!usuario) throw new Error(`Nenhum usuário com o e-mail ${email || "(vazio)"}. Nada foi alterado.`);

  const situacao = usuario.ativo ? "ativo" : "inativo";
  console.log(`\n${usuario.nome} <${usuario.email}> — ${usuario.papel.toLowerCase()}, ${situacao}\n`);

  const acaoStatus = usuario.ativo ? "Desativar" : "Ativar";
  const opcao = (await perguntar(`O que fazer? 1) Trocar a senha  2) ${acaoStatus} o usuário [1]: `)).trim() || "1";

  let resumo;
  let dados;
  if (opcao === "1") {
    dados = { senha_hash: await gerarHash(await perguntarSenhaNova("Senha nova")) };
    resumo = "Trocar a senha de";
  } else if (opcao === "2") {
    dados = { ativo: !usuario.ativo };
    resumo = acaoStatus;
  } else {
    throw new Error("Opção inválida: use 1 ou 2. Nada foi alterado.");
  }

  const confirma = (await perguntar(`\n${resumo} "${usuario.nome}" <${usuario.email}> no banco ${banco}? (s/N) `)).trim().toLowerCase();
  if (confirma !== "s") {
    console.log("Nada foi alterado.");
    return;
  }

  await prisma.usuario.update({ where: { id: usuario.id }, data: dados });
  if (opcao === "1") console.log("Senha trocada.");
  else console.log(`Usuário ${dados.ativo ? "ativado" : "desativado (o acesso dele é bloqueado na hora)"}.`);
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
