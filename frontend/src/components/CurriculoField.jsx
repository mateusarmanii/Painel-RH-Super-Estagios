import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { FilePlus2, FileText, RefreshCw, Trash2 } from "lucide-react";
import Modal from "./Modal.jsx";
import { buttonDanger, buttonSecondary } from "../ui.js";
import {
  ACCEPT_CURRICULO,
  curriculoFileError,
  curriculoKind,
  formatFileSize,
  saveCurriculoChange,
  viewCurriculo,
} from "../curriculo.js";

const smallButton =
  "inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-marinho-800 transition-colors hover:bg-marinho-50 disabled:cursor-not-allowed disabled:opacity-50";
const removeButton =
  "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50";

// Ícone + nome + tipo/tamanho do arquivo.
function FileLine({ name, detail }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-marinho-50 text-marinho-700">
        <FileText size={20} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-marinho-900" title={name}>{name}</p>
        {detail && <p className="text-xs text-slate-500">{detail}</p>}
      </div>
    </div>
  );
}

// Escolhe o arquivo (escondido atrás de um botão) e confere tipo e tamanho antes de enviar.
function useFilePicker(onFile) {
  const inputRef = useRef(null);
  const [error, setError] = useState("");
  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT_CURRICULO}
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        const message = curriculoFileError(file);
        setError(message);
        if (!message) onFile(file);
      }}
      className="sr-only"
      tabIndex={-1}
      aria-label="Arquivo do currículo"
    />
  );
  return { open: () => inputRef.current?.click(), input, error, setError };
}

// Campo do cadastro/edição do estudante: anexar, trocar ou remover. A mudança é enviada depois de salvar os dados.
// change: { file } para anexar/trocar, { remove: true } para apagar.
export default function CurriculoField({ current, change, onChange }) {
  const picker = useFilePicker((file) => onChange({ file }));
  const hasFile = Boolean(change?.file || (current && !change?.remove));

  return (
    <div className="sm:col-span-2">
      <span className="text-sm font-medium text-slate-700">
        Currículo <span className="font-normal text-slate-400">(opcional)</span>
      </span>
      <div className="mt-1.5 flex flex-wrap items-center gap-3 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3">
        <div className="min-w-0 flex-1 basis-48">
          {change?.file ? (
            <FileLine name={change.file.name} detail={`Novo arquivo · ${formatFileSize(change.file.size)}`} />
          ) : current && !change?.remove ? (
            <FileLine name={current.nome_original} detail={`${curriculoKind(current)} · ${formatFileSize(current.tamanho_bytes)}`} />
          ) : (
            <p className="text-xs text-slate-500">
              {change?.remove ? "O currículo será removido ao salvar." : "Nenhum currículo anexado."}
            </p>
          )}
          <p className="mt-1 text-xs text-slate-400">PDF, DOC ou DOCX, até 5 MB.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={picker.open} className={smallButton}>
            {hasFile ? <RefreshCw size={15} /> : <FilePlus2 size={15} />} {hasFile ? "Trocar" : "Anexar currículo"}
          </button>
          {hasFile && (
            <button
              type="button"
              onClick={() => {
                picker.setError("");
                onChange(current ? { remove: true } : null);
              }}
              className={removeButton}
            >
              <Trash2 size={15} /> Remover
            </button>
          )}
        </div>
        {picker.input}
      </div>
      {picker.error && (
        <p role="alert" className="mt-1.5 text-sm font-semibold text-rose-700">
          {picker.error}
        </p>
      )}
    </div>
  );
}

// Perfil do estudante: ver, anexar, trocar e remover na hora (cada ação já salva).
export function CurriculoManager({ studentId, curriculo, onChanged }) {
  const [isSaving, setIsSaving] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const picker = useFilePicker((file) => save({ file }, curriculo ? "Currículo trocado." : "Currículo anexado."));

  async function save(change, successMessage) {
    setIsSaving(true);
    try {
      await saveCurriculoChange(studentId, change);
      toast.success(successMessage);
      setConfirmingRemove(false);
      window.dispatchEvent(new Event("dashboard:refresh"));
      onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {curriculo ? (
        <>
          <FileLine name={curriculo.nome_original} detail={`${curriculoKind(curriculo)} · ${formatFileSize(curriculo.tamanho_bytes)}`} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => viewCurriculo(studentId, curriculo)} className={smallButton}>
              <FileText size={15} /> Ver currículo
            </button>
            <button type="button" onClick={picker.open} disabled={isSaving} className={smallButton}>
              <RefreshCw size={15} /> {isSaving ? "Enviando..." : "Trocar"}
            </button>
            <button type="button" onClick={() => setConfirmingRemove(true)} disabled={isSaving} className={removeButton}>
              <Trash2 size={15} /> Remover
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-500">Nenhum currículo anexado.</p>
          <button type="button" onClick={picker.open} disabled={isSaving} className={smallButton}>
            <FilePlus2 size={15} /> {isSaving ? "Enviando..." : "Anexar currículo"}
          </button>
        </>
      )}
      <p className="text-xs text-slate-400">PDF, DOC ou DOCX, até 5 MB.</p>
      {picker.input}
      {picker.error && (
        <p role="alert" className="text-sm font-semibold text-rose-700">
          {picker.error}
        </p>
      )}

      <Modal isOpen={confirmingRemove} title="Tem certeza?" onClose={() => !isSaving && setConfirmingRemove(false)}>
        <div className="space-y-5">
          <p className="text-sm text-slate-700">
            Deseja remover o currículo <strong className="font-semibold text-marinho-900">{curriculo?.nome_original}</strong>? O arquivo
            será apagado e não pode ser recuperado.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmingRemove(false)} disabled={isSaving} className={buttonSecondary}>
              Cancelar
            </button>
            <button type="button" onClick={() => save({ remove: true }, "Currículo removido.")} disabled={isSaving} className={buttonDanger}>
              {isSaving ? "Removendo..." : "Remover"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
