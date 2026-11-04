import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Plus } from "lucide-react";
import Modal from "./Modal.jsx";
import { apiJson } from "../api.js";
import { buttonPrimary, buttonSecondary } from "../ui.js";
import { turnoEstudoLabels } from "../estudante.js";

const checkLabels = { disponibilidade: "Disponibilidade", turno_estudo: "Turno de estudo", cidade: "Cidade" };

// "Sugerir candidatos": estudantes compatíveis com a vaga (mesma regra das vagas compatíveis do perfil) que ainda
// não estão nela. "Adicionar" cria a candidatura em Candidato Contatado, como o "Indicar para vaga".
export function SuggestionsDialog({ vagaId, onClose, onAdded }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(() => new Set());
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    apiJson(`/vagas/${vagaId}/sugestoes`, undefined, "Não foi possível carregar as sugestões.").then(setData).catch((e) => setError(e.message));
  }, [vagaId]);

  async function add(student) {
    setBusy(student.id);
    try {
      await apiJson(`/candidatos/${student.id}/candidaturas`, { method: "POST", body: { vaga_id: vagaId } }, "Não foi possível adicionar.");
      setAdded((current) => new Set(current).add(student.id));
      toast.success(`${student.nome_completo} adicionado(a) em Candidato Contatado.`);
      window.dispatchEvent(new Event("dashboard:refresh"));
      onAdded();
    } catch (addError) {
      toast.error(addError.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal isOpen title="Sugerir candidatos" onClose={onClose}>
      {error ? (
        <p className="text-sm text-rose-700">{error}</p>
      ) : !data ? (
        <div className="h-40 animate-pulse rounded bg-slate-100" />
      ) : data.vagaFechada ? (
        <p className="text-sm text-slate-600">A vaga não está aberta: reabra para indicar candidatos.</p>
      ) : data.sugestoes.length === 0 ? (
        <p className="text-sm text-slate-600">Nenhum estudante compatível fora desta vaga. A regra é a mesma das “Vagas compatíveis” do perfil (área do curso, turno, disponibilidade e cidade).</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-600">{data.sugestoes.length} estudante(s) compatível(is), da área do curso primeiro.</p>
          <ul className="-mx-2 max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
            {data.sugestoes.map(({ estudante, tipo, motivo, checks }) => {
              const confirmed = Object.keys(checkLabels).filter((key) => checks[key] === true).map((key) => checkLabels[key]);
              return (
                <li key={estudante.id} className="flex items-start gap-3 px-2 py-3">
                  <div className="min-w-0 flex-1">
                    <Link to={`/estudantes/${estudante.id}`} onClick={onClose} className="text-sm font-bold text-marinho-900 hover:underline">{estudante.nome_completo}</Link>
                    <p className="text-xs text-slate-500">
                      {[estudante.curso, estudante.semestre_atual && `${estudante.semestre_atual}º sem.`, turnoEstudoLabels[estudante.turno_estudo], estudante.cidade].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-1">
                      <span title={motivo} className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${tipo === "curso" ? "bg-emerald-50 text-emerald-800" : "bg-sky-50 text-sky-800"}`}>
                        {tipo === "curso" ? "Curso" : "Curso correlato"}
                      </span>
                      {confirmed.map((label) => <span key={label} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{label} ✓</span>)}
                      {estudante.etiquetas?.map((tag) => <span key={tag} className="rounded-full bg-marinho-50 px-2 py-0.5 text-[11px] text-marinho-800">{tag}</span>)}
                    </p>
                  </div>
                  {added.has(estudante.id) ? (
                    <span className="shrink-0 text-xs font-semibold text-emerald-700">Adicionado</span>
                  ) : (
                    <button type="button" disabled={busy === estudante.id} onClick={() => add(estudante)} className={`${buttonSecondary} h-8 shrink-0 px-3 text-xs`}>
                      <Plus size={14} /> Adicionar
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Modal>
  );
}

