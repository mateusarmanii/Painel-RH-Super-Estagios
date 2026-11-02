// Registro de atividades: toda alteração que deu certo (POST, PUT, PATCH, DELETE com status < 400) feita por um
// usuário logado vira uma linha em Atividade (quem, método, caminho, entidade e id). Automático; não muda nenhuma
// resposta e uma falha ao gravar o registro só aparece no log.
const prisma = require("./prisma");

const METODOS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function registrarAtividades(req, res, next) {
  if (!METODOS.has(req.method)) return next();
  res.on("finish", () => {
    // Usuários temporários dos scripts de teste (…@teste.local) não entram no registro.
    if (res.statusCode >= 400 || !req.usuario || req.usuario.email.endsWith("@teste.local")) return;
    const caminho = req.originalUrl.split("?")[0].slice(0, 200);
    prisma.atividade
      .create({
        data: {
          usuario_id: req.usuario.id,
          metodo: req.method,
          caminho,
          entidade: caminho.split("/")[1]?.slice(0, 30) || null,
          entidade_id: caminho.match(UUID)?.[0] ?? null,
          status: res.statusCode,
        },
      })
      .catch((error) => console.error("Erro ao registrar atividade:", error.message));
  });
  return next();
}

module.exports = { registrarAtividades };
