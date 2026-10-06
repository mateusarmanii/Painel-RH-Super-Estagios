import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Mail, Phone } from "lucide-react";
import CandidaturaHistory from "./CandidaturaHistory.jsx";
import { API_URL as apiUrl } from "../api.js";

const horarioTexto = { MANHA: "estuda de manhã", TARDE: "estuda à tarde", NOITE: "estuda à noite" };

// Perfil resumido em modal (dados, contato, anotações e histórico).
// Provisório: a página completa /estudantes/:id chega na Frente 3.
export default function StudentQuickProfile({ studentId, onClose }) {
  const [student, setStudent] = useState(null);
  // Ref para não recarregar a cada render quando o pai passa uma função nova.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    let isCurrent = true;
    fetch(`${apiUrl}/candidatos`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar o perfil.");
        const found = (await response.json()).find((item) => item.id === studentId);
        if (!found) throw new Error("Estudante não encontrado.");
        if (isCurrent) setStudent(found);
      })
      .catch((loadError) => {
        toast.error(loadError instanceof TypeError ? "O servidor não respondeu. Verifique se a API está rodando." : loadError.message);
        onCloseRef.current();
      });
    return () => {
      isCurrent = false;
    };
  }, [studentId]);

  if (!student) return <p className="text-sm text-slate-500">A carregar perfil...</p>;

  return (
    <div>
      <p className="text-lg font-extrabold text-marinho-900">{student.nome_completo}</p>
      <p className="text-sm text-slate-600">
        {student.curso} · {student.instituicao_ensino} · {horarioTexto[student.horario_estudo]}
      </p>
      <div className="mt-3 space-y-1 text-sm text-slate-700">
        <p className="flex items-center gap-2"><Phone size={14} className="text-slate-400" /> {student.telefone}</p>
        {student.email && <p className="flex items-center gap-2 break-all"><Mail size={14} className="text-slate-400" /> {student.email}</p>}
      </div>
      {student.anotacoes_recrutador && (
        <div className="mt-4 rounded-md border-l-4 border-ambar-400 bg-ambar-50 px-3 py-2 text-sm text-slate-700">
          <p className="text-xs font-extrabold uppercase tracking-wide text-marinho-700">Anotações do recrutador</p>
          <p className="mt-1 whitespace-pre-line">{student.anotacoes_recrutador}</p>
        </div>
      )}
      <CandidaturaHistory aplicacoes={student.aplicacoes} />
    </div>
  );
}
