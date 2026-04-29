export type NomusJson = Record<string, unknown>;

export type NomusPriceTableRaw = NomusJson & {
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
  is_active?: boolean | string | number | null;
  itens?: NomusPriceTableItemRaw[] | null;
  items?: NomusPriceTableItemRaw[] | null;
  produtos?: NomusPriceTableItemRaw[] | null;
  tabelaPrecoItens?: NomusPriceTableItemRaw[] | null;
  registros?: NomusPriceTableItemRaw[] | null;
  lista?: NomusPriceTableItemRaw[] | null;
  data?: NomusPriceTableItemRaw[] | null;
};

export type NomusPriceTableItemRaw = NomusJson & {
  id?: string | number | null;
  produto?: NomusJson | null;
  product?: NomusJson | null;
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
  custoMateriais?: string | number | null;
  custoMaterial?: string | number | null;
  custoMOD?: string | number | null;
  custoMod?: string | number | null;
  custoCIF?: string | number | null;
  custoCif?: string | number | null;
  custosAdm?: string | number | null;
  custosVenda?: string | number | null;
  custoTotal?: string | number | null;
  custoUnitario?: string | number | null;
  custoProducaoTotal?: string | number | null;
  margemDesejadaPct?: string | number | null;
  margem_desejada_pct?: string | number | null;
  margemContribuicao?: string | number | null;
  margem_contribuicao?: string | number | null;
  lucroBruto?: string | number | null;
  lucroLiquido?: string | number | null;
  unidadeMedida?: string | null;
  unidade_medida?: string | null;
  moeda?: string | null;
  currency?: string | null;
};

export type NomusProductCostRaw = NomusJson & {
  custoMaterial?: string | number | null;
  custoMateriais?: string | number | null;
  custoMaoObra?: string | number | null;
  custoMOD?: string | number | null;
  custoMod?: string | number | null;
  custoTerceiros?: string | number | null;
  custoCIF?: string | number | null;
  custoCif?: string | number | null;
  custosAdm?: string | number | null;
  custosVenda?: string | number | null;
  custoTotal?: string | number | null;
  custoUnitario?: string | number | null;
  custoProducaoTotal?: string | number | null;
};

export type SyncNomusPriceTablesResult = {
  success: boolean;
  tables: number;
  items: number;
  errors: string[];
};
