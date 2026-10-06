import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Mail, MessageSquareX, Phone, Send, Users } from "lucide-react";
import ListToolbar from "../components/ListToolbar.jsx";
import Modal from "../components/Modal.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { courseOptions, normalize, plural } from "../text.js";

const apiUrl = "http://localhost:3333";
const IN_PROCESS = new Set(["ENVIADO_EMPRESA", "AGUARDANDO_RETORNO", "ENTREVISTA_AGENDADA"]);
const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });

// Regras do Banco de Talentos:
// - entra quem tem ao menos uma candidatura RECUSADO;
// - quem já foi contratado (APROVADO em qualquer vaga) fica de fora;
// - quem ainda está em processo em outra vaga ganha a etiqueta "Em processo".
// A data da dispensa é o updated_at da candidatura (enquanto RECUSADO, a última alteração é a dispensa).
function toTalents(students) {
  return students
    .filter((student) => {
      const statuses = (student.aplicacoes ?? []).map((application) => application.status_kanban);
      return statuses.includes("RECUSADO") && !statuses.includes("APROVADO");
    })
    .map((student) => {
      const applications = student.aplicacoes ?? [];
      const lastDismissal = applications
        .filter((application) => application.status_kanban === "RECUSADO")
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
      return {
        ...student,
        lastDismissal,
        inProcess: applications.filter((application) => IN_PROCESS.has(application.status_kanban)),
      };
    })
    .sort((a, b) => new Date(b.lastDismissal.updated_at) - new Date(a.lastDismissal.updated_at));
}

function IndicateForm({ talent, openJobs, onDone, onCancel }) {
  const appliedJobIds = new Set((talent.aplicacoes ?? []).map((application) => application.vaga_id));
  const availableJobs = openJobs.filter((job) => !appliedJobIds.has(job.id));
  const [jobId, setJobId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetch(`${apiUrl}/candidatos/${talent.id}/candidaturas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vaga_id: jobId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.erro ?? "Não foi possível indicar o candidato.");

      toast.success(`${talent.nome_completo} foi indicado para "${result.vaga?.titulo}".`);
      window.dispatchEvent(new Event("dashboard:refresh"));
      onDone();
    } catch (saveError) {
      toast.error(saveError.message);
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-700">
        Indicar <strong className="font-semibold text-slate-900">{talent.nome_completo}</strong> para uma vaga aberta.
        A candidatura começa em "Enviado à empresa".
      </p>

      {availableJobs.length === 0 ? (
        <p className="rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-600">
          Não há vagas abertas em que este candidato ainda não esteja inscrito.
        </p>
      ) : (
        <label htmlFor="indicar-vaga" className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Vaga</span>
          <select
            id="indicar-vaga"
            required
            value={jobId}
            onChange={(event) => setJobId(event.target.value)}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-700 focus:ring-2 focus:ring-sky-700/15"
          >
            <option value="">Selecione uma vaga aberta</option>
            {availableJobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.codigo_vaga} - {job.titulo} ({job.empresa?.nome})
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSaving || availableJobs.length === 0}
          className="h-10 rounded-md bg-sky-800 px-4 text-sm font-medium text-white transition-colors hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "A guardar..." : "Indicar"}
        </button>
      </div>
    </form>
  );
}

export default function BancoTalentosPage() {
  const [students, setStudents] = useState([]);
  const [openJobs, setOpenJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState("");
  const [indicating, setIndicating] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [studentsResponse, jobsResponse] = await Promise.all([
        fetch(`${apiUrl}/candidatos`),
        fetch(`${apiUrl}/vagas`),
      ]);
      if (!studentsResponse.ok || !jobsResponse.ok) throw new Error("Não foi possível carregar o Banco de Talentos.");
      setStudents(await studentsResponse.json());
      setOpenJobs((await jobsResponse.json()).filter((job) => job.status === "ABERTA"));
    } catch (loadError) {
      toast.error(loadError instanceof TypeError ? "O servidor não respondeu. Verifique se a API está rodando." : loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    window.addEventListener("dashboard:refresh", loadData);
    return () => window.removeEventListener("dashboard:refresh", loadData);
  }, [loadData]);

  const talents = useMemo(() => toTalents(students), [students]);
  const courses = useMemo(() => courseOptions(talents.map((talent) => talent.curso)), [talents]);

  const filteredTalents = useMemo(() => {
    const term = normalize(search);
    return talents.filter(
      (talent) =>
        (!term || normalize(talent.nome_completo).includes(term)) &&
        (!course || normalize(talent.curso) === course),
    );
  }, [talents, search, course]);

  const hasFilters = Boolean(search.trim() || course);

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <PageHeader
          title="Banco de Talentos"
          subtitle="Candidatos dispensados em alguma vaga e ainda não contratados, prontos para novas indicações"
        />
        <ListToolbar id="talentos" search={search} onSearchChange={setSearch} placeholder="Buscar por nome">
          <label htmlFor="filtro-curso" className="sr-only">Filtrar por curso</label>
          <select
            id="filtro-curso"
            value={course}
            onChange={(event) => setCourse(event.target.value)}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-700 focus:ring-2 focus:ring-sky-700/15 sm:w-60"
          >
            <option value="">Todos os cursos</option>
            {courses.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
        </ListToolbar>

        {!isLoading && talents.length > 0 && (
          <p className="mb-4 text-sm text-slate-500">
            {hasFilters
              ? `${plural(filteredTalents.length, "talento encontrado", "talentos encontrados")} de ${talents.length}`
              : plural(talents.length, "talento disponível", "talentos disponíveis")}
          </p>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="h-56 animate-pulse rounded-lg border border-slate-200 bg-white" />
            ))}
          </div>
        ) : filteredTalents.length === 0 ? (
          <div className="grid place-items-center rounded-md border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
            <span className="grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500">
              <Users size={22} />
            </span>
            <p className="mt-4 text-base font-semibold text-slate-900">
              {hasFilters ? "Nenhum talento com esses filtros" : "O Banco de Talentos está vazio"}
            </p>
            {!hasFilters && (
              <p className="mt-1 max-w-md text-sm text-slate-600">
                Candidatos dispensados no Kanban (e ainda não contratados) aparecem aqui para serem indicados a outras vagas.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTalents.map((talent) => (
              <article
                key={talent.id}
                className="flex flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold leading-6 text-slate-900">{talent.nome_completo}</h2>
                    <p className="mt-1 text-sm text-slate-600">{talent.curso}</p>
                  </div>
                  {talent.inProcess.length > 0 && (
                    <span
                      className="shrink-0 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700"
                      title={`Em processo: ${talent.inProcess.map((application) => application.vaga?.titulo).join(", ")}`}
                    >
                      Em processo
                    </span>
                  )}
                </div>

                <div className="mt-4 rounded-md bg-rose-50/70 p-3 text-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-rose-700">Última dispensa</p>
                  <Link
                    to={`/kanban/${talent.lastDismissal.vaga_id}`}
                    className="mt-1 block font-medium text-slate-900 hover:text-sky-800 hover:underline"
                  >
                    {talent.lastDismissal.vaga?.titulo}
                  </Link>
                  <p className="text-xs text-slate-600">
                    {talent.lastDismissal.vaga?.empresa?.nome} · {dateFormat.format(new Date(talent.lastDismissal.updated_at))}
                  </p>
                  {talent.lastDismissal.motivo_recusa && (
                    <p className="mt-2 flex items-start gap-1.5 text-slate-700">
                      <MessageSquareX size={14} className="mt-0.5 shrink-0 text-rose-600" />
                      <span>{talent.lastDismissal.motivo_recusa}</span>
                    </p>
                  )}
                </div>

                <div className="mt-4 space-y-1 text-sm text-slate-600">
                  <p className="flex items-center gap-1.5"><Phone size={14} className="shrink-0 text-slate-400" /> {talent.telefone}</p>
                  {talent.email && (
                    <p className="flex items-center gap-1.5 break-all"><Mail size={14} className="shrink-0 text-slate-400" /> {talent.email}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIndicating(talent)}
                  className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-sky-800 px-4 text-sm font-medium text-white transition-colors hover:bg-sky-900"
                >
                  <Send size={16} /> Indicar para vaga
                </button>
              </article>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={Boolean(indicating)} title="Indicar para vaga" onClose={() => setIndicating(null)}>
        {indicating && (
          <IndicateForm
            key={indicating.id}
            talent={indicating}
            openJobs={openJobs}
            onDone={() => setIndicating(null)}
            onCancel={() => setIndicating(null)}
          />
        )}
      </Modal>
    </section>
  );
}
