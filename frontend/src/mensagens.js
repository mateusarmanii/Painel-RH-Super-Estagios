// Variáveis dos modelos de mensagem (Configurações → Modelos) e o preenchimento a partir de uma candidatura
// (GET /modelos/contexto/:aplicacaoId). Variável sem valor vira texto vazio.
import { interviewFormatLabels } from "./interviewStatus.js";

export const TEMPLATE_VARIABLES = [
  { key: "primeiro_nome", label: "Primeiro nome do estudante" },
  { key: "nome", label: "Nome completo" },
  { key: "curso", label: "Curso" },
  { key: "vaga", label: "Título da vaga" },
  { key: "codigo_vaga", label: "Nº da vaga" },
  { key: "empresa", label: "Empresa" },
  { key: "data_entrevista", label: "Data da entrevista (ex.: terça-feira, 4 de novembro)" },
  { key: "hora_entrevista", label: "Hora da entrevista" },
  { key: "local_entrevista", label: "Formato e local/link da entrevista" },
];

const dateFormat = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const timeFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function templateValues(context) {
  const name = (context.estudante.nome_completo ?? "").replace(/^\s*\[[^\]]*\]\s*/, "").trim();
  const interview = context.data_hora_entrevista ? new Date(context.data_hora_entrevista) : null;
  const format = interviewFormatLabels[context.entrevista_formato];
  return {
    primeiro_nome: name.split(/\s+/)[0] ?? "",
    nome: name,
    curso: context.estudante.curso ?? "",
    vaga: context.vaga.titulo,
    codigo_vaga: context.vaga.codigo_vaga,
    empresa: context.vaga.empresa.nome,
    data_entrevista: interview ? dateFormat.format(interview) : "",
    hora_entrevista: interview ? timeFormat.format(interview) : "",
    local_entrevista: [format, context.entrevista_local].filter(Boolean).join(" · "),
    // O link externo não existe mais: modelos antigos que citam a variável ficam sem o texto, em vez de mostrar as chaves.
    link_confirmacao: "",
  };
}

export function fillTemplate(text, values) {
  return text.replace(/\{([a-z_]+)\}/g, (match, key) => (key in values ? values[key] : match));
}
