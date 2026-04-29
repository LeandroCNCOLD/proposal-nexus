import type {
  NomusPriceTableItemRaw,
  NomusPriceTableRaw,
  NomusProductCostRaw,
} from "@/modules/nomus/types/priceTables";

type Json = Record<string, unknown>;

function asJson(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
}

function pickStr(source: Json, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (value !== null && value !== undefined && value !== "") return String(value).trim();
  }
  return null;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value).trim();
  if (!raw) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function pickNum(source: Json, ...keys: string[]): number | null {
  for (const key of keys) {
    const parsed = parseNumber(source[key]);
    if (parsed !== null) return parsed;
  }
  return null;
}

function pickBool(source: Json, ...keys: string[]): boolean | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string" && value.trim()) {
      return /^(true|sim|s|1|ativo|active)$/i.test(value.trim());
    }
  }
  return null;
}

function normalizeCurrency(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value).trim().toUpperCase();
  if (!raw || raw === "R$" || raw === "REAL" || raw === "REAIS") return "BRL";
  return raw;
}

function calculateMargin(price: number | null, cost: number | null): number | null {
  if (price === null || cost === null || price <= 0) return null;
  return ((price - cost) / price) * 100;
}

function firstObject(source: Json, ...keys: string[]): Json | null {
  for (const key of keys) {
    const value = source[key];
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Json;
  }
  return null;
}

export function extractNomusList<T>(payload: unknown): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as T[];
  const source = payload as Json;
  for (const key of [
    "itens",
    "items",
    "produtos",
    "tabelaPrecoItens",
    "registros",
    "lista",
    "data",
    "content",
  ]) {
    const value = source[key];
    if (Array.isArray(value)) return value as T[];
  }
  return [];
}

export function mapNomusPriceTableToDb(raw: NomusPriceTableRaw) {
  const table = asJson(raw);
  const nomusId = pickStr(table, "id", "idTabelaPreco", "codigo", "code");
  if (!nomusId) return null;

  return {
    nomus_id: nomusId,
    name: pickStr(table, "nome", "descricao", "name") ?? `Tabela ${nomusId}`,
    code: pickStr(table, "codigo", "code"),
    currency: normalizeCurrency(pickStr(table, "moeda", "currency")),
    is_active: pickBool(table, "ativo", "active", "is_active") ?? true,
    raw: raw as never,
    synced_at: new Date().toISOString(),
  };
}

export function mapNomusProductCostToDb(raw: NomusProductCostRaw) {
  const cost = asJson(raw);
  return {
    custo_materiais: pickNum(cost, "custo_materiais", "custoMateriais", "custoMaterial"),
    custo_mod: pickNum(cost, "custo_mod", "custoMOD", "custoMod", "custoMaoObra"),
    custo_cif: pickNum(cost, "custo_cif", "custoCIF", "custoCif"),
    custos_adm: pickNum(cost, "custos_adm", "custosAdm", "custoAdministrativo"),
    custos_venda: pickNum(cost, "custos_venda", "custosVenda"),
    custo_producao_total: pickNum(
      cost,
      "custo_producao_total",
      "custoProducaoTotal",
      "custoTotal",
      "custoUnitario",
      "custoMedio",
    ),
  };
}

export function mapNomusPriceTableItemToDb(
  raw: NomusPriceTableItemRaw,
  args: {
    priceTableId: string;
    equipmentId?: string | null;
    fallbackCurrency?: string | null;
  },
) {
  const item = asJson(raw);
  const product = firstObject(item, "produto", "product");
  const productId =
    pickStr(item, "nomus_product_id", "produtoId", "idProduto", "codigoProduto", "productCode") ??
    (product ? pickStr(product, "id", "codigo", "codigoProduto") : null);
  if (!productId) return null;

  const cost = mapNomusProductCostToDb(raw);
  const unitPrice =
    pickNum(item, "unit_price", "precoVenda", "preco", "valor", "valorUnitario", "precoUnitario") ??
    0;
  const precoLiquido = pickNum(
    item,
    "preco_liquido",
    "precoLiquido",
    "precoCalculado",
    "preco_calculado",
  );
  const custoTotal = cost.custo_producao_total;
  const margem =
    pickNum(item, "margem_contribuicao", "margemContribuicao", "margem", "margemDesejadaPct") ??
    calculateMargin(precoLiquido ?? unitPrice, custoTotal);
  const hasCostData = Object.values(cost).some(
    (value) => typeof value === "number" && Number.isFinite(value),
  );

  return {
    price_table_id: args.priceTableId,
    nomus_product_id: productId,
    equipment_id: args.equipmentId ?? null,
    unit_price: unitPrice,
    currency: normalizeCurrency(pickStr(item, "currency", "moeda") ?? args.fallbackCurrency),
    ...cost,
    has_cost_data: hasCostData,
    preco_calculado: pickNum(item, "preco_calculado", "precoCalculado"),
    preco_liquido: precoLiquido,
    margem_desejada_pct: pickNum(item, "margem_desejada_pct", "margemDesejadaPct"),
    margem_contribuicao: margem,
    lucro_bruto: pickNum(item, "lucro_bruto", "lucroBruto"),
    lucro_liquido: pickNum(item, "lucro_liquido", "lucroLiquido"),
    unidade_medida: pickStr(item, "unidade_medida", "unidadeMedida", "unidade"),
    import_source: "nomus",
    raw: raw as never,
    synced_at: new Date().toISOString(),
  };
}
