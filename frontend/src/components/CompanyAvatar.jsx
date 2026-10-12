import { useState } from "react";
import { getInitials } from "../text.js";
import { API_URL } from "../api.js";

// Cores fixas por empresa (a mesma empresa tem sempre a mesma cor em todas as telas). Sem vermelho, que é a cor de alerta.
const colors = [
  "bg-marinho-700 text-white",
  "bg-sky-700 text-white",
  "bg-emerald-700 text-white",
  "bg-violet-700 text-white",
  "bg-fuchsia-800 text-white",
  "bg-teal-700 text-white",
  "bg-orange-700 text-white",
  "bg-indigo-700 text-white",
];

function colorFor(key) {
  let hash = 0;
  for (const char of key ?? "") hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return colors[hash % colors.length];
}

const sizes = {
  xs: "size-6 rounded text-[9px]",
  sm: "size-8 rounded-md text-[11px]",
  md: "size-10 rounded-lg text-sm",
  lg: "size-14 rounded-xl text-lg",
};

// A logo fica no banco (logo_arquivo_id) e é pública: vai direto no <img>, sem login.
export function logoSrc(logoId) {
  return logoId ? `${API_URL}/arquivos/logo/${logoId}` : null;
}

// Logo da empresa ou, sem logo (ou se a imagem não carregar), as iniciais coloridas.
export default function CompanyAvatar({ id, name, logoId, size = "md" }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const src = logoSrc(logoId);

  if (src && failedSrc !== src) {
    return (
      <span
        aria-hidden="true"
        className={`grid shrink-0 place-items-center overflow-hidden bg-white ring-1 ring-slate-200 ${sizes[size]}`}
      >
        <img src={src} alt="" loading="lazy" onError={() => setFailedSrc(src)} className="size-full object-contain p-0.5" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center font-extrabold tracking-wide ${sizes[size]} ${colorFor(id ?? name)}`}
    >
      {getInitials(name)}
    </span>
  );
}
