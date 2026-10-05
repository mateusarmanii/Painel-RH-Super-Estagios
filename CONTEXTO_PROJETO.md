# Contexto do Projeto — Super Estágios (Painel de RH)

Este arquivo resume tudo o que já foi decidido e implementado no projeto, para que qualquer assistente de código (Claude Code, etc.) entenda o histórico antes de mexer no sistema. **Leia este arquivo inteiro antes de qualquer alteração.**

## O que é o sistema

Painel interno de RH da Super Estágios (agência de estagiários) para organizar o fechamento de vagas das empresas clientes.

- **Backend:** Node.js + Express (`backend/server.js`, `backend/src`), Prisma (`backend/prisma/schema.prisma`)
- **Frontend:** React + Vite + Tailwind CSS (`frontend/src`), React Router, Kanban com drag and drop
- **Entidades principais:** Empresas, Vagas, Candidatos/Estudantes (Banco de Talentos)

## Status atual (diagnóstico de 05/10/2026, conferido no código)

### ❌ Etapa 1 — NÃO IMPLEMENTADA (o registro anterior estava errado)
Nada da Etapa 1 existe no código commitado. Situação real:
- Rotas: `empresas` só tem `GET`/`POST`; `vagas` e `candidatos` têm `GET`/`POST`/`PATCH /:id`. **Não há nenhum `PUT` nem `DELETE`.**
- FKs da `Aplicacao` e da `Vaga` usam `ON DELETE RESTRICT` — exclusões precisarão de cascade ou erro amigável.
- `react-hot-toast` não está instalado.
- Não existe campo "Anotações do Recrutador" (nem no schema, nem no formulário).
- Busca em tempo real e botões Editar/Excluir: não verificados como implementados — tratar como pendentes.

O que JÁ existe: CRUD de criação (POST), Dashboard com KPIs + funil (`/dashboard-metrics`), Kanban com drag and drop (`@dnd-kit`), `recharts` instalado.

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

### 1 — Refazer a Etapa 1 (backend primeiro, depois frontend)
- `PUT`/`DELETE` para `/empresas/:id`, `/vagas/:id`, `/candidatos/:id`, com tratamento das FKs `RESTRICT`
- Campo `anotacoes` (String?) em `Estudante`
- Depois: `react-hot-toast`, busca, modais de Editar/Excluir, textarea de anotações

### 2A — Banco de dados e backend (sem mexer no frontend)
1. **Ajustar o modelo `Aplicacao` (não criar tabela nova):**
   - adicionar `data_contratacao` (DateTime?), `createdAt` (`@default(now())`), `updatedAt` (`@updatedAt`)
   - adicionar `@@unique([vaga_id, estudante_id])` (verificar duplicatas existentes antes)
   - manter `motivo_recusa` como motivo da dispensa e `data_hora_entrevista` como data da entrevista
   - adicionar `createdAt` em `Vaga` (necessário para "Vagas em Alerta")
2. Rota `GET /vagas/:vagaId/candidatos` → só aplicações daquela vaga
3. Rota de atualização do Kanban aceitando `status_kanban`, `motivo_recusa`, `data_hora_entrevista`; ao mudar para `APROVADO`, gravar `data_contratacao`
4. Rota `GET /entrevistas` → aplicações com `data_hora_entrevista` futura, ordenadas por data
5. `GET /dashboard-metrics` passando a calcular (hoje calcula só vagas abertas, candidatos em processo, empresas, entrevistas agendadas, funil e próximas 5 entrevistas — sem filtro de data futura):
   - **Tempo Médio de Contratação:** média de dias entre `createdAt` da candidatura e `data_contratacao` (não usar `updatedAt`, que muda a cada edição)
   - **Vagas em Alerta:** vagas `ABERTA` criadas há mais de 10 dias com 0 aplicações em `ENTREVISTA_AGENDADA`
   - **Distribuição por Curso:** contagem de estudantes agrupados por `curso`
6. O projeto usa migrations (`backend/prisma/migrations`): rodar `npx prisma migrate dev --name <nome>` após alterar o schema (não usar `db push`)

### 2B — Kanban isolado e interativo (frontend)
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

- Fazer **uma subetapa por vez** (2A → 2B → 2C → 2D) e testar entre elas
- **Commit no Git antes de cada subetapa**, para poder voltar se algo quebrar
- Manter o padrão visual Tailwind existente; vermelho para ações destrutivas
- Não reescrever arquivos inteiros sem necessidade; preferir alterações pontuais
