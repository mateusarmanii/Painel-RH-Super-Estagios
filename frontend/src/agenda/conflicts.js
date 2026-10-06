import { timeFormat } from "./dates.js";

const dayFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

// Texto do aviso de conflito devolvido pela API ao agendar/reagendar.
export function conflictWarning(name, conflicts) {
  const list = conflicts
    .map((conflict) => {
      const date = new Date(conflict.data_hora_entrevista);
      return `${dayFormat.format(date)} às ${timeFormat.format(date)} (${conflict.vaga} · ${conflict.empresa})`;
    })
    .join("; ");
  return `Conflito de horário: ${name} já tem entrevista em ${list}.`;
}
