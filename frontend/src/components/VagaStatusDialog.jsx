import { useState } from "react";
import toast from "react-hot-toast";
import { plural } from "../text.js";
import { buttonDanger, buttonPrimary, buttonSecondary, inputBase } from "../ui.js";
import { API_URL as apiUrl } from "../api.js";

export const MOTIVO_PADRAO_FECHAMENTO = "Vaga encerrada pela empresa";

// Muda o status da vaga na API. Devolve a vaga atualizada (com o total de dispensados, ao fechar).
export async function changeVagaStatus(vaga, status, motivo) {
  const response = await fetch(`${apiUrl}/vagas/${vaga.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, ...(motivo !== undefined && { motivo }) }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.erro ?? "Não foi possível mudar o status da vaga.");
  window.dispatchEvent(new Event("dashboard:refresh"));
  return result;
}

// Confirmação de "Fechar vaga" (com motivo opcional) e "Suspender vaga".
export default function VagaStatusDialog({ vaga, status, onDone, onCancel }) {
  const [motivo, setMotivo] = useState(MOTIVO_PADRAO_FECHAMENTO);
  const [isSaving, setIsSaving] = useState(false);
  const closing = status === "FECHADA";
  const inProcess = vaga.resumo?.em_processo ?? 0;
  const hired = vaga.resumo?.por_etapa?.APROVADO ?? 0;
  const interviews = vaga.resumo?.por_etapa?.ENTREVISTA_AGENDADA ?? 0;

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const result = await changeVagaStatus(vaga, status, closing ? motivo.trim() || MOTIVO_PADRAO_FECHAMENTO : undefined);
      toast.success(
        closing
          ? `Vaga fechada.${result.dispensados ? ` ${plural(result.dispensados, "candidato dispensado", "candidatos dispensados")}.` : ""}`
          : "Vaga suspensa. Reabra quando a empresa retomar o processo.",
      );
      onDone();
    } catch (error) {
      toast.error(error.message);
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-700">
        {closing ? "Fechar" : "Suspender"} a vaga <strong className="font-semibold text-marinho-900">{vaga.titulo}</strong>
        {vaga.empresa?.nome && <> ({vaga.empresa.nome})</>}?
      </p>
      {closing ? (
        <>
          <ul className="list-disc space-y-1 rounded-md bg-slate-50 py-3 pl-8 pr-3 text-sm text-slate-700">
            <li>
              {inProcess
                ? `${plural(inProcess, "candidato em andamento será dispensado", "candidatos em andamento serão dispensados")} com o motivo abaixo.`
                : "Não há candidatos em andamento."}
            </li>
            {interviews > 0 && <li>{plural(interviews, "entrevista em aberto será cancelada", "entrevistas em aberto serão canceladas")}.</li>}
            {hired > 0 && <li>{plural(hired, "contratado continua", "contratados continuam")} como está.</li>}
            <li>O histórico fica guardado e dá para reabrir a vaga depois.</li>
          </ul>
          <label htmlFor="fechar-vaga-motivo" className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">
              Motivo da dispensa <span className="font-normal text-slate-400">(opcional)</span>
            </span>
            <input
              id="fechar-vaga-motivo"
              maxLength={500}
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              className={`${inputBase} h-10`}
            />
          </label>
        </>
      ) : (
        <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          A vaga para de receber indicações.{" "}
          {inProcess
            ? `${plural(inProcess, "candidato em andamento continua", "candidatos em andamento continuam")} onde está, e o processo volta ao normal quando você reabrir.`
            : "Quando a empresa retomar, é só reabrir."}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} disabled={isSaving} className={buttonSecondary}>
          Cancelar
        </button>
        <button type="submit" disabled={isSaving} className={closing ? buttonDanger : buttonPrimary}>
          {isSaving ? "A guardar..." : closing ? "Fechar vaga" : "Suspender vaga"}
        </button>
      </div>
    </form>
  );
}
