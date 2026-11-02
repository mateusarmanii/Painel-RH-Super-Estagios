import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Copy, ExternalLink, Link2Off, Plus, RefreshCw } from "lucide-react";
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

// "Link para a empresa": gera, copia, troca ou desativa o link do portal da vaga (opcional).
export function PortalLinkDialog({ vaga, onClose, onChanged }) {
  const [busy, setBusy] = useState(false);
  const link = vaga.portal_token ? `${window.location.origin}/portal/${vaga.portal_token}` : "";

  async function generate() {
    setBusy(true);
    try {
      const result = await apiJson(`/vagas/${vaga.id}/portal`, { method: "POST" }, "Não foi possível gerar o link.");
      onChanged(result.portal_token);
      toast.success(vaga.portal_token ? "Link trocado: o anterior não funciona mais." : "Link criado.");
    } catch (generateError) {
      toast.error(generateError.message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!window.confirm("Desativar o link? A empresa não vai mais conseguir abrir o portal.")) return;
    setBusy(true);
    try {
      await apiJson(`/vagas/${vaga.id}/portal`, { method: "DELETE" }, "Não foi possível desativar o link.");
      onChanged(null);
      toast.success("Link desativado.");
    } catch (revokeError) {
      toast.error(revokeError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal isOpen title="Link para a empresa" onClose={onClose}>
      <div className="space-y-4 text-sm text-slate-700">
        <p>
          A empresa abre o link (sem login) e vê os candidatos enviados para esta vaga (a partir de “Enviado à Empresa”, sem os dispensados), com curso,
          instituição, semestre e currículo, e dá um parecer: aprovar, talvez ou não aprovar. O parecer aparece no cartão; a etapa continua com você.
        </p>
        {link ? (
          <>
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{link}</span>
              <button type="button" onClick={() => navigator.clipboard?.writeText(link).then(() => toast.success("Link copiado."))} className={`${buttonSecondary} h-8 px-3 text-xs`}>
                <Copy size={14} /> Copiar
              </button>
              <a href={link} target="_blank" rel="noopener noreferrer" className={`${buttonSecondary} h-8 px-3 text-xs`}><ExternalLink size={14} /> Abrir</a>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" disabled={busy} onClick={revoke} className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50">
                <Link2Off size={15} /> Desativar link
              </button>
              <button type="button" disabled={busy} onClick={generate} className={buttonSecondary}><RefreshCw size={15} /> Trocar link</button>
            </div>
          </>
        ) : (
          <div className="flex justify-end">
            <button type="button" disabled={busy} onClick={generate} className={buttonPrimary}>{busy ? "Gerando..." : "Gerar link"}</button>
          </div>
        )}
      </div>
    </Modal>
  );
}
