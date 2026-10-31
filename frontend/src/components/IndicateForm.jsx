import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { apiJson, OFFLINE_MESSAGE } from "../api.js";
import { buttonPrimary, buttonSecondary, inputBase } from "../ui.js";

const jobLabel = (job) => `${job.codigo_vaga} - ${job.titulo} (${job.empresa?.nome})`;

// Indica um estudante para uma vaga aberta em que ele ainda não está inscrito (POST /candidatos/:id/candidaturas).
// As vagas vêm de GET /candidatos/:id/vagas-compativeis (mesma regra das "Vagas compatíveis" do perfil):
// compatíveis primeiro e, abaixo, as outras vagas abertas com o motivo de não serem compatíveis.
export function IndicateForm({ studentId, onDone, onCancel }) {
  const [data, setData] = useState(null);
  const [jobId, setJobId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    let isCurrent = true;
    apiJson(`/candidatos/${studentId}/vagas-compativeis`, {}, "Não foi possível carregar as vagas abertas.")
      .then((result) => {
        if (isCurrent) setData(result);
      })
      .catch((loadError) => {
        toast.error(loadError instanceof TypeError ? OFFLINE_MESSAGE : loadError.message);
        onCancelRef.current();
      });
    return () => {
      isCurrent = false;
    };
  }, [studentId]);

  if (!data) return <p className="text-sm text-slate-500">Carregando vagas abertas...</p>;

  const { estudante, area_curso: courseArea, compativeis: compatible, outras: others } = data;
  const total = compatible.length + others.length;
  const selectedCompatible = compatible.find((item) => item.vaga.id === jobId);
  const selectedOther = others.find((item) => item.vaga.id === jobId);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const result = await apiJson(
        `/candidatos/${studentId}/candidaturas`,
        { method: "POST", body: { vaga_id: jobId } },
        "Não foi possível indicar o candidato.",
      );

      toast.success(`${estudante.nome_completo} foi indicado para "${result.vaga?.titulo}".`);
      window.dispatchEvent(new Event("dashboard:refresh"));
      onDone();
    } catch (saveError) {
      toast.error(saveError.message);
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-700">
        Indicar <strong className="font-semibold text-marinho-900">{estudante.nome_completo}</strong> para uma vaga aberta.
        A candidatura começa em "Candidato Contatado".
      </p>

      {total === 0 ? (
        <p className="rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-600">
          Não há vagas abertas em que este candidato ainda não esteja inscrito.
        </p>
      ) : (
        <label htmlFor="indicar-vaga" className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Vaga</span>
          <select
            id="indicar-vaga"
            required
            value={jobId}
            onChange={(event) => setJobId(event.target.value)}
            className={`h-10 ${inputBase}`}
          >
            <option value="">Selecione uma vaga aberta</option>
            {compatible.length > 0 && (
              <optgroup label={`Compatíveis com ${courseArea?.nome ?? "o curso"} (${compatible.length})`}>
                {compatible.map(({ vaga, tipo }) => (
                  <option key={vaga.id} value={vaga.id}>
                    {jobLabel(vaga)}
                    {tipo === "correlato" ? " · curso correlato" : ""}
                  </option>
                ))}
              </optgroup>
            )}
            {others.length > 0 && (
              <optgroup label={`Outras vagas abertas (${others.length})`}>
                {others.map(({ vaga, motivo }) => (
                  <option key={vaga.id} value={vaga.id}>
                    {jobLabel(vaga)} · {motivo.toLowerCase()}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {selectedCompatible && <span className="block text-xs text-emerald-800">{selectedCompatible.motivo}.</span>}
          {selectedOther && (
            <span className="block text-xs text-orange-800">
              Fora das vagas compatíveis: {selectedOther.motivo.toLowerCase()}. Confira antes de indicar.
            </span>
          )}
          {!courseArea && (
            <span className="block text-xs text-slate-500">
              A área do curso “{estudante.curso}” não foi identificada, por isso nenhuma vaga aparece como compatível.
            </span>
          )}
        </label>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} disabled={isSaving} className={buttonSecondary}>
          Cancelar
        </button>
        <button type="submit" disabled={isSaving || total === 0} className={buttonPrimary}>
          {isSaving ? "Salvando..." : "Indicar"}
        </button>
      </div>
    </form>
  );
}

// Nome usado no Kanban, em Estudantes e no perfil (o formulário já carrega as vagas sozinho).
export const IndicateDialog = IndicateForm;
