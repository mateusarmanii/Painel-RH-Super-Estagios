import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, CalendarDays, CalendarX2 } from "lucide-react";
import DashPanel, { Segmented } from "./DashPanel.jsx";
import { PanelLink } from "./BarList.jsx";
import { interviewStatus, interviewStatusBadge, interviewStatusLabels } from "../interviewStatus.js";

const timeFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short" });

// Entrevistas e eventos de hoje numa linha do tempo, em ordem de horário (dia inteiro primeiro).
function todayItems({ interviews, events }) {
  return [
    ...interviews.map((interview) => ({
      key: `e-${interview.id}`,
      kind: "entrevista",
      date: new Date(interview.data_hora_entrevista),
      allDay: false,
      interview,
    })),
    ...events.map((event) => ({ key: `ev-${event.id}`, kind: "evento", date: new Date(event.inicio), allDay: event.dia_inteiro, event })),
  ].sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.date - b.date);
}

function StatusBadge({ interview }) {
  const status = interviewStatus(interview);
  if (!status) return null;
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${interviewStatusBadge[status]}`}>{interviewStatusLabels[status]}</span>;
}

function InterviewLine({ interview, when, now }) {
  const past = new Date(interview.data_hora_entrevista) < now;
  return (
    <div className={`min-w-0 flex-1 ${past ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Link to={`/estudantes/${interview.estudante.id}`} className="truncate text-sm font-bold text-marinho-900 hover:underline">
          {interview.estudante.nome_completo}
        </Link>
        <StatusBadge interview={interview} />
      </div>
      <p className="truncate text-xs text-slate-500">
        <Link to={`/kanban/${interview.vaga.id}`} className="hover:text-marinho-700 hover:underline">{interview.vaga.titulo}</Link>
        {" · "}{interview.vaga.empresa?.nome}{when ? ` · ${when}` : ""}
      </p>
    </div>
  );
}

function Empty({ icon: Icon, text }) {
  return (
    <div className="grid place-items-center px-5 py-12 text-center text-sm text-slate-500">
      <Icon size={22} className="mb-2 text-slate-300" />
      {text}
    </div>
  );
}

export default function AgendaPanel({ today, upcoming, totalUpcoming, error, className }) {
  const [tab, setTab] = useState("hoje");
  const now = new Date();
  const items = today ? todayItems(today) : [];

  return (
    <DashPanel
      title="Agenda"
      subtitle={`${totalUpcoming} ${totalUpcoming === 1 ? "entrevista agendada" : "entrevistas agendadas"} daqui para frente`}
      icon={CalendarDays}
      className={className}
      bodyClassName="p-0"
      action={
        <Segmented
          label="Agenda"
          value={tab}
          onChange={setTab}
          options={[{ value: "hoje", label: `Hoje${today ? ` (${items.length})` : ""}` }, { value: "proximas", label: "Próximas" }]}
        />
      }
    >
      {error && <p className="border-b border-rose-100 bg-rose-50 px-5 py-2 text-xs text-rose-800">{error}</p>}

      {tab === "hoje" ? (
        items.length === 0 ? (
          <Empty icon={CalendarX2} text="Nada marcado para hoje." />
        ) : (
          <ol className="max-h-96 overflow-y-auto px-5 py-3">
            {items.map((item, index) => (
              <li key={item.key} className="relative flex gap-3 pb-4 last:pb-1">
                {index < items.length - 1 && <span aria-hidden="true" className="absolute left-[2.6rem] top-6 h-full w-px bg-slate-200" />}
                <span className="w-10 shrink-0 pt-0.5 text-right text-xs font-bold tabular-nums text-slate-600">
                  {item.allDay ? "Dia" : timeFormat.format(item.date)}
                </span>
                <span
                  aria-hidden="true"
                  className={`relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-white ${item.kind === "evento" ? "bg-sky-500" : "bg-violet-500"}`}
                />
                {item.kind === "evento" ? (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-marinho-900">{item.event.titulo}</p>
                    <p className="text-xs text-slate-500">Evento do calendário</p>
                  </div>
                ) : (
                  <InterviewLine interview={item.interview} now={now} />
                )}
              </li>
            ))}
          </ol>
        )
      ) : upcoming.length === 0 ? (
        <Empty icon={CalendarClock} text="Nenhuma entrevista agendada." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {upcoming.map((interview) => {
            const date = new Date(interview.data_hora_entrevista);
            return (
              <li key={interview.id} className="flex items-center gap-3 px-5 py-3">
                <span className="grid w-12 shrink-0 place-items-center rounded-lg bg-marinho-50 py-1 text-center leading-tight text-marinho-800">
                  <span className="text-[10px] font-bold uppercase">{dayFormat.format(date).split(",")[0].replace(".", "")}</span>
                  <span className="text-sm font-extrabold tabular-nums">{String(date.getDate()).padStart(2, "0")}</span>
                </span>
                <InterviewLine interview={interview} when={timeFormat.format(date)} now={now} />
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-slate-100 px-5 py-3 text-right">
        <PanelLink to="/calendario">Abrir calendário</PanelLink>
      </div>
    </DashPanel>
  );
}
