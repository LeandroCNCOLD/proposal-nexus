import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { listAll, nomusFetch } from "@/integrations/nomus/client";
import { NOMUS_ENDPOINTS, priceTableItemsPath } from "@/integrations/nomus/endpoints";
import {
  extractNomusList,
  mapNomusPriceTableItemToDb,
  mapNomusPriceTableToDb,
} from "@/modules/nomus/mappers";
import type {
  NomusPriceTableItemRaw,
  NomusPriceTableRaw,
  SyncNomusPriceTablesResult,
} from "@/modules/nomus/types";

type Json = Record<string, unknown>;

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

function isAuthError(message: string): boolean {
  return /401|autentica|auth|token|chave/i.test(message);
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

export async function fetchNomusPriceTables(): Promise<
  { ok: true; items: NomusPriceTableRaw[] } | { ok: false; error: string }
> {
  const result = await listAll<NomusPriceTableRaw>(
    NOMUS_ENDPOINTS.tabelas_preco,
    {},
    {
      entity: "tabelas_preco",
      maxItems: 10_000,
    },
  );
  if (!result.ok) {
    return {
      ok: false,
      error: isAuthError(result.error) ? "Erro de autenticação com Nomus" : result.error,
    };
  }
  return { ok: true, items: result.items };
}

export async function fetchNomusPriceTableItems(
  tableId: string | number,
): Promise<{ ok: true; items: NomusPriceTableItemRaw[] } | { ok: false; error: string }> {
  const result = await nomusFetch<unknown>(priceTableItemsPath(tableId), {
    method: "GET",
    entity: "tabelas_preco",
    operation: "list-items",
    direction: "pull",
    maxAttempts: 1,
  });
  if (!result.ok) {
    return {
      ok: false,
      error: isAuthError(result.error)
        ? "Erro de autenticação com Nomus"
        : `Erro ao buscar itens da tabela ${tableId}`,
    };
  }
  return { ok: true, items: extractNomusList<NomusPriceTableItemRaw>(result.data) };
}

export async function syncNomusPriceTables(): Promise<SyncNomusPriceTablesResult> {
  const errors: string[] = [];
  const tablesResult = await fetchNomusPriceTables();

  if (!tablesResult.ok) {
    return {
      success: false,
      tables: 0,
      items: 0,
      errors: [tablesResult.error],
    };
  }

  let tables = 0;
  let items = 0;

  for (const rawTable of tablesResult.items) {
    const tablePayload = mapNomusPriceTableToDb(rawTable);
    if (!tablePayload) {
      errors.push("Tabela de preço ignorada: payload sem id/código Nomus.");
      continue;
    }

    const { data: tableRow, error: tableError } = await supabaseAdmin
      .from("nomus_price_tables")
      .upsert(tablePayload as never, { onConflict: "nomus_id" })
      .select("id, nomus_id, name, code, currency")
      .single();
    if (tableError || !tableRow) {
      errors.push(
        `Tabela ${tablePayload.nomus_id}: ${tableError?.message ?? "upsert sem retorno"}`,
      );
      continue;
    }
    tables += 1;

    const itemsResult = await fetchNomusPriceTableItems(tablePayload.nomus_id);
    if (!itemsResult.ok) {
      errors.push(itemsResult.error);
      continue;
    }

    const productIds = itemsResult.items.map(readProductId).filter(Boolean) as string[];
    let equipmentMap = new Map<string, string>();
    try {
      equipmentMap = await buildEquipmentMap(productIds);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    for (const rawItem of itemsResult.items) {
      const productId = readProductId(rawItem);
      if (!productId) {
        errors.push(`Tabela ${tablePayload.nomus_id}: item sem produto/código.`);
        continue;
      }

      const mappedItem = mapNomusPriceTableItemToDb(rawItem, {
        priceTableId: tableRow.id,
        fallbackCurrency: tableRow.currency,
      });
      if (!mappedItem) {
        errors.push(`Tabela ${tablePayload.nomus_id}: item sem produto/código.`);
        continue;
      }

      const itemPayload = {
        ...mappedItem,
        price_table_id: tableRow.id,
        equipment_id: equipmentMap.get(productId) ?? null,
      };

      const { data: existingItem, error: existingItemError } = await supabaseAdmin
        .from("nomus_price_table_items")
        .select("id")
        .eq("price_table_id", tableRow.id)
        .eq("nomus_product_id", productId)
        .maybeSingle();
      if (existingItemError) {
        errors.push(
          `Produto ${productId} / tabela ${tablePayload.nomus_id}: ${existingItemError.message}`,
        );
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
        errors.push(`Produto ${productId} / tabela ${tablePayload.nomus_id}: ${itemError.message}`);
        continue;
      }
      items += 1;
    }
  }

  if (tables === 0 && items === 0) {
    return {
      success: false,
      tables,
      items,
      errors: errors.length > 0 ? errors : ["Nenhuma tabela de preço foi retornada pelo Nomus."],
    };
  }

  return {
    success: errors.length === 0,
    tables,
    items,
    errors,
  };
}
