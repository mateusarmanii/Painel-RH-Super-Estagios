import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { UserRoundCheck } from "lucide-react";
import ListToolbar from "../components/ListToolbar.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { csvDate, downloadCsv, toCsv, todayForFilename } from "../csv.js";
import { normalize, plural } from "../text.js";

const apiUrl = "http://localhost:3333";
const DIA_MS = 24 * 60 * 60 * 1000;
const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });

function daysToHire(hire) {
  if (!hire.data_aprovacao || !hire.created_at) return null;
  return Math.max(0, Math.round((new Date(hire.data_aprovacao) - new Date(hire.created_at)) / DIA_MS));
}

// Uma linha por candidatura em APROVADO, da contratação mais recente para a mais antiga.
function toHires(students) {
  return students
    .flatMap((student) =>
      (student.aplicacoes ?? [])
        .filter((application) => application.status_kanban === "APROVADO")
        .map((application) => ({ ...application, estudante: student })),
    )
    .sort((a, b) => new Date(b.data_aprovacao ?? 0) - new Date(a.data_aprovacao ?? 0));
}

const csvColumns = [
  { header: "Estudante", value: (hire) => hire.estudante.nome_completo },
  { header: "Curso", value: (hire) => hire.estudante.curso },
  { header: "Instituição de ensino", value: (hire) => hire.estudante.instituicao_ensino },
  { header: "Telefone", value: (hire) => hire.estudante.telefone },
  { header: "E-mail", value: (hire) => hire.estudante.email },
  { header: "Vaga", value: (hire) => hire.vaga?.titulo },
  { header: "Nº da vaga", value: (hire) => hire.vaga?.codigo_vaga },
  { header: "Empresa", value: (hire) => hire.vaga?.empresa?.nome },
  { header: "Contratado em", value: (hire) => csvDate(hire.data_aprovacao) },
  { header: "Dias até a contratação", value: (hire) => daysToHire(hire) ?? "" },
];

export default function ContratacoesPage() {
  const [hires, setHires] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadHires = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/candidatos`);
      if (!response.ok) throw new Error("Não foi possível carregar as contratações.");
      setHires(toHires(await response.json()));
    } catch (loadError) {
      toast.error(loadError instanceof TypeError ? "O servidor não respondeu. Verifique se a API está rodando." : loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHires();
    window.addEventListener("dashboard:refresh", loadHires);
    return () => window.removeEventListener("dashboard:refresh", loadHires);
  }, [loadHires]);

  const filteredHires = useMemo(() => {
    const term = normalize(search);
    if (!term) return hires;
    return hires.filter((hire) =>
      normalize(`${hire.estudante.nome_completo} ${hire.estudante.curso} ${hire.vaga?.titulo} ${hire.vaga?.empresa?.nome}`).includes(term),
    );
  }, [hires, search]);

  function handleExport() {
    downloadCsv(`contratacoes-${todayForFilename()}.csv`, toCsv(filteredHires, csvColumns));
    toast.success(`${plural(filteredHires.length, "contratação exportada", "contratações exportadas")}.`);
  }

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <PageHeader
          title="Contratações efetivas"
          subtitle={isLoading ? "A carregar..." : `${plural(hires.length, "estudante contratado", "estudantes contratados")}, da contratação mais recente para a mais antiga`}
        />
        <ListToolbar
          id="contratacoes"
          search={search}
          onSearchChange={setSearch}
          placeholder="Buscar por estudante, curso, vaga ou empresa"
          onExport={handleExport}
          exportDisabled={isLoading || filteredHires.length === 0}
        />

        {isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-md border border-slate-200 bg-white" />
            ))}
          </div>
        ) : filteredHires.length === 0 ? (
          <div className="grid place-items-center rounded-md border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
            <span className="grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-700">
              <UserRoundCheck size={22} />
            </span>
            <p className="mt-4 text-base font-semibold text-slate-900">
              {search.trim() ? `Nenhuma contratação encontrada para "${search.trim()}".` : "Nenhuma contratação ainda"}
            </p>
            {!search.trim() && (
              <p className="mt-1 text-sm text-slate-600">
                Quando um candidato for movido para "Contratado" no Kanban, ele aparece aqui.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
            {/* Celular: cartões empilhados. */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {filteredHires.map((hire) => {
                const days = daysToHire(hire);
                return (
                  <li key={hire.id} className="space-y-1 px-4 py-4 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{hire.estudante.nome_completo}</p>
                        <p className="text-xs text-slate-500">{hire.estudante.curso}</p>
                      </div>
                      <p className="shrink-0 text-right text-xs font-medium text-emerald-700">
                        {hire.data_aprovacao ? dateFormat.format(new Date(hire.data_aprovacao)) : "—"}
                      </p>
                    </div>
                    <Link to={`/kanban/${hire.vaga_id}`} className="block text-slate-700 hover:text-sky-800">
                      {hire.vaga?.titulo}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {hire.vaga?.empresa?.nome} · Nº {hire.vaga?.codigo_vaga}
                      {days !== null && ` · ${days < 1 ? "no mesmo dia" : `${plural(days, "dia", "dias")} após a candidatura`}`}
                    </p>
                  </li>
                );
              })}
            </ul>
            {/* Telas maiores: tabela. */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Estudante</th>
                    <th className="px-5 py-3 font-medium">Vaga</th>
                    <th className="px-5 py-3 font-medium">Empresa</th>
                    <th className="px-5 py-3 font-medium">Contratado em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHires.map((hire) => {
                    const days = daysToHire(hire);
                    return (
                      <tr key={hire.id}>
                        <td className="px-5 py-4">
                          <p className="font-medium text-slate-900">{hire.estudante.nome_completo}</p>
                          <p className="text-xs text-slate-500">{hire.estudante.curso}</p>
                        </td>
                        <td className="px-5 py-4">
                          <Link to={`/kanban/${hire.vaga_id}`} className="text-slate-700 hover:text-sky-800 hover:underline">
                            {hire.vaga?.titulo}
                          </Link>
                          <p className="text-xs text-slate-500">Nº {hire.vaga?.codigo_vaga}</p>
                        </td>
                        <td className="px-5 py-4 text-slate-600">{hire.vaga?.empresa?.nome}</td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <p className="text-slate-700">{hire.data_aprovacao ? dateFormat.format(new Date(hire.data_aprovacao)) : "—"}</p>
                          {days !== null && (
                            <p className="text-xs text-slate-500">{days < 1 ? "no mesmo dia" : `${plural(days, "dia", "dias")} após a candidatura`}</p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
