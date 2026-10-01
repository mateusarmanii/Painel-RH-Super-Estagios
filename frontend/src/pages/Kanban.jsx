import { useEffect, useState } from "react";
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

const columns = [
  {
    id: "novos",
    title: "Novos Candidatos",
    status: "ENVIADO_EMPRESA",
    border: "border-t-sky-500",
  },
  {
    id: "analise",
    title: "Em Análise",
    status: "AGUARDANDO_RETORNO",
    border: "border-t-amber-500",
  },
  {
    id: "entrevista",
    title: "Entrevista",
    status: "ENTREVISTA_AGENDADA",
    border: "border-t-violet-500",
  },
  {
    id: "contratados",
    title: "Contratados",
    status: "APROVADO",
    border: "border-t-emerald-500",
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
      className={`flex cursor-grab touch-none items-center gap-3 rounded-md border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing ${
        isDragging ? "opacity-50" : ""
      }`}
    >
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
    </article>
  );
}

function KanbanColumn({ column, candidates }) {
  const { isOver, setNodeRef } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      className={`flex h-full w-72 flex-col overflow-hidden rounded-md border border-slate-200 border-t-4 bg-slate-50 transition-colors sm:w-80 ${column.border} ${
        isOver ? "bg-sky-50" : ""
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

export default function KanbanPage() {
  const [candidates, setCandidates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    let isCurrent = true;

    fetch("http://localhost:3333/candidatos")
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar os candidatos.");
        return response.json();
      })
      .then((students) => {
        if (!isCurrent) return;

        const applications = students.flatMap((student) =>
          (student.aplicacoes ?? []).flatMap((application, index) => {
            const column = columnByStatus[application.status_kanban];
            if (!column) return [];

            return [{
              id: student.id,
              applicationId: application.id,
              nome: student.nome_completo,
              curso: student.curso,
              status: application.status_kanban,
              coluna: column,
              avatar: avatarStyles[index % avatarStyles.length],
            }];
          }),
        );

        setCandidates(applications);
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
  }, []);

  async function handleDragEnd({ active, over }) {
    if (!over) return;

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

    const previousStatus = draggedCandidate.status;
    const previousColumn = draggedCandidate.coluna;

    setCandidates((current) =>
      current.map((candidate) =>
        candidate.applicationId === draggedCandidate.applicationId
          ? { ...candidate, status: destination.status, coluna: destination.id }
          : candidate,
      ),
    );
    setError("");

    try {
      const response = await fetch(
        `http://localhost:3333/candidatos/${draggedCandidate.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            aplicacao_id: draggedCandidate.applicationId,
            status_kanban: destination.status,
          }),
        },
      );

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.erro ?? "Não foi possível atualizar a candidatura.");
      }
    } catch (updateError) {
      setCandidates((current) =>
        current.map((candidate) =>
          candidate.applicationId === draggedCandidate.applicationId &&
          candidate.coluna === destination.id
            ? { ...candidate, status: previousStatus, coluna: previousColumn }
            : candidate,
        ),
      );
      setError(updateError.message);
    }
  }

  return (
    <section className="flex h-[calc(100vh-4rem)] min-h-[32rem] flex-col bg-slate-100">
      <header className="flex shrink-0 items-center justify-between px-5 py-5 sm:px-7">
        <h1 className="text-xl font-semibold text-slate-900">Candidatos</h1>
        {isLoading && <span className="text-sm text-slate-500">A carregar...</span>}
      </header>

      {error && (
        <p role="alert" className="mx-5 mb-3 text-sm text-rose-700 sm:mx-7">
          {error}
        </p>
      )}

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
    </section>
  );
}