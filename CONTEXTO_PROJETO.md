# Contexto do Projeto — Super Estágios (Painel de RH)

Este arquivo resume tudo o que já foi decidido e implementado no projeto, para que qualquer assistente de código (Claude Code, etc.) entenda o histórico antes de mexer no sistema. **Leia este arquivo inteiro antes de qualquer alteração.**

## O que é o sistema

Painel interno de RH da Super Estágios (agência de estagiários) para organizar o fechamento de vagas das empresas clientes.

- **Backend:** Node.js + Express (`backend/server.js`, `backend/src`), Prisma (`backend/prisma/schema.prisma`)
- **Frontend:** React + Vite + Tailwind CSS (`frontend/src`), React Router, Kanban com drag and drop
- **Entidades principais:** Empresas, Vagas, Candidatos/Estudantes (Banco de Talentos)

## Status atual (diagnóstico de 05/10/2026, conferido no código)

### 🟡 Etapa 1 — IMPLEMENTADA (05/10/2026); falta validar no navegador
Backend implementado e testado (17/17 testes passaram, incluindo exclusões bloqueadas). Testes: `cd backend && npm run test:etapa1` (**grava e apaga registros `[TESTE]` no banco — pedir aprovação antes de rodar**).
- `PUT` e `DELETE` em `/empresas/:id`, `/vagas/:id`, `/candidatos/:id`
  - `PUT /vagas/:id` edita só os dados (código, título, descrição, valor, empresa). **Status continua no `PATCH /vagas/:id`**, que também marca as aplicações como `RECUSADO` ao fechar/suspender.
  - `PUT /candidatos/:id` edita só os dados do estudante; candidaturas continuam no `PATCH /candidatos/:id` (Kanban).
- **Sem cascade:** FKs mantidas em `ON DELETE RESTRICT`. Antes de excluir, a rota conta os vínculos e devolve **409** com mensagem amigável (ex.: "ela possui 1 vaga vinculada"). Vínculos verificados: empresa→vagas, vaga→aplicações, estudante→aplicações. Erros: 400 (id/campos inválidos), 404 (não encontrado), 204 (excluído).
- Campo `anotacoes_recrutador String? @db.Text` em `Estudante` (migration `20261005171734_add_estudante_anotacoes_recrutador`), aceito no `POST` e no `PUT` de candidatos.
- Helpers compartilhados em `backend/src/utils.js` (`uuidValido`, `pluralizar`).

Frontend (build OK):
- `react-hot-toast` com `<Toaster>` no `App.jsx`. Não havia `alert`/`console.log` no frontend; os erros que o `CreationForm` mostrava como texto viraram toasts. Dashboard e Kanban continuam com erro inline (não foram alterados).
- As páginas **Vagas** (antes com dados fixos no código), **Empresas** e **Banco de Talentos** (antes só placeholders) agora carregam da API via o componente genérico `frontend/src/components/EntityList.jsx`: busca em tempo real (ignora acentos/maiúsculas; vagas também buscam pelo Nº), botões Editar (lápis) e Excluir (lixeira vermelha), modal "Tem certeza?". Em 409 a mensagem da API aparece num toast de erro e o item fica na lista.
- `CreationForm` aceita `initialData` → modo edição com `PUT`. Na edição do estudante, o campo Vaga é ocultado (candidaturas ficam no Kanban). Campos com `optional: true` não são obrigatórios e enviam `null` se vazios.
- Textarea "Anotações do Recrutador" (`anotacoes_recrutador`) no formulário do estudante; um trecho aparece no card do Banco de Talentos.
- Listas e Dashboard recarregam pelo evento `window` `dashboard:refresh`, disparado após criar/editar/excluir.
- E-mail do estudante é opcional no formulário (como no schema); vazio é enviado como `null`.
- Conhecido: "Abrir Kanban" ainda aponta para `/kanban` (muda na 2B).

O que JÁ existia: CRUD de criação (POST), Dashboard com KPIs + funil (`/dashboard-metrics`), Kanban com drag and drop (`@dnd-kit`), `recharts` instalado.

### 🧯 Incidente de migrations (05/10/2026)
A IA da Etapa 2 travada aplicou no banco duas migrations que **nunca foram salvas no disco** (`20261002000000_add_recruiter_notes_and_application_cascade` e `20261002010000_add_hiring_analytics_dates`). Ao gerar a migration da Etapa 1 a partir do banco, o SQL **apagou** `Aplicacao.created_at`, `Aplicacao.data_aprovacao` e `Vaga.created_at` (2 vagas e 2 aplicações afetadas; valores perdidos) e trocou as FKs de CASCADE de volta para RESTRICT. Correção feita com aprovação do usuário: migration reescrita para apenas `ADD COLUMN IF NOT EXISTS "anotacoes_recrutador"`, registros órfãos removidos de `_prisma_migrations` e checksum ajustado. A sequência das 3 migrations foi validada num banco temporário (`No difference detected`). As datas voltam na 2A (`createdAt`, `data_contratacao`).

Observações de ambiente:
- `backend/node_modules` não vem no repositório: rodar `npm ci` em `backend/` antes de qualquer `npx prisma` (senão o `npx` baixa outra versão do Prisma). Versão fixada: 5.22.0.
- `prisma migrate dev` falha em terminal não interativo. Alternativa: gerar o SQL com `prisma migrate diff`, **revisar e mostrar ao usuário**, salvar em `prisma/migrations/<timestamp>_<nome>/migration.sql` e aplicar com `prisma migrate deploy` após aprovação.
- Ler a saída **completa** de `prisma migrate status` (não usar `tail`).

### ⚠️ Etapa 2 — TRAVOU e NADA foi salvo
O prompt que tentou alterar 17 arquivos (+1.461 linhas) não deixou alterações no repositório (`git status` limpo, sem stash/branches). Último commit antes deste diagnóstico: `91b24cb ajustes no dashboart`.

### 🔒 Segurança do repositório
`backend/.env` e `frontend/dist` foram removidos do índice e adicionados ao `.gitignore`. **Atenção:** o `.env` já foi enviado ao GitHub em commits anteriores e continua no histórico — trocar a senha do banco (`DATABASE_URL`).

## Modelo de dados atual (manter)

O schema **já possui** a tabela de relacionamento `Aplicacao` (vaga ↔ estudante), com `status_kanban`, `data_hora_entrevista` e `motivo_recusa`. O status fica na candidatura, não no estudante. **Não criar tabela `Candidatura`; não renomear o enum.**

Enum `StatusKanban` e rótulos usados nas telas:

| Enum | Rótulo na tela |
|---|---|
| `ENVIADO_EMPRESA` | Novos / Enviado à empresa |
| `AGUARDANDO_RETORNO` | Análise |
| `ENTREVISTA_AGENDADA` | Entrevista |
| `APROVADO` | **Contratado** |
| `RECUSADO` | **Dispensado** |

### Causa real do "Kanban global"
Não é o schema. `Kanban.jsx` busca `GET /candidatos` e exibe as aplicações de **todas as vagas num único quadro** (rota `/kanban`, sem `:vagaId`). O `PATCH /candidatos/:id` já atualiza só a aplicação informada. A correção é isolar por vaga (backend 2A + frontend 2B).

## O que falta implementar

### 1 — Etapa 1: validar no navegador (código pronto)

### ✅ 2A — Banco de dados e backend — CONCLUÍDA (05/10/2026)
Testes: `cd backend && npm run test:etapa2a` (33/33 passaram; **grava e apaga registros `[TESTE]` — pedir aprovação antes de rodar**).
1. Migration `20261005173316_add_datas_aplicacao_vaga` (só adições, aprovada pelo usuário):
   - `Aplicacao`: `created_at` (`@default(now())`), `updated_at` (`@default(now()) @updatedAt`), `data_aprovacao DateTime?` (= data de contratação), `@@unique([vaga_id, estudante_id])` (não havia duplicatas)
   - `Vaga`: `created_at` (`@default(now())`)
   - Registros existentes receberam a data/hora da migration (05/10/2026). Nomes em snake_case, por decisão do usuário (não usar `createdAt`/`data_contratacao`).
2. `GET /vagas/:vagaId/candidatos` → aplicações da vaga com `estudante` (id, nome, curso, instituição, telefone, e-mail), ordenadas por `created_at`; 400 id inválido, 404 vaga inexistente.
3. `PATCH /candidatos/:id` (Kanban) aceita `status_kanban`, `data_hora_entrevista`, `motivo_recusa`:
   - `ENTREVISTA_AGENDADA` exige data válida e `RECUSADO` exige motivo não vazio → senão **400**
   - Entrar em `APROVADO` grava `data_aprovacao`; repetir não altera; sair de `APROVADO` limpa
   - `motivo_recusa` só é mantido enquanto `RECUSADO` (sair limpa); `data_hora_entrevista` permanece como histórico
   - ⚠️ O `Kanban.jsx` atual não envia a data: **arrastar para "Entrevista" devolve 400 e o cartão volta** até a 2B ser feita.
4. `GET /entrevistas` (`src/routes/entrevistas.js`) → só `ENTREVISTA_AGENDADA` com data futura, ordenadas por data, com estudante, vaga e empresa.
5. `GET /dashboard-metrics` passou a devolver também:
   - `metrics.tempoMedioContratacaoDias` (média de `data_aprovacao − created_at`, 1 casa decimal; `null` sem contratações) e `metrics.totalContratacoes`
   - `vagasEmAlerta[]`: `ABERTA` criadas há mais de 10 dias sem aplicação em `ENTREVISTA_AGENDADA` (id, código, título, empresa, `created_at`, `diasAberta`, `totalCandidaturas`)
   - `distribuicaoPorCurso[]` `{ curso, total }`: agrupa ignorando maiúsculas, acentos e espaços extras; exibe a grafia mais comum (empate: alfabética)
   - Sem alteração: `recentInterviews` continua sem filtro de data futura.

### 2B — Kanban isolado e interativo (frontend)
- **Prioridade:** o Kanban atual quebra ao soltar em "Entrevista" (backend agora exige `data_hora_entrevista`).
- Rota `/kanban/:vagaId`; `Kanban.jsx` usa `useParams` e busca `/vagas/:vagaId/candidatos`
- Botão "Abrir Kanban" em Vagas aponta para `/kanban/${vaga.id}`
- 5ª coluna **Dispensado** = status `RECUSADO` (cor neutra/avermelhada). Hoje o Kanban tem só 4 colunas e aplicações `RECUSADO` ficam ocultas
- `onDragEnd`: soltar em "Dispensado" → modal pedindo motivo; soltar em "Entrevista" → modal com `datetime-local`. Só salvar após confirmar; se cancelar, o cartão volta.

### 2C — Dashboard analítico (frontend)
- Card KPI "Tempo Médio de Contratação" (ex.: "14 dias")
- Painel vermelho/amarelo "Vagas em Alerta"
- `recharts` PieChart (rosca) com distribuição por curso
- Grid responsivo com Tailwind

### 2D — Agenda e histórico (frontend)
- Item "Agenda de Entrevistas" (ícone de calendário) no menu lateral (`Layout.jsx`)
- `Agenda.jsx` na rota `/agenda`, lendo `GET /entrevistas`
- No perfil/edição do candidato: seção "Histórico de Candidaturas" (vaga, status, data da entrevista, motivo da dispensa)

## Regras de trabalho

- **Banco de dados: antes de aplicar QUALQUER alteração no banco (migrations, `migrate deploy`/`dev`/`reset`, `db push`, SQL manual, escrita em `_prisma_migrations`, criação/remoção de bancos, scripts de teste que gravam dados), mostrar o SQL/operações ao usuário e esperar aprovação explícita.**

- Fazer **uma subetapa por vez** (2A → 2B → 2C → 2D) e testar entre elas
- **Commit no Git antes de cada subetapa**, para poder voltar se algo quebrar
- Manter o padrão visual Tailwind existente; vermelho para ações destrutivas
- Não reescrever arquivos inteiros sem necessidade; preferir alterações pontuais
