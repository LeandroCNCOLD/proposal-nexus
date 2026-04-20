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

function getCreds() {
  const baseUrlRaw = process.env.NOMUS_BASE_URL;
  const apiKey = process.env.NOMUS_API_KEY;
  if (!baseUrlRaw || !apiKey) {
    throw new Error(
      "Nomus credentials missing. Set NOMUS_BASE_URL and NOMUS_API_KEY in Cloud secrets."
    );
  }
  // Normalize: strip trailing slash
  const baseUrl = baseUrlRaw.replace(/\/+$/, "");
  return { baseUrl, apiKey };
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

export async function nomusFetch<T = unknown>(
  path: string,
  opts: NomusFetchOptions = {}
): Promise<{ ok: true; data: T; status: number } | { ok: false; error: string; status: number }> {
  const { baseUrl, apiKey } = getCreds();
  const method = opts.method ?? "GET";
  const qs = buildQuery(opts.query);
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}${qs}`;
  const entity = opts.entity ?? "unknown";
  const operation = opts.operation ?? method.toLowerCase();
  const direction = opts.direction ?? (method === "GET" ? "pull" : "push");

  const headers: Record<string, string> = {
    Authorization: `Basic ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

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
        lastErr = typeof parsed === "string" ? parsed : JSON.stringify(parsed);
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
        if (res.status >= 500 && attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
          continue;
        }
        return { ok: false, error: `Nomus ${res.status}: ${lastErr}`, status: res.status };
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
      await logCall({
        entity, operation, direction,
        status: "error",
        duration_ms: duration,
        request_path: `${method} ${path}${qs}`,
        error: lastErr,
        triggered_by: opts.triggeredBy ?? null,
      });
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
