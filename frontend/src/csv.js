// CSV para o Excel em português: separador ";", UTF-8 com BOM e quebras de linha CRLF.
const SEPARATOR = ";";
const BOM = "﻿";

function escapeCell(value) {
  if (value === null || value === undefined) return "";
  let text = String(value);

  // Evita que o Excel interprete o conteúdo como fórmula (ex.: "=SOMA(...)").
  // "+" e "-" seguidos de número (telefones, valores) ficam como estão.
  if (/^[=@\t\r]/.test(text) || /^[+-][^\d\s]/.test(text)) text = `'${text}`;

  if (/[;"\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows, columns) {
  const lines = [
    columns.map((column) => escapeCell(column.header)).join(SEPARATOR),
    ...rows.map((row) => columns.map((column) => escapeCell(column.value(row))).join(SEPARATOR)),
  ];
  return BOM + lines.join("\r\n");
}

export function downloadCsv(filename, content) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function todayForFilename() {
  const now = new Date();
  const pad = (number) => String(number).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const decimalFormat = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });

export const csvDate = (value) => (value ? dateFormat.format(new Date(value)) : "");
export const csvDecimal = (value) => (typeof value === "number" ? decimalFormat.format(value) : "");
