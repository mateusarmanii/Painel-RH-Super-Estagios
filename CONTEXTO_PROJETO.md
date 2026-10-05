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

### Causa real do "Kanban global" (resolvido na 2B)
Não era o schema. O `Kanban.jsx` antigo buscava `GET /candidatos` e exibia as aplicações de **todas as vagas num único quadro**. Desde a 2B, cada quadro é de uma vaga (`/kanban/:vagaId`).

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
   - O Kanban (2B) envia a data e o motivo pelos modais.
4. `GET /entrevistas` (`src/routes/entrevistas.js`) → só `ENTREVISTA_AGENDADA` com data futura, ordenadas por data, com estudante, vaga e empresa.
5. `GET /dashboard-metrics` passou a devolver também:
   - `metrics.tempoMedioContratacaoDias` (média de `data_aprovacao − created_at`, 1 casa decimal; `null` sem contratações) e `metrics.totalContratacoes`
   - `vagasEmAlerta[]`: `ABERTA` criadas há mais de 10 dias sem aplicação em `ENTREVISTA_AGENDADA` (id, código, título, empresa, `created_at`, `diasAberta`, `totalCandidaturas`)
   - `distribuicaoPorCurso[]` `{ curso, total }`: agrupa ignorando maiúsculas, acentos e espaços extras; exibe a grafia mais comum (empate: alfabética)
   - Sem alteração: `recentInterviews` continua sem filtro de data futura.

### 🟡 2B — Kanban isolado e interativo — IMPLEMENTADA (05/10/2026); falta validar no navegador
Só frontend (build OK). Arquivos: `pages/Kanban.jsx`, `App.jsx`, `pages/Pages.jsx`, `vagaStatus.js` (rótulos/cores de status da vaga, compartilhados).
- Rotas: `/kanban/:vagaId` → quadro da vaga (`GET /vagas/:vagaId/candidatos`; nome/empresa/Nº vêm de `GET /vagas`, pois não há `GET /vagas/:id`). `/kanban` sem ID → lista de vagas para escolher (o menu lateral não tem item "Kanban"; a rota foi mantida para links antigos). Vaga inexistente → mensagem da API + link "Escolher outra vaga". "Abrir Kanban" em Vagas → `/kanban/${vaga.id}`.
- 5 colunas: Enviado à empresa, Em análise, Entrevista, **Contratado** (`APROVADO`), **Dispensado** (`RECUSADO`, borda rosa e fundo avermelhado claro). Enum inalterado.
- Ao soltar em Entrevista/Dispensado o cartão vai para a coluna e abre um modal (data e hora com `min` = agora + validação no envio; motivo obrigatório, até 500 caracteres). O PATCH só sai ao confirmar; cancelar, fechar no X ou clicar fora devolve o cartão. Erro da API (inclusive 400) → toast com a mensagem e o cartão volta.
- Cartões mostram a data da entrevista (coluna Entrevista) e o motivo (coluna Dispensado). Após salvar, o cartão usa os dados devolvidos pelo PATCH.
- Toasts de sucesso/erro no Kanban; o erro de carregamento do quadro continua inline.
- Não implementado: reagendar uma entrevista sem tirar o cartão da coluna; reordenar cartões dentro da mesma coluna (a ordem não é salva).

### 🟡 2C — Dashboard analítico — IMPLEMENTADA (05/10/2026); falta validar no navegador
Só frontend (build OK; conferido por screenshot em 1440px e no layout de celular). Arquivos: `pages/Dashboard.jsx`, `components/CourseDonutChart.jsx` (novo), `components/FunnelChart.jsx`.
- Card "Tempo médio de contratação": "14,5 dias" (pt-BR, 1 casa); `< 1` → "Menos de 1 dia"; `null` → "Sem contratações ainda" (nunca 0 nem erro). Selo com a base ("Base: N contratações").
- Painel "Vagas em alerta" (âmbar, ícone de alerta): título, empresa, Nº, dias em aberto e candidaturas; cada item leva a `/kanban/:vagaId`. Vazio → caixa verde "Nenhuma vaga parada".
- Rosca "Estudantes por curso" (recharts, carregada sob demanda): 6 maiores cursos + "Outros (N cursos)" em cinza; total no centro; legenda com nome, quantidade e %; tooltip ao passar o mouse. Paleta categórica validada (ordem fixa: azul, laranja, verde-água, amarelo, rosa, verde) — 3 cores têm contraste < 3:1, por isso a legenda com números é obrigatória.
- Funil: rótulo "N · X%" sobre cada barra (X = % da soma das 4 etapas do funil; `RECUSADO` não entra no funil do backend) e tooltip; animação desligada.
- Layout: 5 cards (1 → 2 → 3 → 5 colunas) e 4 painéis (1 → 2 colunas no `xl`): alertas | cursos, funil | próximas entrevistas.
- Carregamento: esqueleto (`animate-pulse`) só no primeiro carregamento; atualizações mostram "A atualizar...". API fora → tela "Não conseguimos carregar o dashboard" com "Tentar novamente"; se já havia dados, eles ficam com um aviso de que podem estar desatualizados.
- (Resolvido na 2D: nomes do funil iguais aos do Kanban e "Próximas entrevistas" só com datas futuras.)

### 🟡 2D — Agenda e histórico — IMPLEMENTADA (05/10/2026); falta validar no navegador
Build OK; testes `cd backend && npm run test:etapa2d` (10/10, registros `[TESTE]`, 0 sobras).
- `/agenda` (`pages/Agenda.jsx`, item "Agenda de Entrevistas" no menu lateral): lê `GET /entrevistas`, agrupa por dia ("Hoje", "Amanhã", "terça-feira, 7 de outubro"…), mostra hora, estudante, curso, vaga, empresa, Nº e telefone; botão **Reagendar** abre modal com data e hora (só futuro) e faz `PATCH /candidatos/:id` mantendo `ENTREVISTA_AGENDADA`; link para o Kanban da vaga. Estados de carregamento, erro e vazio.
- **Histórico de candidaturas** (`components/CandidaturaHistory.jsx`): aparece no modal **Editar** do estudante (Banco de Talentos), abaixo do formulário — vaga (link para o Kanban), empresa, Nº, desde quando, etapa, data da entrevista, data da contratação, motivo da dispensa.
  - Backend (só código, sem schema): `GET /candidatos` passou a trazer em cada candidatura `motivo_recusa`, `data_aprovacao`, `created_at` e `vaga { codigo_vaga, titulo, empresa.nome }`, da mais recente para a mais antiga.
- Dashboard: "Próximas entrevistas" agora usa `GET /entrevistas` (só futuras), 5 primeiras, com link "Ver agenda completa"; o `recentInterviews` do `/dashboard-metrics` deixou de ser usado.
- Funil com os mesmos nomes do Kanban (mapeados no frontend a partir do `status`); rótulos do eixo quebram linha no celular.
- Rótulos e cores das etapas centralizados em `frontend/src/kanbanStatus.js` (Kanban, funil e histórico).

## Regras de trabalho

- **Banco de dados: antes de aplicar QUALQUER alteração no banco (migrations, `migrate deploy`/`dev`/`reset`, `db push`, SQL manual, escrita em `_prisma_migrations`, criação/remoção de bancos, scripts de teste que gravam dados), mostrar o SQL/operações ao usuário e esperar aprovação explícita.**

- Fazer **uma subetapa por vez** (2A → 2B → 2C → 2D) e testar entre elas
- **Commit no Git antes de cada subetapa**, para poder voltar se algo quebrar
- Manter o padrão visual Tailwind existente; vermelho para ações destrutivas
- Não reescrever arquivos inteiros sem necessidade; preferir alterações pontuais
