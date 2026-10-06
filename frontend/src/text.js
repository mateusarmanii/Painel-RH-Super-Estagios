// Texto para comparação: sem acentos, minúsculo e sem espaços extras.
export function normalize(text) {
  return (text ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim().replace(/\s+/g, " ");
}

// Opções de curso para filtros: agrupa grafias ("Direito", "direito ") e usa a mais comum como nome.
export function courseOptions(courses) {
  const groups = new Map();
  for (const course of courses) {
    const label = (course ?? "").trim().replace(/\s+/g, " ");
    if (!label) continue;
    const group = groups.get(normalize(label)) ?? new Map();
    group.set(label, (group.get(label) ?? 0) + 1);
    groups.set(normalize(label), group);
  }
  return [...groups]
    .map(([key, spellings]) => ({
      key,
      label: [...spellings].sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b, "pt-BR"))[0][0],
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

// Link wa.me a partir de um telefone brasileiro em qualquer formato ("(31) 98888-7504" → 5531988887504).
// Devolve null se o número não tiver ao menos DDD + telefone.
export function whatsappLink(phone, message) {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (digits.length < 12) return null;
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

export function plural(total, singular, pluralForm) {
  return `${total} ${total === 1 ? singular : pluralForm}`;
}

// Iniciais para avatares; ignora etiquetas como "[TESTE]" ou "[DEMO]" no início do nome.
// Nome de uma palavra só usa as duas primeiras letras ("UniMED" → "UN").
export function getInitials(name) {
  const words = (name ?? "")
    .replace(/^\s*\[[^\]]*\]\s*/, "")
    .trim()
    .split(/\s+/)
    .filter((part) => /\p{L}/u.test(part));
  const letters = words.length === 1 ? [...words[0]].slice(0, 2) : words.slice(0, 2).map((part) => part[0]);
  return letters.join("").toUpperCase();
}

// Telefone brasileiro no padrão (31) 98888-8888 ou (31) 3222-3468. Formatos que não reconhece ficam como estão.
export function formatPhone(phone) {
  let digits = (phone ?? "").replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return (phone ?? "").trim();
}
