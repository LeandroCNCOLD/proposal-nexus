import { createFileRoute } from "@tanstack/react-router";
import { nomusFetch } from "@/integrations/nomus/client";
import { NOMUS_ENDPOINTS } from "@/integrations/nomus/endpoints";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Rota de diagnóstico TEMPORÁRIA — sondagem profunda de UMA tabela de preço.
 *
 * Diferente do probe anterior (que aplicava heurística de "candidatos a custo"
 * e podia descartar campos), aqui salvamos o payload BRUTO completo no
 * `nomus_sync_log.response` e listamos TODAS as chaves dos 3 primeiros itens.
 *
 * Uso:
 *   GET /api/public/nomus/tabela-preco-deep-probe          → sonda id=18 (default)
 *   GET /api/public/nomus/tabela-preco-deep-probe?id=18
 *   GET /api/public/nomus/tabela-preco-deep-probe?id=18&filter=ativo=true
 *
 * Apaga essa rota depois que a Etapa 2 estiver decidida.
 */

const DEFAULT_ID = "18";

const COST_KEYS_OF_INTEREST = [
  "custoMateriais",
  "custoMaterial",
  "custoMOD",
  "custoMod",
  "custoCIF",
  "custoCif",
  "custosAdm",
  "custoAdministrativo",
  "custoProducaoTotal",
  "custoTotal",
  "custoUnitario",
  "custoMedio",
  "custoPadraoCompra",
  "margemLucroDesejada",
  "margemContribuicao",
  "margemLucroPrevista",
  "margem",
  "lucroLiquido",
  "lucroUnitarioPrevisto",
  "precoUnitarioCalculado",
  "precoCalculado",
  "loteProducao",
  "custosVenda",
  "percentualDescontoFinanceiro",
  // snake_case
  "custo_materiais",
  "custo_mod",
  "custo_cif",
  "custos_adm",
  "margem_lucro_desejada",
  "preco_unitario_calculado",
];

function listKeysDeep(obj: unknown, prefix = "", depth = 0, maxDepth = 3): string[] {
  if (depth > maxDepth || obj === null || typeof obj !== "object" || Array.isArray(obj)) return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    out.push(path);
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...listKeysDeep(v, path, depth + 1, maxDepth));
    }
  }
  return out;
}

function findCostHits(payload: unknown): Array<{ path: string; value: unknown }> {
  const hits: Array<{ path: string; value: unknown }> = [];
  const lowerSet = new Set(COST_KEYS_OF_INTEREST.map((k) => k.toLowerCase()));

  function walk(node: unknown, path: string, depth: number) {
    if (depth > 5 || node === null) return;
    if (Array.isArray(node)) {
      // só inspecionar primeiros 3 elementos para não explodir
      node.slice(0, 3).forEach((el, i) => walk(el, `${path}[${i}]`, depth + 1));
      return;
    }
    if (typeof node !== "object") return;
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const subPath = path ? `${path}.${k}` : k;
      if (lowerSet.has(k.toLowerCase())) {
        hits.push({ path: subPath, value: v });
      }
      if (v && typeof v === "object") walk(v, subPath, depth + 1);
    }
  }
  walk(payload, "", 0);
  return hits;
}

function summarizeItems(payload: unknown): {
  itemArrayPath: string | null;
  itemCount: number;
  firstItemKeys: string[];
  secondItemKeys: string[];
  thirdItemKeys: string[];
  firstThreeItems: unknown[];
} {
  if (!payload || typeof payload !== "object") {
    return { itemArrayPath: null, itemCount: 0, firstItemKeys: [], secondItemKeys: [], thirdItemKeys: [], firstThreeItems: [] };
  }
  const obj = payload as Record<string, unknown>;
  // procura primeiro array de objetos no payload
  const candidates = ["itens", "items", "produtos", "tabelaPrecoItens", "registros", "lista", "data"];
  let arr: unknown[] | null = null;
  let arrPath: string | null = null;
  for (const k of candidates) {
    const v = obj[k];
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object") {
      arr = v;
      arrPath = k;
      break;
    }
  }
  if (!arr) {
    // varredura: pega o primeiro array de objetos em qualquer chave
    for (const [k, v] of Object.entries(obj)) {
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object") {
        arr = v;
        arrPath = k;
        break;
      }
    }
  }
  if (!arr) {
    return { itemArrayPath: null, itemCount: 0, firstItemKeys: [], secondItemKeys: [], thirdItemKeys: [], firstThreeItems: [] };
  }
  const safeKeys = (i: number) =>
    arr![i] && typeof arr![i] === "object" && !Array.isArray(arr![i])
      ? Object.keys(arr![i] as object)
      : [];
  return {
    itemArrayPath: arrPath,
    itemCount: arr.length,
    firstItemKeys: safeKeys(0),
    secondItemKeys: safeKeys(1),
    thirdItemKeys: safeKeys(2),
    firstThreeItems: arr.slice(0, 3),
  };
}

export const Route = createFileRoute("/api/public/nomus/tabela-preco-deep-probe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const id = (url.searchParams.get("id") ?? DEFAULT_ID).trim();
        const filter = url.searchParams.get("filter")?.trim() || null;

        const path = `${NOMUS_ENDPOINTS.tabelas_preco}/${encodeURIComponent(id)}`;

        const res = await nomusFetch<unknown>(path, {
          method: "GET",
          query: filter ? { query: filter } : undefined,
          entity: "tabelas_preco",
          operation: "deep_probe",
          direction: "test",
          triggeredBy: null,
        });

        if (!res.ok) {
          return new Response(
            JSON.stringify({ ok: false, id, filter, status: res.status, error: res.error }, null, 2),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        const raw = res.data;
        const topLevelKeys =
          raw && typeof raw === "object" && !Array.isArray(raw)
            ? Object.keys(raw as object)
            : [];
        const allKeysDeep = listKeysDeep(raw);
        const itemsSummary = summarizeItems(raw);
        const costHits = findCostHits(raw);

        // Persiste payload BRUTO completo + sumário no nomus_sync_log
        try {
          await supabaseAdmin.from("nomus_sync_log").insert({
            entity: "tabelas_preco",
            operation: "deep_probe",
            direction: "test",
            status: "success",
            http_status: 200,
            duration_ms: 0,
            request_path: `GET /tabelasPreco/${id}${filter ? `?query=${filter}` : ""} (deep_probe)`,
            payload: { probedId: id, filter } as never,
            response: {
              raw,
              summary: {
                topLevelKeys,
                allKeysDeep,
                itemsSummary,
                costHits,
              },
            } as never,
            triggered_by: null,
          });
        } catch (e) {
          console.error("[deep-probe] failed to log payload", e);
        }

        return new Response(
          JSON.stringify(
            {
              ok: true,
              id,
              filter,
              topLevelKeys,
              allKeysDeep,
              itemsSummary,
              costHits,
              hint:
                costHits.length > 0
                  ? "✅ Encontramos campos de custo/margem! Próximo passo: estender nomus_price_table_items."
                  : "❌ Nenhum campo de custo no payload bruto. Confirma cenário B do plano.",
            },
            null,
            2,
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
