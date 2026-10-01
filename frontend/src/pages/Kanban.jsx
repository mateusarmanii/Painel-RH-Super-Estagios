const columns = [
  { id: "novos", title: "Novos Candidatos", border: "border-t-sky-500" },
  { id: "analise", title: "Em Análise", border: "border-t-amber-500" },
  { id: "entrevista", title: "Entrevista", border: "border-t-violet-500" },
  { id: "contratados", title: "Contratados", border: "border-t-emerald-500" },
];

const estudantes = [
  {
    id: 1,
    nome: "Ana Luiza Martins",
    iniciais: "AM",
    curso: "Design Gráfico",
    coluna: "novos",
    avatar: "bg-sky-100 text-sky-700",
  },
  {
    id: 2,
    nome: "Bruno Henrique Costa",
    iniciais: "BC",
    curso: "Sistemas de Informação",
    coluna: "novos",
    avatar: "bg-rose-100 text-rose-700",
  },
  {
    id: 3,
    nome: "Camila Rocha Almeida",
    iniciais: "CA",
    curso: "Administração",
    coluna: "analise",
    avatar: "bg-amber-100 text-amber-800",
  },
  {
    id: 4,
    nome: "Daniel Souza Lima",
    iniciais: "DL",
    curso: "Psicologia",
    coluna: "entrevista",
    avatar: "bg-violet-100 text-violet-700",
  },
  {
    id: 5,
    nome: "Eduarda Lima Santos",
    iniciais: "ES",
    curso: "Engenharia de Produção",
    coluna: "contratados",
    avatar: "bg-emerald-100 text-emerald-700",
  },
];

export default function KanbanPage() {
  return (
    <section className="flex h-[calc(100vh-4rem)] min-h-[32rem] flex-col bg-slate-100">
      <header className="shrink-0 px-5 py-5 sm:px-7">
        <h1 className="text-xl font-semibold text-slate-900">Candidatos</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-4 pb-5 sm:px-7">
        <div className="flex h-full min-w-max gap-4">
          {columns.map((column) => {
            const estudantesDaColuna = estudantes.filter(
              (estudante) => estudante.coluna === column.id,
            );

            return (
              <section
                key={column.id}
                className={`flex h-full w-72 flex-col overflow-hidden rounded-md border border-slate-200 border-t-4 bg-slate-50 sm:w-80 ${column.border}`}
              >
                <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                  <h2 className="text-sm font-semibold text-slate-800">
                    {column.title}
                  </h2>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                    {estudantesDaColuna.length}
                  </span>
                </header>

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                  {estudantesDaColuna.map((estudante) => (
                    <article
                      key={estudante.id}
                      className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-3 shadow-sm"
                    >
                      <span
                        aria-label={`Iniciais: ${estudante.iniciais}`}
                        className={`grid size-10 shrink-0 place-items-center rounded-full text-xs font-semibold ${estudante.avatar}`}
                      >
                        {estudante.iniciais}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-slate-900">
                          {estudante.nome}
                        </h3>
                        <p className="mt-1 truncate text-xs text-slate-600">
                          {estudante.curso}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}