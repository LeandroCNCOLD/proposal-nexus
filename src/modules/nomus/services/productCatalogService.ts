import { getOne, listAll, nomusFetch, type NomusFetchOptions } from "@/integrations/nomus/client";
import {
  NOMUS_ENDPOINTS,
  priceTableItemsPath,
  productCostCandidatePaths,
  productPricesCandidatePaths,
  productTaxCandidatePaths,
} from "@/modules/nomus/services/endpoints";
import type {
  NomusPriceTableRaw,
  NomusProductCostRaw,
  NomusProductPriceRaw,
  NomusProductRaw,
  NomusProductTaxRaw,
  NomusUnitRaw,
} from "@/modules/nomus/types";

export type NomusServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };
export type NomusListServiceResult<T> = { ok: true; items: T[] } | { ok: false; error: string };

export type NomusCatalogFetchOptions = {
  query?: Record<string, string | number | undefined>;
  triggeredBy?: string | null;
  maxItems?: number;
  timeoutMs?: number;
  maxAttempts?: number;
};

function extractList<T>(payload: unknown): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as T[];
  const env = payload as Record<string, unknown>;
  for (const key of [
    "items",
    "itens",
    "produtos",
    "resultados",
    "data",
    "content",
    "registros",
    "lista",
  ]) {
    const value = env[key];
    if (Array.isArray(value)) return value as T[];
  }
  return [];
}

function toNomusOptions(
  entity: string,
  opts: NomusCatalogFetchOptions = {},
): { entity: string; triggeredBy?: string | null; maxItems?: number } {
  return {
    entity,
    triggeredBy: opts.triggeredBy ?? null,
    maxItems: opts.maxItems,
  };
}

function fetchOptions(
  entity: string,
  operation: string,
  opts: NomusCatalogFetchOptions = {},
): NomusFetchOptions {
  return {
    method: "GET",
    query: opts.query,
    entity,
    operation,
    direction: "pull",
    triggeredBy: opts.triggeredBy ?? null,
    timeoutMs: opts.timeoutMs,
    maxAttempts: opts.maxAttempts,
  };
}

export async function fetchNomusProducts(
  opts: NomusCatalogFetchOptions = {},
): Promise<NomusListServiceResult<NomusProductRaw>> {
  const result = await listAll<NomusProductRaw>(
    NOMUS_ENDPOINTS.produtos,
    opts.query ?? {},
    toNomusOptions("produtos", opts),
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, items: result.items };
}

export async function fetchNomusProductById(
  id: string | number,
  opts: NomusCatalogFetchOptions = {},
): Promise<NomusServiceResult<NomusProductRaw>> {
  const result = await getOne<NomusProductRaw>(NOMUS_ENDPOINTS.produtos, id, {
    entity: "produtos",
    triggeredBy: opts.triggeredBy ?? null,
    timeoutMs: opts.timeoutMs,
    maxAttempts: opts.maxAttempts,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

export async function fetchNomusPriceTables(
  opts: NomusCatalogFetchOptions = {},
): Promise<NomusListServiceResult<NomusPriceTableRaw>> {
  const result = await listAll<NomusPriceTableRaw>(
    NOMUS_ENDPOINTS.tabelas_preco,
    opts.query ?? {},
    toNomusOptions("tabelas_preco", opts),
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, items: result.items };
}

export async function fetchNomusProductPrices(
  productId?: string | number,
  opts: NomusCatalogFetchOptions = {},
): Promise<NomusListServiceResult<NomusProductPriceRaw>> {
  const items: NomusProductPriceRaw[] = [];
  for (const path of productPricesCandidatePaths(productId)) {
    const result = await nomusFetch<unknown>(
      path,
      fetchOptions("tabelas_preco", "list-product-prices", opts),
    );
    if (result.ok) items.push(...extractList<NomusProductPriceRaw>(result.data));
  }

  if (items.length > 0 || productId) return { ok: true, items };

  const tables = await fetchNomusPriceTables(opts);
  if (!tables.ok) return tables as NomusListServiceResult<NomusProductPriceRaw>;
  return {
    ok: true,
    items: tables.items.flatMap((table) => extractList<NomusProductPriceRaw>(table)),
  };
}

export async function fetchNomusProductCosts(
  productId?: string | number,
  opts: NomusCatalogFetchOptions = {},
): Promise<NomusListServiceResult<NomusProductCostRaw>> {
  const candidatePaths = productId
    ? productCostCandidatePaths(productId)
    : [NOMUS_ENDPOINTS.produtos];

  const items: NomusProductCostRaw[] = [];
  for (const path of candidatePaths) {
    const result = await nomusFetch<unknown>(
      path,
      fetchOptions(
        "produtos",
        productId ? "list-product-costs" : "list-products-costs-placeholder",
        opts,
      ),
    );
    if (result.ok) items.push(...extractList<NomusProductCostRaw>(result.data));
  }
  return { ok: true, items };
}

export async function fetchNomusProductTaxes(
  productId?: string | number,
  opts: NomusCatalogFetchOptions = {},
): Promise<NomusListServiceResult<NomusProductTaxRaw>> {
  const candidatePaths = productId
    ? productTaxCandidatePaths(productId)
    : [NOMUS_ENDPOINTS.produtos];
  const items: NomusProductTaxRaw[] = [];
  for (const path of candidatePaths) {
    const result = await nomusFetch<unknown>(
      path,
      fetchOptions(
        "produtos",
        productId ? "list-product-taxes" : "list-products-taxes-placeholder",
        opts,
      ),
    );
    if (result.ok) items.push(...extractList<NomusProductTaxRaw>(result.data));
  }
  return { ok: true, items };
}

export async function fetchNomusUnits(
  opts: NomusCatalogFetchOptions = {},
): Promise<NomusListServiceResult<NomusUnitRaw>> {
  const result = await nomusFetch<unknown>(
    NOMUS_ENDPOINTS.unidades,
    fetchOptions("unidades", "list-units-placeholder", opts),
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, items: extractList<NomusUnitRaw>(result.data) };
}

export async function fetchNomusPriceTableItems(
  priceTableId: string | number,
  opts: NomusCatalogFetchOptions = {},
): Promise<NomusListServiceResult<NomusProductPriceRaw>> {
  const result = await nomusFetch<unknown>(
    priceTableItemsPath(priceTableId),
    fetchOptions("tabelas_preco", "list-price-table-items", opts),
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, items: extractList<NomusProductPriceRaw>(result.data) };
}
