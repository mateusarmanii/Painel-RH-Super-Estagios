// Interpreta as mensagens livres do Telegram com uma IA (opcional; sem IA_API_KEY fica desligado).
//
// Regra de privacidade: a IA só recebe o que o usuário digitou, sem e-mails e números longos. Ela escolhe QUAL consulta
// fazer; quem consulta o banco e escreve a resposta é o servidor (src/assistente.js). Nenhum dado do banco vai para a IA,
// e por isso ela também não tem como inventar dados do painel.
//
// Usa o formato de "chat completions" compatível com OpenAI. Padrão: Groq, que tem plano gratuito.
// O plano gratuito do Gemini não serve aqui: os termos dele pedem para não enviar dados pessoais.
const URL_PADRAO = "https://api.groq.com/openai/v1";
const MODELO_PADRAO = "openai/gpt-oss-20b";
const TEMPO_LIMITE_MS = 20000;
const TEXTO_MAX = 500;

const chave = () => (process.env.IA_API_KEY ?? "").trim();
const iaConfigurada = () => Boolean(chave());

class ErroIa extends Error {
  constructor(status) {
    super(`IA respondeu ${status}`);
    this.status = status;
  }
}

// Nenhuma ferramenta altera dados: as "propor_" só montam um resumo com o botão Confirmar (src/acoes.js).
const FERRAMENTAS = [
  {
    type: "function",
    function: {
      name: "propor_registrar_contato",
      description: "Prepara o registro de um contato ou anotação sobre um estudante ou empresa, quando a pessoa conta que falou com alguém ou pede para anotar. A pessoa confirma antes de salvar.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Só o nome do estudante ou da empresa." },
          tipo: { type: "string", enum: ["LIGACAO", "WHATSAPP", "EMAIL", "REUNIAO", "SEM_RESPOSTA", "NOTA"], description: "Omita se a pessoa não disse como foi o contato." },
          texto: { type: "string", description: "O que aconteceu, com as palavras da pessoa, sem acrescentar nada." },
          proximo_contato: { type: "string", description: "Data de retorno combinada, AAAA-MM-DD. Omita se não foi dita." },
        },
        required: ["nome"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propor_mover_candidato",
      description: "Prepara a mudança de etapa de um candidato no Kanban. A pessoa confirma antes de salvar.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Só o nome do estudante." },
          etapa: { type: "string", enum: ["CANDIDATO_CONTATADO", "ENVIADO_EMPRESA", "ENTREVISTA_AGENDADA", "EM_TESTE", "APROVADO", "RECUSADO"], description: "APROVADO é contratado; RECUSADO é dispensado. Omita se a pessoa não disse." },
        },
        required: ["nome"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_agenda",
      description: "Entrevistas e eventos do calendário em um dia ou período.",
      parameters: {
        type: "object",
        properties: {
          data_inicio: { type: "string", description: "Primeiro dia, AAAA-MM-DD." },
          data_fim: { type: "string", description: "Último dia, AAAA-MM-DD. Omita se for um dia só." },
        },
        required: ["data_inicio"],
      },
    },
  },
  {
    type: "function",
    function: { name: "listar_pendencias", description: "O que precisa de atenção agora: urgências, retornos combinados, vagas paradas, contratos.", parameters: { type: "object", properties: {} } },
  },
  {
    type: "function",
    function: { name: "listar_vagas_abertas", description: "Lista de vagas abertas com candidatos em processo.", parameters: { type: "object", properties: {} } },
  },
  {
    type: "function",
    function: {
      name: "buscar",
      description: "Procura um estudante, empresa ou vaga pelo nome, título ou número da vaga. Mostra contato e situação.",
      parameters: {
        type: "object",
        properties: { termo: { type: "string", description: "Só o nome ou número procurado, sem outras palavras." } },
        required: ["termo"],
      },
    },
  },
  {
    type: "function",
    function: { name: "resumo_da_semana", description: "Números dos últimos 7 dias: candidaturas, contratações, dispensas e vagas novas.", parameters: { type: "object", properties: {} } },
  },
];

// Tira o que identifica alguém diretamente e não ajuda a escolher a consulta.
function limparTexto(texto) {
  return String(texto ?? "")
    .slice(0, TEXTO_MAX)
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[e-mail]")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, "[número]");
}

function promptDoSistema(agora) {
  const hoje = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
  return [
    "Você é o assistente do RH da Super Estágios, agência de estágios no Brasil, e conversa pelo Telegram.",
    `Hoje é ${hoje}, fuso de São Paulo.`,
    "Para qualquer pergunta sobre dados do painel (entrevistas, candidatos, empresas, vagas, pendências, números), chame uma ferramenta. Você não tem acesso aos dados de outra forma: nunca invente nomes, datas ou números.",
    "Se não houver ferramenta para o pedido sobre dados, diga que ainda não consegue e sugira abrir o painel.",
    "Para registrar um contato ou mover um candidato, chame a ferramenta propor_ correspondente. Só a pessoa confirma a gravação: nunca diga que moveu, registrou, dispensou, agendou ou enviou algo.",
    "Pedidos gerais de RH (escrever uma mensagem, dúvida sobre a rotina de estágio) você responde direto, em português do Brasil, de forma curta e sem formatação Markdown. Em mensagens, use marcadores como {primeiro_nome}, {vaga} e {data_entrevista}. Em dúvidas de lei, avise que é bom confirmar na fonte oficial.",
  ].join("\n");
}

// Devolve { acao, args } quando a IA escolhe uma consulta, ou { texto } quando responde direto.
async function interpretar(texto, agora = new Date()) {
  const base = (process.env.IA_API_URL || URL_PADRAO).replace(/\/+$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave()}` },
    body: JSON.stringify({
      model: process.env.IA_MODELO || MODELO_PADRAO,
      temperature: 0.2,
      max_tokens: 800,
      tools: FERRAMENTAS,
      tool_choice: "auto",
      messages: [
        { role: "system", content: promptDoSistema(agora) },
        { role: "user", content: limparTexto(texto) },
      ],
    }),
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });
  if (!res.ok) throw new ErroIa(res.status);
  const mensagem = (await res.json())?.choices?.[0]?.message;
  const chamada = mensagem?.tool_calls?.[0]?.function;
  if (chamada?.name) {
    let args = {};
    try {
      args = JSON.parse(chamada.arguments || "{}");
    } catch {
      throw new ErroIa("argumentos inválidos");
    }
    return { acao: chamada.name, args };
  }
  const resposta = typeof mensagem?.content === "string" ? mensagem.content.trim() : "";
  if (!resposta) throw new ErroIa("resposta vazia");
  return { texto: resposta };
}

module.exports = { iaConfigurada, interpretar, limparTexto, FERRAMENTAS, ErroIa };
