import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { BellRing, CalendarX2, Mail, RefreshCw } from "lucide-react";
import { buttonPrimary, buttonSecondary } from "../ui.js";
import { cancelReminder, getReminders, reminderConfig, resendReminder, sendReminder } from "./api.js";

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-marinho-600 focus:ring-2 focus:ring-ambar-400/40";

export const alarmLabels = {
  10: "10 min antes",
  15: "15 min antes",
  30: "30 min antes",
  60: "1 hora antes",
  120: "2 horas antes",
  1440: "1 dia antes",
  2880: "2 dias antes",
  10080: "1 semana antes",
};

// Mesmo formato aceito pela API.
const emailPattern = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

export function parseEmails(text) {
  return [...new Set(text.split(/[\s,;]+/).map((item) => item.trim().toLowerCase()).filter(Boolean))];
}

const sentFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const pluralEmails = (total) => `${total} ${total === 1 ? "e-mail" : "e-mails"}`;

// Rótulo de cada envio: primeiro convite, convite atualizado (já tinha recebido antes) ou cancelamento.
function sentLabel(sent, history) {
  if (sent.tipo === "CANCELAMENTO") return "Cancelamento";
  const before = history.some((other) => other.email_destino === sent.email_destino && other.sequence < sent.sequence);
  return before ? "Convite atualizado" : "Convite";
}

// "Lembrete por e-mail" dos painéis de evento e de entrevista: histórico de envios, criar lembrete (convite .ics
// com alarmes), reenviar convite atualizado e enviar o cancelamento.
// target: { evento_id } ou { entrevista_id }. version muda quando o compromisso muda (recarrega a situação).
// blockedReason: texto que impede criar lembrete (ex.: entrevista cancelada). onSituation recebe a situação carregada.
export default function ReminderSection({ target, version, blockedReason, onSituation }) {
  const [config, setConfig] = useState(null);
  const [situation, setSituation] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [emailsText, setEmailsText] = useState("");
  const [alarms, setAlarms] = useState([]);
  const [busy, setBusy] = useState(null);
  const targetKey = new URLSearchParams(target).toString();

  useEffect(() => {
    reminderConfig()
      .then((result) => {
        setConfig(result);
        setAlarms(result.alarmes_padrao);
      })
      .catch(() => setConfig({ configurado: false }));
  }, []);

  const load = useCallback(async () => {
    try {
      const result = await getReminders(Object.fromEntries(new URLSearchParams(targetKey)));
      setSituation(result);
      setLoadError("");
      onSituation?.(result);
    } catch (error) {
      setLoadError(error.message);
    }
  }, [targetKey, onSituation]);

  useEffect(() => {
    load();
  }, [load, version]);

  const configured = Boolean(config?.configurado);
  const maxEmails = config?.max_emails_por_envio ?? 10;

  async function run(name, action, success) {
    setBusy(name);
    try {
      const result = await action();
      toast.success(success(result));
      setSituation(result);
      onSituation?.(result);
      return true;
    } catch (error) {
      toast.error(error.message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function submit(event) {
    event.preventDefault();
    const emails = parseEmails(emailsText);
    if (!emails.length) return toast.error("Digite ao menos um e-mail.");
    if (emails.length > maxEmails) return toast.error(`Envie para no máximo ${maxEmails} e-mails por vez.`);
    const invalid = emails.filter((email) => !emailPattern.test(email));
    if (invalid.length) return toast.error(`E-mail inválido: ${invalid.join(", ")}`);
    const ok = await run("enviar", () => sendReminder(target, emails, alarms), (result) => `Convite enviado para ${pluralEmails(result.enviados.length)}.`);
    if (ok) {
      setIsOpen(false);
      setEmailsText("");
    }
  }

  const toggleAlarm = (minutes) =>
    setAlarms((current) => (current.includes(minutes) ? current.filter((item) => item !== minutes) : [...current, minutes]));

  const history = situation?.envios ?? [];
  const disabledReason = !configured ? "Envio de e-mail não configurado" : blockedReason;

  return (
    <section className="space-y-3 rounded-md border border-slate-200 p-3" aria-label="Lembrete por e-mail">
      <p className="flex items-center gap-1.5 text-sm font-bold text-marinho-900">
        <BellRing size={15} className="text-marinho-600" /> Lembrete por e-mail
      </p>

      {loadError && <p className="text-xs text-rose-700">{loadError}</p>}

      {history.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-600">Lembrete enviado para:</p>
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {history.map((sent) => (
              <li key={sent.id} className="flex min-w-0 items-start gap-1.5 text-xs text-slate-700">
                {sent.tipo === "CANCELAMENTO"
                  ? <CalendarX2 size={13} className="mt-0.5 shrink-0 text-rose-500" />
                  : <Mail size={13} className="mt-0.5 shrink-0 text-slate-400" />}
                <span className="min-w-0">
                  <span className="break-all font-semibold">{sent.email_destino}</span>
                  <span className="text-slate-500">
                    {" · "}{sentLabel(sent, history)} em {sentFormat.format(new Date(sent.enviado_em))}
                    {sent.enviado_por && ` por ${sent.enviado_por.nome}`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {situation?.desatualizado && (
        <div className="space-y-2 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-950">
          <p>A data ou a hora mudou depois do envio. Quem recebeu ({situation.ativos.join(", ")}) ainda tem o horário antigo.</p>
          <button
            type="button"
            disabled={!configured || Boolean(busy)}
            title={configured ? "" : "Envio de e-mail não configurado"}
            onClick={() => run("reenviar", () => resendReminder(target), (result) => `Convite atualizado enviado para ${pluralEmails(result.enviados.length)}.`)}
            className={`${buttonSecondary} w-full`}
          >
            <RefreshCw size={15} /> {busy === "reenviar" ? "Enviando..." : "Reenviar convite atualizado"}
          </button>
        </div>
      )}

      {situation?.cancelavel && (
        <div className="space-y-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-950">
          <p>A entrevista foi cancelada, mas o convite continua na agenda de: {situation.ativos.join(", ")}.</p>
          <button
            type="button"
            disabled={!configured || Boolean(busy)}
            title={configured ? "" : "Envio de e-mail não configurado"}
            onClick={() => run("cancelar", () => cancelReminder(target), (result) => `Cancelamento enviado para ${pluralEmails(result.enviados.length)}.`)}
            className={`${buttonSecondary} w-full text-rose-700`}
          >
            <CalendarX2 size={15} /> {busy === "cancelar" ? "Enviando..." : "Enviar cancelamento do convite"}
          </button>
        </div>
      )}

      {isOpen ? (
        <form onSubmit={submit} className="space-y-3">
          <label htmlFor="lembrete-emails" className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">E-mails de quem deve receber</span>
            <textarea
              id="lembrete-emails"
              rows={2}
              autoFocus
              value={emailsText}
              onChange={(event) => setEmailsText(event.target.value)}
              placeholder="responsavel@empresa.com.br, outra@empresa.com.br"
              className={`${inputClass} resize-y`}
            />
            <span className="block text-xs text-slate-500">Separe por vírgula, espaço ou linha. No máximo {maxEmails} por envio.</span>
          </label>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-slate-700">Alarmes no celular</legend>
            <div className="flex flex-wrap gap-1.5">
              {(config?.alarmes_permitidos ?? []).slice().sort((a, b) => b - a).map((minutes) => (
                <label
                  key={minutes}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ambar-400/60 ${
                    alarms.includes(minutes) ? "border-marinho-700 bg-marinho-50 text-marinho-900" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <input type="checkbox" className="sr-only" checked={alarms.includes(minutes)} onChange={() => toggleAlarm(minutes)} />
                  {alarmLabels[minutes] ?? `${minutes} min antes`}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="text-xs text-slate-500">
            Vai um e-mail com convite de calendário: ao abrir, o compromisso entra na agenda do celular com esses alarmes.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsOpen(false)} className={buttonSecondary}>Cancelar</button>
            <button type="submit" disabled={busy === "enviar"} className={buttonPrimary}>
              {busy === "enviar" ? "Enviando..." : "Enviar convite"}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-1">
          <button
            type="button"
            disabled={Boolean(disabledReason) || !config || Boolean(busy)}
            title={disabledReason ?? ""}
            onClick={() => setIsOpen(true)}
            className={`${buttonSecondary} w-full`}
          >
            <BellRing size={15} /> Criar lembrete para responsável
          </button>
          {disabledReason && <p className="text-center text-xs text-slate-500">{disabledReason}</p>}
        </div>
      )}
    </section>
  );
}
