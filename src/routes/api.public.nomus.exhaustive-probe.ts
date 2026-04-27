import { createFileRoute } from "@tanstack/react-router";
import { nomusFetch } from "@/integrations/nomus/client";
import { NOMUS_ENDPOINTS } from "@/integrations/nomus/endpoints";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Rota descartável: testa 10 variações de endpoint do Nomus em busca de
 * campos de custo/margem que a API REST documentada não expõe nas chamadas
 * já testadas anteriormente.
 *
 * Uso:
 *   GET /api/public/nomus/exhaustive-probe
 *   GET /api/public/nomus/exhaustive-probe?proposta=161&item=526&produto=123&tabela=18
 *
 * Resultado: array `{ path, status, hasCost, topKeys, costHits }` para cada
 * variação. Payloads brutos completos são gravados em `nomus_sync_log`.
 *
 * Apagar essa rota depois que decidir se algum endpoint é viável.
 */

const DEFAULTS = {
  proposta: "161",
  item: "526",
  produto: "1",
  tabela: "18",
};

const COST_KEYS = [
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
  "lucroLiquido",
  "lucroUnitarioPrevisto",
  "precoUnitarioCalculado",
  "precoCalculado",
  "custosVenda",
  "custo_materiais",
  "custo_mod",
  "custo_cif",
  "custos_adm",
  "margem_lucro_desejada",
];

const COST_KEYS_LOWER = new Set(COST_KEYS.map((k) => k.toLowerCase()));

function findCostHits(payload: unknown): Array<{ path: string; value: unknown }> {
  const hits: Array<{ path: string; value: unknown }> = [];
  function walk(node: unknown, path: string, depth: number) {
    if (depth > 6 || node === null) return;
    if (Array.isArray(node)) {
      node.slice(0, 3).forEach((el, i) => walk(el, `${path}[${i}]`, depth + 1));
      return;
    }
    if (typeof node !== "object") return;
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const subPath = path ? `${path}.${k}` : k;
      if (COST_KEYS_LOWER.has(k.toLowerCase())) {
        hits.push({ path: subPath, value: v });
      }
      if (v && typeof v === "object") walk(v, subPath, depth + 1);
    }
  }
  walk(payload, "", 0);
  return hits;
}

function topKeys(payload: unknown, limit = 30): string[] {
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload)) {
    const first = payload[0];
    if (first && typeof first === "object") return Object.keys(first).slice(0, limit);
    return [];
  }
  return Object.keys(payload as object).slice(0, limit);
}

type Variation = {
  label: string;
  path: string;
  query?: Record<string, string>;
};

function buildVariations(p: typeof DEFAULTS): Variation[] {
  return [
    { label: "itensProposta singular", path: `/itensProposta/${p.item}` },
    { label: "itensPropostas plural alt", path: `/itensPropostas/${p.item}` },
    { label: "propostas/{id}/items inglês", path: `${NOMUS_ENDPOINTS.propostas}/${p.proposta}/items/${p.item}` },
    { label: "analiseLucro por item", path: `/analiseLucro/${p.item}` },
    { label: "analiseLucro query", path: `/analiseLucro`, query: { query: `idItemProposta=${p.item}` } },
    { label: "proposta incluirAnaliseLucro", path: `${NOMUS_ENDPOINTS.propostas}/${p.proposta}`, query: { incluirAnaliseLucro: "true" } },
    { label: "proposta expand itens.analiseLucro", path: `${NOMUS_ENDPOINTS.propostas}/${p.proposta}`, query: { expand: "itens.analiseLucro" } },
    { label: "proposta fields wildcard", path: `${NOMUS_ENDPOINTS.propostas}/${p.proposta}`, query: { fields: "*,itens.analiseLucro.*" } },
    { label: "produto/{id}/custos", path: `${NOMUS_ENDPOINTS.produtos}/${p.produto}/custos` },
    { label: "produto incluirCusto", path: `${NOMUS_ENDPOINTS.produtos}/${p.produto}`, query: { incluirCusto: "true" } },
    { label: "tabelaPreco/{id}/itens incluirCustos", path: `${NOMUS_ENDPOINTS.tabelas_preco}/${p.tabela}/itens`, query: { incluirCustos: "true" } },
    { label: "tabelaPreco/{id} expand itens.custos", path: `${NOMUS_ENDPOINTS.tabelas_preco}/${p.tabela}`, query: { expand: "itens.custos" } },
  ];
}

export const Route = createFileRoute("/api/public/nomus/exhaustive-probe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const params = {
          proposta: url.searchParams.get("proposta")?.trim() || DEFAULTS.proposta,
          item: url.searchParams.get("item")?.trim() || DEFAULTS.item,
          produto: url.searchParams.get("produto")?.trim() || DEFAULTS.produto,
          tabela: url.searchParams.get("tabela")?.trim() || DEFAULTS.tabela,
        };

        const variations = buildVariations(params);
        const results: Array<Record<string, unknown>> = [];

        for (const v of variations) {
          const res = await nomusFetch<unknown>(v.path, {
            method: "GET",
            query: v.query,
            entity: "exhaustive_probe",
            operation: v.label,
            direction: "test",
            triggeredBy: null,
          });

          const summary: Record<string, unknown> = {
            label: v.label,
            path: v.path,
            query: v.query ?? null,
            status: res.status,
            ok: res.ok,
          };

          if (res.ok) {
            const hits = findCostHits(res.data);
            summary.hasCost = hits.length > 0;
            summary.costHits = hits.slice(0, 10);
            summary.topKeys = topKeys(res.data);

            // Salva payload bruto para inspeção posterior
            try {
              await supabaseAdmin.from("nomus_sync_log").insert({
                entity: "exhaustive_probe",
                operation: v.label,
                direction: "test",
                status: "success",
                http_status: res.status,
                duration_ms: 0,
                request_path: `GET ${v.path}${v.query ? "?" + new URLSearchParams(v.query).toString() : ""}`,
                payload: { params, variation: v } as never,
                response: { raw: res.data, costHits: hits } as never,
                triggered_by: null,
              });
            } catch (e) {
              console.error("[exhaustive-probe] log insert failed", e);
            }
          } else {
            summary.error = res.error;
          }

          results.push(summary);
        }

        const winners = results.filter((r) => r.hasCost === true);

        return new Response(
          JSON.stringify(
            {
              ok: true,
              params,
              variationsTested: variations.length,
              winnersCount: winners.length,
              winners: winners.map((r) => ({ label: r.label, path: r.path, costHits: r.costHits })),
              results,
              hint:
                winners.length > 0
                  ? `🎉 ${winners.length} endpoint(s) expõem custo. Use os "winners" para adaptar o sync automático.`
                  : "❌ Nenhum endpoint retornou custos. Confirma que CSV é a única fonte viável.",
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
