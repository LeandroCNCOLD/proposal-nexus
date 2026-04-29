import type {
  CatalogStatus,
  CatalogProduct,
  CatalogProductCost,
  CatalogProductPrice,
  ProductTaxInfo,
} from "@/modules/catalog/types";
import type {
  NomusProductCostRaw,
  NomusProductPriceRaw,
  NomusProductRaw,
  NomusProductTaxRaw,
} from "@/modules/nomus/types";
import { parseNomusNumber, pickDate, pickNum, pickStr } from "./parseHelpers";

type Json = Record<string, unknown>;

function asJson(raw: Json | null | undefined): Json {
  return raw ?? {};
}

export function normalizeProductCode(value: unknown): string | null {
  const raw = value == null ? "" : String(value).trim();
  if (!raw) return null;
  return raw.replace(/\s+/g, "").toUpperCase();
}

export function normalizeUnit(value: unknown): string | null {
  const raw = value == null ? "" : String(value).trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  const aliases: Record<string, string> = {
    UNIDADE: "UN",
    UND: "UN",
    UNID: "UN",
    PECA: "PC",
    PEÇA: "PC",
    QUILOGRAMA: "KG",
  };
  return aliases[upper] ?? upper;
}

export function normalizeCurrency(value: unknown): string {
  const raw = value == null ? "" : String(value).trim().toUpperCase();
  if (!raw || raw === "R$" || raw === "REAL" || raw === "REAIS") return "BRL";
  return raw;
}

function pickBool(source: Json, ...keys: string[]): boolean | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string" && value.trim()) {
      return /^(true|sim|s|ativo|active|1)$/i.test(value.trim());
    }
  }
  return null;
}

function activeStatus(raw: Json): CatalogStatus {
  const explicit = pickStr(raw, "status", "situacao", "situação", "ativo");
  if (explicit) {
    return /^(inativo|inactive|false|0|não|nao)$/i.test(explicit) ? "inativo" : "ativo";
  }
  const active = pickBool(raw, "isActive", "ativo", "active");
  if (active === null) return "desconhecido";
  return active ? "ativo" : "inativo";
}

export function mapNomusProductToCatalogProduct(
  raw: NomusProductRaw | null | undefined,
): CatalogProduct {
  const product = asJson(raw);
  const code = normalizeProductCode(pickStr(product, "codigo", "code", "sku", "idProduto", "id"));
  return {
    id: pickStr(product, "id", "idProduto", "codigo"),
    codigo: code,
    nome: pickStr(product, "nome", "descricao", "description", "modelo") ?? code,
    descricao: pickStr(
      product,
      "descricao",
      "descricaoTecnica",
      "descricaoComercial",
      "observacoes",
    ),
    categoria: pickStr(product, "categoria", "grupo", "familia", "linha"),
    unidade: normalizeUnit(pickStr(product, "unidade", "unidadeMedida", "unidade_medida", "un")),
    status: activeStatus(product),
    origem: "nomus",
    atualizadoEm: pickDate(product, "updatedAt", "dataAlteracao", "dataModificacao"),
    ncm: pickStr(product, "ncm", "NCM", "classificacaoFiscal"),
    cfop: pickStr(product, "cfop", "CFOP"),
    dadosTecnicos: {
      modelo: pickStr(product, "modelo", "codigoModelo"),
      marca: pickStr(product, "marca", "fabricante"),
      rawTechnical: product.dadosTecnicos ?? product.atributos ?? null,
    },
    raw,
  };
}

export function mapNomusProductsToCatalog(
  rawProducts: NomusProductRaw[] | null | undefined,
): CatalogProduct[] {
  return (rawProducts ?? []).map(mapNomusProductToCatalogProduct);
}

export function mapNomusPriceToCatalogPrice(
  raw: NomusProductPriceRaw | null | undefined,
): CatalogProductPrice {
  const price = asJson(raw);
  const product =
    price.produto && typeof price.produto === "object" ? (price.produto as Json) : null;
  const table =
    price.tabelaPreco && typeof price.tabelaPreco === "object" ? (price.tabelaPreco as Json) : null;
  return {
    produtoId:
      pickStr(price, "produtoId", "idProduto", "nomus_product_id") ??
      (product ? pickStr(product, "id", "codigo") : null),
    tabelaId:
      pickStr(price, "tabelaId", "idTabelaPreco", "price_table_id") ??
      (table ? pickStr(table, "id", "codigo") : null),
    tabelaNome:
      pickStr(price, "tabelaNome", "nomeTabelaPreco", "price_table_name") ??
      (table ? pickStr(table, "nome", "descricao") : null),
    precoVenda: pickNum(price, "precoVenda", "preco", "valor", "unit_price", "precoUnitario"),
    moeda: normalizeCurrency(pickStr(price, "moeda", "currency")),
    validade: pickDate(price, "validade", "valid_until", "dataValidade"),
    status: activeStatus(price),
    raw,
  };
}

export function mapNomusCostToProductCost(
  raw: NomusProductCostRaw | null | undefined,
): CatalogProductCost {
  const cost = asJson(raw);
  const material = pickNum(
    cost,
    "custoMaterial",
    "custoMateriais",
    "custo_materiais",
    "material_cost",
  );
  const labor = pickNum(cost, "custoMaoObra", "custoMOD", "custo_mod", "labor_cost");
  const thirdParty = pickNum(cost, "custoTerceiros", "custoTerceirizacao", "third_party_cost");
  const explicitTotal = pickNum(
    cost,
    "custoTotal",
    "custoProducaoTotal",
    "custoUnitario",
    "custoMedio",
  );
  const calculatedTotal =
    explicitTotal ??
    [material, labor, thirdParty].reduce<number | null>((sum, value) => {
      if (value == null) return sum;
      return (sum ?? 0) + value;
    }, null);

  return {
    produtoId: pickStr(cost, "produtoId", "idProduto", "nomus_product_id"),
    custoMaterial: material,
    custoMaoObra: labor,
    custoTerceiros: thirdParty,
    custoTotal: calculatedTotal,
    dataReferencia: pickDate(cost, "dataReferencia", "dataBase", "updated_at"),
    fonte: pickStr(cost, "fonte", "source") ?? "nomus",
    raw,
  };
}

export function mapNomusTaxToProductTaxInfo(
  raw: NomusProductTaxRaw | null | undefined,
): ProductTaxInfo {
  const tax = asJson(raw);
  return {
    produtoId: pickStr(tax, "produtoId", "idProduto", "nomus_product_id", "codigoProduto"),
    ncm: pickStr(tax, "ncm", "NCM", "classificacaoFiscal"),
    cfop: pickStr(tax, "cfop", "CFOP"),
    icms: pickNum(tax, "icms", "aliquotaIcms", "valorIcms"),
    ipi: pickNum(tax, "ipi", "aliquotaIpi", "valorIpi"),
    pis: pickNum(tax, "pis", "aliquotaPis", "valorPis"),
    cofins: pickNum(tax, "cofins", "aliquotaCofins", "valorCofins"),
    raw,
  };
}
