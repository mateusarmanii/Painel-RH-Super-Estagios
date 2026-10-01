require("dotenv").config();

const express = require("express");
const cors = require("cors");
const prisma = require("./src/prisma");
const vagasRoutes = require("./src/routes/vagas");
const candidatosRoutes = require("./src/routes/candidatos");

const app = express();
const port = Number(process.env.PORT) || 3333;

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ status: "ok", mensagem: "API Super Estágios" });
});

app.use("/vagas", vagasRoutes);
app.use("/candidatos", candidatosRoutes);

const server = app.listen(port, () => {
  console.log(`API disponível em http://localhost:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);