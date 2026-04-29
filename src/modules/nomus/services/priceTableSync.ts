import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getOne, listAll, nomusFetch } from "@/integrations/nomus/client";
import {
  NOMUS_ENDPOINTS,
  priceTableItemsPath,
  productCostCandidatePaths,
} from "@/integrations/nomus/endpoints";
import {
  mapNomusPriceTableItemToDb,
  mapNomusPriceTableToDb,
  mapNomusProductCostToDb,
} from "@/modules/nomus/mappers";
import type {
  NomusPriceTableItemRaw,
  NomusPriceTableRaw,
  NomusProductCostRaw,
  SyncNomusPriceTablesResult,
} from "@/modules/nomus/types";

type Json = Record<string, unknown>;

const ITEM_ARRAY_KEYS = [
  "itens",
  "items",
  "produtos",
  "tabelaPrecoItens",
  "registros",
  "lista",
  "data",
];

function extractList<T>(payload: unknown): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as T[];
  const obj = payload as Json;
  for (const key of ITEM_ARRAY_KEYS) {
    const value = obj[key];
    if (Array.isArray(value)) return value as T[];
  }
  return [];
}

function readProductId(raw: NomusPriceTableItemRaw): string | null {
  const product = raw.produto && typeof raw.produto === "object" ? (raw.produto as Json) : null;
  const value =
    raw.produtoId ??
    raw.idProduto ??
    raw.nomus_product_id ??
    raw.codigoProduto ??
    raw.productCode ??
    product?.id ??
    product?.codigo ??
    null;
  return value === null || value === undefined || value === "" ? null : String(value);
}

async function fetchPriceTableItems(
  tableNomusId: string,
  errors: string[],
): Promise<NomusPriceTableItemRaw[]> {
  const itemPath = priceTableItemsPath(tableNomusId);
  if (!itemPath) {
    errors.push("Endpoint de itens da tabela de preço do Nomus ainda não configurado.");
  } else {
    const itemRes = await nomusFetch<unknown>(itemPath, {
      method: "GET",
      entity: "tabelas_preco",
      operation: "list-items",
      direction: "pull",
      maxAttempts: 1,
    });

    if (itemRes.ok) return extractList<NomusPriceTableItemRaw>(itemRes.data);
    errors.push(
      `Tabela ${tableNomusId}: endpoint de itens falhou (${itemRes.error}); tentando detalhe.`,
    );
  }

  const detailRes = await getOne<NomusPriceTableRaw>(NOMUS_ENDPOINTS.tabelas_preco, tableNomusId, {
    entity: "tabelas_preco",
    maxAttempts: 1,
  });
  if (!detailRes.ok) {
    errors.push(`Tabela ${tableNomusId}: falha ao buscar detalhe (${detailRes.error}).`);
    return [];
  }
  const detailItems = extractList<NomusPriceTableItemRaw>(detailRes.data);
  if (detailItems.length === 0 && !itemPath) {
    errors.push("Endpoint de itens da tabela de preço do Nomus ainda não configurado.");
  }
  return detailItems;
}

async function fetchProductCost(
  productId: string,
  errors: string[],
): Promise<NomusProductCostRaw | null> {
  for (const path of productCostCandidatePaths(productId)) {
    const res = await nomusFetch<unknown>(path, {
      method: "GET",
      entity: "produtos",
      operation: "get-product-cost",
      direction: "pull",
      maxAttempts: 1,
      timeoutMs: 6_000,
    });
    if (!res.ok) continue;
    const list = extractList<NomusProductCostRaw>(res.data);
    if (list[0]) return list[0];
    if (res.data && typeof res.data === "object") return res.data as NomusProductCostRaw;
  }
  errors.push(
    `Produto ${productId}: endpoint de custos do Nomus ainda não configurado ou sem dados.`,
  );
  return null;
}

async function buildEquipmentMap(productIds: string[]) {
  const unique = Array.from(new Set(productIds.filter(Boolean)));
  if (unique.length === 0) return new Map<string, string>();
  const { data, error } = await supabaseAdmin
    .from("equipments")
    .select("id, nomus_id")
    .in("nomus_id", unique);
  if (error) throw new Error(`Falha ao relacionar equipamentos: ${error.message}`);
  return new Map(
    ((data as Array<{ id: string; nomus_id: string | null }> | null) ?? [])
      .filter((row) => row.nomus_id)
      .map((row) => [String(row.nomus_id), row.id]),
  );
}

export async function syncNomusPriceTables(): Promise<SyncNomusPriceTablesResult> {
  const errors: string[] = [];
  const tablesRes = await listAll<NomusPriceTableRaw>(
    NOMUS_ENDPOINTS.tabelas_preco,
    {},
    {
      entity: "tabelas_preco",
      maxItems: 10_000,
    },
  );

  if (!tablesRes.ok) {
    return {
      success: false,
      priceTablesImported: 0,
      itemsImported: 0,
      itemsWithoutPrice: 0,
      itemsWithoutCost: 0,
      errors: [`Endpoint de tabelas de preço do Nomus ainda não configurado: ${tablesRes.error}`],
    };
  }

  let priceTablesImported = 0;
  let itemsImported = 0;
  let itemsWithoutPrice = 0;
  let itemsWithoutCost = 0;

  for (const rawTable of tablesRes.items) {
    const tablePayload = mapNomusPriceTableToDb(rawTable);
    if (!tablePayload) {
      errors.push("Tabela de preço ignorada: payload sem id/código Nomus.");
      continue;
    }
    const tableNomusId = tablePayload.nomus_id;

    const { data: tableRow, error: tableError } = await supabaseAdmin
      .from("nomus_price_tables")
      .upsert(tablePayload as never, { onConflict: "nomus_id" })
      .select("id, nomus_id, name, code, currency")
      .single();
    if (tableError || !tableRow) {
      errors.push(`Tabela ${tableNomusId}: ${tableError?.message ?? "upsert sem retorno"}`);
      continue;
    }
    priceTablesImported += 1;

    const rawItems = await fetchPriceTableItems(tableNomusId, errors);
    const productIds = rawItems.map(readProductId).filter(Boolean) as string[];
    let equipmentMap = new Map<string, string>();
    try {
      equipmentMap = await buildEquipmentMap(productIds);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    for (const rawItem of rawItems) {
      const productId = readProductId(rawItem);
      if (!productId) {
        errors.push(`Tabela ${tableNomusId}: item sem produto/código.`);
        continue;
      }

      const costRaw = await fetchProductCost(productId, errors);
      const costPatch = costRaw ? mapNomusProductCostToDb(costRaw) : {};
      const mappedItem = mapNomusPriceTableItemToDb(rawItem, {
        priceTableId: tableRow.id,
        fallbackCurrency: tableRow.currency,
      });
      if (!mappedItem) {
        errors.push(`Tabela ${tableNomusId}: item sem produto/código.`);
        continue;
      }
      const itemPayload = {
        ...mappedItem,
        has_cost_data:
          mappedItem.has_cost_data ||
          Object.values(costPatch).some(
            (value) => typeof value === "number" && Number.isFinite(value),
          ),
        ...costPatch,
        price_table_id: tableRow.id,
        equipment_id: equipmentMap.get(productId) ?? null,
      };

      if (!itemPayload.unit_price || itemPayload.unit_price <= 0) itemsWithoutPrice += 1;
      if (!itemPayload.has_cost_data) itemsWithoutCost += 1;

      const { data: existingItem, error: existingItemError } = await supabaseAdmin
        .from("nomus_price_table_items")
        .select("id")
        .eq("price_table_id", tableRow.id)
        .eq("nomus_product_id", productId)
        .maybeSingle();
      if (existingItemError) {
        errors.push(`Produto ${productId} / tabela ${tableNomusId}: ${existingItemError.message}`);
        continue;
      }

      const writeQuery = existingItem?.id
        ? supabaseAdmin
            .from("nomus_price_table_items")
            .update(itemPayload as never)
            .eq("id", existingItem.id)
        : supabaseAdmin.from("nomus_price_table_items").insert(itemPayload as never);
      const { error: itemError } = await writeQuery;
      if (itemError) {
        errors.push(`Produto ${productId} / tabela ${tableNomusId}: ${itemError.message}`);
        continue;
      }
      itemsImported += 1;
    }
  }

  return {
    success: errors.length === 0,
    priceTablesImported,
    itemsImported,
    itemsWithoutPrice,
    itemsWithoutCost,
    errors,
  };
}
