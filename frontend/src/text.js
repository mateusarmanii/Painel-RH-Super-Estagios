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

export function plural(total, singular, pluralForm) {
  return `${total} ${total === 1 ? singular : pluralForm}`;
}
