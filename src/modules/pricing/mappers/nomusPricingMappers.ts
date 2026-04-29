import type {
  NomusPriceTableItemRaw,
  NomusPriceTableRaw,
  PriceTable,
  PriceTableItem,
  PriceTableStatus,
} from "@/modules/pricing/types";

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

function parseDate(value: unknown): string | null {
  const raw = value === null || value === undefined ? "" : String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return raw;
}

function normalizeCurrency(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value).trim().toUpperCase();
  if (!raw || raw === "R$" || raw === "REAL" || raw === "REAIS") return "BRL";
  return raw;
}

function normalizeCode(value: unknown): string | null {
  const raw = value === null || value === undefined ? "" : String(value).trim();
  return raw ? raw.replace(/\s+/g, "").toUpperCase() : null;
}

function normalizeStatus(source: Json): PriceTableStatus {
  const boolValue = source.ativo ?? source.active ?? source.is_active;
  if (typeof boolValue === "boolean") return boolValue ? "ativo" : "inativo";
  if (typeof boolValue === "number") return boolValue === 0 ? "inativo" : "ativo";

  const raw = pickStr(source, "status", "situacao", "situação", "ativo", "active", "is_active");
  if (!raw) return "desconhecido";
  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (["ativo", "active", "true", "sim", "1"].includes(normalized)) return "ativo";
  if (["inativo", "inactive", "false", "nao", "não", "0"].includes(normalized)) return "inativo";
  return "desconhecido";
}

export function calculateMargin(
  preco: number | null | undefined,
  custo: number | null | undefined,
): number | null {
  if (preco == null || custo == null || preco <= 0) return null;
  return ((preco - custo) / preco) * 100;
}

export function detectMissingPrice(item: Pick<PriceTableItem, "precoVenda">): boolean {
  return item.precoVenda == null;
}

export function detectMissingCost(item: Pick<PriceTableItem, "custo">): boolean {
  return item.custo == null;
}

export function validatePriceItem(item: PriceTableItem): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  if (detectMissingPrice(item)) warnings.push("Preço de venda ausente.");
  if (detectMissingCost(item)) warnings.push("Custo ausente.");
  return { valid: warnings.length === 0, warnings };
}

function firstObject(source: Json, ...keys: string[]): Json | null {
  for (const key of keys) {
    const value = source[key];
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Json;
  }
  return null;
}

function pickTaxInfo(source: Json): PriceTableItem["impostos"] {
  const tax = firstObject(source, "impostos", "tributos", "fiscal") ?? source;
  const icms = pickNum(tax, "icms", "aliquotaIcms", "valorIcms");
  const ipi = pickNum(tax, "ipi", "aliquotaIpi", "valorIpi");
  const pis = pickNum(tax, "pis", "aliquotaPis", "valorPis");
  const cofins = pickNum(tax, "cofins", "aliquotaCofins", "valorCofins");
  if (icms === null && ipi === null && pis === null && cofins === null) return null;
  return { icms, ipi, pis, cofins };
}

export function mapNomusPriceTableToInternal(raw: NomusPriceTableRaw): PriceTable {
  const table = asJson(raw);
  return {
    id: pickStr(table, "id", "codigo", "nomus_id"),
    nome: pickStr(table, "nome", "descricao", "name"),
    codigo: normalizeCode(pickStr(table, "codigo", "code")),
    status: normalizeStatus(table),
    dataAtualizacao: parseDate(
      pickStr(table, "updated_at", "updatedAt", "dataAlteracao", "dataModificacao"),
    ),
    moeda: normalizeCurrency(pickStr(table, "moeda", "currency")),
    origem: "nomus",
    raw,
  };
}

export function mapNomusPriceItemToInternal(
  raw: NomusPriceTableItemRaw,
  table?: Pick<PriceTable, "id" | "nome" | "moeda"> | null,
): PriceTableItem {
  const item = asJson(raw);
  const product = firstObject(item, "produto", "product");
  const precoVenda = pickNum(
    item,
    "precoVenda",
    "preco",
    "valor",
    "preco_liquido",
    "unit_price",
    "precoUnitario",
  );
  const custo = pickNum(
    item,
    "custo",
    "custoTotal",
    "custoProducaoTotal",
    "custo_producao_total",
    "custoUnitario",
    "custoMedio",
  );
  const rawMargin = pickNum(
    item,
    "margem",
    "margem_contribuicao",
    "margemDesejadaPct",
    "margem_desejada_pct",
  );

  return {
    produtoId:
      pickStr(item, "produtoId", "idProduto", "nomus_product_id") ??
      (product ? pickStr(product, "id", "codigo") : null),
    codigoProduto:
      normalizeCode(pickStr(item, "codigoProduto", "product_code")) ??
      (product ? normalizeCode(pickStr(product, "codigo", "code")) : null),
    nomeProduto:
      pickStr(item, "nomeProduto", "descricao", "description") ??
      (product ? pickStr(product, "nome", "descricao") : null),
    precoVenda,
    custo,
    margem: rawMargin ?? calculateMargin(precoVenda, custo),
    tabelaId: pickStr(item, "tabelaId", "idTabelaPreco", "price_table_id") ?? table?.id ?? null,
    tabelaNome:
      pickStr(item, "tabelaNome", "nomeTabelaPreco", "price_table_name") ?? table?.nome ?? null,
    moeda: normalizeCurrency(pickStr(item, "moeda", "currency") ?? table?.moeda),
    status: normalizeStatus(item),
    impostos: pickTaxInfo(item),
    raw,
  };
}

export function mapNomusPriceItemsToInternal(
  rawItems: NomusPriceTableItemRaw[] | null | undefined,
  table?: Pick<PriceTable, "id" | "nome" | "moeda"> | null,
): PriceTableItem[] {
  return (rawItems ?? []).map((item) => mapNomusPriceItemToInternal(item, table));
}
