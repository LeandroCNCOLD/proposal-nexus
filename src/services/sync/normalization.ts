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

export function normalizeCnColdModelCode(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim().toUpperCase();
  if (!raw) return null;
  const compact = raw.replace(/^CN[\s._/-]*0*(\d+)/, "CN$1").replace(/[^A-Z0-9]/g, "");
  return compact || null;
}

export function stableJsonStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJsonStringify(item)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJsonStringify(v)}`).join(",")}}`;
}

export async function hashNormalizedPayload(payload: unknown): Promise<string> {
  const text = stableJsonStringify(payload);
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function isValidCnpj(value: unknown): boolean {
  const cnpj = normalizeDocument(value);
  if (!cnpj || cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const calc = (base: string, factors: number[]) => {
    const sum = factors.reduce((acc, factor, index) => acc + Number(base[index]) * factor, 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d1 = calc(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj.endsWith(`${d1}${d2}`);
}

export function normalizeProposalNumber(value: unknown): string | null {
  return normalizeString(value)?.replace(/\s+/g, "") ?? null;
}

export function stableNaturalKey(...parts: unknown[]): string | null {
  const normalized = parts.map((part) => normalizeString(part) ?? "").filter(Boolean);
  return normalized.length > 0 ? normalized.join("|") : null;
}
