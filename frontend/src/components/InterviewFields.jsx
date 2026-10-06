import { MapPin, Video } from "lucide-react";
import { toLocalInput } from "../agenda/dates.js";
import { DEFAULT_DURATION } from "../interviewStatus.js";

const inputClass =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-marinho-600 focus:ring-2 focus:ring-ambar-400/40";

const durations = [30, 45, 60, 90, 120];

// Valores iniciais a partir de uma entrevista existente (ou vazios para agendar).
export function interviewFormValues(interview) {
  return {
    dataHora: interview?.data_hora_entrevista ? toLocalInput(interview.data_hora_entrevista) : "",
    formato: interview?.entrevista_formato ?? "",
    local: interview?.entrevista_local ?? "",
    duracao: String(interview?.entrevista_duracao ?? DEFAULT_DURATION),
    entrevistador: interview?.entrevistador ?? "",
  };
}

// Confere e monta o corpo para a API. Devolve { erro } ou { body }.
export function interviewPayload(values) {
  if (!values.dataHora) return { erro: "Informe a data e a hora da entrevista." };
  const date = new Date(values.dataHora);
  if (Number.isNaN(date.getTime()) || date <= new Date()) return { erro: "Escolha uma data e hora no futuro." };
  if (!values.formato) return { erro: "Escolha se a entrevista é presencial ou online." };
  return {
    body: {
      data_hora_entrevista: date.toISOString(),
      entrevista_formato: values.formato,
      entrevista_local: values.local.trim() || null,
      entrevista_duracao: Number(values.duracao),
      entrevistador: values.entrevistador.trim() || null,
    },
  };
}

// Data e hora, formato, local ou link, duração e entrevistador.
export default function InterviewFields({ idPrefix, values, onChange }) {
  const set = (name) => (event) => onChange({ ...values, [name]: event.target.value });
  const isOnline = values.formato === "ONLINE";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label htmlFor={`${idPrefix}-data`} className="block space-y-1.5 sm:col-span-2">
        <span className="text-sm font-medium text-slate-700">Data e hora</span>
        <input
          id={`${idPrefix}-data`}
          type="datetime-local"
          required
          min={toLocalInput(new Date())}
          value={values.dataHora}
          onChange={set("dataHora")}
          className={inputClass}
        />
      </label>

      <fieldset className="sm:col-span-2">
        <legend className="mb-1.5 text-sm font-medium text-slate-700">Formato</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "PRESENCIAL", label: "Presencial", icon: MapPin },
            { value: "ONLINE", label: "Online", icon: Video },
          ].map(({ value, label, icon: Icon }) => (
            <label
              key={value}
              className={`inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ambar-400/60 ${
                values.formato === value
                  ? "border-marinho-700 bg-marinho-50 text-marinho-900"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <input
                type="radio"
                name={`${idPrefix}-formato`}
                value={value}
                checked={values.formato === value}
                onChange={set("formato")}
                className="sr-only"
              />
              <Icon size={16} /> {label}
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor={`${idPrefix}-local`} className="block space-y-1.5 sm:col-span-2">
        <span className="text-sm font-medium text-slate-700">
          {isOnline ? "Link da reunião" : "Endereço"} <span className="font-normal text-slate-400">(opcional)</span>
        </span>
        <input
          id={`${idPrefix}-local`}
          type={isOnline ? "url" : "text"}
          maxLength={500}
          value={values.local}
          onChange={set("local")}
          placeholder={isOnline ? "https://meet.google.com/..." : "Rua, número, sala — cidade"}
          className={inputClass}
        />
      </label>

      <label htmlFor={`${idPrefix}-duracao`} className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-700">Duração</span>
        <select id={`${idPrefix}-duracao`} value={values.duracao} onChange={set("duracao")} className={inputClass}>
          {[...new Set([...durations, Number(values.duracao)])].sort((a, b) => a - b).map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} min
            </option>
          ))}
        </select>
      </label>

      <label htmlFor={`${idPrefix}-entrevistador`} className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-700">
          Entrevistador <span className="font-normal text-slate-400">(opcional)</span>
        </span>
        <input
          id={`${idPrefix}-entrevistador`}
          maxLength={120}
          value={values.entrevistador}
          onChange={set("entrevistador")}
          placeholder="Quem vai entrevistar"
          className={inputClass}
        />
      </label>
    </div>
  );
}
