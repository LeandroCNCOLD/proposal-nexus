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
