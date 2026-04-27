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

export const Route = createFileRoute("/api/public/nomus/tabela-preco-probe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const idsParam = url.searchParams.get("id");

        let ids: string[] = [];
        let listInfo: unknown = null;

        if (idsParam) {
          ids = idsParam
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        } else {
          // Sem id: lista /tabelasPreco e pega os 3 primeiros.
          const listRes = await nomusFetch<unknown>(NOMUS_ENDPOINTS.tabelas_preco, {
            entity: "tabelas_preco",
            operation: "list-probe",
            direction: "test",
            triggeredBy: null,
          });
          if (!listRes.ok) {
            return new Response(
              JSON.stringify(
                {
                  error: "Falha ao listar /tabelasPreco",
                  detail: listRes.error,
                  hint: "Verifique NOMUS_BASE_URL/NOMUS_API_KEY ou passe ?id=1,2,3 manualmente.",
                },
                null,
                2,
              ),
              { status: 502, headers: { "Content-Type": "application/json" } },
            );
          }
          // Heurística: aceita array direto ou { content: [...] } / { data: [...] }
          const data = listRes.data as unknown;
          let arr: unknown[] = [];
          if (Array.isArray(data)) arr = data;
          else if (data && typeof data === "object") {
            const obj = data as Record<string, unknown>;
            for (const k of ["content", "data", "items", "tabelasPreco"]) {
              if (Array.isArray(obj[k])) {
                arr = obj[k] as unknown[];
                break;
              }
            }
          }
          listInfo = {
            count: arr.length,
            firstKeys:
              arr[0] && typeof arr[0] === "object" && !Array.isArray(arr[0])
                ? Object.keys(arr[0] as object).slice(0, 30)
                : null,
          };
          // Extrai ids dos primeiros 3 (campos comuns: id, idTabelaPreco, codigo)
          for (const item of arr.slice(0, 3)) {
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
          (r.summary.itemCostCandidates ?? []).forEach((c) =>
            allItemCostKeys.add(c.key),
          );
        }

        const body = {
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
