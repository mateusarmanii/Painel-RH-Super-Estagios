import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Percent, Plus, X } from "lucide-react";
import LoadError from "../components/LoadError.jsx";
import CompanyAvatar from "../components/CompanyAvatar.jsx";
import TimeGrid from "../agenda/TimeGrid.jsx";
import MonthGrid from "../agenda/MonthGrid.jsx";
import InterviewList from "../agenda/InterviewList.jsx";
import InterviewPanel from "../agenda/InterviewPanel.jsx";
import EventPanel from "../agenda/EventPanel.jsx";
import EventFormModal from "../agenda/EventFormModal.jsx";
import ReminderPrompt, { reminderFollowUp } from "../agenda/ReminderPrompt.jsx";
import { listEvents, runInterviewAction, saveEvent } from "../agenda/api.js";
import { conflictWarning } from "../agenda/conflicts.js";
import { addDays, dayTitle, interviewWho, periodFor, periodLabel, shiftAnchor, startOfWeek, timeFormat } from "../agenda/dates.js";
import { eventDot, eventEnd, eventLine } from "../agenda/events.js";
import { interviewStatusDot, interviewStatusLabels } from "../interviewStatus.js";
import { plural } from "../text.js";
import { buttonPrimary, buttonSecondary } from "../ui.js";
import { apiFetch } from "../api.js";

const views = [
  { value: "dia", label: "Dia" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mês" },
  { value: "lista", label: "Lista" },
];

const selectClass =
  "h-10 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-marinho-600 focus:ring-2 focus:ring-ambar-400/40";

function readView() {
  try {
    const saved = localStorage.getItem("agendaVisao");
    if (views.some((view) => view.value === saved)) return saved;
  } catch {
    // Sem acesso ao armazenamento local: usa o padrão.
  }
  return window.matchMedia?.("(max-width: 639px)").matches ? "lista" : "semana";
}

function SummaryCard({ children, tone = "neutral" }) {
  const tones = {
    neutral: "border-slate-200 bg-white",
    alert: "border-orange-200 bg-orange-50/60",
    ok: "border-slate-200 bg-white",
  };
  return <div className={`rounded-lg border p-3 shadow-sm sm:p-4 ${tones[tone]} ${tone === "neutral" ? "" : "col-span-2 lg:col-span-1"}`}>{children}</div>;
}

// Eventos (não entrevistas) em andamento ou nas próximas 24h, separados das entrevistas.
function EventsCard({ events, onOpen }) {
  return (
    <div className="col-span-2 rounded-lg border border-sky-200 bg-sky-50/50 p-3 shadow-sm sm:p-4 lg:col-span-1">
      <p className="flex items-center gap-1.5 text-sm font-bold text-sky-900">
        <CalendarDays size={16} className="text-sky-700" />
        {events.length ? `${plural(events.length, "evento", "eventos")} nas próximas 24h` : "Nenhum evento nas próximas 24h"}
      </p>
      {events.length > 0 && (
        <ul className="mt-2 space-y-1">
          {events.slice(0, 3).map((event) => (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => onOpen(event)}
                className="flex w-full min-w-0 items-center gap-1.5 text-left text-sm text-sky-950 hover:underline"
              >
                <span className="truncate">
                  {new Date(event.inicio) < new Date() && !event.dia_inteiro ? `Agora · ${event.titulo}` : eventLine(event)}
                </span>
              </button>
            </li>
          ))}
          {events.length > 3 && <li className="text-xs text-sky-800">e mais {events.length - 3}</li>}
        </ul>
      )}
    </div>
  );
}

// Topo: entrevistas das próximas 24h sem confirmação, eventos das próximas 24h, total da semana e comparecimento.
function Summary({ summary, onOpen, onOpenEvent }) {
  if (summary === false) return null;
  if (!summary) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true">
        {[0, 1, 2, 3].map((key) => <div key={key} className="h-24 animate-pulse rounded-lg border border-slate-200 bg-white" />)}
      </div>
    );
  }

  const pending = summary.semConfirmacao24h;
  const { taxa, realizadas, faltas } = summary.comparecimento;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {pending.length > 0 ? (
        <SummaryCard tone="alert">
          <p className="flex items-center gap-1.5 text-sm font-bold text-orange-900">
            <AlertTriangle size={16} className="text-orange-600" />
            {plural(pending.length, "entrevista", "entrevistas")} nas próximas 24h sem confirmação
          </p>
          <ul className="mt-2 space-y-1">
            {pending.slice(0, 3).map((interview) => (
              <li key={interview.id}>
                <button
                  type="button"
                  onClick={() => onOpen(interview)}
                  className="flex w-full min-w-0 items-center gap-1.5 text-left text-sm text-orange-950 hover:underline"
                >
                  <span className="shrink-0 font-bold tabular-nums">{timeFormat.format(new Date(interview.data_hora_entrevista))}</span>
                  <span className="truncate">· {interviewWho(interview)}</span>
                </button>
              </li>
            ))}
            {pending.length > 3 && <li className="text-xs text-orange-800">e mais {pending.length - 3}</li>}
          </ul>
        </SummaryCard>
      ) : (
        <SummaryCard tone="ok">
          <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-800">
            <CheckCircle2 size={16} /> Nada pendente nas próximas 24h
          </p>
          <p className="mt-1 text-sm text-slate-600">Todas as entrevistas desse período estão confirmadas (ou não há nenhuma).</p>
        </SummaryCard>
      )}
      <EventsCard events={summary.eventos24h ?? []} onOpen={onOpenEvent} />
      <SummaryCard>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
          <CalendarDays size={16} className="text-marinho-600" /> Esta semana
        </p>
        <p className="mt-1 text-2xl font-extrabold text-marinho-900 sm:text-3xl">{summary.semana}</p>
        <p className="text-xs text-slate-500 sm:text-sm">{summary.semana === 1 ? "entrevista" : "entrevistas"} (sem contar canceladas)</p>
      </SummaryCard>
      <SummaryCard>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
          <Percent size={16} className="text-marinho-600" /> Comparecimento
        </p>
        <p className="mt-1 text-2xl font-extrabold text-marinho-900 sm:text-3xl">{taxa === null ? "—" : `${Math.round(taxa * 100)}%`}</p>
        <p className="text-xs text-slate-500 sm:text-sm">
          {taxa === null
            ? "Sem entrevistas encerradas nos últimos 90 dias"
            : `${realizadas} de ${realizadas + faltas} nos últimos 90 dias`}
        </p>
      </SummaryCard>
    </div>
  );
}

export default function AgendaPage() {
  const [view, setView] = useState(readView);
  const [anchor, setAnchor] = useState(() => new Date());
  const [interviews, setInterviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [summary, setSummary] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [companyFilter, setCompanyFilter] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  // Modal do evento: { event } para editar, { date } para criar.
  const [eventForm, setEventForm] = useState(null);
  // Pergunta "Reenviar convite atualizado?" / "Enviar cancelamento?" depois de uma mudança.
  const [reminderPrompt, setReminderPrompt] = useState(null);
  // Muda depois de um envio pelo aviso, para os painéis recarregarem o histórico de lembretes.
  const [reminderVersion, setReminderVersion] = useState(0);
  const navigate = useNavigate();

  const period = useMemo(() => periodFor(view, anchor), [view, anchor]);
  const startIso = period.start.toISOString();
  const endIso = period.end.toISOString();

  useEffect(() => {
    try {
      localStorage.setItem("agendaVisao", view);
    } catch {
      // Sem acesso ao armazenamento local: só não lembra a visão.
    }
  }, [view]);

  // Entrevistas e eventos do período.
  const loadInterviews = useCallback(async () => {
    try {
      const [response, eventList] = await Promise.all([
        apiFetch(`/entrevistas?inicio=${encodeURIComponent(startIso)}&fim=${encodeURIComponent(endIso)}`),
        listEvents(startIso, endIso),
      ]);
      if (!response.ok) throw new Error("Não foi possível carregar as entrevistas.");
      const list = await response.json();
      setInterviews(list);
      setEvents(eventList);
      setLoadError("");
      // Mantém os painéis abertos com os dados novos.
      setSelected((current) => (current ? list.find((item) => item.id === current.id) ?? current : current));
      setSelectedEvent((current) => (current ? eventList.find((item) => item.id === current.id) ?? current : current));
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [startIso, endIso]);

  const loadSummary = useCallback(async () => {
    const weekStart = startOfWeek(new Date());
    const params = new URLSearchParams({ inicioSemana: weekStart.toISOString(), fimSemana: addDays(weekStart, 7).toISOString() });
    try {
      const response = await apiFetch(`/entrevistas/resumo?${params}`);
      setSummary(response.ok ? await response.json() : false);
    } catch {
      // O resumo é complementar: sem ele, os cards do topo somem e a agenda mostra o próprio erro.
      setSummary(false);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    loadInterviews();
  }, [loadInterviews]);

  useEffect(() => {
    loadSummary();
    apiFetch("/vagas")
      .then((response) => (response.ok ? response.json() : []))
      .then(setJobs)
      .catch(() => {});
  }, [loadSummary]);

  useEffect(() => {
    const refresh = () => {
      loadInterviews();
      loadSummary();
    };
    window.addEventListener("dashboard:refresh", refresh);
    return () => window.removeEventListener("dashboard:refresh", refresh);
  }, [loadInterviews, loadSummary]);

  const companies = useMemo(() => {
    const map = new Map();
    for (const job of jobs) if (job.empresa) map.set(job.empresa.id, job.empresa);
    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [jobs]);
  const jobOptions = jobs
    .filter((job) => !companyFilter || job.empresa_id === companyFilter)
    .sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));

  const visible = interviews.filter(
    (interview) => (!companyFilter || interview.vaga.empresa.id === companyFilter) && (!jobFilter || interview.vaga.id === jobFilter),
  );
  // Eventos não têm empresa nem vaga: com um filtro ativo, ficam de fora.
  const visibleEvents = companyFilter || jobFilter ? [] : events;
  const selectedCompany = companies.find((company) => company.id === companyFilter);

  // Depois de mudar data/hora ou cancelar: se havia lembrete enviado, pergunta se reenvia ou cancela o convite.
  async function followUpReminder(target, title) {
    const prompt = await reminderFollowUp(target, title);
    if (prompt) setReminderPrompt(prompt);
  }

  function handleUpdated(result) {
    setSelected(result);
    loadInterviews();
    loadSummary();
    followUpReminder({ entrevista_id: result.id }, `entrevista ${interviewWho(result)}`);
  }

  function openItem(kind, item) {
    if (kind === "evento") {
      setSelected(null);
      setSelectedEvent(item);
    } else {
      setSelectedEvent(null);
      setSelected(item);
    }
  }

  function handleEventSaved(saved, previous) {
    setEventForm(null);
    setSelectedEvent(saved);
    loadInterviews();
    loadSummary();
    const timeChanged = previous && (previous.inicio !== saved.inicio || eventEnd(previous).getTime() !== eventEnd(saved).getTime());
    if (timeChanged) followUpReminder({ evento_id: saved.id }, `evento “${saved.titulo}”`);
  }

  function handleEventDeleted() {
    setSelectedEvent(null);
    loadInterviews();
    loadSummary();
  }

  // Arrastar um evento na grade: muda só o início (a duração fica).
  async function moveEvent(event, date) {
    setEvents((current) => current.map((item) => (item.id === event.id ? { ...item, inicio: date.toISOString() } : item)));
    try {
      const saved = await saveEvent(event.id, { inicio: date.toISOString() });
      toast.success(`${event.titulo}: movido para ${dayTitle(date).toLowerCase()}, às ${timeFormat.format(date)}.`);
      window.dispatchEvent(new Event("dashboard:refresh"));
      followUpReminder({ evento_id: saved.id }, `evento “${saved.titulo}”`);
    } catch (error) {
      toast.error(error.message);
      loadInterviews();
    }
  }

  // Arrastar na grade: reagenda direto (entrevistas com a mesma regra do painel: só para o futuro).
  async function handleMove(kind, item, date) {
    if (kind === "evento") {
      moveEvent(item, date);
      return;
    }
    const interview = item;
    if (date <= new Date()) {
      toast.error("Escolha um horário no futuro para reagendar.");
      return;
    }
    setInterviews((current) =>
      current.map((item) => (item.id === interview.id ? { ...item, data_hora_entrevista: date.toISOString(), status_exibido: "AGUARDANDO" } : item)),
    );
    try {
      const result = await runInterviewAction(interview.id, { acao: "reagendar", data_hora_entrevista: date.toISOString() });
      toast.success(`${interview.estudante.nome_completo}: reagendada para ${dayTitle(date).toLowerCase()}, às ${timeFormat.format(date)}.`);
      if (result.conflitos?.length) toast(conflictWarning(interview.estudante.nome_completo, result.conflitos), { icon: "⚠️", duration: 8000 });
      window.dispatchEvent(new Event("dashboard:refresh"));
      followUpReminder({ entrevista_id: interview.id }, `entrevista ${interviewWho(interview)}`);
    } catch (error) {
      toast.error(error.message);
      loadInterviews();
    }
  }

  function pickDay(day) {
    setAnchor(day);
    setView("dia");
  }

  const conflicts = selected
    ? (selected.conflito_com ?? []).map((id) => interviews.find((item) => item.id === id)).filter(Boolean)
    : [];

  return (
    <section className="min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <Summary summary={summary} onOpen={(interview) => openItem("entrevista", interview)} onOpenEvent={(event) => openItem("evento", event)} />

        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setAnchor(new Date())} className={`${buttonSecondary} px-3`}>
              Hoje
            </button>
            <div className="flex">
              <button
                type="button"
                onClick={() => setAnchor((current) => shiftAnchor(view, current, -1))}
                aria-label="Período anterior"
                className="grid size-10 place-items-center rounded-md text-marinho-800 transition-colors hover:bg-marinho-50"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={() => setAnchor((current) => shiftAnchor(view, current, 1))}
                aria-label="Próximo período"
                className="grid size-10 place-items-center rounded-md text-marinho-800 transition-colors hover:bg-marinho-50"
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <h2 className="min-w-0 flex-1 truncate text-base font-extrabold text-marinho-900 sm:text-lg" aria-live="polite">
              {periodLabel(view, anchor)}
            </h2>
            <div role="group" aria-label="Visão" className="inline-flex rounded-md border border-slate-300 bg-white p-0.5">
              {views.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={view === option.value}
                  onClick={() => setView(option.value)}
                  className={`h-9 rounded px-3 text-sm font-semibold transition-colors ${
                    view === option.value ? "bg-marinho-900 text-white" : "text-marinho-800 hover:bg-marinho-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setEventForm({ date: null })} className={buttonPrimary}>
              <Plus size={16} /> Novo evento
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="agenda-empresa">Filtrar por empresa</label>
            <select
              id="agenda-empresa"
              value={companyFilter}
              onChange={(event) => {
                setCompanyFilter(event.target.value);
                setJobFilter("");
              }}
              className={`${selectClass} flex-1 basis-48 sm:max-w-64 sm:flex-none`}
            >
              <option value="">Todas as empresas</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.nome}</option>)}
            </select>
            <label className="sr-only" htmlFor="agenda-vaga">Filtrar por vaga</label>
            <select
              id="agenda-vaga"
              value={jobFilter}
              onChange={(event) => setJobFilter(event.target.value)}
              className={`${selectClass} flex-1 basis-48 sm:max-w-72 sm:flex-none`}
            >
              <option value="">Todas as vagas</option>
              {jobOptions.map((job) => <option key={job.id} value={job.id}>{job.titulo} · Nº {job.codigo_vaga}</option>)}
            </select>
            {(companyFilter || jobFilter) && (
              <button
                type="button"
                onClick={() => {
                  setCompanyFilter("");
                  setJobFilter("");
                }}
                className="inline-flex h-10 items-center gap-1 rounded-md px-2 text-sm font-semibold text-marinho-700 hover:bg-marinho-50"
              >
                {selectedCompany && <CompanyAvatar id={selectedCompany.id} name={selectedCompany.nome} logoUrl={selectedCompany.logo_url} size="xs" />}
                <X size={15} /> Limpar filtros
              </button>
            )}
            <ul className="ml-auto flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600" aria-label="Legenda das cores">
              {Object.entries(interviewStatusLabels).map(([status, label]) => (
                <li key={status} className="inline-flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${interviewStatusDot[status]}`} /> {label}
                </li>
              ))}
              <li className="inline-flex items-center gap-1.5 border-l border-slate-200 pl-3 font-semibold text-sky-800">
                <span className={`size-2 rounded-full ${eventDot}`} />
                <CalendarDays size={12} /> Evento
              </li>
            </ul>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm" aria-busy={isLoading}>
          {loadError ? (
            <div className="p-4">
              <LoadError
                title="Não conseguimos carregar as entrevistas"
                message={loadError}
                onRetry={() => {
                  setIsLoading(true);
                  loadInterviews();
                  loadSummary();
                }}
              />
            </div>
          ) : isLoading && interviews.length === 0 ? (
            <div className="h-96 animate-pulse bg-slate-50" />
          ) : view === "mes" ? (
            <MonthGrid days={period.days} month={anchor.getMonth()} interviews={visible} events={visibleEvents} onOpen={openItem} onPickDay={pickDay} />
          ) : view === "lista" ? (
            <InterviewList interviews={visible} events={visibleEvents} onOpen={openItem} />
          ) : (
            <TimeGrid
              days={period.days}
              interviews={visible}
              events={visibleEvents}
              onOpen={openItem}
              onMove={handleMove}
              onCreate={(date) => setEventForm({ date })}
            />
          )}
        </div>
        {(view === "dia" || view === "semana") && (
          <p className="text-xs text-slate-500">
            Dica: clique num horário vazio para criar um evento; arraste uma entrevista em aberto ou um evento para outro dia ou horário para reagendar.
          </p>
        )}
        {(companyFilter || jobFilter) && events.length > 0 && (
          <p className="text-xs text-slate-500">Os eventos ficam escondidos enquanto houver filtro de empresa ou vaga.</p>
        )}
      </div>

      {selected && (
        <InterviewPanel
          key={selected.id}
          interview={selected}
          conflicts={conflicts}
          reminderVersion={reminderVersion}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
          onOpenProfile={(studentId) => navigate(`/estudantes/${studentId}`)}
        />
      )}

      {selectedEvent && (
        <EventPanel
          key={selectedEvent.id}
          event={selectedEvent}
          reminderVersion={reminderVersion}
          onClose={() => setSelectedEvent(null)}
          onEdit={(event) => setEventForm({ event })}
          onDeleted={handleEventDeleted}
        />
      )}

      {eventForm && (
        <EventFormModal event={eventForm.event} date={eventForm.date} onClose={() => setEventForm(null)} onSaved={handleEventSaved} />
      )}

      {reminderPrompt && (
        <ReminderPrompt
          prompt={reminderPrompt}
          onClose={() => setReminderPrompt(null)}
          onDone={() => {
            setReminderPrompt(null);
            setReminderVersion((current) => current + 1);
          }}
        />
      )}

    </section>
  );
}
