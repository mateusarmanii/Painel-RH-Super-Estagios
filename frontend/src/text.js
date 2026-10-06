// Texto para comparação: sem acentos, minúsculo e sem espaços extras.
export function normalize(text) {
  return (text ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim().replace(/\s+/g, " ");
}

export function plural(total, singular, pluralForm) {
  return `${total} ${total === 1 ? singular : pluralForm}`;
}
