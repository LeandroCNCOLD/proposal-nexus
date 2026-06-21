import type { NomusJson } from "@/modules/nomus/types";

/** Converte "139.103,505674" -> 139103.505674. Aceita number puro também. */
export function parseNomusNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value).trim();
  if (!raw) return null;
  const cleaned = raw.replace(/\s+por\s+\w+/i, "").trim();
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function pickStr(raw: NomusJson, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null && value !== "") return String(value);
  }
  return null;
}

export function pickNumBR(raw: NomusJson, ...keys: string[]): number | null {
  for (const key of keys) {
    const number = parseNomusNumber(raw[key]);
    if (number !== null) return number;
  }
  return null;
}

export function pickInt(raw: NomusJson, ...keys: string[]): number | null {
  const number = pickNumBR(raw, ...keys);
  return number === null ? null : Math.round(number);
}

export function pickDate(raw: NomusJson, ...keys: string[]): string | null {
  const value = pickStr(raw, ...keys);
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return value;
}

export function pickDateTime(raw: NomusJson, ...keys: string[]): string | null {
  const value = pickStr(raw, ...keys);
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  const isoLike = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  if (isoLike) return `${isoLike[1]}T${isoLike[2]}`;
  const brLike = value.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)/);
  if (brLike) return `${brLike[3]}-${brLike[2]}-${brLike[1]}T${brLike[4]}`;
  return null;
}

export function extractTotalTributacao(raw: NomusJson): NomusJson | null {
  const totalTributacao = raw.totalTributacao;
  if (Array.isArray(totalTributacao)) {
    const first = totalTributacao[0];
    return first && typeof first === "object" ? (first as NomusJson) : null;
  }
  return totalTributacao && typeof totalTributacao === "object"
    ? (totalTributacao as NomusJson)
    : null;
}
