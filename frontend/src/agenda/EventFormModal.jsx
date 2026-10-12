import { useState } from "react";
import toast from "react-hot-toast";
import Modal from "../components/Modal.jsx";
import { buttonPrimary, buttonSecondary } from "../ui.js";
import { saveEvent } from "./api.js";
import { durationLabel, EVENT_DESCRIPTION_MAX, EVENT_TITLE_MAX, eventDurations, eventFormValues, eventPayload } from "./events.js";

const inputClass =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-marinho-600 focus:ring-2 focus:ring-ambar-400/40 disabled:bg-slate-100 disabled:text-slate-400";

// Modal "Novo evento" / "Editar evento". event: evento a editar (ou null); date: data e hora sugeridas ao criar.
// onSaved(evento salvo, evento anterior).
export default function EventFormModal({ event, date, onClose, onSaved }) {
  const [values, setValues] = useState(() => eventFormValues(event, date));
  const [isSaving, setIsSaving] = useState(false);
  const set = (name) => (changeEvent) => setValues((current) => ({ ...current, [name]: changeEvent.target.value }));

  async function submit(submitEvent) {
    submitEvent.preventDefault();
    const payload = eventPayload(values);
    if (payload.erro) {
      toast.error(payload.erro);
      return;
    }
    setIsSaving(true);
    try {
      const saved = await saveEvent(event?.id, payload.body);
      toast.success(event ? "Evento atualizado." : "Evento criado.");
      window.dispatchEvent(new Event("dashboard:refresh"));
      onSaved(saved, event);
    } catch (error) {
      toast.error(error.message);
      setIsSaving(false);
    }
  }

  const durations = [...new Set([...eventDurations, Number(values.duracao)])].filter(Boolean).sort((a, b) => a - b);

  return (
    <Modal isOpen title={event ? "Editar evento" : "Novo evento"} onClose={onClose}>
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label htmlFor="evento-titulo" className="block space-y-1.5 sm:col-span-2">
          <span className="text-sm font-medium text-slate-700">Título</span>
          <input
            id="evento-titulo"
            required
            autoFocus
            maxLength={EVENT_TITLE_MAX}
            value={values.titulo}
            onChange={set("titulo")}
            placeholder="Ex.: Reunião com a empresa, visita, prazo de documentos"
            className={inputClass}
          />
        </label>

        <label htmlFor="evento-data" className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Data</span>
          <input id="evento-data" type="date" required value={values.data} onChange={set("data")} className={inputClass} />
        </label>

        <label htmlFor="evento-hora" className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Hora</span>
          <input
            id="evento-hora"
            type="time"
            step={300}
            required={!values.diaInteiro}
            disabled={values.diaInteiro}
            value={values.hora}
            onChange={set("hora")}
            className={inputClass}
          />
        </label>

        <label htmlFor="evento-duracao" className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Duração</span>
          <select id="evento-duracao" disabled={values.diaInteiro} value={values.duracao} onChange={set("duracao")} className={inputClass}>
            {durations.map((minutes) => (
              <option key={minutes} value={minutes}>{durationLabel(minutes)}</option>
            ))}
          </select>
        </label>

        <label className="flex h-10 cursor-pointer items-center gap-2 self-end text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={values.diaInteiro}
            onChange={(changeEvent) => setValues((current) => ({ ...current, diaInteiro: changeEvent.target.checked }))}
            className="size-4 accent-marinho-700"
          />
          Dia inteiro
        </label>

        <label htmlFor="evento-descricao" className="block space-y-1.5 sm:col-span-2">
          <span className="text-sm font-medium text-slate-700">
            Descrição <span className="font-normal text-slate-400">(opcional)</span>
          </span>
          <textarea
            id="evento-descricao"
            rows={3}
            maxLength={EVENT_DESCRIPTION_MAX}
            value={values.descricao}
            onChange={set("descricao")}
            placeholder="Detalhes, endereço, link da reunião..."
            className={`${inputClass} h-auto resize-y py-2`}
          />
        </label>

        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={onClose} className={buttonSecondary}>Cancelar</button>
          <button type="submit" disabled={isSaving} className={buttonPrimary}>
            {isSaving ? "Salvando..." : event ? "Salvar alterações" : "Criar evento"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
