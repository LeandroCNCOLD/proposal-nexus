export type PricingOrigin = "nomus";

export type PriceTableStatus = "ativo" | "inativo" | "desconhecido";

export type PricingJson = Record<string, unknown>;

export type PriceTableTaxes = {
  icms: number | null;
  ipi: number | null;
  pis: number | null;
  cofins: number | null;
  raw?: unknown;
};

export interface PriceTable {
  id: string | null;
  nome: string | null;
  codigo: string | null;
  status: PriceTableStatus;
  dataAtualizacao: string | null;
  moeda: string | null;
  origem: PricingOrigin;
  raw?: unknown;
}

export interface PriceTableItem {
  produtoId: string | null;
  codigoProduto: string | null;
  nomeProduto: string | null;
  precoVenda: number | null;
  custo: number | null;
  margem: number | null;
  tabelaId: string | null;
  tabelaNome: string | null;
  moeda: string | null;
  status: PriceTableStatus;
  impostos?: PriceTableTaxes | null;
  raw?: unknown;
}

export interface PriceTableSummary {
  totalTabelas: number;
  totalItems: number;
  tabelasAtivas: number;
  itemsWithoutPrice: number;
  itemsWithoutCost: number;
  inactiveItems: number;
  lastSyncedAt: string;
}

export type NomusPriceTableRaw = PricingJson & {
  id?: string | number | null;
  codigo?: string | number | null;
  code?: string | number | null;
  nome?: string | null;
  descricao?: string | null;
  name?: string | null;
  moeda?: string | null;
  currency?: string | null;
  ativo?: boolean | string | number | null;
  active?: boolean | string | number | null;
  status?: string | null;
  situacao?: string | null;
  dataAlteracao?: string | null;
  dataAtualizacao?: string | null;
  updated_at?: string | null;
  updatedAt?: string | null;
  itens?: NomusPriceTableItemRaw[] | null;
  items?: NomusPriceTableItemRaw[] | null;
  produtos?: NomusPriceTableItemRaw[] | null;
  tabelaPrecoItens?: NomusPriceTableItemRaw[] | null;
  registros?: NomusPriceTableItemRaw[] | null;
  lista?: NomusPriceTableItemRaw[] | null;
};

export type NomusPriceTableItemRaw = PricingJson & {
  produto?: PricingJson | null;
  produtoId?: string | number | null;
  idProduto?: string | number | null;
  nomus_product_id?: string | number | null;
  codigoProduto?: string | number | null;
  productCode?: string | number | null;
  descricaoProduto?: string | null;
  nomeProduto?: string | null;
  descricao?: string | null;
  nome?: string | null;
  precoVenda?: string | number | null;
  preco?: string | number | null;
  valor?: string | number | null;
  valorUnitario?: string | number | null;
  unit_price?: string | number | null;
  precoLiquido?: string | number | null;
  preco_liquido?: string | number | null;
  custo?: string | number | null;
  custoTotal?: string | number | null;
  custoUnitario?: string | number | null;
  custoProducaoTotal?: string | number | null;
  custo_producao_total?: string | number | null;
  margem?: string | number | null;
  margemContribuicao?: string | number | null;
  margem_contribuicao?: string | number | null;
  margemDesejadaPct?: string | number | null;
  margem_desejada_pct?: string | number | null;
  tabelaId?: string | number | null;
  idTabelaPreco?: string | number | null;
  price_table_id?: string | number | null;
  ativo?: boolean | string | number | null;
  active?: boolean | string | number | null;
  status?: string | null;
  situacao?: string | null;
  impostos?: PricingJson | null;
  totalTributacao?: PricingJson | PricingJson[] | null;
};

export type PricingValidationIssue = {
  code: "missing_price" | "missing_cost";
  message: string;
  path?: string;
};
