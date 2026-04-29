export type NomusJson = Record<string, unknown>;

export interface NomusProductRaw extends NomusJson {
  id?: string | number | null;
  codigo?: string | number | null;
  idProduto?: string | number | null;
  codigoProduto?: string | null;
  nome?: string | null;
  descricao?: string | null;
  descricaoProduto?: string | null;
  categoria?: string | null;
  grupo?: string | null;
  familia?: string | null;
  unidade?: string | null;
  unidadeMedida?: string | null;
  ativo?: boolean | string | number | null;
  status?: string | null;
  situacao?: string | null;
  ncm?: string | null;
  cfop?: string | null;
  dataAlteracao?: string | null;
  dataModificacao?: string | null;
  updatedAt?: string | null;
}

export interface NomusPriceTableRaw extends NomusJson {
  id?: string | number | null;
  codigo?: string | number | null;
  nome?: string | null;
  descricao?: string | null;
  moeda?: string | null;
  currency?: string | null;
  validade?: string | null;
  dataValidade?: string | null;
  ativo?: boolean | string | number | null;
  status?: string | null;
  situacao?: string | null;
  itens?: NomusProductPriceRaw[] | null;
  items?: NomusProductPriceRaw[] | null;
  produtos?: NomusProductPriceRaw[] | null;
  tabelaPrecoItens?: NomusProductPriceRaw[] | null;
}

export interface NomusProductPriceRaw extends NomusJson {
  id?: string | number | null;
  produto?: NomusProductRaw | null;
  idProduto?: string | number | null;
  produtoId?: string | number | null;
  codigoProduto?: string | null;
  tabelaPreco?: NomusPriceTableRaw | null;
  idTabelaPreco?: string | number | null;
  tabelaPrecoId?: string | number | null;
  nomeTabelaPreco?: string | null;
  precoVenda?: string | number | null;
  preco?: string | number | null;
  valor?: string | number | null;
  valorUnitario?: string | number | null;
  moeda?: string | null;
  currency?: string | null;
  validade?: string | null;
  dataValidade?: string | null;
  ativo?: boolean | string | number | null;
  status?: string | null;
  situacao?: string | null;
}

export interface NomusProductCostRaw extends NomusJson {
  id?: string | number | null;
  produtoId?: string | number | null;
  idProduto?: string | number | null;
  codigoProduto?: string | null;
  custoMaterial?: string | number | null;
  custoMateriais?: string | number | null;
  custoMaoObra?: string | number | null;
  custoMOD?: string | number | null;
  custoMod?: string | number | null;
  custoTerceiros?: string | number | null;
  custoCIF?: string | number | null;
  custoCif?: string | number | null;
  custoTotal?: string | number | null;
  custoProducaoTotal?: string | number | null;
  custoUnitario?: string | number | null;
  dataReferencia?: string | null;
  dataAtualizacao?: string | null;
  fonte?: string | null;
}

export interface NomusUnitRaw extends NomusJson {
  id?: string | number | null;
  codigo?: string | number | null;
  sigla?: string | null;
  unidade?: string | null;
  descricao?: string | null;
  nome?: string | null;
}

export interface NomusProductTaxRaw extends NomusJson {
  id?: string | number | null;
  produtoId?: string | number | null;
  idProduto?: string | number | null;
  codigoProduto?: string | null;
  ncm?: string | null;
  cfop?: string | null;
  icms?: string | number | null;
  valorIcms?: string | number | null;
  ipi?: string | number | null;
  valorIpi?: string | number | null;
  pis?: string | number | null;
  valorPis?: string | number | null;
  cofins?: string | number | null;
  valorCofins?: string | number | null;
}

export type NomusResult<T> =
  | { ok: true; data: T; warnings?: string[] }
  | { ok: false; error: string; warnings?: string[] };
