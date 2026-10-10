// Login: senha com hash bcrypt, token JWT (8h) no cabeçalho "Authorization: Bearer <token>".
// O token é conferido em toda requisição, e o usuário precisa continuar ativo (desativar tem efeito imediato).
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("./prisma");

const VALIDADE_TOKEN = "8h";
const ALGORITMO = "HS256";
const CUSTO_BCRYPT = 12;
const TAMANHO_MINIMO_SENHA = 10;
const TAMANHO_MINIMO_SEGREDO = 32;
const papeis = ["ADMIN", "RECRUTADOR"];

// Sem um JWT_SECRET forte a API não sobe: um segredo fraco permitiria forjar tokens.
function segredoJwt() {
  const segredo = process.env.JWT_SECRET ?? "";
  if (segredo.length < TAMANHO_MINIMO_SEGREDO) {
    throw new Error(`Configure JWT_SECRET no .env com pelo menos ${TAMANHO_MINIMO_SEGREDO} caracteres aleatórios.`);
  }
  return segredo;
}

const normalizarEmail = (email) => (typeof email === "string" ? email.trim().toLowerCase() : "");

const gerarHash = (senha) => bcrypt.hash(senha, CUSTO_BCRYPT);

// Dados do usuário que podem ir para o navegador (nunca o hash).
const usuarioPublico = ({ id, nome, email, papel }) => ({ id, nome, email, papel });

// Hash usado quando o e-mail não existe, para a resposta levar o mesmo tempo (não revela quais e-mails existem).
const HASH_FALSO = bcrypt.hashSync("senha-que-nao-existe", CUSTO_BCRYPT);

// Devolve o usuário se e-mail e senha conferem e ele está ativo; senão, null.
async function conferirLogin(email, senha) {
  const usuario = await prisma.usuario.findUnique({ where: { email: normalizarEmail(email) } });
  const senhaOk = await bcrypt.compare(senha, usuario?.senha_hash ?? HASH_FALSO);
  return usuario && usuario.ativo && senhaOk ? usuario : null;
}

function gerarToken(usuario) {
  return jwt.sign({ papel: usuario.papel }, segredoJwt(), {
    subject: usuario.id,
    expiresIn: VALIDADE_TOKEN,
    algorithm: ALGORITMO,
  });
}

const naoAutorizado = (res) => res.status(401).json({ erro: "Sessão inválida ou expirada. Entre novamente." });

// Middleware: exige um token válido de um usuário ativo e deixa os dados dele em req.usuario.
async function exigirLogin(req, res, next) {
  const [tipo, token] = (req.get("Authorization") ?? "").split(" ");
  if (tipo !== "Bearer" || !token) return naoAutorizado(res);

  let dados;
  try {
    dados = jwt.verify(token, segredoJwt(), { algorithms: [ALGORITMO] });
  } catch {
    return naoAutorizado(res);
  }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { id: dados.sub } });
    if (!usuario?.ativo) return naoAutorizado(res);
    req.usuario = usuarioPublico(usuario);
    return next();
  } catch (error) {
    console.error("Erro ao conferir o login:", error);
    return res.status(500).json({ erro: "Não foi possível conferir o login." });
  }
}

module.exports = {
  VALIDADE_TOKEN,
  TAMANHO_MINIMO_SENHA,
  papeis,
  segredoJwt,
  normalizarEmail,
  gerarHash,
  usuarioPublico,
  conferirLogin,
  gerarToken,
  exigirLogin,
};
