import { Inbox } from "lucide-react";
import { card } from "../ui.js";

// Estado vazio padrão: card branco com ícone, título e descrição opcional.
export default function EmptyState({ icon: Icon = Inbox, title, description, children }) {
  return (
    <div className={`${card} grid place-items-center px-6 py-14 text-center`}>
      <span className="grid size-12 place-items-center rounded-full bg-marinho-50 text-marinho-700">
        <Icon size={22} />
      </span>
      <p className="mt-4 text-base font-extrabold text-marinho-900">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-slate-600">{description}</p>}
      {children}
    </div>
  );
}
