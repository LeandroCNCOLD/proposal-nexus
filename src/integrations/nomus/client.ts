// Server-only Nomus ERP HTTP client
// Do NOT import from client-side code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type NomusFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  /** Logical entity name for log/audit (e.g. "clientes", "produtos") */
  entity?: string;
  /** Operation label for log (e.g. "list", "get", "create", "push") */
  operation?: string;
  /** "pull" | "push" | "test" */
  direction?: "pull" | "push" | "test";
  triggeredBy?: string | null;
};

const DEBUG = String(process.env.NOMUS_DEBUG ?? "").toLowerCase() === "true";

function maskKey(key: string): string {
  if (!key) return "";
  const tail = key.slice(-4);
  return `******${tail}`;
}

/** Validate and normalize NOMUS_BASE_URL. Ensures it ends with /api. */
export function getNomusBaseUrl(): string {
  const raw = (process.env.NOMUS_BASE_URL ?? "").trim();
  if (!raw) {
    throw new Error("NOMUS_BASE_URL não configurada. Defina nas Lovable Cloud secrets.");
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      `NOMUS_BASE_URL inválida: "${raw}". Use o formato https://SEU_DOMINIO.nomus.com.br/api`
    );
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`NOMUS_BASE_URL com protocolo inválido: ${url.protocol}`);
  }
  // Normalize: strip trailing slashes
  let normalized = `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  // Auto-append /api if missing
  if (!/\/api(\/|$)/.test(normalized)) {
    normalized = `${normalized}/api`;
  }
  return normalized;
}

function getCreds() {
  const apiKeyRaw = process.env.NOMUS_API_KEY;
  if (!apiKeyRaw) {
    throw new Error("NOMUS_API_KEY não configurada nas Lovable Cloud secrets.");
  }
  const apiKey = apiKeyRaw.trim();
  if (!apiKey) {
    throw new Error("NOMUS_API_KEY está vazia após trim.");
  }
  return { baseUrl: getNomusBaseUrl(), apiKey };
}

function buildQuery(query?: Record<string, string | number | undefined>) {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

async function logCall(input: {
  entity: string;
  operation: string;
  direction: string;
  status: string;
  http_status?: number | null;
  duration_ms: number;
  request_path: string;
  payload?: unknown;
  response?: unknown;
  error?: string | null;
  triggered_by?: string | null;
}) {
  try {
    await supabaseAdmin.from("nomus_sync_log").insert({
      entity: input.entity,
      operation: input.operation,
      direction: input.direction,
      status: input.status,
      http_status: input.http_status ?? null,
      duration_ms: input.duration_ms,
      request_path: input.request_path,
      payload: input.payload ? (input.payload as never) : null,
      response: input.response ? (input.response as never) : null,
      error: input.error ?? null,
      triggered_by: input.triggered_by ?? null,
    });
  } catch (e) {
    console.error("[nomus] failed to write sync log", e);
  }
}

function classifyError(status: number, body: string): string {
  switch (status) {
    case 401:
      return "Falha de autenticação (401): chave API rejeitada pelo Nomus.";
    case 403:
      return "Acesso negado (403): chave válida mas sem permissão para este recurso.";
    case 404:
      return `Endpoint não encontrado (404). Verifique a URL base e o caminho.`;
    case 500:
    case 502:
    case 503:
      return `Erro do servidor Nomus (${status}): ${body.slice(0, 200)}`;
    default:
      return `Nomus ${status}: ${body.slice(0, 300)}`;
  }
}

export async function nomusFetch<T = unknown>(
  path: string,
  opts: NomusFetchOptions = {}
): Promise<{ ok: true; data: T; status: number } | { ok: false; error: string; status: number }> {
  let baseUrl: string;
  let apiKey: string;
  try {
    ({ baseUrl, apiKey } = getCreds());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, status: 0 };
  }

  const method = opts.method ?? "GET";
  const qs = buildQuery(opts.query);
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}${qs}`;
  const entity = opts.entity ?? "unknown";
  const operation = opts.operation ?? method.toLowerCase();
  const direction = opts.direction ?? (method === "GET" ? "pull" : "push");

  // Nomus uses raw API key in Authorization header (no Basic/Bearer prefix).
  const headers: Record<string, string> = {
    Authorization: apiKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (DEBUG) {
    console.log(`[nomus] ${method} ${url}`);
    console.log(`[nomus] auth: ${maskKey(apiKey)}`);
    if (opts.body) console.log("[nomus] payload:", JSON.stringify(opts.body));
  }

  const maxAttempts = 3;
  let attempt = 0;
  let lastErr: string | null = null;
  let lastStatus = 0;

  while (attempt < maxAttempts) {
    attempt += 1;
    const started = Date.now();
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
      const duration = Date.now() - started;
      lastStatus = res.status;

      if (DEBUG) {
        console.log(`[nomus] <- ${res.status} (${duration}ms) ${method} ${path}`);
      }

      if (res.status === 429) {
        const retryHeader = res.headers.get("tempoAteLiberar") || res.headers.get("retry-after");
        const wait = Math.min(Number(retryHeader) || 2 * attempt, 15) * 1000;
        await logCall({
          entity, operation, direction,
          status: "throttled",
          http_status: res.status,
          duration_ms: duration,
          request_path: `${method} ${path}${qs}`,
          error: `Throttled, retrying in ${wait}ms`,
          triggered_by: opts.triggeredBy ?? null,
        });
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }

      const text = await res.text();
      let parsed: unknown = null;
      try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }

      if (!res.ok) {
        lastErr = classifyError(res.status, typeof parsed === "string" ? parsed : JSON.stringify(parsed));
        await logCall({
          entity, operation, direction,
          status: "error",
          http_status: res.status,
          duration_ms: duration,
          request_path: `${method} ${path}${qs}`,
          payload: opts.body ?? null,
          response: parsed,
          error: lastErr,
          triggered_by: opts.triggeredBy ?? null,
        });
        if (DEBUG) console.error(`[nomus] error response:`, parsed);
        if (res.status >= 500 && attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
          continue;
        }
        return { ok: false, error: lastErr, status: res.status };
      }

      await logCall({
        entity, operation, direction,
        status: "success",
        http_status: res.status,
        duration_ms: duration,
        request_path: `${method} ${path}${qs}`,
        payload: opts.body ?? null,
        triggered_by: opts.triggeredBy ?? null,
      });
      return { ok: true, data: parsed as T, status: res.status };
    } catch (err) {
      const duration = Date.now() - started;
      lastErr = err instanceof Error ? err.message : String(err);
      const isTimeout = /timeout|timed out|aborted/i.test(lastErr);
      await logCall({
        entity, operation, direction,
        status: "error",
        duration_ms: duration,
        request_path: `${method} ${path}${qs}`,
        error: isTimeout ? `Timeout: ${lastErr}` : lastErr,
        triggered_by: opts.triggeredBy ?? null,
      });
      if (DEBUG) console.error(`[nomus] network error:`, lastErr);
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
        continue;
      }
    }
  }
  return { ok: false, error: lastErr ?? "Unknown error", status: lastStatus };
}

/** Iterate ?pagina=N until empty list, max 100 pages. */
export async function listAll<T = unknown>(
  endpoint: string,
  query: Record<string, string | number | undefined> = {},
  opts: { entity: string; triggeredBy?: string | null; pageSize?: number } = { entity: "unknown" }
): Promise<{ ok: true; items: T[] } | { ok: false; error: string }> {
  const items: T[] = [];
  for (let pagina = 1; pagina <= 100; pagina++) {
    const res = await nomusFetch<T[] | { items?: T[]; resultados?: T[] }>(endpoint, {
      method: "GET",
      query: { ...query, pagina },
      entity: opts.entity,
      operation: "list",
      direction: "pull",
      triggeredBy: opts.triggeredBy ?? null,
    });
    if (!res.ok) return { ok: false, error: res.error };
    const batch = Array.isArray(res.data)
      ? (res.data as T[])
      : ((res.data as { items?: T[]; resultados?: T[] })?.items
        ?? (res.data as { items?: T[]; resultados?: T[] })?.resultados
        ?? []);
    if (!batch || batch.length === 0) break;
    items.push(...batch);
    if (batch.length < (opts.pageSize ?? 50)) break;
  }
  return { ok: true, items };
}

/** Quick connectivity test against /clientes. */
export async function testNomusConnection(triggeredBy: string | null = null): Promise<{
  success: boolean;
  status: number;
  durationMs: number;
  endpoint: string;
  baseUrl?: string;
  error?: string;
}> {
  const started = Date.now();
  let baseUrl: string | undefined;
  try {
    baseUrl = getNomusBaseUrl();
  } catch (e) {
    return {
      success: false,
      status: 0,
      durationMs: Date.now() - started,
      endpoint: "/clientes",
      error: e instanceof Error ? e.message : String(e),
    };
  }
  const res = await nomusFetch("/clientes", {
    method: "GET",
    query: { pagina: 1 },
    entity: "test",
    operation: "ping",
    direction: "test",
    triggeredBy,
  });
  return {
    success: res.ok,
    status: res.status,
    durationMs: Date.now() - started,
    endpoint: "/clientes",
    baseUrl,
    error: res.ok ? undefined : res.error,
  };
}
