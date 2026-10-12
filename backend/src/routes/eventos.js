// Eventos do Calendário: listar por período, criar, editar e excluir (todas exigem login, pelo server.js).
const express = require("express");
const prisma = require("../prisma");
const { uuidValido, DIA_MS } = require("../utils");
const { camposEvento, selectEvento } = require("../eventos");
const { ErroLembrete, carregarAlvo, cancelarLembrete } = require("../lembretes");

const router = express.Router();
const PERIODO_MAXIMO_DIAS = 62;

function lerData(valor) {
  const data = typeof valor === "string" && valor ? new Date(valor) : null;
  return data && !Number.isNaN(data.getTime()) ? data : null;
}

// ?inicio=&fim= (ISO): eventos que começam no período, em ordem.
router.get("/", async (req, res) => {
  const de = lerData(req.query.inicio);
  const ate = lerData(req.query.fim);
  if (!de || !ate || ate <= de) return res.status(400).json({ erro: "Informe início e fim válidos (fim depois do início)." });
  if (ate - de > PERIODO_MAXIMO_DIAS * DIA_MS) {
    return res.status(400).json({ erro: `O período pode ter no máximo ${PERIODO_MAXIMO_DIAS} dias.` });
  }

  try {
    const eventos = await prisma.evento.findMany({
      where: { inicio: { gte: de, lt: ate } },
      orderBy: [{ inicio: "asc" }, { titulo: "asc" }],
      select: selectEvento,
    });
    return res.json(eventos);
  } catch (error) {
    console.error("Erro ao listar eventos:", error);
    return res.status(500).json({ erro: "Não foi possível listar os eventos." });
  }
});

router.get("/:id", async (req, res) => {
  if (!uuidValido.test(req.params.id)) return res.status(400).json({ erro: "ID de evento inválido." });
  try {
    const evento = await prisma.evento.findUnique({ where: { id: req.params.id }, select: selectEvento });
    if (!evento) return res.status(404).json({ erro: "Evento não encontrado." });
    return res.json(evento);
  } catch (error) {
    console.error("Erro ao buscar evento:", error);
    return res.status(500).json({ erro: "Não foi possível carregar o evento." });
  }
});

router.post("/", async (req, res) => {
  const campos = camposEvento(req.body);
  if (campos.erro) return res.status(400).json({ erro: campos.erro });
  try {
    const evento = await prisma.evento.create({
      data: { ...campos.data, criado_por_id: req.usuario.id },
      select: selectEvento,
    });
    return res.status(201).json(evento);
  } catch (error) {
    console.error("Erro ao criar evento:", error);
    return res.status(500).json({ erro: "Não foi possível criar o evento." });
  }
});

// Edição parcial: só os campos enviados mudam (o arrastar no Calendário manda só o início).
router.put("/:id", async (req, res) => {
  if (!uuidValido.test(req.params.id)) return res.status(400).json({ erro: "ID de evento inválido." });
  try {
    const atual = await prisma.evento.findUnique({ where: { id: req.params.id } });
    if (!atual) return res.status(404).json({ erro: "Evento não encontrado." });
    const campos = camposEvento(req.body, atual);
    if (campos.erro) return res.status(400).json({ erro: campos.erro });
    const evento = await prisma.evento.update({ where: { id: atual.id }, data: campos.data, select: selectEvento });
    return res.json(evento);
  } catch (error) {
    console.error("Erro ao editar evento:", error);
    return res.status(500).json({ erro: "Não foi possível salvar o evento." });
  }
});

// ?cancelar_convite=1: antes de excluir, envia o cancelamento (METHOD:CANCEL) a quem recebeu o convite.
// Se o e-mail falhar, o evento NÃO é excluído (dá para tentar de novo ou excluir sem avisar).
router.delete("/:id", async (req, res) => {
  if (!uuidValido.test(req.params.id)) return res.status(400).json({ erro: "ID de evento inválido." });
  try {
    const existe = await prisma.evento.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!existe) return res.status(404).json({ erro: "Evento não encontrado." });

    if (["1", "true"].includes(req.query.cancelar_convite)) {
      const alvo = await carregarAlvo({ evento_id: existe.id });
      await cancelarLembrete(alvo, { usuario: req.usuario });
    }
    // O histórico de envios fica (evento_id vira NULL pela chave estrangeira).
    await prisma.evento.delete({ where: { id: existe.id } });
    return res.status(204).end();
  } catch (error) {
    if (error instanceof ErroLembrete) return res.status(error.status).json({ erro: error.message });
    console.error("Erro ao excluir evento:", error);
    return res.status(500).json({ erro: "Não foi possível excluir o evento." });
  }
});

module.exports = router;
