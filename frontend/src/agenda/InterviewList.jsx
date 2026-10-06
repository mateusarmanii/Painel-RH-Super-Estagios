import { useState } from "react";
import { AlertTriangle, CalendarX2, ChevronDown, MapPin, Video } from "lucide-react";
import CompanyAvatar from "../components/CompanyAvatar.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { interviewStatusBadge, interviewStatusDot, interviewStatusLabels } from "../interviewStatus.js";
import { dayKey, dayTitle, interviewTimeRange, sameDay, startOfDay } from "./dates.js";

// Visão Lista: entrevistas do mês, separadas por dia. No mês atual, começa em hoje; os dias anteriores ficam
// recolhidos num botão.
export default function InterviewList({ interviews, onOpen }) {
  const today = new Date();
  const [showPast, setShowPast] = useState(false);
  const groups = [];
  for (const interview of interviews) {
    const date = new Date(interview.data_hora_entrevista);
    const key = dayKey(date);
    if (groups.at(-1)?.key !== key) groups.push({ key, date, items: [] });
    groups.at(-1).items.push(interview);
  }

  const past = groups.filter((group) => group.date < startOfDay(today));
  const hasFuture = past.length < groups.length;
  const visibleGroups = showPast || !hasFuture ? groups : groups.slice(past.length);
  const pastCount = past.reduce((total, group) => total + group.items.length, 0);

  if (groups.length === 0) {
    return (
      <div className="p-4">
        <EmptyState icon={CalendarX2} title="Nenhuma entrevista neste período" description="Agende pelo Kanban da vaga, movendo o candidato para Entrevista." />
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-200">
      {hasFuture && past.length > 0 && (
        <button
          type="button"
          onClick={() => setShowPast((current) => !current)}
          aria-expanded={showPast}
          className="flex w-full items-center justify-center gap-1.5 bg-slate-50 px-4 py-2 text-xs font-bold text-marinho-700 hover:bg-marinho-50"
        >
          <ChevronDown size={14} className={showPast ? "rotate-180" : ""} />
          {showPast ? "Esconder os dias anteriores" : `Ver ${pastCount} ${pastCount === 1 ? "entrevista" : "entrevistas"} de dias anteriores deste mês`}
        </button>
      )}
      {visibleGroups.map((group) => {
        const isToday = sameDay(group.date, today);
        return (
          <section key={group.key} aria-label={dayTitle(group.date)}>
            <h3
              className={`sticky top-0 z-10 flex items-center gap-2 px-4 py-2 text-xs font-extrabold uppercase tracking-wide sm:px-5 ${
                isToday ? "bg-ambar-400 text-marinho-900" : "bg-slate-50 text-marinho-800"
              }`}
            >
              {dayTitle(group.date)}
              <span className="font-semibold normal-case tracking-normal opacity-70">· {group.items.length}</span>
            </h3>
            <ul className="divide-y divide-slate-100">
              {group.items.map((interview) => {
                const FormatIcon = interview.entrevista_formato === "ONLINE" ? Video : MapPin;
                const cancelled = interview.status_exibido === "CANCELADA";
                return (
                  <li key={interview.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(interview)}
                      className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left transition-colors hover:bg-marinho-50/60 sm:px-5"
                    >
                      <span className="flex w-28 shrink-0 items-center gap-2 text-sm font-extrabold tabular-nums text-marinho-900">
                        <span className={`size-2 rounded-full ${interviewStatusDot[interview.status_exibido]}`} />
                        {interviewTimeRange(interview)}
                      </span>
                      <span className="min-w-0 flex-1 basis-48">
                        <span className={`block truncate text-sm font-semibold ${cancelled ? "text-slate-400 line-through" : "text-marinho-900"}`}>
                          {interview.estudante.nome_completo}
                          {interview.conflito_com?.length > 0 && (
                            <AlertTriangle size={13} className="ml-1.5 inline text-rose-600" aria-label="Conflito de horário" />
                          )}
                        </span>
                        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
                          <CompanyAvatar id={interview.vaga.empresa.id} name={interview.vaga.empresa.nome} logoUrl={interview.vaga.empresa.logo_url} size="xs" />
                          <span className="truncate">
                            {interview.vaga.titulo} · {interview.vaga.empresa.nome}
                          </span>
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        {interview.entrevista_formato && (
                          <span className="hidden items-center gap-1 text-xs text-slate-500 md:inline-flex">
                            <FormatIcon size={13} /> {interview.entrevista_formato === "ONLINE" ? "Online" : "Presencial"}
                          </span>
                        )}
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${interviewStatusBadge[interview.status_exibido]}`}>
                          {interviewStatusLabels[interview.status_exibido]}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
