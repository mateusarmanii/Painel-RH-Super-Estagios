import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, MessageCircle, MessageSquareX, Phone, Send, UserRound, Users } from "lucide-react";
import ActionMenu from "../components/ActionMenu.jsx";
import ListToolbar from "../components/ListToolbar.jsx";
import { IndicateForm } from "../components/IndicateForm.jsx";
import Modal from "../components/Modal.jsx";
import PageHeader from "../components/PageHeader.jsx";
import LoadError from "../components/LoadError.jsx";
import { courseOptions, formatPhone, normalize, plural, whatsappLink } from "../text.js";
import { toTalents } from "../regras.js";
import { API_URL as apiUrl } from "../api.js";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });

export default function BancoTalentosPage() {
  const [students, setStudents] = useState([]);
  const [openJobs, setOpenJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState("");
  const [indicating, setIndicating] = useState(null);
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    try {
      const [studentsResponse, jobsResponse] = await Promise.all([
        fetch(`${apiUrl}/candidatos`),
        fetch(`${apiUrl}/vagas`),
      ]);
      if (!studentsResponse.ok || !jobsResponse.ok) throw new Error("Não foi possível carregar o Banco de Talentos.");
      setStudents(await studentsResponse.json());
      setOpenJobs((await jobsResponse.json()).filter((job) => job.status === "ABERTA"));
      setLoadError("");
    } catch (error) {
      setLoadError(error.message);
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
    <section className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <PageHeader
          subtitle="Candidatos dispensados em alguma vaga e ainda não contratados, prontos para novas indicações"
        />
        <ListToolbar id="talentos" search={search} onSearchChange={setSearch} placeholder="Buscar por nome">
          <label htmlFor="filtro-curso" className="sr-only">Filtrar por curso</label>
          <select
            id="filtro-curso"
            value={course}
            onChange={(event) => setCourse(event.target.value)}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-marinho-600 focus:ring-2 focus:ring-ambar-400/40 sm:w-60"
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

        {loadError ? (
          <LoadError
            title="Não conseguimos carregar o Banco de Talentos"
            message={loadError}
            onRetry={() => {
              setIsLoading(true);
              loadData();
            }}
          />
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="h-56 animate-pulse rounded-lg border border-slate-200 bg-white" />
            ))}
          </div>
        ) : filteredTalents.length === 0 ? (
          <div className="grid place-items-center rounded-md border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
            <span className="grid size-12 place-items-center rounded-full bg-marinho-50 text-marinho-700">
              <Users size={22} />
            </span>
            <p className="mt-4 text-base font-semibold text-marinho-900">
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
                    <h2 className="text-lg font-semibold leading-6">
                      <Link
                        to={`/estudantes/${talent.id}`}
                        title="Ver perfil"
                        className="text-left text-marinho-900 underline-offset-2 hover:text-marinho-600 hover:underline"
                      >
                        {talent.nome_completo}
                      </Link>
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">{talent.curso}</p>
                  </div>
                  <div className="flex shrink-0 items-start gap-1">
                    {talent.inProcess.length > 0 && (
                      <span
                        className="mt-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700"
                        title={`Em processo: ${talent.inProcess.map((application) => application.vaga?.titulo).join(", ")}`}
                      >
                        Em processo
                      </span>
                    )}
                    <ActionMenu
                      label={`Ações para ${talent.nome_completo}`}
                      title={talent.nome_completo}
                      items={[
                        { key: "profile", label: "Ver perfil", icon: UserRound, onClick: () => navigate(`/estudantes/${talent.id}`) },
                        { key: "indicate", label: "Indicar para vaga", icon: Send, onClick: () => setIndicating(talent) },
                        whatsappLink(talent.telefone)
                          ? { key: "whatsapp", label: "Abrir WhatsApp", icon: MessageCircle, href: whatsappLink(talent.telefone) }
                          : { key: "whatsapp", label: "Abrir WhatsApp", icon: MessageCircle, disabled: true, disabledReason: "Telefone sem DDD" },
                      ]}
                    />
                  </div>
                </div>

                <div className="mt-4 rounded-md bg-rose-50/70 p-3 text-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-rose-700">Última dispensa</p>
                  <Link
                    to={`/kanban/${talent.lastDismissal.vaga_id}`}
                    className="mt-1 block font-medium text-slate-900 hover:text-marinho-700 hover:underline"
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
                  <p className="flex items-center gap-1.5"><Phone size={14} className="shrink-0 text-slate-400" /> {formatPhone(talent.telefone)}</p>
                  {talent.email && (
                    <p className="flex items-center gap-1.5 break-all"><Mail size={14} className="shrink-0 text-slate-400" /> {talent.email}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIndicating(talent)}
                  className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ambar-400 px-4 text-sm font-bold text-marinho-900 transition-colors hover:bg-ambar-500"
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
