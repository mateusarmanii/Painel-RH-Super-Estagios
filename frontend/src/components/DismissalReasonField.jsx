import { DISMISSAL_REASONS } from "../motivos.js";

const labelOf = (id) => DISMISSAL_REASONS.find((reason) => reason.id === id)?.label ?? "";

// Motivo da dispensa (Kanban e Calendário): texto livre, como sempre, mais sugestões OPCIONAIS.
// Clicar numa sugestão marca a categoria e, se o texto estiver vazio (ou for a sugestão anterior), preenche o texto;
// clicar de novo desmarca. Dá para ignorar as sugestões e só escrever.
// value: { text, category } · onChange(novoValor)
export default function DismissalReasonField({ id, value, onChange, label = "Motivo da dispensa", labelClassName, rows = 4, autoFocus, placeholder }) {
  function choose(reasonId) {
    const unselect = value.category === reasonId;
    const autoText = !value.text.trim() || value.text.trim() === labelOf(value.category);
    const category = unselect ? null : reasonId;
    onChange({ category, text: autoText ? (unselect ? "" : labelOf(reasonId)) : value.text });
  }

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block space-y-1.5">
        <span className={labelClassName ?? "text-sm font-medium text-slate-700"}>{label}</span>
        <textarea
          id={id}
          required
          rows={rows}
          maxLength={500}
          autoFocus={autoFocus}
          value={value.text}
          onChange={(event) => onChange({ ...value, text: event.target.value })}
          placeholder={placeholder ?? "Ex.: perfil não aderente à vaga, aceitou outra proposta..."}
          className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-marinho-600 focus:ring-2 focus:ring-ambar-400/40"
        />
      </label>
      <div>
        <p className="mb-1.5 text-xs text-slate-500">Sugestões (opcional): ajudam a agrupar os motivos no Dashboard.</p>
        <ul className="flex flex-wrap gap-1.5" aria-label="Sugestões de motivo">
          {DISMISSAL_REASONS.map((reason) => {
            const active = value.category === reason.id;
            return (
              <li key={reason.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => choose(reason.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ambar-400 ${
                    active ? "border-rose-300 bg-rose-50 text-rose-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {reason.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// Corpo enviado à API: a categoria só vai quando escolhida.
export function dismissalPayload(value) {
  return { motivo_recusa: value.text.trim(), ...(value.category && { motivo_categoria: value.category }) };
}
