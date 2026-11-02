import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CalendarClock, Check, Mail, MessageCircle, Phone, PhoneOff, StickyNote, Trash2, Users } from "lucide-react";
import { apiJson } from "../api.js";
import { inputBase } from "../ui.js";

export const contactTypes = {
  NOTA: { label: "Anotação", icon: StickyNote },
  LIGACAO: { label: "Ligação", icon: Phone },
  WHATSAPP: { label: "WhatsApp", icon: MessageCircle },
  EMAIL: { label: "E-mail", icon: Mail },
  REUNIAO: { label: "Reunião", icon: Users },
  SEM_RESPOSTA: { label: "Sem resposta", icon: PhoneOff },
};

const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
const todayKey = () => new Date().toISOString().slice(0, 10);

// Registro de contatos e anotações (opcional), com "próximo contato" que vira lembrete no sino.
// owner: { estudante_id } ou { empresa_id }.
export default function ContactLog({ owner, compact = false }) {
  const [items, setItems] = useState(null);
  const [type, setType] = useState("NOTA");
  const [text, setText] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const query = new URLSearchParams(owner).toString();

  const load = useCallback(() => {
    apiJson(`/contatos?${query}`, undefined, "Não foi possível carregar os contatos.").then(setItems).catch(() => setItems([]));
  }, [query]);
  useEffect(load, [load]);

  async function add(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const saved = await apiJson("/contatos", { method: "POST", body: { ...owner, tipo: type, texto: text.trim() || undefined, proximo_contato: next || undefined } }, "Não foi possível registrar.");
      setItems((list) => [saved, ...(list ?? [])]);
      setText("");
      setNext("");
      setType("NOTA");
      window.dispatchEvent(new Event("dashboard:refresh"));
    } catch (addError) {
      toast.error(addError.message);
    } finally {
      setBusy(false);
    }
  }

  async function done(item) {
    try {
      const saved = await apiJson(`/contatos/${item.id}`, { method: "PATCH", body: { proximo_contato: null } }, "Não foi possível atualizar.");
      setItems((list) => list.map((current) => (current.id === saved.id ? saved : current)));
      window.dispatchEvent(new Event("dashboard:refresh"));
    } catch (doneError) {
      toast.error(doneError.message);
    }
  }

  async function remove(item) {
    if (!window.confirm("Excluir este registro?")) return;
    try {
      await apiJson(`/contatos/${item.id}`, { method: "DELETE" }, "Não foi possível excluir.");
      setItems((list) => list.filter((current) => current.id !== item.id));
    } catch (removeError) {
      toast.error(removeError.message);
    }
  }

  return (
    <div>
      <form onSubmit={add} className="space-y-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipo de contato">
          {Object.entries(contactTypes).map(([value, { label, icon: Icon }]) => (
            <button
              key={value}
              type="button"
              aria-pressed={type === value}
              onClick={() => setType(value)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${type === value ? "border-marinho-300 bg-marinho-50 text-marinho-900" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
        <textarea rows={compact ? 2 : 3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="O que foi conversado? (opcional para ligação, WhatsApp, e-mail...)" aria-label="Texto do contato" className={`${inputBase} py-2`} />
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <CalendarClock size={14} /> Próximo contato (opcional)
            <input type="date" min={todayKey()} value={next} onChange={(e) => setNext(e.target.value)} className={`${inputBase} h-8 w-40`} />
          </label>
          <button type="submit" disabled={busy || (type === "NOTA" && !text.trim() && !next)} className="ml-auto h-8 rounded-md bg-ambar-400 px-3 text-xs font-bold text-marinho-900 hover:bg-ambar-500 disabled:opacity-50">
            {busy ? "Salvando..." : "Registrar"}
          </button>
        </div>
      </form>

      {items === null ? (
        <div className="mt-4 h-16 animate-pulse rounded bg-slate-100" />
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Nenhum contato registrado.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => {
            const { label, icon: Icon } = contactTypes[item.tipo];
            const pending = item.proximo_contato && item.proximo_contato.slice(0, 10) <= todayKey();
            return (
              <li key={item.id} className="group flex gap-3">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600"><Icon size={13} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{label}</span> · {dateTime.format(new Date(item.created_at))}{item.usuario ? ` · ${item.usuario.nome}` : " · pelo link"}
                  </p>
                  {item.texto && <p className="mt-0.5 whitespace-pre-line break-words text-sm text-slate-800">{item.texto}</p>}
                  {item.proximo_contato && (
                    <p className={`mt-1 inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold ${pending ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                      <CalendarClock size={12} /> Retornar em {dayFormat.format(new Date(item.proximo_contato))}
                      <button type="button" onClick={() => done(item)} title="Marcar retorno como feito" className="ml-1 inline-flex items-center gap-0.5 underline">
                        <Check size={12} /> feito
                      </button>
                    </p>
                  )}
                </div>
                <button type="button" onClick={() => remove(item)} title="Excluir registro" aria-label="Excluir registro" className="grid size-7 shrink-0 place-items-center rounded text-slate-300 opacity-0 hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100">
                  <Trash2 size={13} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
