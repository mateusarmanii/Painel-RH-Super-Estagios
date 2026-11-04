// Modelos de mensagem (WhatsApp/e-mail) com variáveis entre chaves, preenchidas no navegador:
// {nome} {primeiro_nome} {curso} {vaga} {codigo_vaga} {empresa} {data_entrevista} {hora_entrevista} {local_entrevista}.
// Usar um modelo é opcional: os botões de WhatsApp de sempre continuam iguais.
//   GET/POST /modelos · PUT/DELETE /modelos/:id
//   GET /modelos/contexto/:aplicacaoId  dados da candidatura para preencher as variáveis
const express = require("express");
const prisma = require("../prisma");
const { uuidValido } = require("../utils");

const router = express.Router();
const TITULO_MAX = 80;
const TEXTO_MAX = 4000;

const selectModelo = { id: true, titulo: true, texto: true, updated_at: true, criado_por: { select: { id: true, nome: true } } };

function camposModelo(body = {}) {
  const titulo = typeof body.titulo === "string" ? body.titulo.trim() : "";
  const texto = typeof body.texto === "string" ? body.texto.trim() : "";
  if (!titulo || titulo.length > TITULO_MAX) return { erro: `Informe um título (até ${TITULO_MAX} caracteres).` };
  if (!texto || texto.length > TEXTO_MAX) return { erro: `Informe o texto (até ${TEXTO_MAX} caracteres).` };
  return { data: { titulo, texto } };
}

router.get("/", async (_req, res) => {
  try {
    return res.json(await prisma.modeloMensagem.findMany({ orderBy: { titulo: "asc" }, select: selectModelo }));
  } catch (error) {
    console.error("Erro ao listar modelos:", error);
    return res.status(500).json({ erro: "Não foi possível listar os modelos." });
  }
});

router.post("/", async (req, res) => {
  const campos = camposModelo(req.body);
  if (campos.erro) return res.status(400).json({ erro: campos.erro });
  try {
    const modelo = await prisma.modeloMensagem.create({ data: { ...campos.data, criado_por_id: req.usuario.id }, select: selectModelo });
    return res.status(201).json(modelo);
  } catch (error) {
    console.error("Erro ao criar modelo:", error);
    return res.status(500).json({ erro: "Não foi possível criar o modelo." });
  }
});

router.put("/:id", async (req, res) => {
  if (!uuidValido.test(req.params.id)) return res.status(400).json({ erro: "ID inválido." });
  const campos = camposModelo(req.body);
  if (campos.erro) return res.status(400).json({ erro: campos.erro });
  try {
    return res.json(await prisma.modeloMensagem.update({ where: { id: req.params.id }, data: campos.data, select: selectModelo }));
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ erro: "Modelo não encontrado." });
    console.error("Erro ao salvar modelo:", error);
    return res.status(500).json({ erro: "Não foi possível salvar o modelo." });
  }
});

router.delete("/:id", async (req, res) => {
  if (!uuidValido.test(req.params.id)) return res.status(400).json({ erro: "ID inválido." });
  try {
    await prisma.modeloMensagem.delete({ where: { id: req.params.id } });
    return res.status(204).end();
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ erro: "Modelo não encontrado." });
    console.error("Erro ao excluir modelo:", error);
    return res.status(500).json({ erro: "Não foi possível excluir o modelo." });
  }
});

router.get("/contexto/:aplicacaoId", async (req, res) => {
  if (!uuidValido.test(req.params.aplicacaoId)) return res.status(400).json({ erro: "ID inválido." });
  try {
    const aplicacao = await prisma.aplicacao.findUnique({
      where: { id: req.params.aplicacaoId },
      select: {
        id: true,
        status_kanban: true,
        data_hora_entrevista: true,
        entrevista_local: true,
        entrevista_formato: true,
        estudante: { select: { id: true, nome_completo: true, curso: true, telefone: true, email: true } },
        vaga: { select: { titulo: true, codigo_vaga: true, empresa: { select: { nome: true } } } },
      },
    });
    if (!aplicacao) return res.status(404).json({ erro: "Candidatura não encontrada." });
    return res.json(aplicacao);
  } catch (error) {
    console.error("Erro ao montar contexto da mensagem:", error);
    return res.status(500).json({ erro: "Não foi possível carregar os dados da mensagem." });
  }
});

module.exports = router;
