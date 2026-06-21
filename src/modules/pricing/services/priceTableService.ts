import { getOne, listAll, nomusFetch } from "@/integrations/nomus/client";
import { NOMUS_ENDPOINTS } from "@/integrations/nomus/endpoints";
import {
  mapNomusPriceItemsToInternal,
  mapNomusPriceTableToInternal,
} from "@/modules/pricing/mappers";
import type {
  NomusPriceTableItemRaw,
  NomusPriceTableRaw,
  PriceTable,
  PriceTableItem,
  PriceTableSummary,
} from "@/modules/pricing/types";

type PricingServiceOptions = {
  triggeredBy?: string | null;
  maxItems?: number;
  query?: Record<string, string | number | undefined>;
};

type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };
type ListResult<T> = { ok: true; items: T[] } | { ok: false; error: string };

const PRICE_TABLE_ITEMS_KEYS = [
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
  const object = payload as Record<string, unknown>;
  for (const key of PRICE_TABLE_ITEMS_KEYS) {
    const value = object[key];
    if (Array.isArray(value)) return value as T[];
  }
  return [];
}

function priceTableItemsPath(id: string | number): string {
  return `${NOMUS_ENDPOINTS.tabelas_preco}/${encodeURIComponent(String(id))}/itens`;
}

export async function fetchNomusPriceTables(
  options: PricingServiceOptions = {},
): Promise<ListResult<PriceTable>> {
  const result = await listAll<NomusPriceTableRaw>(
    NOMUS_ENDPOINTS.tabelas_preco,
    options.query ?? {},
    {
      entity: "tabelas_preco",
      triggeredBy: options.triggeredBy ?? null,
      maxItems: options.maxItems,
    },
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, items: result.items.map(mapNomusPriceTableToInternal) };
}

export async function fetchNomusPriceTableById(
  id: string | number,
  options: PricingServiceOptions = {},
): Promise<ServiceResult<PriceTable>> {
  const result = await getOne<NomusPriceTableRaw>(NOMUS_ENDPOINTS.tabelas_preco, id, {
    entity: "tabelas_preco",
    triggeredBy: options.triggeredBy ?? null,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: mapNomusPriceTableToInternal(result.data) };
}

export async function fetchNomusPriceTableItems(
  id: string | number,
  options: PricingServiceOptions = {},
): Promise<ListResult<PriceTableItem>> {
  const result = await nomusFetch<unknown>(priceTableItemsPath(id), {
    method: "GET",
    query: options.query,
    entity: "tabelas_preco",
    operation: "list-items",
    direction: "pull",
    triggeredBy: options.triggeredBy ?? null,
  });

  if (!result.ok) {
    // Fallback: algumas instalações retornam os itens dentro do detalhe da tabela.
    const table = await getOne<NomusPriceTableRaw>(NOMUS_ENDPOINTS.tabelas_preco, id, {
      entity: "tabelas_preco",
      triggeredBy: options.triggeredBy ?? null,
    });
    if (!table.ok) return { ok: false, error: result.error };
    return {
      ok: true,
      items: mapNomusPriceItemsToInternal(extractList<NomusPriceTableItemRaw>(table.data), {
        id: String(id),
        nome: table.data.nome ?? table.data.descricao ?? table.data.name ?? null,
        moeda: table.data.moeda ?? table.data.currency ?? null,
      }),
    };
  }

  return {
    ok: true,
    items: mapNomusPriceItemsToInternal(extractList<NomusPriceTableItemRaw>(result.data), {
      id: String(id),
      nome: null,
      moeda: null,
    }),
  };
}

export async function syncPriceTablesFromNomus(
  options: PricingServiceOptions = {},
): Promise<ServiceResult<PriceTableSummary>> {
  const tables = await fetchNomusPriceTables(options);
  if (!tables.ok) return { ok: false, error: tables.error };

  let totalItens = 0;
  let itensSemPreco = 0;
  let itensSemCusto = 0;

  for (const table of tables.items) {
    if (!table.id) continue;
    const items = await fetchNomusPriceTableItems(table.id, options);
    if (!items.ok) continue;
    totalItens += items.items.length;
    itensSemPreco += items.items.filter((item) => item.precoVenda === null).length;
    itensSemCusto += items.items.filter((item) => item.custo === null).length;
  }

  return {
    ok: true,
    data: {
      totalTabelas: tables.items.length,
      totalItems: totalItens,
      tabelasAtivas: tables.items.filter((table) => table.status === "ativo").length,
      itemsWithoutPrice: itensSemPreco,
      itemsWithoutCost: itensSemCusto,
      inactiveItems: 0,
      lastSyncedAt: new Date().toISOString(),
    },
  };
}
