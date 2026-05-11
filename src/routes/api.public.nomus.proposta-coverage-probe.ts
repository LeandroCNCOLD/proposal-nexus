import { createFileRoute } from "@tanstack/react-router";
import { nomusFetch } from "@/integrations/nomus/client";
import { NOMUS_ENDPOINTS } from "@/integrations/nomus/endpoints";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * PROBE TEMPORÁRIO — somente leitura.
 *
 * Investiga se o Nomus expõe endpoints, sub-recursos ou parâmetros que
 * tragam dados COMERCIAIS/FINANCEIROS completos da proposta (tabela de
 * preço, condição de pagamento, comissão, frete, transportadora, moeda,
 * cotação, custos, lucro, margem, itens detalhados, tributos detalhados).
 *
 * NÃO altera schema. NÃO grava nada além do log padrão (`nomus_sync_log`).
 * NÃO faz POST/PUT/DELETE.
 *
 * Uso:
 *   GET /api/public/nomus/proposta-coverage-probe
 *   GET /api/public/nomus/proposta-coverage-probe?ids=210,211,212
 *
 * Apagar a rota assim que a decisão de integração for tomada.
 */

const DEFAULT_IDS = ["210"];

// Mapeamento por GRUPO -> termos a procurar (case-insensitive, substring).
// Mantém variantes em português, inglês e abreviações usadas pelo Nomus.
const GROUP_HINTS: Record<string, string[]> = {
  tabela_preco: ["tabelapreco", "idtabelapreco", "nometabelapreco"],
  pagamento: ["condicaopagamento", "idcondicaopagamento", "formapagamento", "parcela"],
  comissao: ["comissao", "comissoes", "comissionado", "percentualcomissao"],
  logistica: ["transportadora", "frete", "entrega", "logistica", "rota", "servicoentrega"],
  moeda: ["moeda", "cotacao", "cambio", "taxacambio"],
  custos: ["custo", "custos"],
  lucro_margem: ["lucro", "margem", "markup"],
  itens_detalhados: ["desconto", "valorunitario", "precounitario", "tabelapreco"],
  tributos: ["icms", "ipi", "pis", "cofins", "iss", "tributacao", "tributo"],
};

function lowerKeys(payload: unknown, max = 1500): string[] {
  const out: string[] = [];
  function walk(node: unknown, path: string, depth: number) {
    if (out.length >= max || node === null || depth > 6) return;
    if (Array.isArray(node)) {
      node.slice(0, 3).forEach((el, i) => walk(el, `${path}[${i}]`, depth + 1));
      return;
    }
    if (typeof node !== "object") return;
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (out.length >= max) return;
      const sub = path ? `${path}.${k}` : k;
      out.push(sub);
      if (v && typeof v === "object") walk(v, sub, depth + 1);
    }
  }
  walk(payload, "", 0);
  return out;
}

function groupHits(allKeys: string[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [group, hints] of Object.entries(GROUP_HINTS)) {
    const matches = new Set<string>();
    for (const key of allKeys) {
      const lower = key.toLowerCase();
      if (hints.some((h) => lower.includes(h))) matches.add(key);
    }
    result[group] = Array.from(matches).slice(0, 25);
  }
  return result;
}

type Variation = { label: string; path: string; query?: Record<string, string> };

function buildVariations(propostaId: string): Variation[] {
  const base = NOMUS_ENDPOINTS.propostas; // "/propostas"
  return [
    { label: "GET /propostas/{id} (baseline)", path: `${base}/${propostaId}` },
    { label: "filtro query id==", path: base, query: { query: `id==${propostaId}` } },
    { label: "filtro query proposta==", path: base, query: { query: `proposta==${propostaId}` } },
    { label: "subrecurso /detalhe", path: `${base}/${propostaId}/detalhe` },
    { label: "subrecurso /detalhes", path: `${base}/${propostaId}/detalhes` },
    { label: "/detalhe/{id}", path: `${base}/detalhe/${propostaId}` },
    { label: "/detalhes/{id}", path: `${base}/detalhes/${propostaId}` },
    { label: "subrecurso /itens", path: `${base}/${propostaId}/itens` },
    { label: "/itens/{id}", path: `${base}/itens/${propostaId}` },
    { label: "/itensProposta?query=idProposta==", path: `/itensProposta`, query: { query: `idProposta==${propostaId}` } },
    { label: "/itensPropostas?query=idProposta==", path: `/itensPropostas`, query: { query: `idProposta==${propostaId}` } },
    { label: "subrecurso /tributos", path: `${base}/${propostaId}/tributos` },
    { label: "/tributos/{id}", path: `${base}/tributos/${propostaId}` },
    { label: "subrecurso /financeiro", path: `${base}/${propostaId}/financeiro` },
    { label: "/financeiro/{id}", path: `${base}/financeiro/${propostaId}` },
    { label: "subrecurso /comissoes", path: `${base}/${propostaId}/comissoes` },
    { label: "/comissoes/{id}", path: `${base}/comissoes/${propostaId}` },
    { label: "subrecurso /frete", path: `${base}/${propostaId}/frete` },
    { label: "subrecurso /logistica", path: `${base}/${propostaId}/logistica` },
    { label: "subrecurso /entrega", path: `${base}/${propostaId}/entrega` },
    { label: "expand=itens", path: `${base}/${propostaId}`, query: { expand: "itens" } },
    { label: "expand=financeiro", path: `${base}/${propostaId}`, query: { expand: "financeiro" } },
    { label: "expand=comissoes", path: `${base}/${propostaId}`, query: { expand: "comissoes" } },
    { label: "expand=all", path: `${base}/${propostaId}`, query: { expand: "all" } },
    { label: "detalhado=true", path: `${base}/${propostaId}`, query: { detalhado: "true" } },
    { label: "completo=true", path: `${base}/${propostaId}`, query: { completo: "true" } },
    { label: "include=itens,tributos,financeiro,comissoes,frete", path: `${base}/${propostaId}`, query: { include: "itens,tributos,financeiro,comissoes,frete" } },
    { label: "incluirAnaliseLucro=true", path: `${base}/${propostaId}`, query: { incluirAnaliseLucro: "true" } },
    { label: "fields wildcard", path: `${base}/${propostaId}`, query: { fields: "*,itens.*,analiseLucro.*" } },
  ];
}

export const Route = createFileRoute("/api/public/nomus/proposta-coverage-probe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const idsParam = url.searchParams.get("ids");
        const ids = (idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_IDS).slice(0, 4);

        const perId: Array<Record<string, unknown>> = [];
        const globalCoverage: Record<string, Set<string>> = {};
        for (const g of Object.keys(GROUP_HINTS)) globalCoverage[g] = new Set();

        for (const propostaId of ids) {
          const variations = buildVariations(propostaId);
          const results: Array<Record<string, unknown>> = [];

          for (const v of variations) {
            const res = await nomusFetch<unknown>(v.path, {
              method: "GET",
              query: v.query,
              entity: "proposta_coverage_probe",
              operation: v.label,
              direction: "test",
              triggeredBy: null,
              maxAttempts: 1,
              timeoutMs: 12_000,
            });

            const row: Record<string, unknown> = {
              label: v.label,
              path: v.path,
              query: v.query ?? null,
              status: res.status,
              ok: res.ok,
            };

            if (res.ok) {
              const keys = lowerKeys(res.data);
              const hits = groupHits(keys);
              const groupsFound = Object.entries(hits)
                .filter(([, arr]) => arr.length > 0)
                .map(([g]) => g);
              row.totalKeys = keys.length;
              row.groupsFound = groupsFound;
              row.hits = hits;

              for (const g of groupsFound) {
                globalCoverage[g].add(`${v.label} [proposta=${propostaId}]`);
              }

              try {
                await supabaseAdmin.from("nomus_sync_log").insert({
                  entity: "proposta_coverage_probe",
                  operation: v.label,
                  direction: "test",
                  status: "success",
                  http_status: res.status,
                  duration_ms: 0,
                  request_path: `GET ${v.path}${v.query ? "?" + new URLSearchParams(v.query).toString() : ""}`,
                  payload: { propostaId, variation: v } as never,
                  response: { raw: res.data, hits } as never,
                  triggered_by: null,
                });
              } catch (e) {
                console.error("[coverage-probe] log insert failed", e);
              }
            } else {
              row.error =
                res.status === 404
                  ? "endpoint inexistente ou indisponível"
                  : res.error;
            }
            results.push(row);
          }
          perId.push({ propostaId, variationsTested: variations.length, results });
        }

        const coverageMatrix = Object.fromEntries(
          Object.keys(GROUP_HINTS).map((g) => [g, Array.from(globalCoverage[g]).slice(0, 8)]),
        );

        const recommendation =
          Object.values(coverageMatrix).every((v) => v.length === 0)
            ? "Nenhum endpoint adicional retornou os campos comerciais/financeiros buscados. Limite confirmado da API REST do Nomus → adotar arquitetura híbrida (cruzamento local + cálculo + edição manual)."
            : "Pelo menos um endpoint/parâmetro retornou campos relevantes. Revisar `coverageMatrix` para escolher a fonte canônica antes de propor a integração (ainda sem aplicar).";

        return new Response(
          JSON.stringify(
            {
              ok: true,
              ids,
              groupsTested: Object.keys(GROUP_HINTS),
              coverageMatrix,
              recommendation,
              perId,
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
