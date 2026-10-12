import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CalendarDays, CalendarPlus, Clock, ExternalLink, Pencil, StickyNote, Trash2, UserRound, X } from "lucide-react";
import Modal from "../components/Modal.jsx";
import { buttonDanger, buttonSecondary } from "../ui.js";
import { deleteEvent, reminderConfig } from "./api.js";
import { dayTitle } from "./dates.js";
import { durationLabel, eventBadge, eventTimeRange, googleCalendarEventLink } from "./events.js";
import ReminderSection from "./ReminderSection.jsx";

const actionButton =
  "inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const createdFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function Detail({ icon: Icon, children }) {
  return (
    <p className="flex items-start gap-2.5 text-sm text-slate-700">
      <Icon size={16} className="mt-0.5 shrink-0 text-slate-400" />
      <span className="min-w-0 whitespace-pre-line break-words">{children}</span>
    </p>
  );
}

// Painel lateral do evento: detalhes, quem criou, Editar, Excluir (com confirmação), Google Agenda e lembrete.
export default function EventPanel({ event, reminderVersion, onClose, onEdit, onDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [cancelInvite, setCancelInvite] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [situation, setSituation] = useState(null);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    reminderConfig().then((config) => setConfigured(config.configurado)).catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (keyEvent) => keyEvent.key === "Escape" && !confirming && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, confirming]);

  const onSituation = useCallback((result) => setSituation(result), []);
  const activeInvites = situation?.ativos ?? [];
  const offerCancel = configured && activeInvites.length > 0;

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await deleteEvent(event.id, offerCancel && cancelInvite);
      toast.success(offerCancel && cancelInvite
        ? `Evento excluído e cancelamento enviado para ${activeInvites.length} ${activeInvites.length === 1 ? "e-mail" : "e-mails"}.`
        : "Evento excluído.");
      window.dispatchEvent(new Event("dashboard:refresh"));
      onDeleted(event);
    } catch (error) {
      toast.error(error.message);
      setIsDeleting(false);
    }
  }

  const start = new Date(event.inicio);
  const version = `${event.inicio}|${event.duracao_minutos}|${event.dia_inteiro}|${reminderVersion}`;

  return (
    <>
      <button type="button" aria-label="Fechar detalhes" onClick={onClose} className="fixed inset-0 z-40 cursor-default bg-marinho-950/40" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="painel-evento-titulo"
        className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl sm:w-[26rem]"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="min-w-0">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${eventBadge}`}>
              <CalendarDays size={12} /> Evento
            </span>
            <h2 id="painel-evento-titulo" className="mt-2 break-words text-lg font-extrabold leading-snug text-marinho-900">
              {event.titulo}
            </h2>
            <p className="text-sm font-semibold tabular-nums text-slate-600">
              {dayTitle(start)} · {eventTimeRange(event)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-9 shrink-0 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-marinho-900"
          >
            <X size={19} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <section className="space-y-2.5">
            <Detail icon={Clock}>{event.dia_inteiro ? "Dia inteiro" : `Duração: ${durationLabel(event.duracao_minutos)}`}</Detail>
            {event.descricao && <Detail icon={StickyNote}>{event.descricao}</Detail>}
            <Detail icon={UserRound}>
              Criado por {event.criado_por?.nome ?? "usuário removido"} em {createdFormat.format(new Date(event.created_at))}
            </Detail>
          </section>

          <ReminderSection target={{ evento_id: event.id }} version={version} onSituation={onSituation} />
        </div>

        <footer className="shrink-0 space-y-2 border-t border-slate-200 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onEdit(event)} className={`${actionButton} border-slate-300 bg-white text-marinho-800 hover:bg-marinho-50`}>
              <Pencil size={16} /> Editar
            </button>
            <button type="button" onClick={() => setConfirming(true)} className={`${actionButton} border-rose-200 bg-white text-rose-700 hover:bg-rose-50`}>
              <Trash2 size={16} /> Excluir
            </button>
          </div>
          <a
            href={googleCalendarEventLink(event)}
            target="_blank"
            rel="noopener noreferrer"
            className={`${actionButton} border-slate-300 bg-white text-marinho-800 hover:bg-marinho-50`}
          >
            <CalendarPlus size={16} /> Adicionar ao Google Agenda <ExternalLink size={12} className="opacity-60" />
          </a>
        </footer>
      </aside>

      <Modal isOpen={confirming} title="Tem certeza?" onClose={() => !isDeleting && setConfirming(false)}>
        <div className="space-y-5">
          <p className="text-sm text-slate-700">
            Deseja excluir o evento <strong className="font-semibold text-marinho-900">{event.titulo}</strong>? Esta ação não pode ser desfeita.
          </p>
          {offerCancel && (
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={cancelInvite}
                onChange={(changeEvent) => setCancelInvite(changeEvent.target.checked)}
                className="mt-0.5 size-4 accent-marinho-700"
              />
              <span>
                Enviar o cancelamento para quem recebeu o convite ({activeInvites.join(", ")}), para o compromisso sair da agenda deles.
              </span>
            </label>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirming(false)} disabled={isDeleting} className={buttonSecondary}>
              Cancelar
            </button>
            <button type="button" onClick={handleDelete} disabled={isDeleting} className={buttonDanger}>
              {isDeleting ? "Excluindo..." : "Excluir"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
