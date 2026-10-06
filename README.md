# Super Estágios — Painel de RH

Painel interno da Super Estágios (agência de estágios) para acompanhar o fechamento das vagas das empresas clientes:

- **Empresas, vagas e estudantes**, com busca, edição, exclusão e exportação para CSV (Excel).
- **Banco de Talentos**: candidatos dispensados (e não contratados), com filtro por curso e "Indicar para vaga".
- **Contratações efetivas**: todos os estudantes contratados, com data e vaga.
- **Kanban por vaga**: cada candidato passa por *Enviado à empresa → Em análise → Entrevista → Contratado* ou *Dispensado*. Ao mover para "Entrevista" o sistema pede data e hora; para "Dispensado", o motivo.
- **Agenda de entrevistas**, agrupada por dia, com reagendamento.
- **Dashboard** com vagas abertas, tempo médio de contratação, vagas paradas há mais de 10 dias, funil de contratação e distribuição dos estudantes por curso.
- **Histórico de candidaturas** de cada estudante.

## Tecnologias

| Parte | Tecnologias |
|---|---|
| Backend (`backend/`) | Node.js, Express, Prisma 5, PostgreSQL |
| Frontend (`frontend/`) | React 19, Vite, Tailwind CSS 4, React Router, dnd-kit (arrastar e soltar), Recharts (gráficos), react-hot-toast |

## Pré-requisitos

- **Node.js 20 ou mais recente** (o projeto foi desenvolvido com o Node 24).
- **PostgreSQL 14 ou mais recente**, instalado na máquina ou via Docker:

  ```bash
  docker run --name superestagios-db \
    -e POSTGRES_PASSWORD=troque-esta-senha \
    -e POSTGRES_DB=superestagios \
    -p 5432:5432 -d postgres:16
  ```

## Configuração

1. Instale as dependências (use `npm ci` para respeitar as versões travadas):

   ```bash
   cd backend && npm ci
   cd ../frontend && npm ci
   ```

2. Crie o arquivo de ambiente do backend a partir do modelo e preencha a senha do banco:

   ```bash
   cp backend/.env.example backend/.env
   ```

   | Variável | Para que serve |
   |---|---|
   | `DATABASE_URL` | Conexão com o PostgreSQL (`postgresql://usuario:senha@host:porta/banco?schema=public`) |
   | `PORT` | Porta da API (padrão `3333`). Se mudar, ajuste também a `VITE_API_URL` do frontend. |

   O frontend chama a API em `http://localhost:3333`. Se ela estiver em outro endereço, crie `frontend/.env` a partir de `frontend/.env.example` e defina `VITE_API_URL` (depois reinicie o `npm run dev` ou gere o build de novo).

   > O `backend/.env` tem senha e **não** deve ir para o Git (já está no `.gitignore`).

3. Crie as tabelas aplicando as migrations e gere o cliente do Prisma:

   ```bash
   cd backend
   npx prisma migrate deploy
   npx prisma generate
   ```

   > Rode os comandos `npx prisma` **depois** do `npm ci`; sem as dependências instaladas o `npx` baixa outra versão do Prisma.

## Como rodar

Em dois terminais:

```bash
# 1. API — http://localhost:3333 (reinicia sozinha ao salvar arquivos)
cd backend
npm run dev

# 2. Frontend — http://localhost:5173
cd frontend
npm run dev
```

Para gerar a versão de produção do frontend: `cd frontend && npm run build` (saída em `frontend/dist/`).

> No Windows, pare a API antes de rodar `npx prisma generate`; com ela rodando o arquivo do Prisma fica bloqueado (erro `EPERM`).

## Scripts de teste

Os testes sobem a API numa porta separada (3399), criam registros marcados com **`[TESTE]`**, verificam as rotas e apagam tudo no final, informando quantos registros `[TESTE]` restaram (deve ser 0). Eles **gravam no banco do `DATABASE_URL`**, então use um banco de desenvolvimento.

```bash
cd backend
npm run test:etapa1    # PUT/DELETE de empresas, vagas e estudantes; exclusões bloqueadas (409)
npm run test:etapa2a   # datas da candidatura, Kanban por vaga, entrevistas e métricas do dashboard
npm run test:etapa2d   # histórico de candidaturas e reagendamento de entrevista
npm run test:banco-talentos   # "Indicar para vaga" (nova candidatura, sem duplicatas) e data da dispensa
npm run test:resumos   # números dos cards de vagas e empresas; espaços extras tirados ao salvar
npm run test:frente2   # turno, disponibilidade, semestre, formatura, nascimento, turno da vaga e observação
npm run test:logos     # envio, troca e remoção da logo; recusa de SVG, de arquivos grandes e de formatos falsos
npm run test:agenda    # agendamento com detalhes, conflito de horário, resumo da agenda e ações do painel
npm run test:status-vaga   # suspender, fechar (motivo, dispensas, entrevistas canceladas) e reabrir vagas
npm run test:perfil    # perfil do estudante: dados, candidaturas, entrevistas, observações e dispensas
```

## Dados de demonstração

Para mostrar o sistema funcionando com dados realistas:

```bash
cd backend
npm run demo:criar    # 5 empresas, 10 vagas, 30 estudantes e 40 candidaturas marcados com [DEMO]
npm run demo:limpar   # remove tudo o que for [DEMO]
```

- O `demo:criar` não roda se já houver registros `[DEMO]` e grava tudo de uma vez (se algo falhar, nada é gravado).
- O `demo:limpar` só apaga registros `[DEMO]`. Se algum dado real estiver ligado a eles (por exemplo, um estudante real inscrito numa vaga `[DEMO]`), ele não apaga nada e mostra o que precisa ser resolvido.

> ⚠️ **Cuidado com o `npm run seed`** (`backend/prisma/seed.js`): ele **apaga TODOS os dados do banco** (empresas, vagas, estudantes e candidaturas) antes de criar alguns exemplos. Por isso ele só roda com a confirmação explícita `npm run seed -- --confirmar-apagar-tudo`; sem ela, avisa e não faz nada. Use apenas num banco vazio ou descartável. Para demonstrações, prefira o `demo:criar`.

## Backup

O backup precisa de **duas partes**:

1. **O banco de dados** (PostgreSQL), por exemplo com `pg_dump`. Com o banco no Docker:
   ```bash
   docker exec superestagios-db pg_dump -U <usuário> -d superestagios -Fc > backup.dump
   ```
2. **A pasta `backend/uploads/logos`**, com as logos das empresas. Os arquivos ficam nessa pasta e o banco guarda só o caminho (`logo_url`). Ela está no `.gitignore`, então **não vai para o GitHub**: sem copiar essa pasta, as empresas voltam sem logo (e aparecem com as iniciais).

## Estrutura

```
backend/
  server.js               API Express e /dashboard-metrics
  src/routes/             empresas (inclui o envio da logo), vagas, candidatos (inclui o PATCH do Kanban), entrevistas
  uploads/logos/          logos das empresas (fora do git; precisa entrar no backup)
  prisma/schema.prisma    modelo de dados (Empresa, Vaga, Estudante, Aplicacao)
  prisma/migrations/      histórico de alterações do banco
  scripts/                testes e dados de demonstração
frontend/src/
  pages/                  Dashboard, Kanban, Agenda, Vagas, Empresas, Estudantes, Perfil do estudante, Banco de Talentos, Contratações
  components/             lista com busca/edição/exclusão, formulários, modais e gráficos
```

O histórico de decisões e o estado atual do projeto estão em [`CONTEXTO_PROJETO.md`](CONTEXTO_PROJETO.md).
