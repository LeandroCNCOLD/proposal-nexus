import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EQUIPMENT_TABLE_PREFIX = "Tabela de Equipamentos vendas";

/**
 * Lista as tabelas de preço de equipamentos (somente as cujo nome começa com
 * "Tabela de Equipamentos vendas") ativas. Retorna também o ICMS (parseado do
 * nome) para permitir o default "maior imposto da UF".
 */
export const listEquipmentPriceTables = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("nomus_price_tables")
      .select("id, name, ufs, is_active, currency")
      .eq("is_active", true)
      .ilike("name", `${EQUIPMENT_TABLE_PREFIX}%`)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((t) => ({
      id: t.id as string,
      name: t.name as string,
      ufs: (t.ufs as string[] | null) ?? [],
      currency: (t.currency as string | null) ?? "BRL",
      icmsPct: parseIcmsFromName(t.name as string),
    }));
  });

/**
 * Retorna os preços de uma tabela de preço para um conjunto de produtos.
 * Faz match por nomus_product_id (chave primária do produto no Nomus).
 */
export const getPriceTableItemsForProducts = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        priceTableId: z.string().uuid(),
        nomusProductIds: z.array(z.string()).max(500),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    if (data.nomusProductIds.length === 0) return { items: [] as Array<{ nomusProductId: string; unitPrice: number | null; precoLiquido: number | null }> };
    const { data: rows, error } = await supabase
      .from("nomus_price_table_items")
      .select("nomus_product_id, unit_price, preco_liquido")
      .eq("price_table_id", data.priceTableId)
      .in("nomus_product_id", data.nomusProductIds);
    if (error) throw new Error(error.message);
    return {
      items: (rows ?? []).map((r) => ({
        nomusProductId: r.nomus_product_id as string,
        unitPrice: r.unit_price as number | null,
        precoLiquido: r.preco_liquido as number | null,
      })),
    };
  });

/**
 * Lista, para um conjunto de produtos Nomus, todas as tabelas de preço ativas
 * em que cada produto aparece. Retorna a lista achatada — o cliente agrupa
 * por `nomusProductId`. Inclui o `unitPrice` daquele produto naquela tabela.
 */
export const listPriceTablesForProducts = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        nomusProductIds: z.array(z.string()).max(500),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    if (data.nomusProductIds.length === 0) return { rows: [] as Array<{ nomusProductId: string; priceTableId: string; name: string; ufs: string[]; isActive: boolean; currency: string; syncedAt: string | null; unitPrice: number | null; icmsPct: number | null }> };
    const { data: rows, error } = await supabase
      .from("nomus_price_table_items")
      .select(
        "nomus_product_id, unit_price, price_table_id, nomus_price_tables!inner(id, name, ufs, is_active, currency, synced_at)",
      )
      .in("nomus_product_id", data.nomusProductIds)
      .eq("nomus_price_tables.is_active", true);
    if (error) throw new Error(error.message);
    type Row = {
      nomus_product_id: string;
      unit_price: number | null;
      price_table_id: string;
      nomus_price_tables: {
        id: string;
        name: string;
        ufs: string[] | null;
        is_active: boolean;
        currency: string | null;
        synced_at: string | null;
      };
    };
    return {
      rows: ((rows ?? []) as unknown as Row[]).map((r) => ({
        nomusProductId: r.nomus_product_id,
        priceTableId: r.price_table_id,
        name: r.nomus_price_tables.name,
        ufs: r.nomus_price_tables.ufs ?? [],
        isActive: r.nomus_price_tables.is_active,
        currency: r.nomus_price_tables.currency ?? "BRL",
        syncedAt: r.nomus_price_tables.synced_at,
        unitPrice: r.unit_price,
        icmsPct: parseIcmsFromName(r.nomus_price_tables.name),
      })),
    };
  });

/**
 * Salva a tabela de preço escolhida para um item específico da proposta.
 * Atualiza price_table_id, nome, snapshot do preço e o método (auto ou manual).
 */
export const setProposalItemPriceTable = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        proposalItemId: z.string().uuid(),
        proposalId: z.string().uuid(),
        nomusItemId: z.string().nullable(),
        description: z.string(),
        quantity: z.number(),
        itemUnitPrice: z.number(),
        position: z.number().nullable(),
        priceTableId: z.string().uuid().nullable(),
        priceTableName: z.string().nullable(),
        priceTableUnitPrice: z.number().nullable(),
        matchMethod: z.enum([
          "auto_uf_max_icms",
          "auto_max_icms",
          "auto_uf_min_icms",
          "auto_min_icms",
          "auto_uf_closest_price",
          "auto_closest_price",
          "auto_latest",
          "manual",
        ]),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const selectedAt = new Date().toISOString();
    const pricePayload = {
      price_table_id: data.priceTableId,
      price_table_name: data.priceTableName,
      price_table_unit_price: data.priceTableUnitPrice,
      price_table_match_method: data.matchMethod,
      price_table_selected_at: selectedAt,
    };
    const { error } = data.nomusItemId
      ? await supabase.from("proposal_items").upsert(
          {
            proposal_id: data.proposalId,
            nomus_item_id: data.nomusItemId,
            description: data.description || "Item da proposta",
            quantity: data.quantity,
            unit_price: data.itemUnitPrice,
            position: data.position,
            ...pricePayload,
          },
          { onConflict: "proposal_id,nomus_item_id" },
        )
      : await supabase
          .from("proposal_items")
          .update(pricePayload)
          .eq("id", data.proposalItemId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Salva a escolha do usuário (price_table_id + nome) na proposta local.
 */
export const setProposalPriceTable = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        proposalId: z.string().uuid(),
        priceTableId: z.string().uuid().nullable(),
        priceTableName: z.string().nullable(),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("proposals")
      .update({
        price_table_id: data.priceTableId,
        nomus_price_table_name: data.priceTableName,
      })
      .eq("id", data.proposalId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Extrai o percentual de ICMS do nome da tabela.
 * Ex.: "Tabela de Equipamentos vendas ICMS 12" → 12
 *      "Tabela de Equipamentos vendas ICMS 8.8" → 8.8
 */
function parseIcmsFromName(name: string): number | null {
  const m = name.match(/ICMS\s*([0-9]+(?:[.,][0-9]+)?)/i);
  if (!m) return null;
  return Number(m[1].replace(",", "."));
}
