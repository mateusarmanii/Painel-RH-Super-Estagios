import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { CalendarClock, CalendarDays, CalendarX2, Phone, RefreshCw } from "lucide-react";
import Modal from "../components/Modal.jsx";
import PageHeader from "../components/PageHeader.jsx";
import PanelCard from "../components/PanelCard.jsx";
import { toDateTimeInputValue } from "../kanbanStatus.js";
import { API_URL as apiUrl } from "../api.js";
import { formatPhone } from "../text.js";

const timeFormat = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" });
const dayFormat = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });

function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayTitle(date) {
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (dayKey(date) === dayKey(today)) return `Hoje · ${dayFormat.format(date)}`;
  if (dayKey(date) === dayKey(tomorrow)) return `Amanhã · ${dayFormat.format(date)}`;
  const label = dayFormat.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// A API já devolve as entrevistas ordenadas; aqui elas só são separadas por dia (fuso do navegador).
function groupByDay(interviews) {
  const groups = [];
  for (const interview of interviews) {
    const date = new Date(interview.data_hora_entrevista);
    const key = dayKey(date);
    if (groups.at(-1)?.key !== key) groups.push({ key, title: dayTitle(date), items: [] });
    groups.at(-1).items.push(interview);
  }
  return groups;
}

function RescheduleForm({ interview, onDone, onCancel }) {
  const [value, setValue] = useState(() => toDateTimeInputValue(interview.data_hora_entrevista));
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (new Date(value) <= new Date()) {
      toast.error("Escolha uma data e hora no futuro.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`${apiUrl}/candidatos/${interview.estudante.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aplicacao_id: interview.id,
          status_kanban: "ENTREVISTA_AGENDADA",
          data_hora_entrevista: new Date(value).toISOString(),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.erro ?? "Não foi possível reagendar a entrevista.");

      toast.success(`Entrevista de ${interview.estudante.nome_completo} reagendada.`);
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
        Nova data da entrevista de{" "}
        <strong className="font-semibold text-marinho-900">{interview.estudante.nome_completo}</strong> para{" "}
        {interview.vaga.titulo}.
      </p>
      <label htmlFor="agenda-nova-data" className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-700">Data e hora</span>
        <input
          id="agenda-nova-data"
          type="datetime-local"
          required
          min={toDateTimeInputValue()}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-marinho-600 focus:ring-2 focus:ring-ambar-400/40"
        />
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-marinho-800 transition-colors hover:bg-marinho-50 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="h-10 rounded-md bg-ambar-400 px-4 text-sm font-bold text-marinho-900 transition-colors hover:bg-ambar-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "A guardar..." : "Reagendar"}
        </button>
      </div>
    </form>
  );
}

export default function AgendaPage() {
  const [interviews, setInterviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [rescheduling, setRescheduling] = useState(null);

  const loadInterviews = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/entrevistas`);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.erro ?? "Não foi possível carregar a agenda.");
      setInterviews(result);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof TypeError
          ? "O servidor não respondeu. Verifique se a API está rodando e tente novamente."
          : loadError.message,
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInterviews();
    window.addEventListener("dashboard:refresh", loadInterviews);
    return () => window.removeEventListener("dashboard:refresh", loadInterviews);
  }, [loadInterviews]);

  const groups = groupByDay(interviews);

  return (
    <section className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <PageHeader subtitle="Próximas entrevistas, da mais próxima para a mais distante" />

        {isLoading ? (
          <div className="space-y-3" aria-busy="true" aria-label="A carregar a agenda">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-md border border-slate-200 bg-white" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-md border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
            <p className="text-sm text-slate-700">{error}</p>
            <button
              type="button"
              onClick={loadInterviews}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-ambar-400 px-4 text-sm font-bold text-marinho-900 transition-colors hover:bg-ambar-500"
            >
              <RefreshCw size={16} /> Tentar novamente
            </button>
          </div>
        ) : groups.length === 0 ? (
          <div className="grid place-items-center rounded-md border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
            <span className="grid size-12 place-items-center rounded-full bg-marinho-50 text-marinho-700">
              <CalendarX2 size={22} />
            </span>
            <p className="mt-4 text-base font-semibold text-marinho-900">Nenhuma entrevista agendada</p>
            <p className="mt-1 text-sm text-slate-600">
              Para agendar, arraste um candidato para a coluna "Entrevista" no Kanban da vaga.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <PanelCard key={group.key} title={group.title} icon={CalendarDays} bodyClassName="p-0">
                <ul className="divide-y divide-slate-100">
                  {group.items.map((interview) => (
                    <li
                      key={interview.id}
                      className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4"
                    >
                      <span className="flex w-20 shrink-0 items-center gap-1.5 text-base font-extrabold tabular-nums text-destaque">
                        <CalendarClock size={17} className="shrink-0" />
                        {timeFormat.format(new Date(interview.data_hora_entrevista))}
                      </span>
                      <div className="min-w-0 flex-1 basis-56">
                        <p className="truncate text-sm font-semibold text-marinho-900">{interview.estudante.nome_completo}</p>
                        <p className="truncate text-xs text-slate-500">{interview.estudante.curso}</p>
                        <p className="mt-1 truncate text-sm text-slate-600">
                          {interview.vaga.titulo}
                          <span className="text-slate-400"> · {interview.vaga.empresa.nome} · Nº {interview.vaga.codigo_vaga}</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <Phone size={13} /> {formatPhone(interview.estudante.telefone)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setRescheduling(interview)}
                          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-marinho-800 transition-colors hover:bg-marinho-50"
                        >
                          Reagendar
                        </button>
                        <Link
                          to={`/kanban/${interview.vaga.id}`}
                          className="px-1 text-sm font-semibold text-marinho-700 transition-colors hover:text-marinho-900"
                        >
                          Kanban <span aria-hidden="true">&rarr;</span>
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              </PanelCard>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={Boolean(rescheduling)} title="Reagendar entrevista" onClose={() => setRescheduling(null)}>
        {rescheduling && (
          <RescheduleForm
            key={rescheduling.id}
            interview={rescheduling}
            onDone={() => setRescheduling(null)}
            onCancel={() => setRescheduling(null)}
          />
        )}
      </Modal>
    </section>
  );
}
