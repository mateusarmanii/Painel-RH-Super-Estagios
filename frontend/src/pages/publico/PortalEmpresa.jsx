import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FileText, Link2Off, ThumbsDown, ThumbsUp, HelpCircle, Users } from "lucide-react";
import { API_URL, apiFetch, OFFLINE_MESSAGE } from "../../api.js";
import { kanbanStatusLabels, kanbanStatusStyles } from "../../kanbanStatus.js";
import { turnoEstudoLabels } from "../../estudante.js";
import PublicShell, { PublicLoading, PublicMessage, publicJson } from "./PublicShell.jsx";

const opinions = [
  { value: "APROVADO", label: "Aprovar", icon: ThumbsUp, active: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  { value: "TALVEZ", label: "Talvez", icon: HelpCircle, active: "border-amber-300 bg-amber-50 text-amber-800" },
  { value: "REPROVADO", label: "Não aprovar", icon: ThumbsDown, active: "border-rose-300 bg-rose-50 text-rose-800" },
];
const opinionLabels = { APROVADO: "Aprovado", TALVEZ: "Talvez", REPROVADO: "Não aprovado" };
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function CandidateCard({ candidate, token, onSaved }) {
  const [opinion, setOpinion] = useState(null);
  const [comment, setComment] = useState("");
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem("portalAvaliador") ?? "";
    } catch {
      return "";
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      try {
        localStorage.setItem("portalAvaliador", name.trim());
      } catch {
        // Sem armazenamento local: só não lembra o nome.
      }
      const saved = await publicJson(
        apiFetch(`/publico/portal/${encodeURIComponent(token)}/parecer`, {
          method: "POST",
          body: { aplicacao_id: candidate.id, parecer: opinion, comentario: comment.trim() || undefined, nome_avaliador: name.trim() || undefined },
        }),
        "Não foi possível enviar o parecer.",
      );
      onSaved(candidate.id, saved);
      setOpinion(null);
      setComment("");
    } catch (saveError) {
      setError(saveError instanceof TypeError ? OFFLINE_MESSAGE : saveError.message);
    } finally {
      setBusy(false);
    }
  }

  const details = [
    candidate.curso,
    candidate.instituicao_ensino,
    candidate.semestre_atual && `${candidate.semestre_atual}º semestre`,
    candidate.turno_estudo && `Estuda: ${turnoEstudoLabels[candidate.turno_estudo] ?? candidate.turno_estudo}`,
    candidate.cidade,
  ].filter(Boolean);

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-extrabold text-marinho-900">{candidate.nome_completo}</p>
          <p className="mt-0.5 text-sm text-slate-600">{details.join(" · ")}</p>
          {candidate.data_hora_entrevista && candidate.status_kanban === "ENTREVISTA_AGENDADA" && (
            <p className="mt-1 text-xs text-violet-700">Entrevista: {dateTime.format(new Date(candidate.data_hora_entrevista))}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${kanbanStatusStyles[candidate.status_kanban]}`}>
            {kanbanStatusLabels[candidate.status_kanban]}
          </span>
          {candidate.tem_curriculo && (
            <a
              href={`${API_URL}/publico/portal/${encodeURIComponent(token)}/curriculo/${candidate.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-marinho-800 hover:bg-marinho-50"
            >
              <FileText size={13} /> Currículo
            </a>
          )}
        </div>
      </div>

      {candidate.parecer && (
        <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Último parecer: <strong className="text-marinho-900">{opinionLabels[candidate.parecer.parecer]}</strong>
          {candidate.parecer.nome_avaliador && ` · ${candidate.parecer.nome_avaliador}`}
          {` · ${dateTime.format(new Date(candidate.parecer.created_at))}`}
          {candidate.parecer.comentario && <span className="mt-1 block text-slate-700">“{candidate.parecer.comentario}”</span>}
        </p>
      )}

      <form onSubmit={save} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
        <div role="group" aria-label="Parecer" className="flex flex-wrap gap-2">
          {opinions.map(({ value, label, icon: Icon, active }) => (
            <button
              key={value}
              type="button"
              aria-pressed={opinion === value}
              onClick={() => setOpinion(opinion === value ? null : value)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors ${
                opinion === value ? active : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
        {opinion && (
          <>
            <textarea
              rows={2}
              maxLength={1000}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Comentário (opcional)"
              aria-label="Comentário"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-marinho-600 focus:ring-2 focus:ring-ambar-400/40"
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={name}
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
                placeholder="Seu nome (opcional)"
                aria-label="Seu nome"
                className="h-10 flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-marinho-600"
              />
              <button type="submit" disabled={busy} className="h-10 rounded-md bg-ambar-400 px-5 text-sm font-bold text-marinho-900 hover:bg-ambar-500 disabled:opacity-50">
                {busy ? "Enviando..." : "Enviar parecer"}
              </button>
            </div>
          </>
        )}
        {error && <p className="text-sm text-rose-700">{error}</p>}
      </form>
    </li>
  );
}

// Portal da empresa: a empresa vê os candidatos enviados para a vaga e dá um parecer. O RH continua decidindo a etapa.
export default function PortalEmpresaPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    publicJson(apiFetch(`/publico/portal/${encodeURIComponent(token)}`), "Não foi possível abrir o portal.")
      .then(setData)
      .catch((loadError) => setError(loadError instanceof TypeError ? OFFLINE_MESSAGE : loadError.message));
  }, [token]);

  const onSaved = useCallback((id, parecer) => {
    setData((current) => ({ ...current, candidatos: current.candidatos.map((c) => (c.id === id ? { ...c, parecer } : c)) }));
  }, []);

  if (error) {
    return (
      <PublicShell title="Portal da empresa" wide>
        <PublicMessage icon={Link2Off} tone="red" title="Link indisponível">{error}</PublicMessage>
      </PublicShell>
    );
  }
  if (!data) return <PublicShell title="Portal da empresa" wide><PublicLoading /></PublicShell>;

  return (
    <PublicShell title={`${data.vaga.titulo} · candidatos`} wide>
      <div className="mb-6">
        <p className="text-sm font-semibold text-slate-500">{data.vaga.empresa} · Vaga Nº {data.vaga.codigo_vaga}</p>
        <h1 className="mt-1 text-2xl font-extrabold text-marinho-900">{data.vaga.titulo}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Estes são os candidatos que a Super Estágios enviou. Dê seu parecer em cada um; nossa equipe acompanha e combina os próximos passos com você.
        </p>
      </div>
      {data.candidatos.length === 0 ? (
        <PublicMessage icon={Users} title="Ainda não há candidatos enviados">Assim que enviarmos candidatos, eles aparecem aqui.</PublicMessage>
      ) : (
        <ul className="space-y-4">
          {data.candidatos.map((candidate) => (
            <CandidateCard key={candidate.id} candidate={candidate} token={token} onSaved={onSaved} />
          ))}
        </ul>
      )}
    </PublicShell>
  );
}
