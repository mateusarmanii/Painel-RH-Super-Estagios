// Perguntas no terminal para os scripts de usuário (usuario:criar, usuario:senha).
const readline = require("readline");
const { TAMANHO_MINIMO_SENHA } = require("../../src/auth");

function criarTerminal() {
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

  // Pede a senha duas vezes, sem mostrar na tela, e confere as regras.
  async function perguntarSenhaNova(rotulo = "Senha") {
    const senha = await perguntar(`${rotulo} (mínimo ${TAMANHO_MINIMO_SENHA} caracteres): `, { secreta: true });
    if (senha.length < TAMANHO_MINIMO_SENHA) throw new Error(`A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`);
    if (senha !== senha.trim()) throw new Error("A senha não pode começar nem terminar com espaço.");
    if ((await perguntar("Repita a senha: ", { secreta: true })) !== senha) throw new Error("As senhas não conferem.");
    return senha;
  }

  return { perguntar, perguntarSenhaNova, fechar: () => rl.close() };
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

module.exports = { criarTerminal, descreverBanco };
