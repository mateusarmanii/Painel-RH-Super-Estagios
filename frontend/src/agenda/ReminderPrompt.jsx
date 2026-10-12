import { useState } from "react";
import toast from "react-hot-toast";
import { CalendarX2, RefreshCw } from "lucide-react";
import Modal from "../components/Modal.jsx";
import { buttonPrimary, buttonSecondary } from "../ui.js";
import { cancelReminder, getReminders, reminderConfig, resendReminder } from "./api.js";

// Depois de mudar a data/hora (ou cancelar a entrevista) de um compromisso com lembrete enviado, devolve o que
// oferecer: { mode: "reenviar" | "cancelar", target, emails, title } — ou null se não houver nada a fazer.
// title: "entrevista Empresa · Estudante" ou "evento “Título”" (entra no meio da frase).
export async function reminderFollowUp(target, title) {
  try {
    const config = await reminderConfig();
    if (!config.configurado) return null;
    const situation = await getReminders(target);
    if (situation.cancelavel) return { mode: "cancelar", target, emails: situation.ativos, title };
    if (situation.desatualizado) return { mode: "reenviar", target, emails: situation.ativos, title };
  } catch {
    // Sem a situação, o painel continua mostrando o aviso quando for aberto.
  }
  return null;
}

// Modal "Reenviar convite atualizado?" / "Enviar cancelamento?".
export default function ReminderPrompt({ prompt, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const resend = prompt.mode === "reenviar";
  const count = `${prompt.emails.length} ${prompt.emails.length === 1 ? "e-mail" : "e-mails"}`;

  async function confirm() {
    setBusy(true);
    try {
      await (resend ? resendReminder(prompt.target) : cancelReminder(prompt.target));
      toast.success(resend ? `Convite atualizado enviado para ${count}.` : `Cancelamento enviado para ${count}.`);
      onDone();
    } catch (error) {
      toast.error(error.message);
      setBusy(false);
    }
  }

  return (
    <Modal isOpen title={resend ? "Reenviar convite atualizado?" : "Enviar cancelamento?"} onClose={() => !busy && onClose()}>
      <div className="space-y-5">
        <p className="text-sm text-slate-700">
          {resend ? (
            <>
              O lembrete de <strong className="font-semibold text-marinho-900">{prompt.title}</strong> foi enviado para{" "}
              {prompt.emails.join(", ")}. Reenviar o convite com o novo horário? O compromisso é atualizado na agenda deles, sem duplicar.
            </>
          ) : (
            <>
              A <strong className="font-semibold text-marinho-900">{prompt.title}</strong> foi cancelada, mas o convite continua na agenda de{" "}
              {prompt.emails.join(", ")}. Enviar o cancelamento para tirar o compromisso da agenda deles?
            </>
          )}
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={buttonSecondary}>Agora não</button>
          <button type="button" onClick={confirm} disabled={busy} className={buttonPrimary}>
            {resend ? <RefreshCw size={15} /> : <CalendarX2 size={15} />}
            {busy ? "Enviando..." : resend ? "Reenviar convite atualizado" : "Enviar cancelamento"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
