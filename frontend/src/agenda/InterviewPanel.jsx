import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  CalendarCheck2,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Clock,
  ExternalLink,
  KanbanSquare,
  MapPin,
  MessageCircle,
  Phone,
  StickyNote,
  UserRound,
  UserRoundX,
  UserX,
  Video,
  X,
} from "lucide-react";
import CompanyAvatar from "../components/CompanyAvatar.jsx";
import InterviewFields, { interviewFormValues, interviewPayload } from "../components/InterviewFields.jsx";
import { kanbanStatusLabels } from "../kanbanStatus.js";
import { interviewFormatLabels, interviewStatusBadge, interviewStatusLabels } from "../interviewStatus.js";
import { formatPhone, getInitials, whatsappLink } from "../text.js";
import { buttonPrimary, buttonSecondary } from "../ui.js";
import { runInterviewAction } from "./api.js";
import { conflictWarning } from "./conflicts.js";
import { confirmationMessage, dayTitle, googleCalendarLink, interviewTimeRange, isLink, timeFormat } from "./dates.js";

const actionButton =
  "inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

function Detail({ icon: Icon, children }) {
  return (
    <p className="flex items-start gap-2.5 text-sm text-slate-700">
      <Icon size={16} className="mt-0.5 shrink-0 text-slate-400" />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}

// Painel lateral da entrevista: detalhes e ações (celular: ocupa a tela).
export default function InterviewPanel({ interview, conflicts, onClose, onUpdated, onOpenProfile }) {
  const [mode, setMode] = useState(null); // null | "reagendar" | "dispensar"
  const [form, setForm] = useState(() => interviewFormValues(interview));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const status = interview.status_exibido;
  const isOpen = interview.status_kanban === "ENTREVISTA_AGENDADA" && status !== "CANCELADA";
  const started = new Date(interview.data_hora_entrevista) <= new Date();
  const whatsapp = whatsappLink(interview.estudante.telefone, confirmationMessage(interview));
  const FormatIcon = interview.entrevista_formato === "ONLINE" ? Video : MapPin;

  async function act(name, body, success) {
    setBusy(name);
    try {
      const result = await runInterviewAction(interview.id, body);
      toast.success(success(result));
      if (result.conflitos?.length) toast(conflictWarning(interview.estudante.nome_completo, result.conflitos), { icon: "⚠️", duration: 8000 });
      window.dispatchEvent(new Event("dashboard:refresh"));
      setMode(null);
      onUpdated(result);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(null);
    }
  }

  function reschedule(event) {
    event.preventDefault();
    const payload = interviewPayload(form);
    if (payload.erro) {
      toast.error(payload.erro);
      return;
    }
    act("reagendar", { acao: "reagendar", ...payload.body }, (result) => {
      const date = new Date(result.data_hora_entrevista);
      return `Entrevista reagendada para ${dayTitle(date).toLowerCase()}, às ${timeFormat.format(date)}.`;
    });
  }

  function dismiss(event) {
    event.preventDefault();
    if (!reason.trim()) {
      toast.error("Informe o motivo da dispensa.");
      return;
    }
    act("dispensar", { acao: "dispensar", motivo_recusa: reason.trim() }, () => `${interview.estudante.nome_completo} foi dispensado.`);
  }

  return (
    <>
      <button type="button" aria-label="Fechar detalhes" onClick={onClose} className="fixed inset-0 z-40 cursor-default bg-marinho-950/40" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="painel-entrevista-titulo"
        className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl sm:w-[26rem]"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="min-w-0">
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${interviewStatusBadge[status]}`}>
              {interviewStatusLabels[status]}
            </span>
            <h2 id="painel-entrevista-titulo" className="mt-2 text-lg font-extrabold leading-snug text-marinho-900">
              {dayTitle(new Date(interview.data_hora_entrevista))}
            </h2>
            <p className="text-sm font-semibold tabular-nums text-slate-600">
              {interviewTimeRange(interview)} · {interview.entrevista_duracao ?? 45} min
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
          {conflicts.length > 0 && (
            <div role="alert" className="flex gap-2.5 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
              <AlertTriangle size={17} className="mt-0.5 shrink-0 text-rose-600" />
              <div>
                <p className="font-bold">Conflito de horário</p>
                {conflicts.map((other) => (
                  <p key={other.id}>
                    Também tem entrevista às {timeFormat.format(new Date(other.data_hora_entrevista))} — {other.vaga.titulo} ({other.vaga.empresa.nome}).
                  </p>
                ))}
              </div>
            </div>
          )}

          <section className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-marinho-100 text-sm font-extrabold text-marinho-800">
              {getInitials(interview.estudante.nome_completo)}
            </span>
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => onOpenProfile(interview.estudante.id)}
                className="block max-w-full truncate text-left font-bold text-marinho-900 underline-offset-2 hover:underline"
              >
                {interview.estudante.nome_completo}
              </button>
              <p className="truncate text-sm text-slate-500">{interview.estudante.curso}</p>
              <p className="flex items-center gap-1.5 text-sm text-slate-600">
                <Phone size={13} className="text-slate-400" /> {formatPhone(interview.estudante.telefone)}
              </p>
            </div>
          </section>

          <section className="flex items-center gap-3 rounded-md bg-slate-50 p-3">
            <CompanyAvatar id={interview.vaga.empresa.id} name={interview.vaga.empresa.nome} logoUrl={interview.vaga.empresa.logo_url} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-800">{interview.vaga.empresa.nome}</p>
              <p className="truncate text-sm text-slate-600">
                {interview.vaga.titulo} · Nº {interview.vaga.codigo_vaga}
              </p>
            </div>
            <Link
              to={`/kanban/${interview.vaga.id}`}
              title="Abrir Kanban da vaga"
              aria-label="Abrir Kanban da vaga"
              className="grid size-9 shrink-0 place-items-center rounded-md text-marinho-700 transition-colors hover:bg-white"
            >
              <KanbanSquare size={18} />
            </Link>
          </section>

          <section className="space-y-2.5">
            <Detail icon={FormatIcon}>
              {interview.entrevista_formato ? interviewFormatLabels[interview.entrevista_formato] : "Formato não informado"}
              {interview.entrevista_local && (
                <>
                  {" · "}
                  {isLink(interview.entrevista_local) ? (
                    <a href={interview.entrevista_local} target="_blank" rel="noopener noreferrer" className="font-semibold text-marinho-700 underline">
                      {interview.entrevista_local}
                    </a>
                  ) : (
                    interview.entrevista_local
                  )}
                </>
              )}
            </Detail>
            <Detail icon={UserRound}>{interview.entrevistador ? `Entrevistador: ${interview.entrevistador}` : "Entrevistador não informado"}</Detail>
            <Detail icon={Clock}>Etapa no Kanban: {kanbanStatusLabels[interview.status_kanban]}</Detail>
            {interview.observacao && <Detail icon={StickyNote}>{interview.observacao}</Detail>}
            {interview.motivo_recusa && <Detail icon={UserX}>Motivo da dispensa: {interview.motivo_recusa}</Detail>}
          </section>

          {mode === "reagendar" && (
            <form onSubmit={reschedule} className="space-y-4 rounded-md border border-slate-200 p-4">
              <p className="text-sm font-bold text-marinho-900">Reagendar</p>
              <InterviewFields idPrefix="painel-reagendar" values={form} onChange={setForm} />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setMode(null)} className={buttonSecondary}>Cancelar</button>
                <button type="submit" disabled={busy === "reagendar"} className={buttonPrimary}>
                  {busy === "reagendar" ? "A guardar..." : "Salvar nova data"}
                </button>
              </div>
            </form>
          )}

          {mode === "dispensar" && (
            <form onSubmit={dismiss} className="space-y-3 rounded-md border border-rose-200 bg-rose-50/40 p-4">
              <label htmlFor="painel-motivo" className="block space-y-1.5">
                <span className="text-sm font-bold text-rose-900">Motivo da dispensa</span>
                <textarea
                  id="painel-motivo"
                  rows={3}
                  maxLength={500}
                  autoFocus
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Ex.: não compareceu, aceitou outra proposta..."
                  className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-marinho-600 focus:ring-2 focus:ring-ambar-400/40"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setMode(null)} className={buttonSecondary}>Cancelar</button>
                <button
                  type="submit"
                  disabled={busy === "dispensar"}
                  className="inline-flex h-10 items-center rounded-md bg-rose-600 px-4 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {busy === "dispensar" ? "A guardar..." : "Dispensar"}
                </button>
              </div>
            </form>
          )}
        </div>

        <footer className="shrink-0 space-y-2 border-t border-slate-200 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          {isOpen ? (
            <>
              {whatsapp ? (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${status === "AGUARDANDO" ? buttonPrimary : buttonSecondary} w-full`}
                >
                  <MessageCircle size={16} /> Pedir confirmação pelo WhatsApp
                </a>
              ) : (
                <p className="text-xs text-slate-500">Telefone sem DDD: não dá para abrir o WhatsApp.</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={status === "CONFIRMADA" || status === "NAO_COMPARECEU" || Boolean(busy)}
                  onClick={() => act("confirmar", { acao: "confirmar" }, () => "Entrevista confirmada.")}
                  className={`${actionButton} border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`}
                >
                  <CalendarCheck2 size={16} /> {status === "CONFIRMADA" ? "Confirmada" : "Confirmar"}
                </button>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => setMode(mode === "reagendar" ? null : "reagendar")}
                  className={`${actionButton} border-slate-300 bg-white text-marinho-800 hover:bg-marinho-50`}
                >
                  <CalendarClock size={16} /> Reagendar
                </button>
                <button
                  type="button"
                  disabled={!started || Boolean(busy)}
                  title={started ? "Move o candidato para Em análise" : "Disponível depois do horário da entrevista"}
                  onClick={() => act("realizada", { acao: "realizada" }, () => `Entrevista realizada: ${interview.estudante.nome_completo} foi para Em análise.`)}
                  className={`${actionButton} border-marinho-200 bg-marinho-50 text-marinho-800 hover:bg-marinho-100`}
                >
                  <CheckCircle2 size={16} /> Realizada
                </button>
                <button
                  type="button"
                  disabled={!started || status === "NAO_COMPARECEU" || Boolean(busy)}
                  title={started ? "" : "Disponível depois do horário da entrevista"}
                  onClick={() => act("nao_compareceu", { acao: "nao_compareceu" }, () => "Marcado: não compareceu.")}
                  className={`${actionButton} border-rose-200 bg-white text-rose-700 hover:bg-rose-50`}
                >
                  <UserRoundX size={16} /> Não compareceu
                </button>
              </div>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => setMode(mode === "dispensar" ? null : "dispensar")}
                className={`${actionButton} border-transparent text-rose-700 hover:bg-rose-50`}
              >
                <UserX size={16} /> Dispensar candidato
              </button>
            </>
          ) : (
            <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Entrevista encerrada ({interviewStatusLabels[status].toLowerCase()}). O candidato está em “{kanbanStatusLabels[interview.status_kanban]}”.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <a href={googleCalendarLink(interview)} target="_blank" rel="noopener noreferrer" className={`${actionButton} border-slate-300 bg-white text-marinho-800 hover:bg-marinho-50`}>
              <CalendarPlus size={16} /> Google Agenda <ExternalLink size={12} className="opacity-60" />
            </a>
            <button
              type="button"
              onClick={() => onOpenProfile(interview.estudante.id)}
              className={`${actionButton} border-slate-300 bg-white text-marinho-800 hover:bg-marinho-50`}
            >
              <UserRound size={16} /> Ver perfil
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}
