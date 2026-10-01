import { Link } from "react-router-dom";

function PlaceholderPage({ title }) {
  return (
    <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50 px-4">
      <h1 className="text-center text-3xl font-semibold text-slate-900">{title}</h1>
    </section>
  );
}

export function VagasPage() {
  const vagas = [
    {
      id: 1,
      titulo: "Estágio em Desenvolvimento Front-end",
      empresa: "Núcleo Digital",
      status: "ABERTA",
    },
    {
      id: 2,
      titulo: "Assistente de Marketing",
      empresa: "Horizonte Comunicação",
      status: "ABERTA",
    },
    {
      id: 3,
      titulo: "Estágio em Recursos Humanos",
      empresa: "Grupo Vereda",
      status: "SUSPENSA",
    },
    {
      id: 4,
      titulo: "Auxiliar Administrativo",
      empresa: "Ponto Sul Consultoria",
      status: "FECHADA",
    },
  ];

  const statusStyles = {
    ABERTA: "bg-emerald-50 text-emerald-700",
    SUSPENSA: "bg-amber-50 text-amber-700",
    FECHADA: "bg-slate-100 text-slate-600",
  };

  const statusLabels = {
    ABERTA: "Aberta",
    SUSPENSA: "Suspensa",
    FECHADA: "Fechada",
  };

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {vagas.map((vaga) => (
          <article
            key={vaga.id}
            className="flex min-h-56 flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[vaga.status]}`}
              >
                {statusLabels[vaga.status]}
              </span>
            </div>
            <h2 className="text-lg font-semibold leading-6 text-slate-900">
              {vaga.titulo}
            </h2>
            <p className="mt-2 text-sm text-slate-600">{vaga.empresa}</p>
            <Link
              to="/kanban"
              className="mt-auto pt-6 text-left text-sm font-semibold text-sky-800 transition-colors hover:text-sky-950"
            >
              Abrir Kanban <span aria-hidden="true">&rarr;</span>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

export function EmpresasPage() {
  return <PlaceholderPage title="Empresas" />;
}

export function EmpresasSemVagaPage() {
  return <PlaceholderPage title="Empresas sem vaga" />;
}

export function BancoDeTalentosPage() {
  return <PlaceholderPage title="Banco de Talentos" />;
}

export function ContratacoesPage() {
  return <PlaceholderPage title="Contratações" />;
}