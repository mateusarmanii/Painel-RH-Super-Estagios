# Contexto do Projeto — Super Estágios (Painel de RH)

## Relatório da sessão (05/10/2026, execução sem acompanhamento)

Regras seguidas: nenhuma migration, nenhuma alteração de schema e nenhuma escrita em dados reais. Os únicos dados gravados foram registros `[TESTE]`, criados e apagados pelos scripts, que confirmaram **0 sobras** em todas as execuções. Todas as etapas passaram no `npm run build` e foram enviadas ao GitHub.

### O que foi concluído

| Etapa | Commit | Resumo |
|---|---|---|
| 1 — 2D | `2ecbbdd` | Agenda `/agenda` (por dia, com Reagendar), histórico de candidaturas no modal Editar do estudante, "Próximas entrevistas" via `/entrevistas`, funil com os nomes do Kanban. Teste `npm run test:etapa2d`: 10/10. |
| 2 — CSV | `d13f5e1` | Botão "Exportar CSV" em Vagas e Banco de Talentos, respeitando a busca (`;`, UTF-8 com BOM, CRLF, proteção contra fórmula). |
| 3 — Demo | `8ce2a83` | Scripts de dados de demonstração (removidos depois, de propósito, no commit `5b8e481`). |
| 4 — README | `240a240` | `README.md` e `backend/.env.example` (sem senha real). |
| 5 — Revisão | `93a3dc0` | Busca do topo passou a funcionar, cabeçalho padrão nas listas, iniciais do Kanban corrigidas, variáveis sem uso removidas do seed. |

A Etapa 1 incluiu uma mudança **só de código** no backend: o `GET /candidatos` passou a trazer título, número e empresa da vaga, motivo da dispensa e datas de cada candidatura, que o histórico precisa. Não houve mudança de schema.

O que a revisão (Etapa 5) verificou:
- **Lint (`oxlint`):** frontend sem nenhum import ou variável sem uso.
- **Console do navegador:** nenhum erro ou aviso do app em 10 rotas; a única mensagem é o convite do React DevTools, que só aparece em desenvolvimento.
- **Prints em notebook e celular de todas as telas**, com dados `[TESTE]` temporários: nenhuma tela vaza para os lados no celular.

### O que foi pulado ou ficou parcial
- **Interações que o navegador headless não consegue fazer:** não testei por clique o modal de histórico, o Reagendar, o download do CSV (nem a abertura no Excel), a busca do topo e o arraste no Kanban. A lógica por trás de cada um foi testada (API, geração do CSV), mas a interação precisa do roteiro abaixo.
- **Nenhuma etapa precisou ser desfeita.**

### Encontrado e NÃO corrigido (fora do escopo seguro)
1. ⚠️ **`npm run seed` (`prisma/seed.js`) apaga todos os dados do banco** antes de criar exemplos. Está documentado no README; não alterei. Sugestão: remover o script ou fazê-lo recusar rodar com dados existentes.
2. **"Empresas sem vaga" e "Contratações" são páginas vazias**, só com o título. É funcionalidade não implementada.
3. **Endereço da API fixo** (`http://localhost:3333`) em 6 arquivos do frontend. Sugestão: uma variável `VITE_API_URL`, que muda a configuração.
4. **Kanban:**
   - reordenar cartões dentro da mesma coluna não é salvo;
   - no celular, as colunas ocupam a altura toda e é preciso rolar para o lado; no notebook, a 5ª coluna também exige rolagem.
   - O reagendamento agora está disponível na Agenda.
5. **Rosca por curso:** as porcentagens arredondadas podem somar 101% (ex.: 12,5% vira 13%).
6. **O funil não inclui os dispensados** (`RECUSADO`), porque é assim que o backend calcula.
7. **Lint:** aviso "body em GET" nos scripts de teste é falso positivo, porque o `body` é `undefined`.
8. **Prisma:** o projeto usa a versão 5.22; a 8 está disponível, mas atualizar é uma mudança grande.

### O que precisa da sua aprovação ou ação
1. **Trocar a senha do banco.** O `.env` antigo continua no histórico do GitHub.
2. **Confirmar a mudança de código no `GET /candidatos`** (Etapa 1).
3. **Decidir sobre os itens 1 e 3 da lista acima:** o `seed.js` destrutivo e a `VITE_API_URL`.

### Roteiro único de testes no navegador
Suba a API e o frontend (`npm run dev` em `backend/` e `frontend/`).

**Agenda e histórico (2D)**
1. No menu lateral (☰), clique em **Agenda de Entrevistas**. As entrevistas devem aparecer agrupadas por dia ("Amanhã · …"), com hora, estudante, vaga, empresa e telefone.
2. Clique em **Reagendar**:
   - datas passadas devem estar bloqueadas;
   - escolha outra data e confirme: deve aparecer um toast verde e a entrevista deve mudar de dia ou de hora;
   - o mesmo cartão no Kanban deve mostrar a nova data.
3. "Kanban →" na Agenda deve abrir o quadro da vaga.
4. Em **Banco de Talentos**, clique no lápis de um estudante. Abaixo do formulário deve aparecer o "Histórico de candidaturas" com vaga, etapa colorida, data da entrevista, data da contratação e motivo da dispensa. Clique no nome da vaga: deve abrir o Kanban.
5. No **Dashboard**:
   - "Próximas entrevistas" deve mostrar só entrevistas futuras, no máximo 5;
   - o link "Ver agenda completa" deve funcionar;
   - o funil deve mostrar "Enviado à empresa / Em análise / Entrevista / Contratado", e no celular os nomes quebram em duas linhas sem se sobrepor.

**Exportar CSV**
6. Em **Vagas**, digite algo na busca e clique em **Exportar CSV**. O arquivo deve ter só as vagas filtradas. Abra no Excel e confira:
   - os acentos aparecem certos;
   - cada coluna fica numa célula separada;
   - o valor aparece como "1500,50" e a data como dd/mm/aaaa.
7. Repita no **Banco de Talentos**: as anotações com vírgula, ponto e vírgula ou quebra de linha devem continuar numa célula só.
8. Com uma busca sem resultado, o botão deve ficar desabilitado.

**Revisão**
9. Na busca do topo, digite o Nº de uma vaga existente e tecle Enter: deve abrir o Kanban dela. Com um número inexistente, deve aparecer um toast "Nenhuma vaga com o Nº …".
10. No Kanban, as iniciais dos cartões `[DEMO]` devem mostrar as letras do nome (ex.: "AB"), e não "[D".
11. Vagas, Empresas, Banco de Talentos e `/kanban` devem ter o cabeçalho "Super Estágios / título".


**Regressão (etapas anteriores, ainda não validadas no navegador)**
12. **Etapa 1:** busca, edição e exclusão (com 409) em Vagas, Empresas e Banco de Talentos.
13. **2B:** modais de "Entrevista" e "Dispensado" ao arrastar no Kanban, e o cartão volta se você cancelar.
14. **2C:** estados de carregamento e de "API fora do ar" no Dashboard.

---

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

Documentação: `README.md` na raiz (instalação, `.env`, migrations, como rodar e testes) e `backend/.env.example` (sem senha real). ⚠️ `npm run seed` (`prisma/seed.js`, anterior a estas sessões) **apaga todos os dados** antes de criar exemplos — documentado no README, não alterado.

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

### 🟡 Exportar CSV — IMPLEMENTADO (05/10/2026); falta validar no navegador/Excel
- Botão "Exportar CSV" em **Vagas** e **Banco de Talentos** (`EntityList` prop `csvExport`), ao lado da busca; exporta só o que está na tela (respeita o filtro). Desabilitado com a lista vazia. Arquivo `vagas-AAAA-MM-DD.csv` / `banco-de-talentos-AAAA-MM-DD.csv`.
- `frontend/src/csv.js`: separador `;`, UTF-8 com BOM, CRLF; células com `;`, aspas ou quebra de linha vão entre aspas; valores com 2 casas e vírgula ("1500,50"); datas dd/mm/aaaa. Proteção contra fórmula: conteúdo que começa com `=`, `@`, tab, ou `+`/`-` seguido de não-dígito recebe `'` na frente (telefones "+55…" ficam intactos).
- Colunas — Vagas: Nº, Título, Empresa, Status, Bolsa-auxílio (R$), Criada em, Descrição. Banco de Talentos: Nome, Curso, Instituição, Telefone, E-mail, Horário, Endereço, Currículo, Candidaturas, Vagas e etapas, Anotações.

### Dados de demonstração — REMOVIDOS (07/10/2026)
- Os scripts `seed-demo.js` e `limpar-demo.js` (`demo:criar` / `demo:limpar`) foram removidos de propósito no commit `5b8e481`. Registros `[DEMO]` que ainda existam no banco não têm mais limpeza automática.

### ✅ Contratações efetivas — IMPLEMENTADA (05/10/2026)
- Causa do "não mostra nada": `/contratacoes` apontava para um `PlaceholderPage` (só o título). Agora é `pages/Contratacoes.jsx`.
- Lista as candidaturas em `APROVADO` (via `GET /candidatos`, sem mudança no backend) com estudante, curso, vaga (link para o Kanban), Nº, empresa, data de contratação e "N dias após a candidatura", da mais recente para a mais antiga. Busca por estudante/curso/vaga/empresa e "Exportar CSV". Celular: cartões; telas `md+`: tabela.
- Conferida com os dados `[DEMO]` (5 contratados), criados com aprovação do usuário pelos scripts de demonstração (hoje removidos).
- Componentes compartilhados novos: `components/ListToolbar.jsx` (busca + filtros + CSV, usado também pelo `EntityList`) e `text.js` (`normalize`, `plural`).

### ✅ Estudantes × Banco de Talentos — IMPLEMENTADO (05/10/2026)
- **Estudantes** (`/estudantes`, `EstudantesPage` em `pages/Pages.jsx`): é a antiga lista "Banco de Talentos", renomeada — todos os cadastrados, com busca, editar, excluir, histórico e CSV (`estudantes-AAAA-MM-DD.csv`).
- **Banco de Talentos** (`/banco-de-talentos`, `pages/BancoTalentos.jsx`): quem tem ao menos uma candidatura `RECUSADO` **e nenhuma** `APROVADO`. Mostra a última vaga/empresa da dispensa, motivo, data, curso e contato; etiqueta **"Em processo"** se houver candidatura em `ENVIADO_EMPRESA`/`AGUARDANDO_RETORNO`/`ENTREVISTA_AGENDADA` (o título das vagas aparece ao passar o mouse). Ordenado pela dispensa mais recente. Busca por nome e filtro por curso (grafias agrupadas, `courseOptions` em `text.js`).
- **Indicar para vaga**: modal com as vagas `ABERTA` em que o estudante ainda não está inscrito → `POST /candidatos/:id/candidaturas { vaga_id }` (novo) cria a candidatura em `ENVIADO_EMPRESA`. Respostas: 201; 400 ids inválidos; 404 estudante/vaga; 409 vaga não aberta ou candidatura duplicada (inclusive na vaga em que foi dispensado). Testes: `npm run test:banco-talentos` (11/11, `[TESTE]`, 0 sobras).
- **Data da dispensa = `updated_at` da candidatura** (incluído no `GET /candidatos`). Não existe coluna própria; enquanto a candidatura está `RECUSADO`, a última alteração é a dispensa. Para uma data exata e imutável seria preciso uma migration (`data_recusa`) — **aguardando aprovação**.- Menu lateral: "Estudantes" e "Banco de Talentos".
- ⚠️ O Vite em modo dev rodando há horas na pasta do OneDrive parou de gerar classes novas do Tailwind (ex.: `sm:w-60`); o build está correto. Se algo aparecer sem estilo, reinicie o `npm run dev` do frontend.

### ✅ Extras (05/10/2026)
- **`seed.js` protegido**: `npm run seed` só apaga e recria os dados com `npm run seed -- --confirmar-apagar-tudo`; sem a flag, avisa e sai sem tocar no banco (conferido).
- **`VITE_API_URL`**: `frontend/src/api.js` (`API_URL`, padrão `http://localhost:3333`, barra final removida) usado nos 8 arquivos que tinham o endereço fixo; `frontend/.env.example` criado e `frontend/.env` no `.gitignore`. Conferido com build usando outro endereço.
- **Empresas sem vaga** (`/empresas-sem-vaga`): empresas **sem nenhuma vaga `ABERTA`** (inclui as que nunca tiveram vaga), com a última vaga (título, status, data) ou "Nunca teve vaga cadastrada", contato, busca, editar/excluir e CSV. `GET /empresas` passou a trazer `vagas` resumidas (id, Nº, título, status, `created_at`). `EntityList` ganhou as props `filterItems` e `subtitle`. Conferida com empresas `[TESTE]` temporárias (0 sobras). O `PlaceholderPage` foi removido (nenhuma página usa mais).

### ✅ Local da entrevista e vaga do estudante opcionais (06/10/2026)
Sem migration.
- **Local/link da entrevista** (`entrevista_local`) é opcional no Presencial e no Online (modal do Kanban e Reagendar da Agenda, `InterviewFields.jsx`); o backend já aceitava vazio. Sem local: o painel da Agenda mostra "Local a definir", o WhatsApp diz só "Entrevista presencial/online." e o link do Google Agenda vai sem `location`. Testes em `npm run test:agenda`.
- **Vaga no cadastro do estudante** é opcional (`CreationForm`, opção "Sem vaga — indicar depois"; `POST /candidatos` sem `vaga_id` cria o estudante sem candidatura). Vaga informada continua validada (400 id inválido, 404, 409 não aberta). Testes em `npm run test:banco-talentos` (18/18).

### ✅ Parte 0 — Preparação para o login (10/10/2026)
Sem migration e sem mudança de comportamento nas telas.
- **Pasta única:** o projeto passou a ser só `Painel-RH-Super-Estagios` (remote `Painel-RH-Super-Estagios`). O `.env` e `backend/uploads/` foram copiados da cópia antiga (`solucaoSuperEstagios-1`, remote antigo), que será renomeada para `_antigo` pelo usuário.
- **Produção (Neon):** criado vazio em 06/10/2026 e recebeu as 5 migrations via `migrate deploy`; não usa a senha do banco local.
- **`apiFetch` central** (`frontend/src/api.js`): toda chamada à API passa por `apiFetch(path, { method, body })` (URL base, corpo em JSON — `FormData` vai como está — e falha de conexão como `OfflineError`, um `TypeError` com `OFFLINE_MESSAGE`) ou `apiJson(path, options, mensagemPadrão)` (devolve o JSON; erro → `ApiError` com o `erro` da API ou a mensagem padrão). Não há mais `fetch` direto nas telas; o `offline.js` (que substituía o `window.fetch`) foi removido. **O login deve entrar aqui** (credenciais/cookie e tratamento de 401).
- **Helper dos testes** (`backend/scripts/lib/teste.js`): `criarTeste(PORT)` → `req`, `checar`, `checarStatus` (status HTTP esperado), `esperarServidor` e o contador `teste.falhas`, usado nos 10 scripts.
- **Limpeza:** referências aos scripts de demo removidas; `*.dump` e `*.sql.gz` no `.gitignore`; removidos `studyShiftPhrase`/`turnoFrase`, `linkText`, o `recentInterviews` do `/dashboard-metrics` e o `package.json` da raiz.
- **Conferência no banco local:** 32 estudantes, nenhum telefone repetido comparando só os dígitos; 30 no formato `(99) 99999-9999`, 1 com 10 dígitos e 1 com 11 dígitos sem máscara.

### 🟡 Parte 1 — Login — IMPLEMENTADA (10/10/2026); commit local, push e configuração do Render pendentes
Migration `20261010120000_add_usuarios` (só adições, aprovada pelo usuário; aplicada no banco local, **não no Neon**): enum `PapelUsuario` (`ADMIN`, `RECRUTADOR`) e tabela `Usuario` (`nome`, `email` único e sempre minúsculo, `senha_hash` bcrypt custo 12, `papel`, `ativo`, `created_at`, `updated_at`).
- **Backend** (`src/auth.js`, `src/routes/auth.js`): `POST /auth/login { email, senha }` → `{ token, usuario }`; JWT HS256 de 8h assinado com `JWT_SECRET` (obrigatório, ≥ 32 caracteres; a API não sobe sem ele). Mesma mensagem para e-mail inexistente, senha errada e usuário inativo (com tempo de resposta igual). `GET /auth/me` → usuário logado.
- **Todas as rotas exigem `Authorization: Bearer`** (middleware `exigirLogin` em `server.js`), exceto `POST /auth/login`, `GET /` e `/uploads/logos/*` (públicas; arquivo inexistente é 404, não 401). A cada requisição o usuário precisa existir e estar `ativo` — desativar tem efeito imediato.
- **Limite de tentativas** (`express-rate-limit`): só falhas contam; 8 por e-mail e 20 por IP a cada 15 min → 429. Em produção `trust proxy = 1` (Render).
- **CORS:** só `FRONTEND_URL` (vários separados por vírgula); fora de produção (`NODE_ENV` ≠ `production`) também `localhost`/`127.0.0.1`.
- Tratador de erros no fim do `server.js`: JSON curto (`{ erro }`) em vez da página HTML do Express. `aparaTextos` não mexe mais no campo `senha`.
- **Frontend:** `session.js` (token e usuário no `localStorage`, com cópia em memória), `apiFetch` envia o token; ao receber 401 (fora do `/auth/login`) apaga a sessão e dispara `auth:expired` → `App.jsx` mostra a tela de login (`pages/Login.jsx`) com o toast "Sua sessão expirou". Sem login, qualquer endereço mostra o login e, ao entrar, abre o endereço pedido. "Sair" e "Logado como …" no menu lateral.
- **Usuários:** `npm run usuario:criar` (`scripts/criar-usuario.js`) pergunta nome, e-mail, senha (oculta, mínimo 10, repetida) e papel; mostra o banco (host/nome, sem senha) e pede confirmação. Sem cadastro público. Os papéis ainda não restringem nada (admin e recrutador veem o mesmo).
- **Testes:** o helper (`scripts/lib/teste.js`) cria um usuário `[TESTE]` temporário (`teste-<porta>-…@teste.local`) no `esperarServidor()` e o apaga com `teste.removerUsuario()`. Novo `npm run test:login` (36 casos). Total: 11 scripts, 262 casos.

## Regras de trabalho

- **Banco de dados: antes de aplicar QUALQUER alteração no banco (migrations, `migrate deploy`/`dev`/`reset`, `db push`, SQL manual, escrita em `_prisma_migrations`, criação/remoção de bancos, scripts de teste que gravam dados), mostrar o SQL/operações ao usuário e esperar aprovação explícita.**

- Fazer **uma subetapa por vez** (2A → 2B → 2C → 2D) e testar entre elas
- **Commit no Git antes de cada subetapa**, para poder voltar se algo quebrar
- Manter o padrão visual Tailwind existente; vermelho para ações destrutivas
- Não reescrever arquivos inteiros sem necessidade; preferir alterações pontuais
