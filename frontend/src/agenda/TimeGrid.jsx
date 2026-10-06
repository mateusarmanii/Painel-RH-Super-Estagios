import { useEffect, useRef, useState } from "react";
import { DndContext, PointerSensor, useDraggable, useSensor, useSensors } from "@dnd-kit/core";
import { AlertTriangle, MapPin, Video } from "lucide-react";
import CompanyAvatar from "../components/CompanyAvatar.jsx";
import { interviewStatusBlock } from "../interviewStatus.js";
import { addDays, dayKey, interviewEnd, MINUTE_MS, sameDay, timeFormat, weekdayShort } from "./dates.js";

const HOUR_HEIGHT = 56;
const GUTTER = 56;
const SNAP_MINUTES = 15;

// Só entrevistas ainda em aberto podem ser arrastadas (reagendar).
export function canReschedule(interview) {
  return interview.status_kanban === "ENTREVISTA_AGENDADA" && ["AGUARDANDO", "CONFIRMADA", "NAO_COMPARECEU"].includes(interview.status_exibido);
}

// Entrevistas que se sobrepõem no mesmo dia ficam lado a lado.
function layoutDay(items) {
  const sorted = [...items].sort((a, b) => new Date(a.data_hora_entrevista) - new Date(b.data_hora_entrevista));
  const placed = [];
  let cluster = [];
  let clusterEnd = 0;
  let laneEnds = [];

  const closeCluster = () => {
    for (const item of cluster) item.lanes = laneEnds.length;
    cluster = [];
    laneEnds = [];
  };

  for (const interview of sorted) {
    const start = new Date(interview.data_hora_entrevista).getTime();
    const end = interviewEnd(interview).getTime();
    if (cluster.length && start >= clusterEnd) closeCluster();
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    const entry = { interview, lane, lanes: 1 };
    cluster.push(entry);
    placed.push(entry);
    clusterEnd = Math.max(clusterEnd, end);
  }
  closeCluster();
  return placed;
}

function Block({ entry, top, height, preview, onOpen }) {
  const { interview } = entry;
  const draggable = canReschedule(interview);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: interview.id, disabled: !draggable });
  const start = new Date(interview.data_hora_entrevista);
  const compact = height < 44;
  const FormatIcon = interview.entrevista_formato === "ONLINE" ? Video : MapPin;

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={() => onOpen(interview)}
      title={`${timeFormat.format(start)} · ${interview.estudante.nome_completo} · ${interview.vaga.empresa.nome}${draggable ? " (arraste para reagendar)" : ""}`}
      style={{
        top,
        height,
        left: `calc(${(entry.lane / entry.lanes) * 100}% + 2px)`,
        width: `calc(${100 / entry.lanes}% - 4px)`,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        zIndex: isDragging ? 30 : 10,
      }}
      className={`absolute overflow-hidden rounded-md border-l-4 px-2 py-1 text-left text-xs shadow-sm ring-1 ring-black/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marinho-700 ${
        interviewStatusBlock[interview.status_exibido]
      } ${draggable ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-pointer"} ${isDragging ? "opacity-90 shadow-lg" : ""}`}
    >
      {interview.conflito_com?.length > 0 && (
        <AlertTriangle size={13} className="absolute right-1 top-1 text-rose-600" aria-label="Conflito de horário" />
      )}
      {compact ? (
        <p className="truncate pr-4 font-semibold">
          <span className="tabular-nums">{timeFormat.format(preview ?? start)}</span> {interview.estudante.nome_completo}
        </p>
      ) : (
        <>
          <p className="flex items-center gap-1 pr-4 font-bold tabular-nums">
            {timeFormat.format(preview ?? start)}
            <FormatIcon size={11} className="shrink-0 opacity-60" />
          </p>
          <p className="truncate font-semibold">{interview.estudante.nome_completo}</p>
          {height >= 64 && (
            <p className="mt-0.5 flex min-w-0 items-center gap-1 opacity-80">
              <CompanyAvatar id={interview.vaga.empresa.id} name={interview.vaga.empresa.nome} logoUrl={interview.vaga.empresa.logo_url} size="xs" />
              <span className="truncate">{interview.vaga.empresa.nome}</span>
            </p>
          )}
        </>
      )}
    </button>
  );
}

// Visões Dia e Semana: grade de horários; arrastar uma entrevista para outro dia ou horário reagenda.
export default function TimeGrid({ days, interviews, onOpen, onMove }) {
  const bodyRef = useRef(null);
  const justDragged = useRef(false);
  const [preview, setPreview] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const hours = interviews.flatMap((interview) => [
    new Date(interview.data_hora_entrevista).getHours(),
    Math.ceil((interviewEnd(interview).getHours() * 60 + interviewEnd(interview).getMinutes()) / 60),
  ]);
  const firstHour = Math.min(7, ...hours);
  const lastHour = Math.max(20, ...hours);
  const hourList = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);
  const byDay = new Map(days.map((day) => [dayKey(day), []]));
  for (const interview of interviews) byDay.get(dayKey(new Date(interview.data_hora_entrevista)))?.push(interview);

  function targetDate(interview, delta) {
    const columnWidth = (bodyRef.current.clientWidth - GUTTER) / days.length;
    const dayShift = days.length > 1 ? Math.round(delta.x / columnWidth) : 0;
    const minuteShift = Math.round(delta.y / (HOUR_HEIGHT / (60 / SNAP_MINUTES))) * SNAP_MINUTES;
    const start = new Date(interview.data_hora_entrevista);
    return new Date(addDays(start, dayShift).getTime() + minuteShift * MINUTE_MS);
  }

  const findInterview = (id) => interviews.find((interview) => interview.id === id);

  function handleOpen(interview) {
    if (!justDragged.current) onOpen(interview);
  }

  const columns = `${GUTTER}px repeat(${days.length}, minmax(0, 1fr))`;
  const minWidth = days.length > 1 ? "min-w-[46rem]" : "";

  return (
    <div className="overflow-x-auto">
      <div className={minWidth}>
        <div className="sticky top-0 z-20 grid border-b border-slate-200 bg-white" style={{ gridTemplateColumns: columns }}>
          <span />
          {days.map((day) => {
            const isToday = sameDay(day, now);
            return (
              <div key={dayKey(day)} className="flex flex-col items-center gap-0.5 border-l border-slate-100 py-2">
                <span className={`text-[11px] font-bold uppercase tracking-wide ${isToday ? "text-marinho-900" : "text-slate-500"}`}>
                  {weekdayShort.format(day).replace(".", "")}
                </span>
                <span
                  className={`grid size-8 place-items-center rounded-full text-sm font-extrabold ${
                    isToday ? "bg-ambar-400 text-marinho-900" : "text-marinho-900"
                  }`}
                >
                  {day.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        <DndContext
          sensors={sensors}
          onDragStart={() => {
            justDragged.current = true;
          }}
          onDragMove={({ active, delta }) => {
            const interview = findInterview(active.id);
            if (interview) setPreview({ id: active.id, date: targetDate(interview, delta) });
          }}
          onDragCancel={() => setPreview(null)}
          onDragEnd={({ active, delta }) => {
            setPreview(null);
            setTimeout(() => {
              justDragged.current = false;
            }, 50);
            const interview = findInterview(active.id);
            if (!interview) return;
            const date = targetDate(interview, delta);
            if (date.getTime() !== new Date(interview.data_hora_entrevista).getTime()) onMove(interview, date);
          }}
        >
          <div ref={bodyRef} className="relative grid pt-3" style={{ gridTemplateColumns: columns }}>
            <div>
              {hourList.map((hour) => (
                <div key={hour} className="relative text-right" style={{ height: HOUR_HEIGHT }}>
                  <span className="absolute -top-2 right-2 text-[11px] tabular-nums text-slate-400">{String(hour).padStart(2, "0")}:00</span>
                </div>
              ))}
            </div>
            {days.map((day) => {
              const isToday = sameDay(day, now);
              const nowTop = ((now.getHours() - firstHour) * 60 + now.getMinutes()) / 60 * HOUR_HEIGHT;
              return (
                <div key={dayKey(day)} className={`relative border-l border-slate-100 ${isToday ? "bg-ambar-50/40" : ""}`}>
                  {hourList.map((hour) => (
                    <div key={hour} className="border-t border-slate-100" style={{ height: HOUR_HEIGHT }} />
                  ))}
                  {isToday && nowTop >= 0 && nowTop <= hourList.length * HOUR_HEIGHT && (
                    <div className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: nowTop }} aria-hidden="true">
                      <span className="-ml-1 size-2 rounded-full bg-ambar-500" />
                      <span className="h-0.5 flex-1 bg-ambar-500" />
                    </div>
                  )}
                  {layoutDay(byDay.get(dayKey(day)) ?? []).map((entry) => {
                    const start = new Date(entry.interview.data_hora_entrevista);
                    const top = ((start.getHours() - firstHour) * 60 + start.getMinutes()) / 60 * HOUR_HEIGHT;
                    const minutes = entry.interview.entrevista_duracao ?? 45;
                    return (
                      <Block
                        key={entry.interview.id}
                        entry={entry}
                        top={top}
                        height={Math.max(24, (minutes / 60) * HOUR_HEIGHT - 2)}
                        preview={preview?.id === entry.interview.id ? preview.date : null}
                        onOpen={handleOpen}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </DndContext>
      </div>
    </div>
  );
}
