import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { syncPriceTableItems } from "@/integrations/nomus/server.functions";
import { selectTableForItem, type ItemPriceTable } from "@/features/price-table-picker/select-table-for-item";

// Hook público para:
//  1) Re-sincronizar TODAS as tabelas de preço Nomus (refazendo o pull dos itens).
//  2) Backfill: para cada item de proposta com nomus_product_id, escolher a melhor
//     tabela e gravar price_table_id + snapshot de custos em proposal_items.
//
// Acionar via:
//   POST /api/public/hooks/sync-price-tables
//   Authorization: Bearer <SUPABASE_PUBLISHABLE_KEY ou NOMUS_CRON_SECRET>
//   Body: { syncTables?: boolean, backfill?: boolean, proposalId?: string }

type Tbl = {
  id: string;
  nomus_id: string;
  name: string;
  ufs: string[] | null;
  is_active: boolean;
  currency: string | null;
  synced_at: string | null;
};

type ItemRow = {
  nomus_product_id: string;
  unit_price: number | null;
  price_table_id: string;
  custo_materiais: number | null;
  custo_mod: number | null;
  custo_cif: number | null;
  custos_adm: number | null;
  custos_venda: number | null;
  custo_producao_total: number | null;
  preco_calculado: number | null;
  preco_liquido: number | null;
  margem_desejada_pct: number | null;
  lucro_bruto: number | null;
  lucro_liquido: number | null;
  margem_contribuicao: number | null;
};

function parseIcms(name: string): number | null {
  const m = name.match(/ICMS\s*([0-9]+(?:[.,][0-9]+)?)/i);
  return m ? Number(m[1].replace(",", ".")) : null;
}

async function syncAllPriceTables(): Promise<{ tables: number; itemsUpserted: number; errors: string[] }> {
  const { data: tables, error } = await supabaseAdmin
    .from("nomus_price_tables")
    .select("id, nomus_id, raw")
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  let totalUpserted = 0;
  const errors: string[] = [];
  for (const t of (tables ?? []) as Array<{ id: string; nomus_id: string; raw: unknown }>) {
    try {
      const res = await syncPriceTableItems({
        priceTableId: t.id,
        tableNomusId: t.nomus_id,
        source: (t.raw ?? {}) as never,
        triggeredBy: null,
      });
      totalUpserted += res.upserted;
    } catch (e) {
      errors.push(`tabela ${t.nomus_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { tables: (tables ?? []).length, itemsUpserted: totalUpserted, errors };
}

async function backfillProposalItems(proposalId?: string): Promise<{ updated: number; skipped: number }> {
  // 1. Carrega todas as tabelas ativas.
  const { data: tablesRaw, error: tErr } = await supabaseAdmin
    .from("nomus_price_tables")
    .select("id, nomus_id, name, ufs, is_active, currency, synced_at")
    .eq("is_active", true);
  if (tErr) throw new Error(tErr.message);
  const tables = (tablesRaw ?? []) as Tbl[];
  const tableById = new Map(tables.map((t) => [t.id, t]));

  // 2. Carrega itens das tabelas (todas as linhas).
  const { data: itemsRaw, error: iErr } = await supabaseAdmin
    .from("nomus_price_table_items")
    .select(
      "nomus_product_id, unit_price, price_table_id, custo_materiais, custo_mod, custo_cif, custos_adm, custos_venda, custo_producao_total, preco_calculado, preco_liquido, margem_desejada_pct, lucro_bruto, lucro_liquido, margem_contribuicao",
    );
  if (iErr) throw new Error(iErr.message);
  const allItems = (itemsRaw ?? []) as ItemRow[];

  // Indexa: produto → ItemPriceTable[]
  const byProduct = new Map<string, ItemPriceTable[]>();
  for (const r of allItems) {
    const tbl = tableById.get(r.price_table_id);
    if (!tbl) continue;
    const arr = byProduct.get(r.nomus_product_id) ?? [];
    arr.push({
      id: r.price_table_id,
      name: tbl.name,
      ufs: tbl.ufs ?? [],
      icmsPct: parseIcms(tbl.name),
      unitPrice: r.unit_price,
      currency: tbl.currency ?? "BRL",
      syncedAt: tbl.synced_at,
      isActive: tbl.is_active,
      costs: {
        custoMateriais: r.custo_materiais,
        custoMod: r.custo_mod,
        custoCif: r.custo_cif,
        custosAdm: r.custos_adm,
        custosVenda: r.custos_venda,
        custoProducaoTotal: r.custo_producao_total,
        precoCalculado: r.preco_calculado,
        precoLiquido: r.preco_liquido,
        margemDesejadaPct: r.margem_desejada_pct,
        lucroBruto: r.lucro_bruto,
        lucroLiquido: r.lucro_liquido,
        margemContribuicao: r.margem_contribuicao,
      },
    });
    byProduct.set(r.nomus_product_id, arr);
  }

  // 3. Carrega itens das propostas que precisam matching (com cliente UF).
  let q = supabaseAdmin
    .from("proposal_items")
    .select("id, proposal_id, nomus_item_id, nomus_product_id, unit_price, price_table_match_method, proposals!inner(id, client_id, clients(state))")
    .not("nomus_product_id", "is", null);
  if (proposalId) q = q.eq("proposal_id", proposalId);
  const { data: pItemsRaw, error: pErr } = await q;
  if (pErr) throw new Error(pErr.message);
  const pItems = (pItemsRaw ?? []).filter(
    (r) => (r as { price_table_match_method?: string | null }).price_table_match_method !== "manual",
  );

  let updated = 0;
  let skipped = 0;
  for (const row of pItems as unknown as Array<{
    id: string;
    nomus_product_id: string;
    unit_price: number | null;
    proposals: { clients: { state: string | null } | null } | null;
  }>) {
    const productId = row.nomus_product_id;
    const tablesForProduct = byProduct.get(productId) ?? [];
    if (tablesForProduct.length === 0) {
      skipped += 1;
      continue;
    }
    const uf = row.proposals?.clients?.state ?? null;
    const sel = selectTableForItem(tablesForProduct, uf, Number(row.unit_price ?? 0));
    if (!sel?.table) {
      skipped += 1;
      continue;
    }
    const c = sel.table.costs ?? null;
    const { error: upErr } = await supabaseAdmin
      .from("proposal_items")
      .update({
        price_table_id: sel.table.id,
        price_table_name: sel.table.name,
        price_table_unit_price: sel.table.unitPrice,
        price_table_match_method: sel.method,
        price_table_selected_at: new Date().toISOString(),
        price_table_custo_materiais: c?.custoMateriais ?? null,
        price_table_custo_mod: c?.custoMod ?? null,
        price_table_custo_cif: c?.custoCif ?? null,
        price_table_custos_adm: c?.custosAdm ?? null,
        price_table_custos_venda: c?.custosVenda ?? null,
        price_table_custo_producao_total: c?.custoProducaoTotal ?? null,
        price_table_preco_calculado: c?.precoCalculado ?? null,
        price_table_preco_liquido: c?.precoLiquido ?? null,
        price_table_margem_desejada_pct: c?.margemDesejadaPct ?? null,
        price_table_lucro_bruto: c?.lucroBruto ?? null,
        price_table_lucro_liquido: c?.lucroLiquido ?? null,
        price_table_margem_contribuicao: c?.margemContribuicao ?? null,
      })
      .eq("id", row.id);
    if (upErr) {
      skipped += 1;
      continue;
    }
    updated += 1;
  }
  return { updated, skipped };
}

export const Route = createFileRoute("/api/public/hooks/sync-price-tables")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
        const allowed = new Set(
          [
            process.env.NOMUS_CRON_SECRET?.trim(),
            process.env.SUPABASE_PUBLISHABLE_KEY?.trim(),
            process.env.SUPABASE_ANON_KEY?.trim(),
          ].filter((v): v is string => Boolean(v)),
        );
        if (!token || !allowed.has(token)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: { syncTables?: boolean; backfill?: boolean; proposalId?: string } = {};
        try { body = await request.json(); } catch { /* empty body ok */ }

        const out: Record<string, unknown> = { ok: true };
        try {
          if (body.syncTables !== false) {
            out.sync = await syncAllPriceTables();
          }
          if (body.backfill !== false) {
            out.backfill = await backfillProposalItems(body.proposalId);
          }
        } catch (e) {
          return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e), partial: out }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify(out), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
  },
});
