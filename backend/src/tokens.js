// Tokens dos links públicos (sem login):
//   entrevista  "<aplicacaoId>.<assinatura>": confirmar presença. A assinatura inclui a data da entrevista,
//               então reagendar invalida o link antigo sozinho (não precisa guardar nada no banco).
//   portal      aleatório, guardado em Vaga.portal_token (o RH gera e pode revogar).
//   senha       JWT de 1 hora para redefinir a senha; inclui um pedaço do hash atual, então vale uma vez só.
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { segredoJwt } = require("./auth");
const { uuidValido } = require("./utils");

const assinar = (texto) => crypto.createHmac("sha256", segredoJwt()).update(texto).digest("base64url").slice(0, 32);

function tokenEntrevista(aplicacao) {
  const data = new Date(aplicacao.data_hora_entrevista).toISOString();
  return `${aplicacao.id}.${assinar(`entrevista:${aplicacao.id}:${data}`)}`;
}

// Devolve o id da candidatura se o formato for válido (a assinatura é conferida depois, com a data do banco).
function idDoTokenEntrevista(token) {
  const [id, assinatura] = String(token ?? "").split(".");
  return uuidValido.test(id ?? "") && assinatura ? id : null;
}

function conferirTokenEntrevista(token, aplicacao) {
  if (!aplicacao?.data_hora_entrevista) return false;
  const esperado = Buffer.from(tokenEntrevista(aplicacao));
  const recebido = Buffer.from(String(token));
  return esperado.length === recebido.length && crypto.timingSafeEqual(esperado, recebido);
}

const novoTokenPortal = () => crypto.randomBytes(24).toString("base64url");
const tokenPortalValido = (token) => /^[A-Za-z0-9_-]{20,64}$/.test(String(token ?? ""));

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
  tokenEntrevista,
  idDoTokenEntrevista,
  conferirTokenEntrevista,
  novoTokenPortal,
  tokenPortalValido,
  tokenSenha,
  lerTokenSenha,
  pedacoDoHash,
};
