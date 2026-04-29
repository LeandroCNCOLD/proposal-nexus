import { createFileRoute } from "@tanstack/react-router";
import { getNomusBaseUrl } from "@/integrations/nomus/client";
import { NOMUS_ENDPOINTS } from "@/integrations/nomus/endpoints";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Rota de diagnóstico TEMPORÁRIA.
 *
 * Sonda `GET /tabelasPreco/{id}` no Nomus para descobrir se o ambiente expõe
 * `precoCusto`, `precoVenda`, `margem`, `markup` e similares por produto na
 * tabela. Sem isso não dá pra decidir se vale persistir custo/margem por item
 * de tabela e usar no cálculo de lucro do item da proposta.
 *
 * Uso:
 *   GET /api/public/nomus/tabela-preco-probe              → lista /tabelasPreco e sonda os 3 primeiros
 *   GET /api/public/nomus/tabela-preco-probe?id=1         → sonda 1 ID específico
 *   GET /api/public/nomus/tabela-preco-probe?id=1,2,3     → sonda lista de IDs
 *
 * Apaga essa rota depois que a Etapa 2 estiver decidida.
 */

const COST_KEY_HINTS = [
  "custo",
  "preco",
  "valor",
  "margem",
  "markup",
  "desconto",
  "compra",
  "ultimo",
  "ultima",
  "medio",
  "venda",
  "tabela",
];

function describeValue(v: unknown): unknown {
  if (v === null) return null;
  if (Array.isArray(v)) {
    return {
      __type: "array",
      length: v.length,
      sampleKeys:
        v[0] && typeof v[0] === "object" && !Array.isArray(v[0])
          ? Object.keys(v[0] as object).slice(0, 30)
          : null,
    };
  }
  if (typeof v === "object") {
    return { __type: "object", keys: Object.keys(v as object).slice(0, 30) };
  }
  if (typeof v === "string" && v.length > 120) return v.slice(0, 120) + "…";
  return v;
}

function pickCandidates(
  obj: Record<string, unknown>,
): Array<{ key: string; value: unknown }> {
  const out: Array<{ key: string; value: unknown }> = [];
  for (const k of Object.keys(obj)) {
    const lower = k.toLowerCase();
    if (COST_KEY_HINTS.some((h) => lower.includes(h))) {
      out.push({ key: k, value: describeValue(obj[k]) });
    }
  }
  return out;
}

type ProbeSummary = {
  topLevelKeys: string[];
  sample: Record<string, unknown>;
  costCandidates: Array<{ key: string; value: unknown }>;
  itemsArrayKey: string | null;
  itemSampleKeys: string[] | null;
  itemCostCandidates: Array<{ key: string; value: unknown }> | null;
};

function summarize(payload: unknown): ProbeSummary {
  const empty: ProbeSummary = {
    topLevelKeys: [],
    sample: {},
    costCandidates: [],
    itemsArrayKey: null,
    itemSampleKeys: null,
    itemCostCandidates: null,
  };
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return empty;

  const obj = payload as Record<string, unknown>;
  const topLevelKeys = Object.keys(obj);
  const sample: Record<string, unknown> = {};
  for (const k of topLevelKeys) sample[k] = describeValue(obj[k]);

  // Tenta achar o array de produtos/itens dentro da tabela.
  let itemsArrayKey: string | null = null;
  let itemSampleKeys: string[] | null = null;
  let itemCostCandidates: Array<{ key: string; value: unknown }> | null = null;
  for (const k of topLevelKeys) {
    const v = obj[k];
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] !== null) {
      itemsArrayKey = k;
      const first = v[0] as Record<string, unknown>;
      itemSampleKeys = Object.keys(first);
      itemCostCandidates = pickCandidates(first);
      break;
    }
  }

  return {
    topLevelKeys,
    sample,
    costCandidates: pickCandidates(obj),
    itemsArrayKey,
    itemSampleKeys,
    itemCostCandidates,
  };
}

type RawProbeResult = {
  baseUrlPresent: boolean;
  usernameReceived: string | null;
  passwordPresent: boolean;
  authorizationHeaderPresent: boolean;
  base64Length: number;
  calledUrl: string | null;
  httpStatus: number | null;
  durationMs: number;
  rawBody: string | null;
  parsedBody: unknown;
  errorComplete: unknown;
};

async function fetchNomusRaw(path: string): Promise<RawProbeResult> {
  const started = Date.now();
  const baseUrlRaw = (process.env.NOMUS_REST_BASE_URL ?? process.env.NOMUS_BASE_URL ?? "").trim();
  const username = (process.env.NOMUS_REST_USERNAME ?? process.env.NOMUS_USERNAME ?? "").trim();
  const password = process.env.NOMUS_REST_PASSWORD ?? process.env.NOMUS_PASSWORD ?? "";
  let calledUrl: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    const baseUrl = getNomusBaseUrl();
    calledUrl = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

    if (!username) {
      throw new Error("NOMUS_REST_USERNAME não configurado nas Lovable Cloud secrets.");
    }
    if (!password) {
      throw new Error("NOMUS_REST_PASSWORD não configurado nas Lovable Cloud secrets.");
    }
    const authToken = Buffer.from(`${username}:${password}`, "utf-8").toString("base64");
    const authorizationHeader = `Basic ${authToken}`;

    const controller = new AbortController();
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("Timeout ao chamar Nomus após 12000ms"));
      }, 12_000);
    });
    const response = await Promise.race([
      fetch(calledUrl, {
        method: "GET",
        headers: {
          Authorization: authorizationHeader,
          Accept: "application/json",
        },
        signal: controller.signal,
      }),
      timeout,
    ]);
    if (timer) clearTimeout(timer);

    const rawBody = await response.text();
    let parsedBody: unknown = null;
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      parsedBody = rawBody;
    }

    return {
      baseUrlPresent: Boolean(baseUrlRaw),
      usernameReceived: username || null,
      passwordPresent: Boolean(password),
      authorizationHeaderPresent: Boolean(authorizationHeader),
      base64Length: authToken.length,
      calledUrl,
      httpStatus: response.status,
      durationMs: Date.now() - started,
      rawBody,
      parsedBody,
      errorComplete: response.ok
        ? null
        : {
            name: "NomusHttpError",
            message:
              response.status === 406 && /integracao\.naoAutenticada/i.test(rawBody)
                ? "Credencial REST inválida ou sem permissão no Nomus."
                : `Nomus respondeu HTTP ${response.status}`,
            status: response.status,
            body: rawBody,
          },
    };
  } catch (error) {
    if (timer) clearTimeout(timer);
    const e = error instanceof Error ? error : new Error(String(error));
    return {
      baseUrlPresent: Boolean(baseUrlRaw),
      usernameReceived: username || null,
      passwordPresent: Boolean(password),
      authorizationHeaderPresent: false,
      base64Length: username && password ? Buffer.from(`${username}:${password}`, "utf-8").toString("base64").length : 0,
      calledUrl,
      httpStatus: null,
      durationMs: Date.now() - started,
      rawBody: null,
      parsedBody: null,
      errorComplete: {
        name: e.name,
        message: e.message,
        stack: e.stack,
      },
    };
  }
}

function extractTables(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  for (const key of ["content", "data", "items", "tabelasPreco"]) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
  }
  return [];
}

export const Route = createFileRoute("/api/public/nomus/tabela-preco-probe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const idsParam = url.searchParams.get("id");

        let ids: string[] = [];
        let listInfo: unknown = null;
        const listProbe = await fetchNomusRaw(NOMUS_ENDPOINTS.tabelas_preco);
        const tables = extractTables(listProbe.parsedBody);

        if (idsParam) {
          ids = idsParam
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        } else {
          listInfo = {
            count: tables.length,
            firstKeys:
              tables[0] && typeof tables[0] === "object" && !Array.isArray(tables[0])
                ? Object.keys(tables[0] as object).slice(0, 30)
                : null,
          };
          // Extrai ids dos primeiros 3 (campos comuns: id, idTabelaPreco, codigo)
          for (const item of tables.slice(0, 3)) {
            if (item && typeof item === "object") {
              const obj = item as Record<string, unknown>;
              const id =
                obj.id ?? obj.idTabelaPreco ?? obj.codigo ?? obj.codTabelaPreco;
              if (id !== undefined && id !== null) ids.push(String(id));
            }
          }
        }

        const results: Array<{
          id: string;
          ok: boolean;
          calledUrl: string | null;
          httpStatus: number | null;
          durationMs: number;
          rawBody: string | null;
          errorComplete: unknown;
          summary?: ProbeSummary;
        }> = [];

        for (const id of ids) {
          const detailPath = `${NOMUS_ENDPOINTS.tabelas_preco}/${encodeURIComponent(id)}`;
          const res = await fetchNomusRaw(detailPath);
          const ok = res.httpStatus !== null && res.httpStatus >= 200 && res.httpStatus < 300;
          const summary = ok ? summarize(res.parsedBody) : undefined;
          // Persistimos payload bruto + sumário pra inspeção via psql.
          if (ok) {
            try {
              await supabaseAdmin.from("nomus_sync_log").insert({
                entity: "tabelas_preco",
                operation: "probe",
                direction: "test",
                status: "success",
                http_status: res.httpStatus,
                duration_ms: res.durationMs,
                request_path: `GET ${detailPath} (probe)`,
                payload: { probedId: id } as never,
                response: { summary, raw: res.parsedBody } as never,
                triggered_by: null,
              });
            } catch (e) {
              console.error("[tabela-preco-probe] failed to log payload", e);
            }
          }
          results.push({
            id,
            ok,
            calledUrl: res.calledUrl,
            httpStatus: res.httpStatus,
            durationMs: res.durationMs,
            rawBody: res.rawBody,
            errorComplete: res.errorComplete,
            summary,
          });
        }

        const allTopKeys = new Set<string>();
        const allCostKeys = new Set<string>();
        const allItemKeys = new Set<string>();
        const allItemCostKeys = new Set<string>();
        for (const r of results) {
          if (!r.summary) continue;
          r.summary.topLevelKeys.forEach((k) => allTopKeys.add(k));
          r.summary.costCandidates.forEach((c) => allCostKeys.add(c.key));
          (r.summary.itemSampleKeys ?? []).forEach((k) => allItemKeys.add(k));
          (r.summary.itemCostCandidates ?? []).forEach((c) =>
            allItemCostKeys.add(c.key),
          );
        }

        const body = {
          probeVersion: "tabela-preco-probe-diagnostics-v2",
          baseUrlPresent: listProbe.baseUrlPresent,
          apiKeyPresent: listProbe.apiKeyPresent,
          usernamePresent: listProbe.usernamePresent,
          passwordPresent: listProbe.passwordPresent,
          calledUrl: listProbe.calledUrl,
          httpStatus: listProbe.httpStatus,
          durationMs: listProbe.durationMs,
          rawBody: listProbe.rawBody,
          tablesReceived: tables.length,
          errorComplete: listProbe.errorComplete,
          probedIds: ids,
          listInfo,
          unionOfTopLevelKeys: Array.from(allTopKeys).sort(),
          unionOfCostCandidateKeys_table: Array.from(allCostKeys).sort(),
          unionOfItemKeys: Array.from(allItemKeys).sort(),
          unionOfCostCandidateKeys_item: Array.from(allItemCostKeys).sort(),
          perId: results,
          hint:
            "Procure no nível do ITEM (produto da tabela) por chaves como precoCusto, custoMedio, custoUltimaCompra, precoVenda, margem, markup. " +
            "Se NÃO aparecer nada de custo, a tabela só serve pra preço-base (Etapa 2-4 viram só 'desconto efetivo vs tabela').",
        };

        return new Response(JSON.stringify(body, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
