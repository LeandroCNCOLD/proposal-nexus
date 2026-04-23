/**
 * Engine de resolução de placeholders `{{namespace.chave}}`.
 *
 * Uso:
 *   const ctx = { cliente: { nome_fantasia: "ACME" }, ... }
 *   resolveString("Olá {{cliente.nome_fantasia}}", ctx) // "Olá ACME"
 */

export type PlaceholderContext = Record<string, Record<string, string | number | null | undefined>>;

const PLACEHOLDER_REGEX = /\{\{\s*([\w.]+)\s*\}\}/g;

function lookup(ctx: PlaceholderContext, path: string): string | null {
  const [namespace, ...rest] = path.split(".");
  if (!namespace || rest.length === 0) return null;
  const ns = ctx[namespace];
  if (!ns) return null;
  const key = rest.join(".");
  const value = ns[key];
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

/** Substitui todos os {{...}} em uma string. Mantém a tag se não houver valor. */
export function resolveString(input: string, ctx: PlaceholderContext): string {
  if (!input || typeof input !== "string") return input;
  return input.replace(PLACEHOLDER_REGEX, (match, path: string) => {
    const value = lookup(ctx, path);
    return value ?? match;
  });
}

/** Resolve placeholders em HTML — usa a mesma regex (atributos/href ficam intactos). */
export function resolveHtml(html: string, ctx: PlaceholderContext): string {
  return resolveString(html, ctx);
}

/** Verifica se uma string contém pelo menos um placeholder. */
export function hasPlaceholders(input: unknown): boolean {
  if (typeof input !== "string") return false;
  PLACEHOLDER_REGEX.lastIndex = 0;
  return PLACEHOLDER_REGEX.test(input);
}

/** Extrai todas as chaves de placeholders presentes em uma string. */
export function extractPlaceholderKeys(input: string): string[] {
  if (!input || typeof input !== "string") return [];
  const out = new Set<string>();
  let match: RegExpExecArray | null;
  PLACEHOLDER_REGEX.lastIndex = 0;
  while ((match = PLACEHOLDER_REGEX.exec(input)) !== null) {
    out.add(match[1]);
  }
  return Array.from(out);
}

/**
 * Resolve placeholders recursivamente em qualquer estrutura (string, array, objeto).
 * Valores não-string passam direto. Útil para `rows` de tabelas ou objetos JSON do documento.
 */
export function resolveDeep<T>(value: T, ctx: PlaceholderContext): T {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return resolveString(value, ctx) as unknown as T;
  if (Array.isArray(value)) {
    return value.map((v) => resolveDeep(v, ctx)) as unknown as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolveDeep(v, ctx);
    }
    return out as unknown as T;
  }
  return value;
}
