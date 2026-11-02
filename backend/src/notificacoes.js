// Avisos do sino (calculados na hora a partir do banco; nada é gravado). Usado pela rota GET /notificacoes e
// pelo envio para o Telegram (src/telegram.js).
// Cada item: { id, tipo, gravidade: "alta"|"media"|"info", titulo, descricao, link, quando, chave? }.
// O id é estável para o mesmo acontecimento ("lida" no navegador). "chave" (quando existe) é a identidade para não
// reenviar no celular um aviso cujo texto muda todo dia (contagem regressiva do contrato).
const prisma = require("./prisma");
const { DIA_MS, DIAS_PARA_ALERTA } = require("./utils");
const { ETAPAS_AVANCADAS } = require("./etapas");
const { situacaoEstagio } = require("./estagios");
const { selectEstagio } = require("./routes/estagios");

const HORA_MS = 60 * 60 * 1000;
const diaUtc = (data) => new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });

async function montarNotificacoes(agora = new Date()) {
  const hoje = diaUtc(agora);
  const [entrevistas, remarcacoes, vagasAbertas, estagios, retornos, pareceres, cadastros] = await Promise.all([
    prisma.aplicacao.findMany({
      where: {
        status_kanban: "ENTREVISTA_AGENDADA",
        data_hora_entrevista: { gte: agora, lt: new Date(agora.getTime() + 3 * HORA_MS) },
        OR: [{ entrevista_status: null }, { entrevista_status: { in: ["AGUARDANDO", "CONFIRMADA"] } }],
      },
      select: { id: true, data_hora_entrevista: true, entrevista_status: true, estudante: { select: { nome_completo: true } }, vaga: { select: { id: true, titulo: true } } },
    }),
    prisma.aplicacao.findMany({
      where: { remarcacao_pedida_em: { not: null }, status_kanban: "ENTREVISTA_AGENDADA" },
      select: { id: true, remarcacao_pedida_em: true, remarcacao_mensagem: true, estudante: { select: { id: true, nome_completo: true } }, vaga: { select: { titulo: true } } },
    }),
    prisma.vaga.findMany({
      where: { status: "ABERTA" },
      select: { id: true, titulo: true, codigo_vaga: true, created_at: true, prazo: true, aplicacoes: { select: { status_kanban: true } } },
    }),
    prisma.aplicacao.findMany({
      where: { status_kanban: "APROVADO", estagio: { isNot: null } },
      select: { id: true, estudante: { select: { nome_completo: true } }, vaga: { select: { empresa: { select: { nome: true } } } }, estagio: { select: selectEstagio } },
    }),
    prisma.contato.findMany({
      where: { proximo_contato: { lte: hoje } },
      orderBy: { proximo_contato: "asc" },
      take: 50,
      select: { id: true, proximo_contato: true, texto: true, estudante: { select: { id: true, nome_completo: true } }, empresa: { select: { id: true, nome: true } } },
    }),
    prisma.parecerEmpresa.findMany({
      where: { created_at: { gte: new Date(agora.getTime() - 3 * DIA_MS) } },
      orderBy: { created_at: "desc" },
      take: 30,
      select: { id: true, parecer: true, created_at: true, aplicacao: { select: { vaga_id: true, estudante: { select: { nome_completo: true } }, vaga: { select: { titulo: true } } } } },
    }),
    prisma.estudante.findMany({
      where: { origem: "FORMULARIO", consentimento_em: { gte: new Date(agora.getTime() - 3 * DIA_MS) } },
      orderBy: { consentimento_em: "desc" },
      take: 30,
      select: { id: true, nome_completo: true, curso: true, consentimento_em: true },
    }),
  ]);

  const itens = [];
  for (const e of entrevistas) {
    const confirmada = e.entrevista_status === "CONFIRMADA";
    itens.push({
      id: `entrevista-${e.id}-${e.data_hora_entrevista.toISOString()}`,
      tipo: "entrevista",
      gravidade: confirmada ? "info" : "alta",
      titulo: `Entrevista às ${hora.format(e.data_hora_entrevista)}${confirmada ? "" : " sem confirmação"}`,
      descricao: `${e.estudante.nome_completo} · ${e.vaga.titulo}`,
      link: "/calendario",
      quando: e.data_hora_entrevista,
    });
  }
  for (const r of remarcacoes) {
    itens.push({
      id: `remarcar-${r.id}-${r.remarcacao_pedida_em.toISOString()}`,
      tipo: "remarcacao",
      gravidade: "alta",
      titulo: `${r.estudante.nome_completo} pediu para remarcar`,
      descricao: `${r.vaga.titulo}${r.remarcacao_mensagem ? ` · "${r.remarcacao_mensagem}"` : ""}`,
      link: "/calendario",
      quando: r.remarcacao_pedida_em,
    });
  }
  for (const v of vagasAbertas) {
    const parada = agora - v.created_at > DIAS_PARA_ALERTA * DIA_MS && !v.aplicacoes.some((a) => ETAPAS_AVANCADAS.includes(a.status_kanban));
    if (parada) {
      itens.push({ id: `alerta-${v.id}`, tipo: "vaga_alerta", gravidade: "media", titulo: "Vaga parada", descricao: `${v.titulo} · Nº ${v.codigo_vaga} · ${Math.floor((agora - v.created_at) / DIA_MS)} dias sem entrevista`, link: `/kanban/${v.id}`, quando: v.created_at });
    }
    if (v.prazo) {
      const dias = Math.round((new Date(v.prazo) - hoje) / DIA_MS);
      if (dias <= 3) {
        itens.push({
          id: `prazo-${v.id}-${new Date(v.prazo).toISOString().slice(0, 10)}`,
          tipo: "prazo",
          gravidade: dias < 0 ? "alta" : "media",
          titulo: dias < 0 ? "Prazo da vaga vencido" : dias === 0 ? "Prazo da vaga é hoje" : `Prazo da vaga em ${dias} ${dias === 1 ? "dia" : "dias"}`,
          descricao: `${v.titulo} · Nº ${v.codigo_vaga} · prazo ${dia.format(new Date(v.prazo))}`,
          link: `/kanban/${v.id}`,
          quando: v.prazo,
        });
      }
    }
  }
  for (const c of estagios) {
    for (const alerta of situacaoEstagio(c.estagio, hoje).alertas) {
      itens.push({
        id: `estagio-${c.id}-${alerta.tipo}-${alerta.texto}`,
        chave: `estagio-${c.id}-${alerta.tipo}`,
        tipo: "estagio",
        gravidade: alerta.gravidade,
        titulo: alerta.texto,
        descricao: `${c.estudante.nome_completo} · ${c.vaga.empresa.nome}`,
        link: "/contratacoes",
        quando: c.estagio.updated_at,
      });
    }
  }
  for (const r of retornos) {
    const quem = r.estudante?.nome_completo ?? r.empresa?.nome ?? "";
    itens.push({
      id: `retorno-${r.id}-${r.proximo_contato.toISOString().slice(0, 10)}`,
      tipo: "retorno",
      gravidade: "media",
      titulo: `Retornar contato: ${quem}`,
      descricao: r.texto ? r.texto.slice(0, 120) : `Combinado para ${dia.format(r.proximo_contato)}`,
      link: r.estudante ? `/estudantes/${r.estudante.id}` : "/empresas-sem-vaga",
      quando: r.proximo_contato,
    });
  }
  const nomesParecer = { APROVADO: "aprovou", TALVEZ: "marcou como talvez", REPROVADO: "não aprovou" };
  for (const p of pareceres) {
    itens.push({
      id: `parecer-${p.id}`,
      tipo: "parecer",
      gravidade: "info",
      titulo: `Empresa ${nomesParecer[p.parecer]} ${p.aplicacao.estudante.nome_completo}`,
      descricao: p.aplicacao.vaga.titulo,
      link: `/kanban/${p.aplicacao.vaga_id}`,
      quando: p.created_at,
    });
  }
  for (const e of cadastros) {
    itens.push({ id: `cadastro-${e.id}`, tipo: "cadastro", gravidade: "info", titulo: "Novo cadastro pelo site", descricao: `${e.nome_completo} · ${e.curso}`, link: `/estudantes/${e.id}`, quando: e.consentimento_em });
  }

  const ordem = { alta: 0, media: 1, info: 2 };
  itens.sort((a, b) => ordem[a.gravidade] - ordem[b.gravidade] || new Date(b.quando) - new Date(a.quando));
  return itens.slice(0, 100);
}

module.exports = { montarNotificacoes };
