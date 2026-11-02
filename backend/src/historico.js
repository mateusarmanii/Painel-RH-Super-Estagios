// Histórico de etapas (tabela HistoricoEtapa): uma linha a cada mudança de etapa de uma candidatura.
// Gravado automaticamente pelas rotas que mudam a etapa; o usuário não preenche nada.
// Sempre chamado com o mesmo "db" da alteração (de preferência dentro da mesma transação).

// mudancas: [{ aplicacaoId, de, para }] (de = null quando a candidatura acabou de ser criada).
// Mudança para a mesma etapa (ex.: reagendar uma entrevista) não é registrada.
async function registrarEtapas(db, mudancas, usuarioId = null) {
  const data = mudancas
    .filter(({ de, para }) => de !== para)
    .map(({ aplicacaoId, de, para }) => ({ aplicacao_id: aplicacaoId, de_status: de ?? null, para_status: para, usuario_id: usuarioId }));
  if (data.length) await db.historicoEtapa.createMany({ data });
}

const registrarEtapa = (db, mudanca, usuarioId) => registrarEtapas(db, [mudanca], usuarioId);

// Campos do histórico para as telas (mais antigo primeiro).
const selectHistorico = {
  orderBy: { created_at: "asc" },
  select: { id: true, de_status: true, para_status: true, created_at: true, usuario: { select: { id: true, nome: true } } },
};

module.exports = { registrarEtapa, registrarEtapas, selectHistorico };
