import type {
  CatalogProduct,
  CatalogProductCost,
  CatalogProductPrice,
  CatalogValidationIssue,
  CatalogValidationResult,
  ProductTaxInfo,
} from "@/modules/catalog/types";

export type CatalogValidationCode =
  | "missing_product_code"
  | "missing_price"
  | "missing_cost"
  | "cost_greater_than_price"
  | "expired_price_table"
  | "inactive_product"
  | "missing_tax"
  | "missing_ncm";

export type ValidateCatalogProductInput = {
  product: CatalogProduct;
  prices?: CatalogProductPrice[];
  costs?: CatalogProductCost[];
  taxInfo?: ProductTaxInfo | null;
  taxes?: ProductTaxInfo[];
  referenceDate?: Date;
};

function isExpired(validade: string | null | undefined, referenceDate: Date): boolean {
  if (!validade) return false;
  const value = new Date(validade);
  if (Number.isNaN(value.getTime())) return false;
  return value.getTime() < referenceDate.getTime();
}

function warning(
  code: CatalogValidationCode,
  message: string,
  path?: string,
): CatalogValidationIssue {
  return { code, message, path, severity: "warning" };
}

export function validateCatalogProduct(
  input: ValidateCatalogProductInput,
): CatalogValidationResult {
  const warnings: CatalogValidationIssue[] = [];
  const referenceDate = input.referenceDate ?? new Date();
  const prices = input.prices ?? [];
  const costs = input.costs ?? [];
  const tax = input.taxInfo ?? input.taxes?.[0] ?? null;

  if (!input.product.codigo) {
    warnings.push(warning("missing_product_code", "Produto sem código.", "product.codigo"));
  }

  if (input.product.status && input.product.status !== "ativo") {
    warnings.push(warning("inactive_product", "Produto inativo.", "product.status"));
  }

  if (prices.length === 0 || prices.every((price) => price.precoVenda === null)) {
    warnings.push(warning("missing_price", "Produto sem preço.", "prices"));
  }

  if (costs.length === 0 || costs.every((cost) => cost.custoTotal === null)) {
    warnings.push(warning("missing_cost", "Produto sem custo.", "costs"));
  }

  for (const price of prices) {
    if (isExpired(price.validade, referenceDate)) {
      warnings.push(
        warning(
          "expired_price_table",
          `Tabela de preço vencida${price.tabelaNome ? `: ${price.tabelaNome}` : ""}.`,
          "prices.validade",
        ),
      );
    }
  }

  const firstPrice = prices.find((price) => price.precoVenda !== null);
  const firstCost = costs.find((cost) => cost.custoTotal !== null);
  if (
    firstPrice?.precoVenda !== null &&
    firstPrice?.precoVenda !== undefined &&
    firstCost?.custoTotal !== null &&
    firstCost?.custoTotal !== undefined &&
    firstCost.custoTotal > firstPrice.precoVenda
  ) {
    warnings.push(warning("cost_greater_than_price", "Custo maior que preço.", "costs.custoTotal"));
  }

  if (!tax) {
    warnings.push(warning("missing_tax", "Imposto ausente.", "taxInfo"));
    warnings.push(warning("missing_ncm", "NCM ausente.", "taxInfo.ncm"));
    return { valid: true, warnings };
  }

  if (!tax.ncm) {
    warnings.push(warning("missing_ncm", "NCM ausente.", "taxInfo.ncm"));
  }

  if (tax.icms === null && tax.ipi === null && tax.pis === null && tax.cofins === null) {
    warnings.push(warning("missing_tax", "Imposto ausente.", "taxInfo"));
  }

  return { valid: true, warnings };
}
