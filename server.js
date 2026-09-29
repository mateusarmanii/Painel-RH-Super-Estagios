require("dotenv").config();

const cors = require("cors");
const express = require("express");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const app = express();

app.use(cors());
app.use(express.json());

app.get("/franquias", async (req, res) => {
  try {
    const franquias = await prisma.franquia.findMany();
    res.json(franquias);
  } catch (error) {
    res.status(500).json({ erro: "Não foi possível listar as franquias." });
  }
});

app.post("/franquias", async (req, res) => {
  const { nome, cidade } = req.body;

  if (!nome || !cidade) {
    return res.status(400).json({ erro: "Nome e cidade são obrigatórios." });
  }

  try {
    const franquia = await prisma.franquia.create({ data: { nome, cidade } });
    res.status(201).json(franquia);
  } catch (error) {
    res.status(500).json({ erro: "Não foi possível criar a franquia." });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});