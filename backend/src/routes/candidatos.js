const express = require("express");
const prisma = require("../prisma");
const { uuidValido, pluralizar } = require("../utils");
const { camposEstudante, observacao } = require("../campos");
const { camposEntrevista, conflitosDoEstudante, statusAoSairDaEntrevista } = require("../agenda");

const router = express.Router();
const statusKanbanValidos = new Set([
  "ENVIADO_EMPRESA",
  "ENTREVISTA_AGENDADA",
  "AGUARDANDO_RETORNO",
  "APROVADO",
  "RECUSADO",
]);

router.get("/", async (_req, res) => {
  try {
    const candidatos = await prisma.estudante.findMany({
      include: {
        aplicacoes: {
          select: {
            id: true,
            vaga_id: true,
            status_kanban: true,
            data_hora_entrevista: true,
            motivo_recusa: true,
            observacao: true,
            data_aprovacao: true,
            created_at: true,
            // Enquanto RECUSADO, a última atualização corresponde à data da dispensa (Banco de Talentos).
            updated_at: true,
            vaga: {
              select: { codigo_vaga: true, titulo: true, empresa: { select: { id: true, nome: true, logo_url: true } } },
            },
          },
          orderBy: { created_at: "desc" },
        },
      },
      orderBy: { nome_completo: "asc" },
    });

    return res.json(candidatos);
  } catch (error) {
    console.error("Erro ao listar candidatos:", error);
    return res.status(500).json({ erro: "Não foi possível listar os candidatos." });
  }
});

// Perfil do estudante: dados e todas as candidaturas, com entrevistas, observações e motivos de dispensa.
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  if (!uuidValido.test(id)) {
    return res.status(400).json({ erro: "ID de candidato inválido." });
  }

  try {
    const estudante = await prisma.estudante.findUnique({
      where: { id },
      include: {
        aplicacoes: {
          orderBy: { created_at: "desc" },
          include: {
            vaga: {
              select: {
                id: true,
                codigo_vaga: true,
                titulo: true,
                status: true,
                turno: true,
                valor: true,
                empresa: { select: { id: true, nome: true, logo_url: true } },
              },
            },
          },
        },
      },
    });
    if (!estudante) return res.status(404).json({ erro: "Candidato não encontrado." });
    return res.json(estudante);
  } catch (error) {
    console.error("Erro ao carregar candidato:", error);
    return res.status(500).json({ erro: "Não foi possível carregar o candidato." });
  }
});

router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { aplicacao_id, status_kanban, data_hora_entrevista, motivo_recusa } = req.body ?? {};

  if (!uuidValido.test(id) || !uuidValido.test(aplicacao_id ?? "")) {
    return res.status(400).json({ erro: "ID de candidato ou aplicação inválido." });
  }

  if (!statusKanbanValidos.has(status_kanban)) {
    return res.status(400).json({ erro: "Status de candidatura inválido." });
  }

  const dataEntrevista = data_hora_entrevista ? new Date(data_hora_entrevista) : null;
  if (status_kanban === "ENTREVISTA_AGENDADA" && (!dataEntrevista || Number.isNaN(dataEntrevista.getTime()))) {
    return res.status(400).json({ erro: "Informe uma data e hora válidas para a entrevista." });
  }

  const motivo = typeof motivo_recusa === "string" ? motivo_recusa.trim() : "";
  if (status_kanban === "RECUSADO" && !motivo) {
    return res.status(400).json({ erro: "Informe o motivo da dispensa." });
  }

  const detalhes = status_kanban === "ENTREVISTA_AGENDADA" ? camposEntrevista(req.body) : { data: {} };
  if (detalhes.erro) return res.status(400).json({ erro: detalhes.erro });

  try {
    const aplicacao = await prisma.aplicacao.findFirst({
      where: { id: aplicacao_id, estudante_id: id },
      select: { id: true, status_kanban: true, entrevista_status: true, entrevista_duracao: true },
    });

    if (!aplicacao) {
      return res.status(404).json({ erro: "Aplicação não encontrada para este candidato." });
    }

    // data_aprovacao marca a contratação: grava ao entrar em APROVADO e limpa ao sair.
    const data = { status_kanban };
    if (status_kanban === "APROVADO" && aplicacao.status_kanban !== "APROVADO") {
      data.data_aprovacao = new Date();
    } else if (status_kanban !== "APROVADO") {
      data.data_aprovacao = null;
    }

    // A data da entrevista fica no histórico mesmo após mudar de coluna; o motivo só vale enquanto RECUSADO.
    if (status_kanban === "ENTREVISTA_AGENDADA") {
      // Agendar (ou reagendar) começa sempre como "Aguardando" confirmação.
      Object.assign(data, detalhes.data, { data_hora_entrevista: dataEntrevista, entrevista_status: "AGUARDANDO" });
    } else if (aplicacao.status_kanban === "ENTREVISTA_AGENDADA") {
      data.entrevista_status = statusAoSairDaEntrevista(aplicacao.entrevista_status, status_kanban);
    }
    data.motivo_recusa = status_kanban === "RECUSADO" ? motivo : null;

    const atualizada = await prisma.aplicacao.update({
      where: { id: aplicacao.id },
      data,
      select: {
        id: true,
        estudante_id: true,
        vaga_id: true,
        status_kanban: true,
        data_hora_entrevista: true,
        motivo_recusa: true,
        data_aprovacao: true,
        entrevista_status: true,
        entrevista_formato: true,
        entrevista_local: true,
        entrevista_duracao: true,
        entrevistador: true,
      },
    });

    // Aviso (não bloqueia): o estudante já tem outra entrevista nesse horário.
    const conflitos = status_kanban === "ENTREVISTA_AGENDADA"
      ? await conflitosDoEstudante(prisma, {
        estudanteId: id,
        aplicacaoId: atualizada.id,
        inicio: atualizada.data_hora_entrevista,
        duracao: atualizada.entrevista_duracao,
      })
      : [];

    return res.json({ ...atualizada, conflitos });
  } catch (error) {
    console.error("Erro ao atualizar candidatura:", error);
    return res.status(500).json({ erro: "Não foi possível atualizar a candidatura." });
  }
});

// Observação livre da candidatura (menu "⋯" do Kanban). Vazia apaga; não interfere na etapa nem no motivo da dispensa.
router.put("/:id/candidaturas/:aplicacaoId/observacao", async (req, res) => {
  const { id, aplicacaoId } = req.params;

  if (!uuidValido.test(id) || !uuidValido.test(aplicacaoId)) {
    return res.status(400).json({ erro: "ID de candidato ou aplicação inválido." });
  }

  const campo = observacao(req.body?.observacao);
  if (campo.erro) return res.status(400).json({ erro: campo.erro });

  try {
    const aplicacao = await prisma.aplicacao.findFirst({
      where: { id: aplicacaoId, estudante_id: id },
      select: { id: true },
    });
    if (!aplicacao) {
      return res.status(404).json({ erro: "Aplicação não encontrada para este candidato." });
    }

    const atualizada = await prisma.aplicacao.update({
      where: { id: aplicacao.id },
      data: campo.data,
      select: { id: true, status_kanban: true, motivo_recusa: true, observacao: true },
    });
    return res.json(atualizada);
  } catch (error) {
    console.error("Erro ao salvar observação:", error);
    return res.status(500).json({ erro: "Não foi possível salvar a observação." });
  }
});

// Indica um estudante já cadastrado para outra vaga (Banco de Talentos): nova candidatura em ENVIADO_EMPRESA.
router.post("/:id/candidaturas", async (req, res) => {
  const { id } = req.params;
  const { vaga_id } = req.body ?? {};

  if (!uuidValido.test(id) || !uuidValido.test(vaga_id ?? "")) {
    return res.status(400).json({ erro: "ID de candidato ou de vaga inválido." });
  }

  try {
    const [estudante, vaga] = await Promise.all([
      prisma.estudante.findUnique({ where: { id }, select: { id: true } }),
      prisma.vaga.findUnique({ where: { id: vaga_id }, select: { id: true, status: true } }),
    ]);

    if (!estudante) return res.status(404).json({ erro: "Candidato não encontrado." });
    if (!vaga) return res.status(404).json({ erro: "Vaga não encontrada." });
    if (vaga.status !== "ABERTA") {
      return res.status(409).json({ erro: "A vaga selecionada não está aberta." });
    }

    const candidatura = await prisma.aplicacao.create({
      data: { estudante_id: id, vaga_id },
      include: { vaga: { select: { codigo_vaga: true, titulo: true, empresa: { select: { id: true, nome: true, logo_url: true } } } } },
    });

    return res.status(201).json(candidatura);
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ erro: "Este candidato já está inscrito nessa vaga." });
    }

    console.error("Erro ao indicar candidato para vaga:", error);
    return res.status(500).json({ erro: "Não foi possível indicar o candidato para a vaga." });
  }
});

router.post("/", async (req, res) => {
  const {
    nome_completo,
    telefone,
    email,
    curso,
    instituicao_ensino,
    link_curriculo,
    endereco,
    anotacoes_recrutador,
    vaga_id,
  } = req.body ?? {};

  if (!nome_completo || !telefone || !curso || !instituicao_ensino) {
    return res.status(400).json({
      erro: "Informe nome, telefone, curso e instituição de ensino.",
    });
  }

  const extras = camposEstudante(req.body);
  if (extras.erro) return res.status(400).json({ erro: extras.erro });

  // Vaga é opcional: sem ela o estudante é criado sem candidatura e pode ser indicado depois.
  if (vaga_id && !uuidValido.test(vaga_id)) {
    return res.status(400).json({ erro: "ID de vaga inválido." });
  }

  try {
    const candidato = await prisma.$transaction(async (transaction) => {
      if (vaga_id) {
        const vaga = await transaction.vaga.findUnique({
          where: { id: vaga_id },
          select: { id: true, status: true },
        });

        if (!vaga) {
          const error = new Error("Vaga não encontrada.");
          error.status = 404;
          throw error;
        }

        if (vaga.status !== "ABERTA") {
          const error = new Error("A vaga selecionada não está aberta.");
          error.status = 409;
          throw error;
        }
      }

      return transaction.estudante.create({
        data: {
          nome_completo,
          telefone,
          email,
          curso,
          instituicao_ensino,
          link_curriculo,
          endereco,
          anotacoes_recrutador,
          ...extras.data,
          ...(vaga_id && { aplicacoes: { create: { vaga: { connect: { id: vaga_id } } } } }),
        },
        include: { aplicacoes: true },
      });
    });

    return res.status(201).json(candidato);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ erro: error.message });
    }

    console.error("Erro ao criar candidato:", error);
    return res.status(500).json({ erro: "Não foi possível criar o candidato." });
  }
});

// Edita os dados do estudante; candidaturas são gerenciadas pelo PATCH (Kanban).
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    nome_completo,
    telefone,
    email,
    curso,
    instituicao_ensino,
    link_curriculo,
    endereco,
    anotacoes_recrutador,
  } = req.body ?? {};

  if (!uuidValido.test(id)) {
    return res.status(400).json({ erro: "ID de candidato inválido." });
  }

  if (!nome_completo || !telefone || !curso || !instituicao_ensino) {
    return res.status(400).json({
      erro: "Informe nome, telefone, curso e instituição de ensino.",
    });
  }

  const extras = camposEstudante(req.body);
  if (extras.erro) return res.status(400).json({ erro: extras.erro });

  try {
    const candidato = await prisma.estudante.update({
      where: { id },
      data: {
        nome_completo,
        telefone,
        email,
        curso,
        instituicao_ensino,
        link_curriculo,
        endereco,
        anotacoes_recrutador,
        ...extras.data,
      },
    });

    return res.json(candidato);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ erro: "Candidato não encontrado." });
    }

    console.error("Erro ao atualizar candidato:", error);
    return res.status(500).json({ erro: "Não foi possível atualizar o candidato." });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  if (!uuidValido.test(id)) {
    return res.status(400).json({ erro: "ID de candidato inválido." });
  }

  try {
    const candidato = await prisma.estudante.findUnique({
      where: { id },
      select: { _count: { select: { aplicacoes: true } } },
    });

    if (!candidato) {
      return res.status(404).json({ erro: "Candidato não encontrado." });
    }

    const totalAplicacoes = candidato._count.aplicacoes;
    if (totalAplicacoes > 0) {
      return res.status(409).json({
        erro: `Não é possível excluir este candidato: ele possui ${pluralizar(totalAplicacoes, "candidatura vinculada", "candidaturas vinculadas")}.`,
      });
    }

    await prisma.estudante.delete({ where: { id } });
    return res.status(204).end();
  } catch (error) {
    if (error.code === "P2003") {
      return res.status(409).json({ erro: "Não é possível excluir este candidato: ele possui candidaturas vinculadas." });
    }
    if (error.code === "P2025") {
      return res.status(404).json({ erro: "Candidato não encontrado." });
    }

    console.error("Erro ao excluir candidato:", error);
    return res.status(500).json({ erro: "Não foi possível excluir o candidato." });
  }
});

module.exports = router;