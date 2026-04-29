export type NomusJson = Record<string, unknown>;

export function parseNomusNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value).trim();
  if (!raw) return null;
  const withoutUnit = raw.replace(/\s+por\s+\w+/i, "").trim();
  const normalized = withoutUnit.includes(",")
    ? withoutUnit.replace(/\./g, "").replace(",", ".")
    : withoutUnit;
  const parsed = Number(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function pickStr(source: NomusJson, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (value !== null && value !== undefined && value !== "") return String(value).trim();
  }
  return null;
}

export function pickNum(source: NomusJson, ...keys: string[]): number | null {
  for (const key of keys) {
    const parsed = parseNomusNumber(source[key]);
    if (parsed !== null) return parsed;
  }
  return null;
}

export function pickDate(source: NomusJson, ...keys: string[]): string | null {
  const raw = pickStr(source, ...keys);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return raw;
}

export function normalizeCode(value: unknown): string | null {
  const code = value === null || value === undefined ? "" : String(value).trim();
  return code ? code.toUpperCase() : null;
}

export function normalizeCurrency(value: unknown): string {
  const currency =
    value === null || value === undefined || value === ""
      ? "BRL"
      : String(value).trim().toUpperCase();
  return currency || "BRL";
}

export function normalizeUnit(value: unknown): string | null {
  const unit = value === null || value === undefined ? "" : String(value).trim();
  return unit ? unit.toUpperCase() : null;
}
