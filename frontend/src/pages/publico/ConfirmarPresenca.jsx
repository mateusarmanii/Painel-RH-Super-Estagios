import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarCheck2, CalendarClock, CalendarX2, CheckCircle2, MapPin, Video } from "lucide-react";
import { apiFetch, OFFLINE_MESSAGE } from "../../api.js";
import PublicShell, { PublicLoading, PublicMessage, publicJson } from "./PublicShell.jsx";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const timeFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const isLink = (text) => /^https?:\/\//i.test(text ?? "");

// Página que o candidato abre pelo link da mensagem: confirma presença ou pede para remarcar.
export default function ConfirmarPresencaPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState(null); // null | "remarcar"
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    publicJson(apiFetch(`/publico/entrevista/${encodeURIComponent(token)}`), "Não foi possível abrir a entrevista.")
      .then(setData)
      .catch((loadError) => setError(loadError instanceof TypeError ? OFFLINE_MESSAGE : loadError.message));
  }, [token]);

  async function answer(resposta) {
    setBusy(true);
    try {
      const result = await publicJson(
        apiFetch(`/publico/entrevista/${encodeURIComponent(token)}`, { method: "POST", body: { resposta, mensagem: message.trim() || undefined } }),
        "Não foi possível enviar a resposta.",
      );
      setData(result);
      setMode(null);
    } catch (answerError) {
      setError(answerError instanceof TypeError ? OFFLINE_MESSAGE : answerError.message);
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <PublicShell title="Entrevista">
        <PublicMessage icon={CalendarX2} tone="red" title="Não foi possível abrir esta entrevista">{error}</PublicMessage>
      </PublicShell>
    );
  }
  if (!data) return <PublicShell title="Entrevista"><PublicLoading /></PublicShell>;

  const date = new Date(data.data_hora);
  const confirmed = data.status === "CONFIRMADA";

  return (
    <PublicShell title="Confirmar entrevista">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Olá, {data.primeiro_nome}! Sua entrevista:</p>
        <h1 className="mt-1 text-xl font-extrabold text-marinho-900">{data.vaga}</h1>
        <p className="text-sm text-slate-600">{data.empresa}</p>

        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <CalendarClock size={18} className="mt-0.5 shrink-0 text-marinho-600" />
            <dd>
              <span className="inline-block font-bold text-marinho-900 first-letter:uppercase">{dateFormat.format(date)}</span>, às {timeFormat.format(date)}
              {data.duracao ? ` (cerca de ${data.duracao} min)` : ""}
            </dd>
          </div>
          {(data.formato || data.local) && (
            <div className="flex items-start gap-3">
              {data.formato === "ONLINE" ? <Video size={18} className="mt-0.5 shrink-0 text-marinho-600" /> : <MapPin size={18} className="mt-0.5 shrink-0 text-marinho-600" />}
              <dd className="min-w-0 break-words">
                {data.formato === "ONLINE" ? "Online" : "Presencial"}
                {data.local && (isLink(data.local)
                  ? <> · <a href={data.local} target="_blank" rel="noopener noreferrer" className="font-semibold text-marinho-700 underline">link da reunião</a></>
                  : ` · ${data.local}`)}
              </dd>
            </div>
          )}
        </dl>

        {confirmed && (
          <p className="mt-5 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            <CheckCircle2 size={18} /> Presença confirmada. Até lá!
          </p>
        )}
        {data.remarcacao_pedida && !confirmed && (
          <p className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Recebemos seu pedido para remarcar. Nossa equipe vai entrar em contato com uma nova data.
          </p>
        )}

        {data.aberta && mode !== "remarcar" && (
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            {!confirmed && (
              <button
                type="button"
                disabled={busy}
                onClick={() => answer("confirmar")}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <CalendarCheck2 size={17} /> Confirmo presença
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => setMode("remarcar")}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-marinho-800 hover:bg-marinho-50 disabled:opacity-50"
            >
              Preciso remarcar
            </button>
          </div>
        )}

        {mode === "remarcar" && (
          <form
            className="mt-6 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              answer("remarcar");
            }}
          >
            <label htmlFor="mensagem-remarcar" className="block text-sm font-semibold text-slate-700">
              Quer deixar um recado? (opcional)
              <textarea
                id="mensagem-remarcar"
                rows={3}
                maxLength={500}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Ex.: tenho prova nesse dia; posso na quinta à tarde."
                className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-marinho-600 focus:ring-2 focus:ring-ambar-400/40"
              />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setMode(null)} className="h-10 flex-1 rounded-md border border-slate-300 text-sm font-semibold text-marinho-800">Voltar</button>
              <button type="submit" disabled={busy} className="h-10 flex-1 rounded-md bg-ambar-400 text-sm font-bold text-marinho-900 hover:bg-ambar-500 disabled:opacity-50">
                Pedir para remarcar
              </button>
            </div>
          </form>
        )}

        {!data.aberta && !confirmed && !data.remarcacao_pedida && (
          <p className="mt-5 text-sm text-slate-500">Esta entrevista não aceita mais respostas por aqui. Fale com a Super Estágios.</p>
        )}
      </div>
    </PublicShell>
  );
}
