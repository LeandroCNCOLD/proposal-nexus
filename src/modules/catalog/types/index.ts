export type CatalogDataOrigin = "nomus" | "manual" | "coldpro" | "unknown";

export type CatalogStatus = "ativo" | "inativo" | "desconhecido";

export interface CatalogProduct {
  id: string | null;
  codigo: string | null;
  nome: string | null;
  descricao: string | null;
  categoria: string | null;
  unidade: string | null;
  status: CatalogStatus;
  origem: CatalogDataOrigin;
  atualizadoEm: string | null;
  ncm?: string | null;
  cfop?: string | null;
  dadosTecnicos?: Record<string, unknown>;
  raw?: unknown;
}

export interface CatalogProductPrice {
  produtoId: string | null;
  tabelaId: string | null;
  tabelaNome: string | null;
  precoVenda: number | null;
  moeda: string | null;
  validade: string | null;
  status: CatalogStatus;
  raw?: unknown;
}

export interface ProductPriceTable {
  id: string | null;
  nome: string | null;
  codigo: string | null;
  moeda: string | null;
  validade: string | null;
  status: CatalogStatus;
  raw?: unknown;
}

export interface CatalogProductCost {
  produtoId: string | null;
  custoMaterial: number | null;
  custoMaoObra: number | null;
  custoTerceiros: number | null;
  custoTotal: number | null;
  dataReferencia: string | null;
  fonte: string | null;
  raw?: unknown;
}

export interface ProductCostSummary extends CatalogProductCost {
  hasCost: boolean;
}

export interface ProductTaxInfo {
  produtoId: string | null;
  ncm: string | null;
  cfop: string | null;
  icms: number | null;
  ipi: number | null;
  pis: number | null;
  cofins: number | null;
  raw?: unknown;
}

export interface CatalogProductDetails {
  product: CatalogProduct;
  prices: CatalogProductPrice[];
  costs: CatalogProductCost[];
  taxes: ProductTaxInfo[];
  validation?: CatalogValidationResult;
}

export type CatalogProductWithDetails = CatalogProduct & {
  prices?: CatalogProductPrice[];
  costs?: CatalogProductCost[];
  taxes?: ProductTaxInfo[];
  validation?: CatalogValidationResult;
};

export interface CatalogValidationIssue {
  code: string;
  message: string;
  severity: "warning";
  path?: string;
}

export interface CatalogValidationResult {
  valid: boolean;
  warnings: CatalogValidationIssue[];
}
