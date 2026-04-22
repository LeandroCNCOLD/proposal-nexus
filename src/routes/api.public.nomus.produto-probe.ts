import { createFileRoute } from "@tanstack/react-router";
import { getOne } from "@/integrations/nomus/client";
import { NOMUS_ENDPOINTS } from "@/integrations/nomus/endpoints";

/**
 * Rota de diagnóstico TEMPORÁRIA.
 *
 * Sonda `GET /produtos/{id}` no Nomus para descobrir quais campos de custo
 * (precoCusto, custoMedio, ultimaCompra, margemBase, etc.) o ambiente expõe
 * via REST. Sem essa informação não dá pra decidir se vale persistir
 * custos por produto e usar no cálculo de lucro do item.
 *
 * Uso:
 *   GET /api/nomus/produto-probe                   → sonda IDs default (8576, 687, 8490)
 *   GET /api/nomus/produto-probe?id=8576           → sonda 1 ID específico
 *   GET /api/nomus/produto-probe?id=8576,687,8490  → sonda lista de IDs
 *
 * Retorna, para cada ID:
 *  - lista de chaves de primeiro nível
 *  - amostra "mascarada" (primitivos preservados, objetos/arrays só como tipo+contagem)
 *  - candidatos prováveis a campos de custo (heurística por nome)
 *
 * Apaga essa rota depois que a Etapa 2 estiver decidida.
 */

const DEFAULT_IDS = ["8576", "687", "8490"];

const COST_KEY_HINTS = [
  "custo",
  "preco",
  "valor",
  "margem",
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
    return { __type: "array", length: v.length, sampleKeys: v[0] && typeof v[0] === "object" && !Array.isArray(v[0]) ? Object.keys(v[0] as object).slice(0, 20) : null };
  }
  if (typeof v === "object") {
    return { __type: "object", keys: Object.keys(v as object).slice(0, 30) };
  }
  if (typeof v === "string" && v.length > 120) return v.slice(0, 120) + "…";
  return v;
}

function summarize(payload: unknown): {
  topLevelKeys: string[];
  sample: Record<string, unknown>;
  costCandidates: Array<{ key: string; value: unknown }>;
} {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { topLevelKeys: [], sample: {}, costCandidates: [] };
  }
  const obj = payload as Record<string, unknown>;
  const topLevelKeys = Object.keys(obj);
  const sample: Record<string, unknown> = {};
  for (const k of topLevelKeys) sample[k] = describeValue(obj[k]);

  const costCandidates: Array<{ key: string; value: unknown }> = [];
  for (const k of topLevelKeys) {
    const lower = k.toLowerCase();
    if (COST_KEY_HINTS.some((h) => lower.includes(h))) {
      costCandidates.push({ key: k, value: describeValue(obj[k]) });
    }
  }
  return { topLevelKeys, sample, costCandidates };
}

export const Route = createFileRoute("/api/public/nomus/produto-probe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const idsParam = url.searchParams.get("id");
        const ids = (idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_IDS);

        const results: Array<{
          id: string;
          ok: boolean;
          error?: string;
          topLevelKeys?: string[];
          costCandidates?: Array<{ key: string; value: unknown }>;
          sample?: Record<string, unknown>;
        }> = [];

        for (const id of ids) {
          const res = await getOne<unknown>(NOMUS_ENDPOINTS.produtos, id, {
            entity: "produtos",
            triggeredBy: null,
          });
          if (!res.ok) {
            results.push({ id, ok: false, error: res.error });
            continue;
          }
          const summary = summarize(res.data);
          results.push({
            id,
            ok: true,
            topLevelKeys: summary.topLevelKeys,
            costCandidates: summary.costCandidates,
            sample: summary.sample,
          });
        }

        const allKeys = new Set<string>();
        const allCostKeys = new Set<string>();
        for (const r of results) {
          (r.topLevelKeys ?? []).forEach((k) => allKeys.add(k));
          (r.costCandidates ?? []).forEach((c) => allCostKeys.add(c.key));
        }

        const body = {
          probedIds: ids,
          unionOfTopLevelKeys: Array.from(allKeys).sort(),
          unionOfCostCandidateKeys: Array.from(allCostKeys).sort(),
          perId: results,
          hint: "Procure chaves como precoCusto, custoMedio, custoUltimaCompra, valorTabela, margem*. Use o resultado para decidir o schema da Etapa 2.",
        };

        return new Response(JSON.stringify(body, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
