// Formatação e regras de exibição do Dashboard (períodos, variações, rótulos da série).

export const PERIODS = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "mes", label: "Este mês" },
  { value: "ano", label: "Este ano" },
  { value: "12m", label: "12 meses" },
  { value: "personalizado", label: "Personalizado" },
];
export const DEFAULT_PERIOD = "30d";

// Cores das séries (paleta categórica validada, ordem fixa; a mesma série tem sempre a mesma cor).
export const SERIES = [
  { key: "candidaturas", label: "Candidaturas", color: "#2a78d6" },
  { key: "contratacoes", label: "Contratações", color: "#eb6834" },
  { key: "dispensas", label: "Dispensas", color: "#1baf7a" },
  { key: "vagas", label: "Vagas novas", color: "#eda100" },
];

const integer = new Intl.NumberFormat("pt-BR");
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" });
const monthYearLong = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

export const formatInteger = (value) => integer.format(value);
export const formatDecimal = (value) => decimal.format(value);
export const formatPercent = (value) => percent.format(value);

// "2026-10-05" → Date em UTC (as datas do período são dias de calendário, sem fuso).
const fromKey = (key) => new Date(`${key.length === 7 ? `${key}-01` : key}T00:00:00Z`);

export function formatRange(from, to) {
  if (from === to) return longDate.format(fromKey(from));
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${(sameYear ? shortDate : longDate).format(fromKey(from))} – ${longDate.format(fromKey(to))}`;
}

export const formatKeyDate = (key) => longDate.format(fromKey(key));

export function formatDays(value) {
  if (value === null || value === undefined) return null;
  if (value < 1) return "Menos de 1 dia";
  return `${decimal.format(value)} ${value === 1 ? "dia" : "dias"}`;
}

// Rótulo curto (eixo) e completo (tooltip) de um ponto da série.
export function seriesLabels(point, granularity) {
  const date = fromKey(point.inicio);
  if (granularity === "mes") return { short: monthYear.format(date).replace(" de ", "/").replace(".", ""), full: monthYearLong.format(date) };
  if (granularity === "semana") return { short: dayMonth.format(date), full: `Semana de ${longDate.format(date)}` };
  return { short: dayMonth.format(date), full: longDate.format(date) };
}

// Variação contra o período anterior. kind: "count" (diferença absoluta e %), "days" (diferença em dias),
// "points" (pontos percentuais). lowerIsBetter: tempo médio (cair é bom).
// Devolve null quando não há o que comparar.
export function compare(current, previous, { kind = "count", lowerIsBetter = false } = {}) {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  const diff = current - previous;
  const direction = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  const good = direction === "flat" ? null : (direction === "down") === lowerIsBetter;
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
  const abs = Math.abs(diff);
  let text;
  if (kind === "days") text = `${sign}${decimal.format(abs)} ${abs === 1 ? "dia" : "dias"}`;
  else if (kind === "points") text = `${sign}${decimal.format(abs)} p.p.`;
  else text = previous > 0 ? `${sign}${integer.format(abs)} (${sign}${percent.format(abs / previous)})` : `${sign}${integer.format(abs)}`;
  return { direction, good, text };
}

// Texto "há 2 min" para a última atualização.
export function timeAgo(date, now) {
  const seconds = Math.max(0, Math.round((now - date) / 1000));
  if (seconds < 45) return "agora mesmo";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `há ${hours} h`;
}
