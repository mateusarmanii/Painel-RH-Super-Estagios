import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { formatPercent } from "./format.js";

// Barras horizontais com nome, quantidade e % (uma série: a cor não identifica nada, só a largura conta).
// Cada item pode ter onClick (aplica um filtro) ou to (abre outra tela).
export default function BarList({ items, ariaLabel, mutedKey }) {
  const max = Math.max(...items.map((item) => item.total), 1);
  const total = items.reduce((sum, item) => sum + item.total, 0);

  return (
    <ul className="space-y-1" aria-label={ariaLabel}>
      {items.map((item) => {
        const content = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-slate-700" title={item.label}>{item.label}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-bold text-slate-900">{item.total}</span>
                <span className="ml-1.5 inline-block w-9 text-right text-xs text-slate-500">{formatPercent(total ? item.total / total : 0)}</span>
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${item.key === mutedKey || item.muted ? "bg-slate-400" : "bg-marinho-600"}`}
                style={{ width: `${Math.max(2, (item.total / max) * 100)}%` }}
              />
            </div>
          </>
        );
        const interactive = "group block w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ambar-400";
        return (
          <li key={item.key}>
            {item.to ? (
              <Link to={item.to} className={interactive} title={item.hint}>
                {content}
              </Link>
            ) : item.onClick ? (
              <button type="button" onClick={item.onClick} className={interactive} title={item.hint}>
                {content}
              </button>
            ) : (
              <div className="px-2 py-2">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function PanelLink({ to, children }) {
  return (
    <Link to={to} className="inline-flex shrink-0 items-center gap-0.5 text-xs font-bold text-marinho-700 underline-offset-2 hover:underline">
      {children} <ChevronRight size={14} />
    </Link>
  );
}
