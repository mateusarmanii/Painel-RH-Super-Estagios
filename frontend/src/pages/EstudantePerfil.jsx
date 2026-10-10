import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  ExternalLink,
  FileText,
  KanbanSquare,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Send,
  StickyNote,
  UserX,
} from "lucide-react";
import CompanyAvatar from "../components/CompanyAvatar.jsx";
import CreationForm from "../components/CreationForm.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { IndicateDialog } from "../components/IndicateForm.jsx";
import Modal from "../components/Modal.jsx";
import { kanbanStatusLabels, kanbanStatusStyles } from "../kanbanStatus.js";
import { interviewFormatLabels, interviewStatus, interviewStatusBadge, interviewStatusLabels } from "../interviewStatus.js";
import { ageFrom, availabilityText, formatMonthYear, studyShiftLabel, turnoVagaLabels } from "../estudante.js";
import { compatibleJobs, IN_PROCESS, nextInterview, profileAlerts, situationLabels, studentSituation, timeline } from "../perfil.js";
import { formatPhone, getInitials, plural, whatsappLink } from "../text.js";
import { buttonPrimary, buttonSecondary, card } from "../ui.js";
import { apiFetch, apiJson } from "../api.js";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const situationStyles = {
  DISPONIVEL: "bg-slate-100 text-slate-700",
  EM_PROCESSO: "bg-sky-50 text-sky-800 ring-1 ring-sky-200",
  CONTRATADO: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
};

function Section({ title, count, children, action }) {
  return (
    <section className={`${card} p-4 sm:p-5`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-marinho-900">
          {title}
          {count !== undefined && <span className="ml-1.5 font-semibold text-slate-400">{count}</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Chip({ children }) {
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{children}</span>;
}

function JobLine({ vaga }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <CompanyAvatar id={vaga?.empresa?.id} name={vaga?.empresa?.nome ?? ""} logoUrl={vaga?.empresa?.logo_url} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-marinho-900">{vaga?.titulo ?? "Vaga"}</p>
        <p className="truncate text-xs text-slate-500">
          {vaga?.empresa?.nome} · Nº {vaga?.codigo_vaga}
        </p>
      </div>
    </div>
  );
}

const eventIcons = { indicado: Send, entrevista: CalendarClock, contratado: BadgeCheck, dispensado: UserX };
const eventIconStyles = {
  indicado: "bg-sky-50 text-sky-700",
  entrevista: "bg-violet-50 text-violet-700",
  contratado: "bg-emerald-50 text-emerald-700",
  dispensado: "bg-rose-50 text-rose-700",
};

function TimelineEvent({ event, showNote }) {
  const Icon = eventIcons[event.type];
  const { application } = event;
  const vaga = application.vaga;
  const date = new Date(event.date);
  const titles = {
    indicado: "Indicado para a vaga",
    entrevista: "Entrevista",
    contratado: "Contratado",
    dispensado: "Dispensado",
  };

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      <span className={`relative z-10 grid size-8 shrink-0 place-items-center rounded-full ${eventIconStyles[event.type]}`}>
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-bold text-marinho-900">{titles[event.type]}</span>
          {event.type === "entrevista" && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${interviewStatusBadge[event.status]}`}>
              {interviewStatusLabels[event.status]}
            </span>
          )}
          <span className="text-xs text-slate-500">
            {event.type === "entrevista" ? dateTimeFormat.format(date) : dateFormat.format(date)}
          </span>
        </p>
        <p className="mt-0.5 truncate text-sm text-slate-600">
          {vaga?.titulo} · {vaga?.empresa?.nome}
        </p>
        {event.type === "entrevista" && application.entrevista_formato && (
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {interviewFormatLabels[application.entrevista_formato]}
            {application.entrevista_local && ` · ${application.entrevista_local}`}
            {application.entrevistador && ` · com ${application.entrevistador}`}
          </p>
        )}
        {event.type === "dispensado" && application.motivo_recusa && (
          <p className="mt-1 rounded bg-rose-50 px-2 py-1 text-xs text-rose-900">Motivo: {application.motivo_recusa}</p>
        )}
        {showNote && application.observacao && (
          <p className="mt-1 flex items-start gap-1.5 rounded border-l-2 border-marinho-300 bg-slate-50 px-2 py-1 text-xs text-slate-700">
            <StickyNote size={13} className="mt-px shrink-0 text-marinho-500" /> {application.observacao}
          </p>
        )}
      </div>
    </li>
  );
}

export default function EstudantePerfilPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isIndicating, setIsIndicating] = useState(false);
  const [indicatingJob, setIndicatingJob] = useState(null);

  const load = useCallback(async () => {
    try {
      const [studentResponse, jobsResponse] = await Promise.all([apiFetch(`/candidatos/${id}`), apiFetch("/vagas")]);
      if (studentResponse.status === 404 || studentResponse.status === 400) {
        setError("Estudante não encontrado. Ele pode ter sido excluído.");
        return;
      }
      if (!studentResponse.ok) throw new Error("Não foi possível carregar o perfil.");
      setStudent(await studentResponse.json());
      if (jobsResponse.ok) setJobs(await jobsResponse.json());
    } catch (loadError) {
      setError(loadError.message);
    }
  }, [id]);

  useEffect(() => {
    load();
    window.addEventListener("dashboard:refresh", load);
    return () => window.removeEventListener("dashboard:refresh", load);
  }, [load]);

  async function indicate(job) {
    setIndicatingJob(job.id);
    try {
      await apiJson(
        `/candidatos/${student.id}/candidaturas`,
        { method: "POST", body: { vaga_id: job.id } },
        "Não foi possível indicar o estudante.",
      );
      toast.success(`${student.nome_completo} foi indicado para "${job.titulo}".`);
      window.dispatchEvent(new Event("dashboard:refresh"));
    } catch (indicateError) {
      toast.error(indicateError.message);
    } finally {
      setIndicatingJob(null);
    }
  }

  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/estudantes"));

  if (error) {
    return (
      <section className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <EmptyState icon={UserX} title={error}>
            <Link to="/estudantes" className={`${buttonSecondary} mt-5`}>
              <ArrowLeft size={16} /> Ver estudantes
            </Link>
          </EmptyState>
        </div>
      </section>
    );
  }

  if (!student) {
    return (
      <section className="px-4 py-8 sm:px-6 lg:px-8" aria-busy="true">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="h-40 animate-pulse rounded-lg border border-slate-200 bg-white" />
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="h-72 animate-pulse rounded-lg border border-slate-200 bg-white lg:col-span-2" />
            <div className="h-72 animate-pulse rounded-lg border border-slate-200 bg-white" />
          </div>
        </div>
      </section>
    );
  }

  const applications = student.aplicacoes ?? [];
  const active = applications.filter((application) => IN_PROCESS.includes(application.status_kanban));
  const upcoming = nextInterview(applications);
  const events = timeline(applications);
  // A observação de cada candidatura aparece uma vez, no evento mais recente dela.
  const seenApplications = new Set();
  const noteEvents = new Set();
  for (const event of events) {
    if (seenApplications.has(event.key)) continue;
    seenApplications.add(event.key);
    noteEvents.add(event.id);
  }
  const alerts = profileAlerts(student);
  const situation = studentSituation(student);
  const age = ageFrom(student.data_nascimento);
  const whatsapp = whatsappLink(student.telefone);
  const matches = compatibleJobs(student, jobs);

  return (
    <section className="min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <button type="button" onClick={goBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-marinho-700 hover:text-marinho-900">
          <ArrowLeft size={16} /> Voltar
        </button>

        <header className={`${card} p-4 sm:p-6`}>
          <div className="flex flex-wrap items-start gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-full bg-marinho-900 text-xl font-extrabold text-white">
              {getInitials(student.nome_completo)}
            </span>
            <div className="min-w-0 flex-1 basis-64">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold leading-tight text-marinho-900 sm:text-2xl">{student.nome_completo}</h1>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${situationStyles[situation]}`}>{situationLabels[situation]}</span>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {student.curso} · {student.instituicao_ensino}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {student.semestre_atual && <Chip>{student.semestre_atual}º semestre</Chip>}
                {studyShiftLabel(student) && <Chip>Estuda: {studyShiftLabel(student)}</Chip>}
                {student.disponibilidade?.length > 0 && <Chip>Disponível: {availabilityText(student.disponibilidade)}</Chip>}
                {age !== null && <Chip>{age} anos</Chip>}
                {student.previsao_formatura && <Chip>Forma em {formatMonthYear(student.previsao_formatura)}</Chip>}
              </div>
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
              {whatsapp && (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  <MessageCircle size={16} /> WhatsApp
                </a>
              )}
              {student.email && (
                <a href={`mailto:${student.email}`} className={`${buttonSecondary} px-3`}>
                  <Mail size={16} /> E-mail
                </a>
              )}
              <button type="button" onClick={() => setIsEditing(true)} className={`${buttonSecondary} px-3`}>
                <Pencil size={16} /> Editar
              </button>
              <button type="button" onClick={() => setIsIndicating(true)} className={`${buttonPrimary} px-3`}>
                <Send size={16} /> Indicar para vaga
              </button>
            </div>
          </div>

          {alerts.length > 0 && (
            <ul className="mt-4 space-y-2">
              {alerts.map((alert) => (
                <li
                  key={alert.key}
                  role="alert"
                  className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${
                    alert.tone === "danger" ? "bg-rose-50 text-rose-900 ring-1 ring-rose-200" : "bg-orange-50 text-orange-900 ring-1 ring-orange-200"
                  }`}
                >
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {alert.text}
                </li>
              ))}
            </ul>
          )}
        </header>

        <div className="grid items-start gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Section title="Em andamento" count={active.length}>
              {upcoming && (
                <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-violet-200 bg-violet-50 p-3">
                  <CalendarClock size={20} className="shrink-0 text-violet-700" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-violet-950">
                      Próxima entrevista: {dateTimeFormat.format(new Date(upcoming.data_hora_entrevista))}
                    </p>
                    <p className="truncate text-sm text-violet-900">
                      {upcoming.vaga?.titulo} · {upcoming.vaga?.empresa?.nome}
                      {upcoming.entrevista_formato && ` · ${interviewFormatLabels[upcoming.entrevista_formato]}`}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${interviewStatusBadge[interviewStatus(upcoming)]}`}>
                    {interviewStatusLabels[interviewStatus(upcoming)]}
                  </span>
                </div>
              )}
              {active.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {situation === "CONTRATADO" ? "Contratado — sem processos em andamento." : "Nenhum processo em andamento. Veja as vagas compatíveis ao lado."}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {active.map((application) => (
                    <li key={application.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex-1 basis-56">
                        <JobLine vaga={application.vaga} />
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${kanbanStatusStyles[application.status_kanban]}`}>
                        {kanbanStatusLabels[application.status_kanban]}
                      </span>
                      <Link
                        to={`/kanban/${application.vaga_id}`}
                        title="Abrir Kanban da vaga"
                        aria-label={`Abrir Kanban da vaga ${application.vaga?.titulo}`}
                        className="grid size-9 place-items-center rounded-md text-marinho-700 hover:bg-marinho-50"
                      >
                        <KanbanSquare size={17} />
                      </Link>
                      {application.observacao && (
                        <p className="flex w-full items-start gap-1.5 rounded border-l-2 border-marinho-300 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                          <StickyNote size={13} className="mt-px shrink-0 text-marinho-500" /> {application.observacao}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Linha do tempo" count={applications.length ? plural(applications.length, "candidatura", "candidaturas") : undefined}>
              {events.length === 0 ? (
                <p className="text-sm text-slate-500">Ainda sem candidaturas. Use “Indicar para vaga” para começar.</p>
              ) : (
                <ol className="relative before:absolute before:bottom-2 before:left-4 before:top-2 before:w-px before:bg-slate-200">
                  {events.map((event) => (
                    <TimelineEvent key={event.id} event={event} showNote={noteEvents.has(event.id)} />
                  ))}
                </ol>
              )}
            </Section>
          </div>

          <div className="space-y-4">
            <Section title="Contato">
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex items-center gap-2"><Phone size={15} className="shrink-0 text-slate-400" /> {formatPhone(student.telefone)}</li>
                {student.email && <li className="flex items-center gap-2 break-all"><Mail size={15} className="shrink-0 text-slate-400" /> {student.email}</li>}
                {student.endereco && <li className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" /> {student.endereco}</li>}
                {student.link_curriculo && (
                  <li className="flex items-center gap-2">
                    <FileText size={15} className="shrink-0 text-slate-400" />
                    <a href={student.link_curriculo} target="_blank" rel="noopener noreferrer" className="font-semibold text-marinho-700 underline">
                      Currículo <ExternalLink size={12} className="inline" />
                    </a>
                  </li>
                )}
                {student.data_nascimento && <li className="text-slate-500">Nascimento: {dateFormat.format(new Date(`${student.data_nascimento.slice(0, 10)}T12:00:00`))}</li>}
              </ul>
            </Section>

            <Section
              title="Anotações do recrutador"
              action={
                <button type="button" onClick={() => setIsEditing(true)} className="text-xs font-bold text-marinho-700 hover:underline">
                  Editar
                </button>
              }
            >
              {student.anotacoes_recrutador ? (
                <p className="whitespace-pre-line rounded-md border-l-4 border-ambar-400 bg-ambar-50/60 px-3 py-2 text-sm text-slate-700">
                  {student.anotacoes_recrutador}
                </p>
              ) : (
                <p className="text-sm text-slate-500">Sem anotações.</p>
              )}
            </Section>

            <Section title="Vagas compatíveis" count={matches.length}>
              <p className="mb-3 text-xs text-slate-500">
                Vagas abertas ligadas ao curso
                {student.disponibilidade?.length ? " e sem choque com a disponibilidade" : " (sem disponibilidade informada, o horário não é conferido)"}.
              </p>
              {matches.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma vaga aberta compatível no momento.</p>
              ) : (
                <ul className="space-y-3">
                  {matches.map(({ job, schedule }) => (
                    <li key={job.id} className="rounded-md border border-slate-200 p-3">
                      <JobLine vaga={job} />
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">Curso</span>
                        {schedule === true && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">Horário</span>}
                        {job.turno && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{turnoVagaLabels[job.turno]}</span>}
                        <button
                          type="button"
                          disabled={indicatingJob === job.id}
                          onClick={() => indicate(job)}
                          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md bg-ambar-400 px-3 text-xs font-bold text-marinho-900 hover:bg-ambar-500 disabled:opacity-50"
                        >
                          <Send size={13} /> {indicatingJob === job.id ? "Indicando..." : "Indicar"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </div>
      </div>

      <Modal isOpen={isEditing} title="Editar estudante" onClose={() => setIsEditing(false)}>
        {isEditing && (
          <CreationForm
            type="estudante"
            initialData={student}
            onSuccess={() => {
              setIsEditing(false);
              load();
            }}
          />
        )}
      </Modal>
      <Modal isOpen={isIndicating} title="Indicar para vaga" onClose={() => setIsIndicating(false)}>
        {isIndicating && (
          <IndicateDialog
            studentId={student.id}
            onDone={() => {
              setIsIndicating(false);
              load();
            }}
            onCancel={() => setIsIndicating(false)}
          />
        )}
      </Modal>
    </section>
  );
}

