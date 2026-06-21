export type NomusJson = Record<string, unknown>;

export interface NomusCustomerRaw extends NomusJson {
  id?: string | number | null;
  codigo?: string | number | null;
  idCliente?: string | number | null;
  clienteId?: string | number | null;
  nome?: string | null;
  nomeCliente?: string | null;
  clienteNome?: string | null;
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  apelido?: string | null;
  cnpj?: string | null;
  cpf?: string | null;
  documento?: string | null;
  cidade?: string | null;
  municipio?: string | null;
  uf?: string | null;
  estado?: string | null;
  email?: string | null;
  emailPrincipal?: string | null;
  telefone?: string | null;
  fone?: string | null;
  celular?: string | null;
}

export interface NomusPaymentConditionRaw extends NomusJson {
  id?: string | number | null;
  codigo?: string | number | null;
  idCondicaoPagamento?: string | number | null;
  condicaoPagamentoId?: string | number | null;
  nome?: string | null;
  descricao?: string | null;
  nomeCondicaoPagamento?: string | null;
  descricaoCondicaoPagamento?: string | null;
  observacao?: string | null;
  observacoes?: string | null;
  parcelas?: unknown;
  installments?: unknown;
  itens?: unknown;
}

export interface NomusTaxRaw extends NomusJson {
  valorIcms?: string | number | null;
  valorIcmsRecolher?: string | number | null;
  icmsRecolher?: string | number | null;
  valorIcmsSt?: string | number | null;
  valorIcmsStRecolher?: string | number | null;
  icmsStRecolher?: string | number | null;
  valorIpi?: string | number | null;
  valorIpiRecolher?: string | number | null;
  ipiRecolher?: string | number | null;
  valorIss?: string | number | null;
  valorIssqn?: string | number | null;
  valorIssqnRecolher?: string | number | null;
  issqnRecolher?: string | number | null;
  valorPis?: string | number | null;
  valorPisRecolher?: string | number | null;
  pisRecolher?: string | number | null;
  valorCofins?: string | number | null;
  valorCofinsRecolher?: string | number | null;
  cofinsRecolher?: string | number | null;
  valorSimplesNacional?: string | number | null;
  valorSimplesNacionalRecolher?: string | number | null;
  valorCbs?: string | number | null;
  valorIbs?: string | number | null;
  valorIbsEstadual?: string | number | null;
}

export interface NomusRepresentativeRaw extends NomusJson {
  id?: string | number | null;
  codigo?: string | number | null;
  idRepresentante?: string | number | null;
  representanteId?: string | number | null;
  nome?: string | null;
  nomeRepresentante?: string | null;
  razaoSocial?: string | null;
  email?: string | null;
  cnpj?: string | null;
  cpf?: string | null;
  regiao?: string | null;
  uf?: string | null;
}

export interface NomusProposalItemRaw extends NomusJson {
  id?: string | number | null;
  idItem?: string | number | null;
  idProduto?: string | number | null;
  produtoId?: string | number | null;
  produto?: NomusJson | null;
  codigoProduto?: string | null;
  codigo?: string | null;
  descricaoProduto?: string | null;
  descricao?: string | null;
  nome?: string | null;
  informacoesAdicionaisProduto?: string | null;
  informacoesAdicionais?: string | null;
  qtde?: string | number | null;
  quantidade?: string | number | null;
  qtd?: string | number | null;
  valorUnitario?: string | number | null;
  preco?: string | number | null;
  desconto?: string | number | null;
  valorDesconto?: string | number | null;
  valorTotal?: string | number | null;
  valorTotalProdutos?: string | number | null;
  total?: string | number | null;
  valorTotalComDesconto?: string | number | null;
  prazoEntrega?: string | number | null;
  diasEntrega?: string | number | null;
  status?: string | null;
  situacao?: string | null;
}

export interface NomusProposalRaw extends NomusJson {
  id?: string | number | null;
  idProposta?: string | number | null;
  codigo?: string | number | null;
  proposta?: string | null;
  numero?: string | null;
  numeroProposta?: string | null;
  cliente?: NomusCustomerRaw | null;
  empresa?: NomusJson | null;
  vendedor?: NomusJson | null;
  representante?: NomusRepresentativeRaw | null;
  contato?: NomusJson | null;
  tabelaPreco?: NomusJson | null;
  condicaoPagamento?: NomusPaymentConditionRaw | null;
  idCliente?: string | number | null;
  clienteId?: string | number | null;
  nomeCliente?: string | null;
  clienteNome?: string | null;
  totalTributacao?: NomusTaxRaw[] | NomusTaxRaw | null;
  itensProposta?: NomusProposalItemRaw[] | null;
  itens?: NomusProposalItemRaw[] | null;
  items?: NomusProposalItemRaw[] | null;
}

export type NomusCustomer = {
  id: string | null;
  nomus_id: string | null;
  name: string | null;
  trade_name: string | null;
  document: string | null;
  city: string | null;
  state: string | null;
  email: string | null;
  phone: string | null;
  raw: NomusCustomerRaw | null;
};

export type NomusPaymentCondition = {
  id: string | null;
  nomus_id: string | null;
  name: string | null;
  description: string | null;
  installments: Array<{
    label: string;
    percentage: number | null;
    value: number | null;
    due_in_days: number | null;
    due_date: string | null;
  }>;
  raw: NomusPaymentConditionRaw | null;
};

export type NomusTaxSummary = {
  icms_recolher: number | null;
  icms_st_recolher: number | null;
  ipi_recolher: number | null;
  pis_recolher: number | null;
  cofins_recolher: number | null;
  issqn_recolher: number | null;
  simples_nacional_recolher: number | null;
  cbs_recolher: number | null;
  ibs_recolher: number | null;
  ibs_estadual_recolher: number | null;
  total_tributacao: NomusJson | null;
};

export type NomusProposalMapped = {
  nomus_id: string;
  numero: string | null;
  nome_cliente: string | null;
  cliente_nomus_id: string | null;
  empresa_nomus_id: string | null;
  empresa_nome: string | null;
  vendedor_nomus_id: string | null;
  vendedor_nome: string | null;
  representante_nomus_id: string | null;
  representante_nome: string | null;
  contato_nomus_id: string | null;
  contato_nome: string | null;
  tabela_preco_nomus_id: string | null;
  tabela_preco_nome: string | null;
  condicao_pagamento_nomus_id: string | null;
  condicao_pagamento_nome: string | null;
  tipo_movimentacao: string | null;
  prazo_entrega_dias: number | null;
  pedido_compra_cliente: string | null;
  layout_pdf: string | null;
  validade: string | null;
  data_emissao: string | null;
  criada_em_nomus: string | null;
  criada_por_nomus: string | null;
  valor_total: number | null;
  valor_produtos: number | null;
  valor_descontos: number | null;
  valor_total_com_desconto: number | null;
  valor_liquido: number | null;
  icms_recolher: number | null;
  icms_st_recolher: number | null;
  ipi_recolher: number | null;
  pis_recolher: number | null;
  cofins_recolher: number | null;
  issqn_recolher: number | null;
  simples_nacional_recolher: number | null;
  cbs_recolher: number | null;
  ibs_recolher: number | null;
  ibs_estadual_recolher: number | null;
  total_tributacao: NomusJson | null;
  comissoes_venda: number | null;
  frete_valor: number | null;
  frete_percentual: number | null;
  seguros_valor: number | null;
  despesas_acessorias: number | null;
  custos_producao: number | null;
  custos_materiais: number | null;
  custos_mod: number | null;
  custos_cif: number | null;
  custos_administrativos: number | null;
  custos_incidentes_lucro: number | null;
  lucro_bruto: number | null;
  margem_bruta_pct: number | null;
  lucro_antes_impostos: number | null;
  lucro_liquido: number | null;
  margem_liquida_pct: number | null;
  status_nomus: string | null;
  observacoes: string | null;
};

export type NomusProposalItemMapped = {
  nomus_item_id: string | null;
  nomus_product_id: string | null;
  product_code: string | null;
  description: string;
  additional_info: string | null;
  quantity: number | null;
  unit_price: number | null;
  unit_value_with_unit: string | null;
  discount: number | null;
  total: number | null;
  total_with_discount: number | null;
  prazo_entrega_dias: number | null;
  item_status: string | null;
};

export type {
  Customer,
  PaymentCondition,
  PaymentConditionInstallment,
  Proposal,
  ProposalItem,
  ProposalSource,
  TaxSummary,
} from "./domain";
