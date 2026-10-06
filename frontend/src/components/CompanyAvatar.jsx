import { getInitials } from "../text.js";

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
  sm: "size-8 rounded-md text-[11px]",
  md: "size-10 rounded-lg text-sm",
  lg: "size-14 rounded-xl text-lg",
};

export default function CompanyAvatar({ id, name, size = "md" }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center font-extrabold tracking-wide ${sizes[size]} ${colorFor(id ?? name)}`}
    >
      {getInitials(name)}
    </span>
  );
}
