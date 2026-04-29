import {
  fetchNomusProductById,
  fetchNomusProductCosts,
  fetchNomusProductPrices,
  fetchNomusProducts,
  fetchNomusProductTaxes,
} from "@/modules/nomus/services";
import {
  mapNomusCostToProductCost,
  mapNomusPriceToCatalogPrice,
  mapNomusProductToCatalogProduct,
  mapNomusProductsToCatalog,
  mapNomusTaxToProductTaxInfo,
} from "@/modules/nomus/mappers";
import type {
  CatalogProduct,
  CatalogProductCost,
  CatalogProductPrice,
  CatalogProductWithDetails,
  ProductTaxInfo,
} from "@/modules/catalog/types";
import { validateCatalogProduct } from "@/modules/catalog/validation";

type CatalogServiceOptions = {
  triggeredBy?: string | null;
  maxItems?: number;
};

export async function getCatalogProducts(
  options: CatalogServiceOptions = {},
): Promise<{ ok: true; products: CatalogProduct[] } | { ok: false; error: string }> {
  const result = await fetchNomusProducts(options);
  if (!result.ok) return result;
  return { ok: true, products: mapNomusProductsToCatalog(result.items) };
}

export async function getCatalogProductById(
  id: string | number,
  options: CatalogServiceOptions = {},
): Promise<{ ok: true; product: CatalogProduct | null } | { ok: false; error: string }> {
  const result = await fetchNomusProductById(id, options);
  if (!result.ok) return result;
  return { ok: true, product: mapNomusProductToCatalogProduct(result.data) };
}

export async function getCatalogProductWithPrices(
  id: string | number,
  options: CatalogServiceOptions = {},
): Promise<{ ok: true; product: CatalogProductWithDetails | null } | { ok: false; error: string }> {
  const productResult = await getCatalogProductById(id, options);
  if (!productResult.ok) return productResult;
  if (!productResult.product) return { ok: true, product: null };

  const [pricesResult, taxesResult] = await Promise.all([
    fetchNomusProductPrices(id, options),
    fetchNomusProductTaxes(id, options),
  ]);

  const prices: CatalogProductPrice[] = pricesResult.ok
    ? pricesResult.items.map(mapNomusPriceToCatalogPrice)
    : [];
  const taxes: ProductTaxInfo[] = taxesResult.ok
    ? taxesResult.items.map(mapNomusTaxToProductTaxInfo)
    : [];

  return {
    ok: true,
    product: {
      ...productResult.product,
      prices,
      taxes,
      validation: validateCatalogProduct({
        product: productResult.product,
        prices,
        taxes,
      }),
    },
  };
}

export async function getCatalogProductWithCosts(
  id: string | number,
  options: CatalogServiceOptions = {},
): Promise<{ ok: true; product: CatalogProductWithDetails | null } | { ok: false; error: string }> {
  const productResult = await getCatalogProductById(id, options);
  if (!productResult.ok) return productResult;
  if (!productResult.product) return { ok: true, product: null };

  const [costsResult, pricesResult, taxesResult] = await Promise.all([
    fetchNomusProductCosts(id, options),
    fetchNomusProductPrices(id, options),
    fetchNomusProductTaxes(id, options),
  ]);

  const costs: CatalogProductCost[] = costsResult.ok
    ? costsResult.items.map(mapNomusCostToProductCost)
    : [];
  const prices = pricesResult.ok ? pricesResult.items.map(mapNomusPriceToCatalogPrice) : [];
  const taxes = taxesResult.ok ? taxesResult.items.map(mapNomusTaxToProductTaxInfo) : [];

  return {
    ok: true,
    product: {
      ...productResult.product,
      costs,
      prices,
      taxes,
      validation: validateCatalogProduct({
        product: productResult.product,
        prices,
        costs,
        taxes,
      }),
    },
  };
}

export async function syncCatalogFromNomus(options: CatalogServiceOptions = {}): Promise<
  | {
      ok: true;
      products: CatalogProduct[];
      warnings: number;
      errors: number;
    }
  | { ok: false; error: string }
> {
  const result = await getCatalogProducts(options);
  if (!result.ok) return result;

  const validations = result.products.map((product) => validateCatalogProduct({ product }));
  return {
    ok: true,
    products: result.products,
    warnings: validations.reduce((sum, item) => sum + item.warnings.length, 0),
    errors: 0,
  };
}
