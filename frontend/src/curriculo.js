// Currículo do estudante (guardado no banco). O download exige login: busca pelo apiFetch e abre/baixa no
// navegador a partir de um blob (não existe link público para o arquivo).
import toast from "react-hot-toast";
import { ApiError, apiFetch, apiJson } from "./api.js";

const TIPO_PDF = "application/pdf";
export const TAMANHO_MAXIMO_CURRICULO = 5 * 1024 * 1024;
export const ACCEPT_CURRICULO =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Confere antes de enviar (a API confere de novo, pelo conteúdo do arquivo).
export function curriculoFileError(file) {
  if (!/\.(pdf|docx?)$/i.test(file.name)) return "Formato não aceito: escolha PDF, DOC ou DOCX.";
  if (file.size > TAMANHO_MAXIMO_CURRICULO) return "O currículo deve ter no máximo 5 MB.";
  return "";
}

// "1,2 MB" / "350 KB"
export function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

export const curriculoKind = (curriculo) =>
  curriculo?.mime === TIPO_PDF ? "PDF" : curriculo?.mime === "application/msword" ? "DOC" : "DOCX";

// Envia ou remove o currículo. change: { file } (anexar/trocar) ou { remove: true }. Devolve { curriculo }.
export async function saveCurriculoChange(estudanteId, change) {
  if (change?.file) {
    const body = new FormData();
    body.append("curriculo", change.file);
    return apiJson(`/candidatos/${estudanteId}/curriculo`, { method: "POST", body }, "Não foi possível enviar o currículo.");
  }
  if (change?.remove) {
    return apiJson(`/candidatos/${estudanteId}/curriculo`, { method: "DELETE" }, "Não foi possível remover o currículo.");
  }
  return null;
}

// PDF abre numa aba nova; DOC/DOCX baixa com o nome original.
// A aba do PDF é aberta já no clique (depois do await o navegador bloquearia o pop-up); se der erro, ela fecha.
export async function openCurriculo(estudanteId, curriculo) {
  const isPdf = curriculo?.mime === TIPO_PDF;
  const tab = isPdf ? window.open("", "_blank") : null;
  try {
    const response = await apiFetch(`/candidatos/${estudanteId}/curriculo`);
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new ApiError(result.erro ?? "Não foi possível abrir o currículo.", response.status, result);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    if (tab) {
      tab.location.href = url;
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.download = curriculo?.nome_original ?? "curriculo";
      document.body.append(link);
      link.click();
      link.remove();
    }
    // Tempo para a aba ou o download lerem o arquivo antes de liberar a memória.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    tab?.close();
    throw error;
  }
}

// Para os botões e menus "Ver currículo": abre e mostra o erro num toast.
export function viewCurriculo(estudanteId, curriculo) {
  openCurriculo(estudanteId, curriculo).catch((error) => toast.error(error.message));
}
