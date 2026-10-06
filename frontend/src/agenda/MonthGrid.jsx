import { AlertTriangle } from "lucide-react";
import { interviewStatusDot, interviewStatusLabels } from "../interviewStatus.js";
import { dayKey, sameDay, timeFormat } from "./dates.js";

const weekdays = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const MAX_PER_DAY = 3;

// Visão Mês: até 3 entrevistas por dia; "+N" (ou tocar no dia, no celular) abre o dia.
export default function MonthGrid({ days, month, interviews, onOpen, onPickDay }) {
  const today = new Date();
  const byDay = new Map(days.map((day) => [dayKey(day), []]));
  for (const interview of interviews) byDay.get(dayKey(new Date(interview.data_hora_entrevista)))?.push(interview);

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-slate-200 bg-white">
        {weekdays.map((weekday) => (
          <span key={weekday} className="py-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
            {weekday}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const items = byDay.get(dayKey(day)) ?? [];
          const isToday = sameDay(day, today);
          const outside = day.getMonth() !== month;
          return (
            <div
              key={dayKey(day)}
              className={`min-h-16 border-b border-r border-slate-100 p-1 sm:min-h-28 sm:p-1.5 ${outside ? "bg-slate-50/70" : "bg-white"} ${
                isToday ? "bg-ambar-50/50" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => onPickDay(day)}
                title="Ver o dia"
                className={`mb-1 grid size-7 place-items-center rounded-full text-xs font-extrabold transition-colors ${
                  isToday ? "bg-ambar-400 text-marinho-900" : outside ? "text-slate-400 hover:bg-slate-100" : "text-marinho-900 hover:bg-marinho-50"
                }`}
              >
                {day.getDate()}
              </button>

              {/* Celular: só pontinhos coloridos; tocar no número abre o dia. */}
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => onPickDay(day)}
                  className="flex flex-wrap gap-0.5 px-1 sm:hidden"
                  aria-label={`${items.length} entrevista(s) — ver o dia`}
                >
                  {items.slice(0, 6).map((interview) => (
                    <span key={interview.id} className={`size-1.5 rounded-full ${interviewStatusDot[interview.status_exibido]}`} />
                  ))}
                </button>
              )}

              <ul className="hidden space-y-0.5 sm:block">
                {items.slice(0, MAX_PER_DAY).map((interview) => (
                  <li key={interview.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(interview)}
                      title={`${interviewStatusLabels[interview.status_exibido]} · ${interview.estudante.nome_completo} · ${interview.vaga.empresa.nome}`}
                      className={`flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] transition-colors hover:bg-marinho-50 ${
                        interview.status_exibido === "CANCELADA" ? "text-slate-400 line-through" : "text-slate-700"
                      }`}
                    >
                      <span className={`size-1.5 shrink-0 rounded-full ${interviewStatusDot[interview.status_exibido]}`} />
                      <span className="shrink-0 font-bold tabular-nums">{timeFormat.format(new Date(interview.data_hora_entrevista))}</span>
                      <span className="truncate">{interview.estudante.nome_completo}</span>
                      {interview.conflito_com?.length > 0 && <AlertTriangle size={11} className="shrink-0 text-rose-600" />}
                    </button>
                  </li>
                ))}
                {items.length > MAX_PER_DAY && (
                  <li>
                    <button
                      type="button"
                      onClick={() => onPickDay(day)}
                      className="px-1 text-[11px] font-bold text-marinho-700 hover:underline"
                    >
                      +{items.length - MAX_PER_DAY} mais
                    </button>
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
