import { createFileRoute } from "@tanstack/react-router";
import { getOne, nomusFetch } from "@/integrations/nomus/client";
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

function pickCandidates(obj: Record<string, unknown>): Array<{ key: string; value: unknown }> {
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

type DirectListProbe = {
  label: "withPagina" | "withoutPagina";
  baseUrlPresent: boolean;
  apiKeyPresent: boolean;
  url: string | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  status: number | null;
  ok: boolean;
  bodyRaw: string | null;
  tablesReceived: number;
  error: string | null;
};

const DIRECT_PROBE_TIMEOUT_MS = 60_000;

function extractList(payload: unknown): unknown[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  for (const k of [
    "content",
    "data",
    "items",
    "resultados",
    "registros",
    "lista",
    "tabelasPreco",
  ]) {
    if (Array.isArray(obj[k])) return obj[k] as unknown[];
  }
  return [];
}

function normalizeBaseUrl(raw: string): string {
  const parsed = new URL(raw);
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

function parseBody(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

async function directListProbe(
  label: DirectListProbe["label"],
  query: string,
): Promise<DirectListProbe> {
  const baseUrlRaw = process.env.NOMUS_BASE_URL?.trim() ?? "";
  const apiKeyRaw = process.env.NOMUS_API_KEY?.trim() ?? "";
  const baseUrlPresent = Boolean(baseUrlRaw);
  const apiKeyPresent = Boolean(apiKeyRaw);
  const startedAt = new Date().toISOString();
  const started = Date.now();
  let url: string | null = null;

  try {
    if (!baseUrlPresent || !apiKeyPresent) {
      const endedAt = new Date().toISOString();
      return {
        label,
        baseUrlPresent,
        apiKeyPresent,
        url,
        startedAt,
        endedAt,
        durationMs: Date.now() - started,
        status: null,
        ok: false,
        bodyRaw: null,
        tablesReceived: 0,
        error: "NOMUS_BASE_URL ou NOMUS_API_KEY ausente.",
      };
    }

    url = `${normalizeBaseUrl(baseUrlRaw)}${NOMUS_ENDPOINTS.tabelas_preco}${query}`;
    console.info("[tabela-preco-probe] chamada direta iniciada", {
      label,
      baseUrlPresent,
      apiKeyPresent,
      url,
      startedAt,
      timeoutMs: DIRECT_PROBE_TIMEOUT_MS,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DIRECT_PROBE_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: /^basic\s+/i.test(apiKeyRaw) ? apiKeyRaw : `Basic ${apiKeyRaw}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
      const bodyRaw = await response.text();
      const parsed = parseBody(bodyRaw);
      const tablesReceived = extractList(parsed).length;
      const endedAt = new Date().toISOString();
      const result: DirectListProbe = {
        label,
        baseUrlPresent,
        apiKeyPresent,
        url,
        startedAt,
        endedAt,
        durationMs: Date.now() - started,
        status: response.status,
        ok: response.ok,
        bodyRaw,
        tablesReceived,
        error: response.ok ? null : `Nomus respondeu HTTP ${response.status}`,
      };
      console.info("[tabela-preco-probe] chamada direta finalizada", {
        label,
        url,
        endedAt,
        durationMs: result.durationMs,
        status: result.status,
        ok: result.ok,
        tablesReceived,
        bodyRaw,
      });
      return result;
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const endedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : String(error);
    const isTimeout = error instanceof Error && error.name === "AbortError";
    const result: DirectListProbe = {
      label,
      baseUrlPresent,
      apiKeyPresent,
      url,
      startedAt,
      endedAt,
      durationMs: Date.now() - started,
      status: null,
      ok: false,
      bodyRaw: null,
      tablesReceived: 0,
      error: isTimeout ? "Timeout ao conectar no Nomus" : message,
    };
    console.error("[tabela-preco-probe] chamada direta falhou", {
      label,
      url,
      endedAt,
      durationMs: result.durationMs,
      error: result.error,
      rawError: message,
    });
    return result;
  }
}

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

export const Route = createFileRoute("/api/public/nomus/tabela-preco-probe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const idsParam = url.searchParams.get("id");
        const directConnectivity = [
          await directListProbe("withPagina", "?pagina=1"),
          await directListProbe("withoutPagina", ""),
        ];

        let ids: string[] = [];
        let listInfo: unknown = null;

        if (idsParam) {
          ids = idsParam
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        } else {
          const successfulList = directConnectivity.find((probe) => probe.ok && probe.bodyRaw);
          const arr = successfulList?.bodyRaw ? extractList(parseBody(successfulList.bodyRaw)) : [];
          listInfo = {
            count: arr.length,
            firstKeys:
              arr[0] && typeof arr[0] === "object" && !Array.isArray(arr[0])
                ? Object.keys(arr[0] as object).slice(0, 30)
                : null,
            source: successfulList?.label ?? null,
          };
          // Extrai ids dos primeiros 3 (campos comuns: id, idTabelaPreco, codigo)
          for (const item of arr.slice(0, 3)) {
            if (item && typeof item === "object") {
              const obj = item as Record<string, unknown>;
              const id = obj.id ?? obj.idTabelaPreco ?? obj.codigo ?? obj.codTabelaPreco;
              if (id !== undefined && id !== null) ids.push(String(id));
            }
          }
        }

        const results: Array<{
          id: string;
          ok: boolean;
          error?: string;
          summary?: ProbeSummary;
        }> = [];

        for (const id of ids) {
          const res = await getOne<unknown>(NOMUS_ENDPOINTS.tabelas_preco, id, {
            entity: "tabelas_preco",
            triggeredBy: null,
          });
          if (!res.ok) {
            results.push({ id, ok: false, error: res.error });
            continue;
          }
          const summary = summarize(res.data);
          // Persistimos payload bruto + sumário pra inspeção via psql.
          try {
            await supabaseAdmin.from("nomus_sync_log").insert({
              entity: "tabelas_preco",
              operation: "probe",
              direction: "test",
              status: "success",
              http_status: 200,
              duration_ms: 0,
              request_path: `GET /tabelasPreco/${id} (probe)`,
              payload: { probedId: id } as never,
              response: { summary, raw: res.data } as never,
              triggered_by: null,
            });
          } catch (e) {
            console.error("[tabela-preco-probe] failed to log payload", e);
          }
          results.push({ id, ok: true, summary });
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
          (r.summary.itemCostCandidates ?? []).forEach((c) => allItemCostKeys.add(c.key));
        }

        const body = {
          directConnectivity,
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
