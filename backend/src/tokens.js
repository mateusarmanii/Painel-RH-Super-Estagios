// Token do link para redefinir a senha (a página abre sem login, porque quem esqueceu a senha não consegue entrar):
//   senha       JWT de 1 hora para redefinir a senha; inclui um pedaço do hash atual, então vale uma vez só.
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { segredoJwt } = require("./auth");

const pedacoDoHash = (senhaHash) => crypto.createHash("sha256").update(senhaHash).digest("base64url").slice(0, 16);

function tokenSenha(usuario) {
  return jwt.sign({ fim: "senha", h: pedacoDoHash(usuario.senha_hash) }, segredoJwt(), {
    subject: usuario.id,
    expiresIn: "1h",
    algorithm: "HS256",
  });
}

// Devolve { id, h } do token de redefinição, ou null se inválido/vencido.
function lerTokenSenha(token) {
  try {
    const dados = jwt.verify(String(token ?? ""), segredoJwt(), { algorithms: ["HS256"] });
    return dados.fim === "senha" ? { id: dados.sub, h: dados.h } : null;
  } catch {
    return null;
  }
}

module.exports = {
  tokenSenha,
  lerTokenSenha,
  pedacoDoHash,
};
