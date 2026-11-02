// Categorias de motivo de dispensa (Aplicacao.motivo_categoria). Escolher uma é OPCIONAL: o texto livre
// (motivo_recusa) continua sendo o motivo de verdade. A mesma lista está em frontend/src/motivos.js (ids e nomes iguais).
//
//   id       fica gravado no banco (não renomeie)
//   nome     como aparece nas telas
//   palavras trechos (sem acento, minúsculas) que, no texto livre, indicam a categoria. Servem para classificar
//            na hora da leitura os motivos sem categoria (os antigos e os digitados sem clicar numa sugestão).
//            A ordem da lista importa: a primeira categoria que bater vale.
const MOTIVOS = [
  { id: "vaga_encerrada", nome: "Vaga encerrada", palavras: ["vaga encerrada", "vaga fechada", "vaga cancelada", "encerrada pela empresa", "vaga suspensa", "vaga preenchida", "vaga ocupada"] },
  { id: "nao_compareceu", nome: "Não compareceu", palavras: ["nao compareceu", "faltou", "nao apareceu", "ausente", "nao veio"] },
  { id: "sem_retorno", nome: "Sem retorno do candidato", palavras: ["sem retorno", "nao retornou", "nao respondeu", "sem resposta", "nao atende", "nao responde"] },
  { id: "outra_proposta", nome: "Aceitou outra proposta", palavras: ["outra proposta", "outro estagio", "outra vaga", "outra empresa", "ja contratado", "ja esta estagiando"] },
  { id: "desistiu", nome: "Candidato desistiu", palavras: ["desist", "declinou", "sem interesse", "nao tem mais interesse", "perdeu o interesse", "nao quis"] },
  { id: "reprovado_empresa", nome: "Reprovado pela empresa", palavras: ["reprovad", "nao aprovad", "empresa nao gostou", "empresa recusou", "nao passou"] },
  { id: "perfil", nome: "Perfil não aderente", palavras: ["perfil", "aderente", "requisito", "qualificac", "experiencia", "conhecimento"] },
  { id: "distancia", nome: "Mora longe da vaga", palavras: ["distante", "distancia", "longe", "reside", "deslocamento", "transporte", "mora em"] },
  { id: "horario", nome: "Horário incompatível", palavras: ["horario", "turno", "incompativel", "disponibilidade"] },
  { id: "valor", nome: "Bolsa não atrativa", palavras: ["valor", "bolsa", "salario", "remuneracao", "pagamento"] },
  { id: "documentacao", nome: "Matrícula ou documentação", palavras: ["matricula", "documenta", "formou", "formado", "trancou", "menor de idade"] },
  { id: "outro", nome: "Outro", palavras: [] },
];

const motivoPorId = new Map(MOTIVOS.map((motivo) => [motivo.id, motivo]));
const semAcento = (texto) => (texto ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Valida o campo opcional vindo da API: ausente/vazio → null; id desconhecido → { erro }.
function lerCategoria(valor) {
  if (valor === undefined || valor === null || valor === "") return { valor: null };
  if (typeof valor !== "string" || !motivoPorId.has(valor)) return { erro: "Categoria de motivo inválida." };
  return { valor };
}

// Categoria a partir do texto livre (null se nenhuma palavra bater).
function categorizarTexto(texto) {
  const normalizado = semAcento(texto);
  if (!normalizado.trim()) return null;
  return MOTIVOS.find((motivo) => motivo.palavras.some((palavra) => normalizado.includes(palavra)))?.id ?? null;
}

module.exports = { MOTIVOS, motivoPorId, lerCategoria, categorizarTexto };
