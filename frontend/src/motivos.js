// Sugestões de motivo de dispensa (categorias opcionais). Mesmos ids e nomes de backend/src/motivos.js.
// "Vaga encerrada" não aparece como sugestão: é marcada sozinha ao fechar a vaga.
export const DISMISSAL_REASONS = [
  { id: "perfil", label: "Perfil não aderente" },
  { id: "reprovado_empresa", label: "Reprovado pela empresa" },
  { id: "outra_proposta", label: "Aceitou outra proposta" },
  { id: "desistiu", label: "Candidato desistiu" },
  { id: "nao_compareceu", label: "Não compareceu" },
  { id: "sem_retorno", label: "Sem retorno do candidato" },
  { id: "distancia", label: "Mora longe da vaga" },
  { id: "horario", label: "Horário incompatível" },
  { id: "valor", label: "Bolsa não atrativa" },
  { id: "documentacao", label: "Matrícula ou documentação" },
  { id: "outro", label: "Outro" },
];
