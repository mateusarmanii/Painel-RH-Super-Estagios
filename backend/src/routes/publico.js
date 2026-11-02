// Rotas públicas (sem login), com limite de requisições por IP:
//   GET  /publico/vagas                          vagas abertas (só com o formulário público ligado nas Configurações)
//   POST /publico/candidatura                    cadastro do estudante pelo formulário público (exige consentimento LGPD)
//   GET  /publico/entrevista/:token              dados da entrevista para o candidato confirmar presença
//   POST /publico/entrevista/:token              { resposta: "confirmar" | "remarcar", mensagem? }
//   GET  /publico/portal/:token                  portal da empresa: candidatos enviados para a vaga
//   POST /publico/portal/:token/parecer          { aplicacao_id, parecer, comentario?, nome_avaliador? }
//   GET  /publico/portal/:token/curriculo/:aplicacaoId
// Nada daqui muda a etapa de uma candidatura sozinho: o RH continua decidindo no Kanban.
const express = require("express");
const { rateLimit } = require("express-rate-limit");
const prisma = require("../prisma");
const { uuidValido } = require("../utils");
const { ETAPA_INICIAL } = require("../etapas");
const { registrarEtapa } = require("../historico");
const { lerConfiguracao } = require("../configuracoes");
const { areaDaVaga } = require("../compatibilidade");
const { idDoTokenEntrevista, conferirTokenEntrevista, tokenPortalValido } = require("../tokens");
const { enviarArquivo } = require("../arquivos");

const router = express.Router();

const limite = (max) => rateLimit({ windowMs: 15 * 60 * 1000, limit: max, standardHeaders: "draft-8", legacyHeaders: false,
  message: { erro: "Muitas requisições. Aguarde alguns minutos e tente de novo." } });
router.use(limite(300));
const limiteEnvios = limite(20);

const ETAPAS_NO_PORTAL = ["ENVIADO_EMPRESA", "ENTREVISTA_AGENDADA", "EM_TESTE", "APROVADO"];
const PARECERES = new Set(["APROVADO", "TALVEZ", "REPROVADO"]);
const textoOpcional = (valor, max) => valor === undefined || valor === null || valor === "" || (typeof valor === "string" && valor.trim().length <= max);

// ---------- Vagas e formulário público ----------

async function formularioLigado(res) {
  if (await lerConfiguracao("formulario_publico_ativo")) return true;
  res.status(404).json({ erro: "O cadastro pelo site não está disponível no momento." });
  return false;
}

router.get("/vagas", async (_req, res) => {
  try {
    if (!(await formularioLigado(res))) return undefined;
    const mostrarEmpresa = await lerConfiguracao("vagas_publicas_mostrar_empresa");
    const vagas = await prisma.vaga.findMany({
      where: { status: "ABERTA", arquivada_em: null },
      orderBy: { created_at: "desc" },
      select: {
        id: true, codigo_vaga: true, titulo: true, descricao: true, valor: true, turno: true, horario: true, modalidade: true,
        cidade: true, bairro: true, area_manual: true, created_at: true, empresa: { select: { nome: true, setor: true } },
      },
    });
    return res.json(vagas.map(({ empresa, area_manual, ...vaga }) => ({
      ...vaga,
      area: areaDaVaga({ ...vaga, area_manual, empresa }).areas[0]?.nome ?? null,
      empresa: mostrarEmpresa ? empresa.nome : null,
    })));
  } catch (error) {
    console.error("Erro ao listar vagas públicas:", error);
    return res.status(500).json({ erro: "Não foi possível carregar as vagas." });
  }
});

router.post("/candidatura", limiteEnvios, async (req, res) => {
  const { nome_completo, telefone, email, curso, instituicao_ensino, cidade, vaga_id, consentimento, site } = req.body ?? {};
  // Campo escondido "site": robôs preenchem, pessoas não. Responde como sucesso e não grava.
  if (site) return res.status(201).json({ mensagem: "Cadastro recebido." });
  if (typeof nome_completo !== "string" || nome_completo.trim().length < 3 || nome_completo.length > 120) {
    return res.status(400).json({ erro: "Informe seu nome completo." });
  }
  const digitos = String(telefone ?? "").replace(/\D/g, "");
  if (digitos.length < 10 || digitos.length > 13) return res.status(400).json({ erro: "Informe um telefone com DDD." });
  if (typeof curso !== "string" || !curso.trim() || curso.length > 120) return res.status(400).json({ erro: "Informe seu curso." });
  if (email && (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) return res.status(400).json({ erro: "E-mail inválido." });
  if (!textoOpcional(instituicao_ensino, 120) || !textoOpcional(cidade, 100)) return res.status(400).json({ erro: "Dados inválidos." });
  if (consentimento !== true) return res.status(400).json({ erro: "É preciso aceitar o uso dos dados para o cadastro." });
  if (vaga_id && !uuidValido.test(vaga_id)) return res.status(400).json({ erro: "Vaga inválida." });

  try {
    if (!(await formularioLigado(res))) return undefined;
    if (vaga_id) {
      const vaga = await prisma.vaga.findUnique({ where: { id: vaga_id }, select: { status: true } });
      if (vaga?.status !== "ABERTA") return res.status(409).json({ erro: "Esta vaga não está mais aberta." });
    }
    await prisma.$transaction(async (transaction) => {
      const [existente] = await transaction.$queryRaw`
        SELECT id FROM "Estudante" WHERE regexp_replace(telefone, '\\D', '', 'g') = ${digitos} LIMIT 1`;
      // Telefone já cadastrado: não mexe nos dados (pode não ser a mesma pessoa); só inscreve na vaga.
      const estudanteId = existente?.id ?? (await transaction.estudante.create({
        data: {
          nome_completo: nome_completo.trim(),
          telefone: String(telefone).trim(),
          email: email?.trim() || null,
          curso: curso.trim(),
          instituicao_ensino: instituicao_ensino?.trim() || null,
          cidade: cidade?.trim() || null,
          origem: "FORMULARIO",
          consentimento_em: new Date(),
        },
        select: { id: true },
      })).id;
      if (vaga_id) {
        const jaInscrito = await transaction.aplicacao.findUnique({ where: { vaga_id_estudante_id: { vaga_id, estudante_id: estudanteId } } });
        if (!jaInscrito) {
          const aplicacao = await transaction.aplicacao.create({ data: { vaga_id, estudante_id: estudanteId, status_kanban: ETAPA_INICIAL } });
          await registrarEtapa(transaction, { aplicacaoId: aplicacao.id, de: null, para: ETAPA_INICIAL }, null);
        }
      }
    });
    // Mesma resposta para cadastro novo ou telefone já existente (não revela quem está cadastrado).
    return res.status(201).json({ mensagem: "Cadastro recebido! Nossa equipe vai entrar em contato." });
  } catch (error) {
    console.error("Erro no cadastro público:", error);
    return res.status(500).json({ erro: "Não foi possível enviar o cadastro. Tente novamente." });
  }
});

// ---------- Confirmação de presença ----------

const selectEntrevistaPublica = {
  id: true,
  status_kanban: true,
  data_hora_entrevista: true,
  entrevista_status: true,
  entrevista_formato: true,
  entrevista_local: true,
  entrevista_duracao: true,
  remarcacao_pedida_em: true,
  estudante: { select: { id: true, nome_completo: true } },
  vaga: { select: { titulo: true, empresa: { select: { nome: true } } } },
};

async function entrevistaDoToken(token) {
  const id = idDoTokenEntrevista(token);
  if (!id) return null;
  const aplicacao = await prisma.aplicacao.findUnique({ where: { id }, select: selectEntrevistaPublica });
  return aplicacao && conferirTokenEntrevista(token, aplicacao) ? aplicacao : null;
}

const respostaEntrevista = (a) => ({
  primeiro_nome: a.estudante.nome_completo.trim().split(/\s+/)[0],
  vaga: a.vaga.titulo,
  empresa: a.vaga.empresa.nome,
  data_hora: a.data_hora_entrevista,
  duracao: a.entrevista_duracao,
  formato: a.entrevista_formato,
  local: a.entrevista_local,
  status: a.entrevista_status ?? "AGUARDANDO",
  remarcacao_pedida: Boolean(a.remarcacao_pedida_em),
  // Só dá para responder enquanto a entrevista está marcada e ainda não aconteceu.
  aberta: a.status_kanban === "ENTREVISTA_AGENDADA" && a.data_hora_entrevista > new Date()
    && ["AGUARDANDO", "CONFIRMADA", null].includes(a.entrevista_status),
});

router.get("/entrevista/:token", async (req, res) => {
  try {
    const aplicacao = await entrevistaDoToken(req.params.token);
    if (!aplicacao) return res.status(404).json({ erro: "Link inválido ou vencido. A entrevista pode ter sido remarcada." });
    return res.json(respostaEntrevista(aplicacao));
  } catch (error) {
    console.error("Erro ao abrir confirmação:", error);
    return res.status(500).json({ erro: "Não foi possível carregar a entrevista." });
  }
});

router.post("/entrevista/:token", limiteEnvios, async (req, res) => {
  const { resposta, mensagem } = req.body ?? {};
  if (!["confirmar", "remarcar"].includes(resposta)) return res.status(400).json({ erro: "Resposta inválida." });
  if (!textoOpcional(mensagem, 500)) return res.status(400).json({ erro: "Mensagem muito longa (até 500 caracteres)." });
  try {
    const aplicacao = await entrevistaDoToken(req.params.token);
    if (!aplicacao) return res.status(404).json({ erro: "Link inválido ou vencido. A entrevista pode ter sido remarcada." });
    if (!respostaEntrevista(aplicacao).aberta) return res.status(409).json({ erro: "Esta entrevista não aceita mais respostas." });

    if (resposta === "confirmar") {
      await prisma.aplicacao.update({ where: { id: aplicacao.id }, data: { entrevista_status: "CONFIRMADA", remarcacao_pedida_em: null, remarcacao_mensagem: null } });
    } else {
      const texto = mensagem?.trim() || null;
      await prisma.$transaction([
        prisma.aplicacao.update({ where: { id: aplicacao.id }, data: { remarcacao_pedida_em: new Date(), remarcacao_mensagem: texto } }),
        prisma.contato.create({
          data: {
            estudante_id: aplicacao.estudante.id,
            aplicacao_id: aplicacao.id,
            tipo: "NOTA",
            texto: `Pediu para remarcar a entrevista (${aplicacao.vaga.titulo}) pelo link de confirmação.${texto ? ` Mensagem: ${texto}` : ""}`,
          },
        }),
      ]);
    }
    const atualizada = await prisma.aplicacao.findUnique({ where: { id: aplicacao.id }, select: selectEntrevistaPublica });
    return res.json(respostaEntrevista(atualizada));
  } catch (error) {
    console.error("Erro ao responder confirmação:", error);
    return res.status(500).json({ erro: "Não foi possível registrar a resposta." });
  }
});

// ---------- Portal da empresa ----------

async function vagaDoPortal(token) {
  if (!tokenPortalValido(token)) return null;
  return prisma.vaga.findUnique({
    where: { portal_token: token },
    select: { id: true, titulo: true, codigo_vaga: true, status: true, empresa: { select: { nome: true, logo_arquivo_id: true } } },
  });
}

router.get("/portal/:token", async (req, res) => {
  try {
    const vaga = await vagaDoPortal(req.params.token);
    if (!vaga) return res.status(404).json({ erro: "Link inválido ou desativado. Peça um novo link à Super Estágios." });
    const aplicacoes = await prisma.aplicacao.findMany({
      where: { vaga_id: vaga.id, status_kanban: { in: ETAPAS_NO_PORTAL } },
      orderBy: { created_at: "asc" },
      select: {
        id: true,
        status_kanban: true,
        data_hora_entrevista: true,
        estudante: { select: { nome_completo: true, curso: true, instituicao_ensino: true, semestre_atual: true, turno_estudo: true, cidade: true, curriculo_arquivo_id: true } },
        pareceres: { orderBy: { created_at: "desc" }, take: 1, select: { parecer: true, comentario: true, nome_avaliador: true, created_at: true } },
      },
    });
    return res.json({
      vaga: { titulo: vaga.titulo, codigo_vaga: vaga.codigo_vaga, status: vaga.status, empresa: vaga.empresa.nome, logo_arquivo_id: vaga.empresa.logo_arquivo_id },
      candidatos: aplicacoes.map(({ estudante: { curriculo_arquivo_id, ...estudante }, pareceres, ...aplicacao }) => ({
        ...aplicacao,
        ...estudante,
        tem_curriculo: Boolean(curriculo_arquivo_id),
        parecer: pareceres[0] ?? null,
      })),
    });
  } catch (error) {
    console.error("Erro ao abrir portal:", error);
    return res.status(500).json({ erro: "Não foi possível carregar o portal." });
  }
});

async function aplicacaoDoPortal(vaga, aplicacaoId) {
  if (!uuidValido.test(aplicacaoId ?? "")) return null;
  return prisma.aplicacao.findFirst({
    where: { id: aplicacaoId, vaga_id: vaga.id, status_kanban: { in: ETAPAS_NO_PORTAL } },
    select: { id: true, estudante: { select: { curriculo: { select: { mime: true, nome_original: true, conteudo: true } } } } },
  });
}

router.post("/portal/:token/parecer", limiteEnvios, async (req, res) => {
  const { aplicacao_id, parecer, comentario, nome_avaliador } = req.body ?? {};
  if (!PARECERES.has(parecer)) return res.status(400).json({ erro: "Escolha um parecer." });
  if (!textoOpcional(comentario, 1000) || !textoOpcional(nome_avaliador, 100)) return res.status(400).json({ erro: "Texto muito longo." });
  try {
    const vaga = await vagaDoPortal(req.params.token);
    if (!vaga) return res.status(404).json({ erro: "Link inválido ou desativado." });
    const aplicacao = await aplicacaoDoPortal(vaga, aplicacao_id);
    if (!aplicacao) return res.status(404).json({ erro: "Candidato não encontrado nesta vaga." });
    const salvo = await prisma.parecerEmpresa.create({
      data: { aplicacao_id: aplicacao.id, parecer, comentario: comentario?.trim() || null, nome_avaliador: nome_avaliador?.trim() || null },
      select: { parecer: true, comentario: true, nome_avaliador: true, created_at: true },
    });
    return res.status(201).json(salvo);
  } catch (error) {
    console.error("Erro ao registrar parecer:", error);
    return res.status(500).json({ erro: "Não foi possível registrar o parecer." });
  }
});

router.get("/portal/:token/curriculo/:aplicacaoId", async (req, res) => {
  try {
    const vaga = await vagaDoPortal(req.params.token);
    if (!vaga) return res.status(404).json({ erro: "Link inválido ou desativado." });
    const aplicacao = await aplicacaoDoPortal(vaga, req.params.aplicacaoId);
    const arquivo = aplicacao?.estudante.curriculo;
    if (!arquivo) return res.status(404).json({ erro: "Currículo não encontrado." });
    return enviarArquivo(res, arquivo, { disposicao: "inline", cache: "private, no-store" });
  } catch (error) {
    console.error("Erro ao enviar currículo do portal:", error);
    return res.status(500).json({ erro: "Não foi possível abrir o currículo." });
  }
});

module.exports = router;
