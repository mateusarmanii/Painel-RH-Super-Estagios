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
const diaSp = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

const DIAS_CANDIDATO_PARADO = 7;
const DIAS_VAGA_SEM_CANDIDATO = 3;
const DIAS_ENTREVISTA_SEM_RESULTADO = 14;
const DIAS_AVISO_FORMATURA = 60;
// Etapas em que o próximo passo depende do RH ou da empresa (Em Entrevista tem aviso próprio).
const ETAPAS_QUE_PODEM_PARAR = ["CANDIDATO_CONTATADO", "ENVIADO_EMPRESA", "EM_TESTE"];

async function montarNotificacoes(agora = new Date()) {
  const hoje = diaUtc(agora);
  const entrevistaEmAberto = [{ entrevista_status: null }, { entrevista_status: { in: ["AGUARDANDO", "CONFIRMADA"] } }];
  const [entrevistas, semResultado, contratacoes, vagasAbertas, estagios, retornos] = await Promise.all([
    prisma.aplicacao.findMany({
      where: {
        status_kanban: "ENTREVISTA_AGENDADA",
        data_hora_entrevista: { gte: agora, lt: new Date(agora.getTime() + 24 * HORA_MS) },
        OR: entrevistaEmAberto,
      },
      select: { id: true, data_hora_entrevista: true, entrevista_status: true, estudante: { select: { nome_completo: true } }, vaga: { select: { id: true, titulo: true } } },
    }),
    // Passou há mais de 1 hora e continua em "Em Entrevista": falta dizer como foi.
    prisma.aplicacao.findMany({
      where: {
        status_kanban: "ENTREVISTA_AGENDADA",
        data_hora_entrevista: { gte: new Date(agora.getTime() - DIAS_ENTREVISTA_SEM_RESULTADO * DIA_MS), lt: new Date(agora.getTime() - HORA_MS) },
        OR: entrevistaEmAberto,
      },
      select: { id: true, data_hora_entrevista: true, estudante: { select: { nome_completo: true } }, vaga: { select: { titulo: true } } },
    }),
    prisma.historicoEtapa.findMany({
      where: { para_status: "APROVADO", created_at: { gte: new Date(agora.getTime() - 3 * DIA_MS) } },
      orderBy: { created_at: "desc" },
      take: 30,
      select: { id: true, created_at: true, aplicacao: { select: { vaga_id: true, estudante: { select: { nome_completo: true } }, vaga: { select: { titulo: true, empresa: { select: { nome: true } } } } } } },
    }),
    prisma.vaga.findMany({
      where: { status: "ABERTA" },
      select: { id: true, titulo: true, codigo_vaga: true, created_at: true, prazo: true, quantidade: true, aplicacoes: { select: { status_kanban: true, updated_at: true } } },
    }),
    prisma.aplicacao.findMany({
      where: { status_kanban: "APROVADO", estagio: { isNot: null } },
      select: { id: true, estudante: { select: { nome_completo: true, previsao_formatura: true } }, vaga: { select: { empresa: { select: { nome: true } } } }, estagio: { select: selectEstagio } },
    }),
    prisma.contato.findMany({
      where: { proximo_contato: { lte: hoje } },
      orderBy: { proximo_contato: "asc" },
      take: 50,
      select: { id: true, proximo_contato: true, texto: true, estudante: { select: { id: true, nome_completo: true } }, empresa: { select: { id: true, nome: true } } },
    }),
  ]);

  const itens = [];
  for (const e of entrevistas) {
    const confirmada = e.entrevista_status === "CONFIRMADA";
    // De 3 a 24 horas antes, só avisa quem ainda não confirmou (a tempo de ligar para o candidato).
    if (e.data_hora_entrevista - agora > 3 * HORA_MS) {
      if (!confirmada) {
        itens.push({
          id: `entrevista-vespera-${e.id}-${e.data_hora_entrevista.toISOString()}`,
          tipo: "entrevista",
          gravidade: "media",
          titulo: `Entrevista em ${diaSp.format(e.data_hora_entrevista)} às ${hora.format(e.data_hora_entrevista)} sem confirmação`,
          descricao: `${e.estudante.nome_completo} · ${e.vaga.titulo}`,
          link: "/calendario",
          quando: e.data_hora_entrevista,
        });
      }
      continue;
    }
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
  for (const e of semResultado) {
    itens.push({
      id: `entrevista-resultado-${e.id}-${e.data_hora_entrevista.toISOString()}`,
      tipo: "entrevista",
      gravidade: "media",
      titulo: "Entrevista sem resultado registrado",
      descricao: `${e.estudante.nome_completo} · ${e.vaga.titulo} · foi em ${diaSp.format(e.data_hora_entrevista)}`,
      link: "/calendario",
      quando: e.data_hora_entrevista,
    });
  }
  for (const c of contratacoes) {
    itens.push({
      id: `contratacao-${c.id}`,
      tipo: "contratacao",
      gravidade: "info",
      titulo: `Contratação: ${c.aplicacao.estudante.nome_completo}`,
      descricao: `${c.aplicacao.vaga.titulo} · ${c.aplicacao.vaga.empresa.nome}`,
      link: `/kanban/${c.aplicacao.vaga_id}`,
      quando: c.created_at,
    });
  }
  for (const v of vagasAbertas) {
    const parada = agora - v.created_at > DIAS_PARA_ALERTA * DIA_MS && !v.aplicacoes.some((a) => ETAPAS_AVANCADAS.includes(a.status_kanban));
    if (parada) {
      itens.push({ id: `alerta-${v.id}`, tipo: "vaga_alerta", gravidade: "media", titulo: "Vaga parada", descricao: `${v.titulo} · Nº ${v.codigo_vaga} · ${Math.floor((agora - v.created_at) / DIA_MS)} dias sem entrevista`, link: `/kanban/${v.id}`, quando: v.created_at });
    }
    if (!parada && !v.aplicacoes.length && agora - v.created_at > DIAS_VAGA_SEM_CANDIDATO * DIA_MS) {
      itens.push({ id: `sem-candidato-${v.id}`, tipo: "vaga_sem_candidato", gravidade: "media", titulo: "Vaga sem candidatos", descricao: `${v.titulo} · Nº ${v.codigo_vaga} · aberta há ${Math.floor((agora - v.created_at) / DIA_MS)} dias`, link: `/kanban/${v.id}`, quando: v.created_at });
    }
    const parados = v.aplicacoes.filter((a) => ETAPAS_QUE_PODEM_PARAR.includes(a.status_kanban) && agora - a.updated_at > DIAS_CANDIDATO_PARADO * DIA_MS).length;
    if (parados) {
      // O id não leva a quantidade: mudar de 2 para 3 parados não gera outra mensagem.
      itens.push({ id: `parados-${v.id}`, tipo: "candidato_parado", gravidade: "media", titulo: `${parados === 1 ? "1 candidato parado" : `${parados} candidatos parados`} há mais de ${DIAS_CANDIDATO_PARADO} dias`, descricao: `${v.titulo} · Nº ${v.codigo_vaga}`, link: `/kanban/${v.id}`, quando: v.created_at });
    }
    const contratados = v.aplicacoes.filter((a) => a.status_kanban === "APROVADO").length;
    if (v.quantidade && contratados >= v.quantidade) {
      itens.push({ id: `completa-${v.id}`, tipo: "vaga_completa", gravidade: "media", titulo: "Vaga completa e ainda aberta", descricao: `${v.titulo} · Nº ${v.codigo_vaga} · ${contratados} de ${v.quantidade} contratados`, link: `/kanban/${v.id}`, quando: v.created_at });
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
    // Estágio exige matrícula: formatura antes do fim do contrato (ou sem data de fim) pede uma conversa com a empresa.
    const formatura = c.estudante.previsao_formatura && new Date(c.estudante.previsao_formatura);
    const contratoAcabaAntes = c.estagio.data_fim && new Date(c.estagio.data_fim) < formatura;
    if (formatura && !c.estagio.encerrado_em && !contratoAcabaAntes) {
      const dias = Math.round((formatura - hoje) / DIA_MS);
      if (dias >= 0 && dias <= DIAS_AVISO_FORMATURA) {
        itens.push({
          id: `formatura-${c.id}-${formatura.toISOString().slice(0, 10)}`,
          tipo: "formatura",
          gravidade: "media",
          titulo: `Estagiário se forma em ${dia.format(formatura)}`,
          descricao: `${c.estudante.nome_completo} · ${c.vaga.empresa.nome}`,
          link: "/contratacoes",
          quando: formatura,
        });
      }
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

  const ordem = { alta: 0, media: 1, info: 2 };
  itens.sort((a, b) => ordem[a.gravidade] - ordem[b.gravidade] || new Date(b.quando) - new Date(a.quando));
  return itens.slice(0, 100);
}

module.exports = { montarNotificacoes };
