import { useEffect, useRef, useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import CompanyAvatar from "./CompanyAvatar.jsx";
import { API_URL as apiUrl } from "../api.js";

export const TIPOS_DE_LOGO = ["image/png", "image/jpeg", "image/webp"];
export const TAMANHO_MAXIMO_LOGO = 2 * 1024 * 1024;

// Confere antes de enviar (a API confere de novo, pelo conteúdo do arquivo).
export function logoFileError(file) {
  if (!TIPOS_DE_LOGO.includes(file.type) || !/\.(png|jpe?g|webp)$/i.test(file.name)) {
    return "Formato não aceito: escolha PNG, JPG ou WEBP (SVG não é aceito).";
  }
  if (file.size > TAMANHO_MAXIMO_LOGO) return "A logo deve ter no máximo 2 MB.";
  return "";
}

// Envia ou remove a logo depois que a empresa foi salva. change: { file } ou { remove: true }.
export async function saveLogoChange(empresaId, change) {
  if (change?.file) {
    const body = new FormData();
    body.append("logo", change.file);
    const response = await fetch(`${apiUrl}/empresas/${empresaId}/logo`, { method: "POST", body });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.erro ?? "Não foi possível enviar a logo.");
  } else if (change?.remove) {
    const response = await fetch(`${apiUrl}/empresas/${empresaId}/logo`, { method: "DELETE" });
    if (!response.ok) throw new Error("Não foi possível remover a logo.");
  }
}

// Campo de logo do cadastro/edição de empresa: pré-visualização, escolher/trocar e remover.
export default function LogoField({ empresaId, name, currentLogoUrl, change, onChange }) {
  const inputRef = useRef(null);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!change?.file) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(change.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [change?.file]);

  const hasLogo = Boolean(change?.file || (currentLogoUrl && !change?.remove));

  function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const message = logoFileError(file);
    setError(message);
    if (!message) onChange({ file });
  }

  return (
    <div className="sm:col-span-2">
      <span className="text-sm font-medium text-slate-700">
        Logo <span className="font-normal text-slate-400">(opcional)</span>
      </span>
      <div className="mt-1.5 flex flex-wrap items-center gap-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3">
        {previewUrl ? (
          <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
            <img src={previewUrl} alt="Pré-visualização da logo" className="size-full object-contain p-0.5" />
          </span>
        ) : (
          <CompanyAvatar id={empresaId} name={name || "?"} logoUrl={change?.remove ? null : currentLogoUrl} size="lg" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500">
            {change?.file
              ? `Nova logo: ${change.file.name}`
              : hasLogo
                ? "Logo atual."
                : change?.remove
                  ? "A logo será removida ao salvar; a empresa volta a aparecer com as iniciais."
                  : "Sem logo, a empresa aparece com as iniciais."}
          </p>
          <p className="text-xs text-slate-400">PNG, JPG ou WEBP, até 2 MB.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-marinho-800 transition-colors hover:bg-marinho-50"
            >
              <ImageUp size={15} /> {hasLogo ? "Trocar logo" : "Escolher imagem"}
            </button>
            {hasLogo && (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  onChange(currentLogoUrl ? { remove: true } : null);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50"
              >
                <Trash2 size={15} /> Remover logo
              </button>
            )}
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
          onChange={handleFile}
          className="sr-only"
          tabIndex={-1}
          aria-label="Arquivo da logo"
        />
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-sm font-semibold text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
