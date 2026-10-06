// Rótulos e formatações dos campos de estudante e de vaga (turnos, disponibilidade, datas).

export const turnoEstudoLabels = { MANHA: "Manhã", TARDE: "Tarde", NOITE: "Noite", INTEGRAL: "Integral", EAD: "EAD" };
export const periodoLabels = { MANHA: "Manhã", TARDE: "Tarde", NOITE: "Noite" };
export const turnoVagaLabels = { MANHA: "Manhã", TARDE: "Tarde", INTEGRAL: "Integral" };

const turnoFrase = {
  MANHA: "estuda de manhã",
  TARDE: "estuda à tarde",
  NOITE: "estuda à noite",
  INTEGRAL: "estuda em período integral",
  EAD: "estuda a distância (EAD)",
};

// Turno de estudo; cadastros antigos ainda podem ter só o horário de estudo.
export function studyShift(estudante) {
  return estudante?.turno_estudo ?? estudante?.horario_estudo ?? null;
}

export function studyShiftLabel(estudante) {
  return turnoEstudoLabels[studyShift(estudante)] ?? "";
}

export function studyShiftPhrase(estudante) {
  return turnoFrase[studyShift(estudante)] ?? "";
}

// ["MANHA", "NOITE"] → "Manhã e Noite"
export function availabilityText(disponibilidade) {
  const labels = (disponibilidade ?? []).map((periodo) => periodoLabels[periodo]).filter(Boolean);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} e ${labels.at(-1)}`;
}

// As datas sem hora vêm como "2027-06-01T00:00:00.000Z"; usa só a parte da data, sem fuso.
function dateParts(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return match ? match.slice(1).map(Number) : null;
}

const monthNames = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// "2027-06-01..." → "jun/2027"
export function formatMonthYear(iso) {
  const parts = dateParts(iso);
  return parts ? `${monthNames[parts[1] - 1]}/${parts[0]}` : "";
}

// "2004-03-15..." → "15/03/2004"
export function formatDate(iso) {
  const parts = dateParts(iso);
  return parts ? `${String(parts[2]).padStart(2, "0")}/${String(parts[1]).padStart(2, "0")}/${parts[0]}` : "";
}

export function ageFrom(iso, today = new Date()) {
  const parts = dateParts(iso);
  if (!parts) return null;
  const [year, month, day] = parts;
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1;
  return age;
}

// Valores para <input type="month"> e <input type="date">.
export function toMonthInput(iso) {
  return iso ? iso.slice(0, 7) : "";
}

export function toDateInput(iso) {
  return iso ? iso.slice(0, 10) : "";
}
