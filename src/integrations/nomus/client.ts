// Server-only Nomus ERP HTTP client
// Do NOT import from client-side code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  NOMUS_ENDPOINTS,
  NOMUS_HEALTHCHECK_ENTITY,
  NOMUS_PROBE_ENTITIES,
  type NomusEntity,
} from "./endpoints";

export { NOMUS_ENDPOINTS, type NomusEntity };

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

/** Validate and normalize NOMUS_BASE_URL. */
export function getNomusBaseUrl(): string {
  const raw = (process.env.NOMUS_BASE_URL ?? "").trim();
  if (!raw) {
    throw new Error("NOMUS_BASE_URL não configurada. Defina nas Lovable Cloud secrets.");
  }
  // Defensive: detect when an API key was pasted into the URL field.
  // Heuristics: no scheme, or looks like base64 / "user:pass" credential string.
  const looksLikeUrl = /^https?:\/\//i.test(raw);
  const looksLikeBase64 = /^[A-Za-z0-9+/=]{16,}$/.test(raw);
  const looksLikeCredential = !looksLikeUrl && /^[^\s/]+:[^\s/]+$/.test(raw);
  if (!looksLikeUrl || looksLikeBase64 || looksLikeCredential) {
    throw new Error(
      `NOMUS_BASE_URL parece ser uma chave de API, não uma URL ("${raw.slice(0, 24)}..."). ` +
      `Mova esse valor para NOMUS_API_KEY e configure NOMUS_BASE_URL com a URL REST do Nomus, ` +
      `ex.: https://SEU_DOMINIO.nomus.com.br/SEU_DOMINIO/rest`
    );
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      `NOMUS_BASE_URL inválida: "${raw}". Use o formato https://SEU_DOMINIO.nomus.com.br/SEU_DOMINIO/rest`
    );
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`NOMUS_BASE_URL com protocolo inválido: ${url.protocol}`);
  }
  // Normalize: strip trailing slashes. Respect whatever path the user provided
  // (Nomus REST often lives at /<empresa>/rest, not /api).
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
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

/** Timeout duro por request (ms). Evita travar sync em endpoints lentos. */
const REQUEST_TIMEOUT_MS = 25_000;

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

  // Nomus exige header `Authorization: Basic <chave-integracao-rest>`.
  // A chave já vem em base64 do ERP — só anexamos o prefixo "Basic " se ainda não estiver presente.
  const authValue = /^basic\s+/i.test(apiKey) ? apiKey : `Basic ${apiKey}`;
  const headers: Record<string, string> = {
    Authorization: authValue,
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
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: ac.signal,
      });
      clearTimeout(timer);
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
      clearTimeout(timer);
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

/**
 * Limites/parâmetros padrão de paginação. Mantemos um teto duro de páginas
 * para evitar loop infinito caso o Nomus devolva sempre o mesmo cursor.
 */
const LIST_MAX_PAGES = 200;
const LIST_MAX_ITEMS = 50_000;
const LIST_DEFAULT_PAGE_SIZE = 50;

/**
 * Extrai o array de itens de várias formas de envelope que o Nomus já
 * retornou em diferentes endpoints (array puro, { items }, { resultados },
 * { data }, { content }, { registros }).
 */
function extractBatch<T>(payload: unknown): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as T[];
  const env = payload as Record<string, unknown>;
  for (const k of ["items", "resultados", "data", "content", "registros", "lista"]) {
    const v = env[k];
    if (Array.isArray(v)) return v as T[];
  }
  return [];
}

/**
 * Pagina por `pagina=N` até o Nomus devolver lista vazia ou batch menor que
 * o `pageSize`. Faz de-duplicação por `id` para sobreviver a APIs que
 * eventualmente repetem registros entre páginas. Suporta `query` extra para
 * já abrir caminho para sync incremental (ex.: `dataModificacaoInicial`).
 */
export async function listAll<T = unknown>(
  endpoint: string,
  query: Record<string, string | number | undefined> = {},
  opts: {
    entity: string;
    triggeredBy?: string | null;
    pageSize?: number;
    /** Teto de itens p/ esta chamada (default LIST_MAX_ITEMS). */
    maxItems?: number;
  } = { entity: "unknown" }
): Promise<{ ok: true; items: T[] } | { ok: false; error: string }> {
  const items: T[] = [];
  const seen = new Set<string>();
  const pageSize = opts.pageSize ?? LIST_DEFAULT_PAGE_SIZE;
  const maxItems = opts.maxItems ?? LIST_MAX_ITEMS;

  for (let pagina = 1; pagina <= LIST_MAX_PAGES; pagina++) {
    const res = await nomusFetch<unknown>(endpoint, {
      method: "GET",
      // Nomus só documenta `pagina` e `query` como parâmetros de listagem.
      query: { ...query, pagina },
      entity: opts.entity,
      operation: "list",
      direction: "pull",
      triggeredBy: opts.triggeredBy ?? null,
    });
    if (!res.ok) return { ok: false, error: res.error };

    const batch = extractBatch<T>(res.data);
    if (batch.length === 0) break;

    let added = 0;
    for (const it of batch) {
      const idVal = (it as Record<string, unknown> | null)?.["id"]
        ?? (it as Record<string, unknown> | null)?.["codigo"];
      const key = idVal != null ? String(idVal) : `${pagina}:${added}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(it);
      added += 1;
      if (items.length >= maxItems) break;
    }

    if (items.length >= maxItems) {
      if (DEBUG) console.warn(`[nomus] listAll(${opts.entity}) hit maxItems=${maxItems}`);
      break;
    }
    // página menor que pageSize → última página
    if (batch.length < pageSize) break;
    // página inteira já vista (de-dup) → sem progresso, encerra
    if (added === 0) break;
  }
  return { ok: true, items };
}

export type NomusProbe = {
  entity: NomusEntity;
  endpoint: string;
  ok: boolean;
  status: number;
  durationMs: number;
  error?: string;
};

/**
 * Multi-recurso connectivity test. Bate em cada entidade de NOMUS_PROBE_ENTITIES
 * em sequência (sem query params, para isolar problemas de auth/URL/permissão).
 *
 * O contrato de retorno mantém os campos antigos (`success`, `status`, `endpoint`,
 * `durationMs`, `baseUrl`, `error`) referentes ao health-check primário, e
 * adiciona `probes[]` com o resultado por recurso.
 */
export async function testNomusConnection(triggeredBy: string | null = null): Promise<{
  success: boolean;
  status: number;
  durationMs: number;
  endpoint: string;
  baseUrl?: string;
  error?: string;
  probes: NomusProbe[];
}> {
  const overallStarted = Date.now();
  const primaryEndpoint = NOMUS_ENDPOINTS[NOMUS_HEALTHCHECK_ENTITY];

  let baseUrl: string | undefined;
  try {
    baseUrl = getNomusBaseUrl();
  } catch (e) {
    return {
      success: false,
      status: 0,
      durationMs: Date.now() - overallStarted,
      endpoint: primaryEndpoint,
      error: e instanceof Error ? e.message : String(e),
      probes: [],
    };
  }

  const probes: NomusProbe[] = [];
  for (const entity of NOMUS_PROBE_ENTITIES) {
    const endpoint = NOMUS_ENDPOINTS[entity];
    const started = Date.now();
    const res = await nomusFetch(endpoint, {
      method: "GET",
      // Sem query params: isola problemas de validação de parâmetros.
      entity: "test",
      operation: `ping:${entity}`,
      direction: "test",
      triggeredBy,
    });
    probes.push({
      entity,
      endpoint,
      ok: res.ok,
      status: res.status,
      durationMs: Date.now() - started,
      error: res.ok ? undefined : res.error,
    });
  }

  const primary = probes.find((p) => p.entity === NOMUS_HEALTHCHECK_ENTITY) ?? probes[0];
  const allOk = probes.length > 0 && probes.every((p) => p.ok);

  return {
    success: allOk,
    status: primary?.status ?? 0,
    durationMs: Date.now() - overallStarted,
    endpoint: primaryEndpoint,
    baseUrl,
    error: allOk
      ? undefined
      : probes
          .filter((p) => !p.ok)
          .map((p) => `${p.entity}: ${p.status} ${p.error ?? ""}`.trim())
          .join(" | ") || primary?.error,
    probes,
  };
}
