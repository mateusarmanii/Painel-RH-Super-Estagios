import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, CalendarClock, MessageSquareX } from "lucide-react";
import {
  closestCorners,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Modal from "../components/Modal.jsx";
import { statusLabels, statusStyles } from "../vagaStatus.js";
import { dateTimeFormat, kanbanStatusLabels, toDateTimeInputValue } from "../kanbanStatus.js";

const apiUrl = "http://localhost:3333";

const columns = [
  {
    id: "novos",
    title: kanbanStatusLabels.ENVIADO_EMPRESA,
    status: "ENVIADO_EMPRESA",
    border: "border-t-sky-500",
  },
  {
    id: "analise",
    title: kanbanStatusLabels.AGUARDANDO_RETORNO,
    status: "AGUARDANDO_RETORNO",
    border: "border-t-amber-500",
  },
  {
    id: "entrevista",
    title: kanbanStatusLabels.ENTREVISTA_AGENDADA,
    status: "ENTREVISTA_AGENDADA",
    border: "border-t-violet-500",
  },
  {
    id: "contratados",
    title: kanbanStatusLabels.APROVADO,
    status: "APROVADO",
    border: "border-t-emerald-500",
  },
  {
    id: "dispensados",
    title: kanbanStatusLabels.RECUSADO,
    status: "RECUSADO",
    border: "border-t-rose-400",
    background: "bg-rose-50/40",
  },
];

const columnByStatus = Object.fromEntries(
  columns.map((column) => [column.status, column.id]),
);

const avatarStyles = [
  "bg-sky-100 text-sky-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-800",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
];

function getInitials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function StudentCard({ candidate }) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: candidate.applicationId });

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
      className={`cursor-grab touch-none rounded-md border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          aria-label={`Iniciais: ${getInitials(candidate.nome)}`}
          className={`grid size-10 shrink-0 place-items-center rounded-full text-xs font-semibold ${candidate.avatar}`}
        >
          {getInitials(candidate.nome)}
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900">
            {candidate.nome}
          </h3>
          <p className="mt-1 truncate text-xs text-slate-600">{candidate.curso}</p>
        </div>
      </div>

      {candidate.coluna === "entrevista" && candidate.dataEntrevista && (
        <p className="mt-3 flex items-center gap-1.5 rounded bg-violet-50 px-2 py-1 text-xs font-medium text-violet-800">
          <CalendarClock size={14} className="shrink-0" />
          {dateTimeFormat.format(new Date(candidate.dataEntrevista))}
        </p>
      )}

      {candidate.coluna === "dispensados" && candidate.motivo && (
        <p className="mt-3 flex items-start gap-1.5 rounded bg-rose-50 px-2 py-1 text-xs text-rose-800">
          <MessageSquareX size={14} className="mt-px shrink-0" />
          <span className="line-clamp-3">{candidate.motivo}</span>
        </p>
      )}
    </article>
  );
}

function KanbanColumn({ column, candidates }) {
  const { isOver, setNodeRef } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      className={`flex h-full w-72 flex-col overflow-hidden rounded-md border border-slate-200 border-t-4 transition-colors sm:w-80 ${column.border} ${
        isOver ? "bg-sky-50" : column.background ?? "bg-slate-50"
      }`}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-800">{column.title}</h2>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
          {candidates.length}
        </span>
      </header>

      <SortableContext
        items={candidates.map((candidate) => candidate.applicationId)}
        strategy={verticalListSortingStrategy}
      >
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {candidates.map((candidate) => (
            <StudentCard key={candidate.applicationId} candidate={candidate} />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}

// Formulário dos modais de "Entrevista" (data e hora) e "Dispensado" (motivo).
function MoveDetailsForm({ move, onConfirm, onCancel }) {
  const isInterview = move.destination.status === "ENTREVISTA_AGENDADA";
  const [value, setValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const minDateTime = toDateTimeInputValue();

  async function handleSubmit(event) {
    event.preventDefault();

    if (isInterview && new Date(value) <= new Date()) {
      toast.error("Escolha uma data e hora no futuro.");
      return;
    }
    if (!isInterview && !value.trim()) {
      toast.error("Informe o motivo da dispensa.");
      return;
    }

    setIsSaving(true);
    const saved = await onConfirm(
      isInterview
        ? { data_hora_entrevista: new Date(value).toISOString() }
        : { motivo_recusa: value.trim() },
    );
    if (!saved) setIsSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-700">
        {isInterview ? "Agendar entrevista de " : "Dispensar "}
        <strong className="font-semibold text-slate-900">{move.candidate.nome}</strong>.
      </p>

      <label htmlFor="kanban-move-detail" className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-700">
          {isInterview ? "Data e hora da entrevista" : "Motivo da dispensa"}
        </span>
        {isInterview ? (
          <input
            id="kanban-move-detail"
            type="datetime-local"
            required
            min={minDateTime}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-700 focus:ring-2 focus:ring-sky-700/15"
          />
        ) : (
          <textarea
            id="kanban-move-detail"
            required
            rows={4}
            maxLength={500}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Ex.: perfil não aderente à vaga, aceitou outra proposta..."
            className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-700 focus:ring-2 focus:ring-sky-700/15"
          />
        )}
      </label>

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
          disabled={isSaving}
          className={`h-10 rounded-md px-4 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            isInterview ? "bg-sky-800 hover:bg-sky-900" : "bg-rose-600 hover:bg-rose-700"
          }`}
        >
          {isSaving ? "A guardar..." : isInterview ? "Agendar" : "Dispensar"}
        </button>
      </div>
    </form>
  );
}

// /kanban sem ID: escolher de qual vaga abrir o quadro.
function VagaPicker() {
  const [vagas, setVagas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;

    fetch(`${apiUrl}/vagas`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar as vagas.");
        return response.json();
      })
      .then((items) => {
        if (isCurrent) setVagas(items);
      })
      .catch((loadError) => {
        if (isCurrent) toast.error(loadError.message);
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-xl font-semibold text-slate-900">Escolha uma vaga para abrir o Kanban</h1>

        {isLoading ? (
          <p className="mt-6 text-sm text-slate-500">A carregar...</p>
        ) : vagas.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">Nenhuma vaga cadastrada.</p>
        ) : (
          <ul className="mt-6 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            {vagas.map((vaga) => (
              <li key={vaga.id}>
                <Link
                  to={`/kanban/${vaga.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{vaga.titulo}</p>
                    <p className="truncate text-xs text-slate-500">
                      Nº {vaga.codigo_vaga} · {vaga.empresa?.nome}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[vaga.status]}`}>
                    {statusLabels[vaga.status]}
                  </span>
                  <span aria-hidden="true" className="text-sky-800">&rarr;</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function toCandidate(application, index) {
  return {
    id: application.estudante.id,
    applicationId: application.id,
    nome: application.estudante.nome_completo,
    curso: application.estudante.curso,
    status: application.status_kanban,
    coluna: columnByStatus[application.status_kanban],
    dataEntrevista: application.data_hora_entrevista,
    motivo: application.motivo_recusa,
    avatar: avatarStyles[index % avatarStyles.length],
  };
}

function KanbanBoard({ vagaId }) {
  const [vaga, setVaga] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingMove, setPendingMove] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setError("");

    Promise.all([
      fetch(`${apiUrl}/vagas`),
      fetch(`${apiUrl}/vagas/${vagaId}/candidatos`),
    ])
      .then(async ([vagasResponse, applicationsResponse]) => {
        if (!applicationsResponse.ok) {
          const result = await applicationsResponse.json().catch(() => ({}));
          throw new Error(result.erro ?? "Não foi possível carregar os candidatos.");
        }
        if (!vagasResponse.ok) throw new Error("Não foi possível carregar a vaga.");
        return [await vagasResponse.json(), await applicationsResponse.json()];
      })
      .then(([vagas, applications]) => {
        if (!isCurrent) return;
        setVaga(vagas.find((item) => item.id === vagaId) ?? null);
        setCandidates(applications.map(toCandidate));
      })
      .catch((loadError) => {
        if (isCurrent) setError(loadError.message);
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [vagaId]);

  function placeCandidate(applicationId, changes) {
    setCandidates((current) =>
      current.map((candidate) =>
        candidate.applicationId === applicationId ? { ...candidate, ...changes } : candidate,
      ),
    );
  }

  // Envia o PATCH; em caso de erro, devolve o cartão à coluna de origem. Retorna true se salvou.
  async function saveMove({ candidate, destination }, details = {}) {
    try {
      const response = await fetch(`${apiUrl}/candidatos/${candidate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aplicacao_id: candidate.applicationId,
          status_kanban: destination.status,
          ...details,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.erro ?? "Não foi possível atualizar a candidatura.");

      placeCandidate(candidate.applicationId, {
        status: result.status_kanban,
        coluna: columnByStatus[result.status_kanban],
        dataEntrevista: result.data_hora_entrevista,
        motivo: result.motivo_recusa,
      });
      toast.success(`Candidatura de ${candidate.nome} movida para "${destination.title}".`);
      window.dispatchEvent(new Event("dashboard:refresh"));
      return true;
    } catch (updateError) {
      placeCandidate(candidate.applicationId, { status: candidate.status, coluna: candidate.coluna });
      toast.error(updateError.message);
      return false;
    }
  }

  function handleDragEnd({ active, over }) {
    if (!over || pendingMove) return;

    const draggedCandidate = candidates.find(
      (candidate) => candidate.applicationId === active.id,
    );
    const targetCandidate = candidates.find(
      (candidate) => candidate.applicationId === over.id,
    );
    const destination =
      columns.find((column) => column.id === over.id) ??
      columns.find((column) => column.id === targetCandidate?.coluna);

    if (!draggedCandidate || !destination || draggedCandidate.coluna === destination.id) {
      return;
    }

    // O cartão vai para a coluna de destino já; se a pessoa cancelar o modal, ele volta.
    placeCandidate(draggedCandidate.applicationId, { status: destination.status, coluna: destination.id });
    const move = { candidate: draggedCandidate, destination };

    if (destination.status === "ENTREVISTA_AGENDADA" || destination.status === "RECUSADO") {
      setPendingMove(move);
    } else {
      saveMove(move);
    }
  }

  function cancelPendingMove() {
    const { candidate } = pendingMove;
    placeCandidate(candidate.applicationId, { status: candidate.status, coluna: candidate.coluna });
    setPendingMove(null);
  }

  async function confirmPendingMove(details) {
    const saved = await saveMove(pendingMove, details);
    // Com erro, o cartão já voltou; o modal fecha para a pessoa tentar de novo.
    setPendingMove(null);
    return saved;
  }

  return (
    <section className="flex h-[calc(100vh-4rem)] min-h-[32rem] flex-col bg-slate-100">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/vagas"
            aria-label="Voltar para vagas"
            title="Voltar para vagas"
            className="grid size-9 shrink-0 place-items-center rounded-md text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900"
          >
            <ArrowLeft size={19} />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-slate-900">
              {vaga?.titulo ?? "Candidatos"}
            </h1>
            {vaga && (
              <p className="truncate text-sm text-slate-600">
                {vaga.empresa?.nome} · Nº {vaga.codigo_vaga}
              </p>
            )}
          </div>
        </div>
        {isLoading && <span className="text-sm text-slate-500">A carregar...</span>}
      </header>

      {error ? (
        <div className="mx-5 sm:mx-7">
          <p role="alert" className="text-sm text-rose-700">{error}</p>
          <Link to="/kanban" className="mt-3 inline-block text-sm font-semibold text-sky-800 hover:text-sky-950">
            Escolher outra vaga <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-4 pb-5 sm:px-7">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragEnd={handleDragEnd}
          >
            <div className="flex h-full min-w-max gap-4">
              {columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  candidates={candidates.filter((candidate) => candidate.coluna === column.id)}
                />
              ))}
            </div>
          </DndContext>
        </div>
      )}

      <Modal
        isOpen={Boolean(pendingMove)}
        title={pendingMove?.destination.status === "RECUSADO" ? "Dispensar candidato" : "Agendar entrevista"}
        onClose={cancelPendingMove}
      >
        {pendingMove && (
          <MoveDetailsForm
            key={pendingMove.candidate.applicationId}
            move={pendingMove}
            onConfirm={confirmPendingMove}
            onCancel={cancelPendingMove}
          />
        )}
      </Modal>
    </section>
  );
}

export default function KanbanPage() {
  const { vagaId } = useParams();
  return vagaId ? <KanbanBoard key={vagaId} vagaId={vagaId} /> : <VagaPicker />;
}
