export function normalizeString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().replace(/\s+/g, " ");
  return text ? text.toUpperCase() : null;
}

export function normalizeDocument(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/\D/g, "");
  return digits || null;
}

export function normalizePhone(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/\D/g, "");
  return digits || null;
}

export function normalizeEmail(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const email = String(value).trim().toLowerCase();
  return email || null;
}

export function normalizeModel(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const model = String(value)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9._/-]/g, "");
  return model || null;
}

export function normalizeProposalNumber(value: unknown): string | null {
  return normalizeString(value)?.replace(/\s+/g, "") ?? null;
}

export function stableNaturalKey(...parts: unknown[]): string | null {
  const normalized = parts.map((part) => normalizeString(part) ?? "").filter(Boolean);
  return normalized.length > 0 ? normalized.join("|") : null;
}
