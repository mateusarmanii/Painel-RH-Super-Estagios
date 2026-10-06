import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { API_URL as apiUrl } from "../api.js";
import { buttonPrimary, buttonSecondary, inputBase } from "../ui.js";

// Indica um estudante para uma vaga aberta em que ele ainda não está inscrito (POST /candidatos/:id/candidaturas).
export function IndicateForm({ talent, openJobs, onDone, onCancel }) {
  const appliedJobIds = new Set((talent.aplicacoes ?? []).map((application) => application.vaga_id));
  const availableJobs = openJobs.filter((job) => !appliedJobIds.has(job.id));
  const [jobId, setJobId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetch(`${apiUrl}/candidatos/${talent.id}/candidaturas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vaga_id: jobId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.erro ?? "Não foi possível indicar o candidato.");

      toast.success(`${talent.nome_completo} foi indicado para "${result.vaga?.titulo}".`);
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
        Indicar <strong className="font-semibold text-marinho-900">{talent.nome_completo}</strong> para uma vaga aberta.
        A candidatura começa em "Enviado à empresa".
      </p>

      {availableJobs.length === 0 ? (
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
            {availableJobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.codigo_vaga} - {job.titulo} ({job.empresa?.nome})
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className={buttonSecondary}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSaving || availableJobs.length === 0}
          className={buttonPrimary}
        >
          {isSaving ? "A guardar..." : "Indicar"}
        </button>
      </div>
    </form>
  );
}

// Versão que carrega sozinha o estudante e as vagas abertas (usada no Kanban).
export function IndicateDialog({ studentId, onDone, onCancel }) {
  const [data, setData] = useState(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    let isCurrent = true;
    Promise.all([fetch(`${apiUrl}/candidatos`), fetch(`${apiUrl}/vagas`)])
      .then(async ([studentsResponse, jobsResponse]) => {
        if (!studentsResponse.ok || !jobsResponse.ok) throw new Error("Não foi possível carregar as vagas abertas.");
        const [students, jobs] = await Promise.all([studentsResponse.json(), jobsResponse.json()]);
        const talent = students.find((student) => student.id === studentId);
        if (!talent) throw new Error("Estudante não encontrado.");
        if (isCurrent) setData({ talent, openJobs: jobs.filter((job) => job.status === "ABERTA") });
      })
      .catch((loadError) => {
        toast.error(loadError instanceof TypeError ? "O servidor não respondeu. Verifique se a API está rodando." : loadError.message);
        onCancelRef.current();
      });
    return () => {
      isCurrent = false;
    };
  }, [studentId]);

  if (!data) return <p className="text-sm text-slate-500">A carregar vagas abertas...</p>;
  return <IndicateForm talent={data.talent} openJobs={data.openJobs} onDone={onDone} onCancel={onCancel} />;
}
