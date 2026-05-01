/**
 * ProposalDocumentContext — camada central de dados que alimenta o editor de
 * propostas (Page Builder) e o gerador de PDF.
 *
 * Princípios:
 *  - Estrutura única, agnóstica de origem. Cada bloco lê daqui em vez de
 *    fazer queries próprias.
 *  - Mantém o conceito atual: dados embutidos em `block.data` continuam a
 *    vencer (modo híbrido). O contexto serve como fallback inteligente e
 *    fonte para auto-fill.
 *  - Preparado para a futura integração direta com Nomus: a camada
 *    `buildProposalDocumentContext` é o único ponto a substituir quando a
 *    fonte de dados mudar.
 *
 * Convenção de prioridade (decidida com o usuário):
 *   proposals (campos materializados) → proposal_tables → nomus_*  → defaults
 */

export interface ProposalContextEmpresa {
  nome: string | null;
  cidade: string | null;
  email: string | null;
  site: string | null;
  telefone: string | null;
}

export interface ProposalContextProposal {
  id: string;
  numero: string | null;
  titulo: string | null;
  status: string | null;
  validade: string | null; // ISO date
  data_emissao: string | null; // ISO date (created_at ou data_emissao Nomus)
  prazo_entrega: string | null;
  payment_terms: string | null;
  total_value: number | null;
  /** Revisão atual (0 = original) e histórico CN##### Rev.X. */
  revisao: number;
  historico_revisoes: Array<{
    numero: string;
    date: string | null;
    total_value: number | null;
    is_current: boolean;
  }>;
}

export interface ProposalContextCliente {
  id: string | null;
  nome: string | null;
  fantasia: string | null;
  documento: string | null; // CNPJ/CPF
  endereco: string | null; // logradouro, número, complemento
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  email: string | null;
  telefone: string | null;
  segmento: string | null;
}

export interface ProposalContextContato {
  nome: string | null;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
}

export interface ProposalContextVendedor {
  nome: string | null;
  representante: string | null;
}

export interface ProposalContextItem {
  /** Posição na lista (1-based para exibição). */
  position: number;
  description: string;
  quantity: number;
  unidade: string | null;
  /** Preço unitário de TABELA (snapshot — pode ser null). */
  unit_price_table: number | null;
  /** Preço unitário VENDIDO (o que o cliente paga). */
  unit_price_sold: number | null;
  /** Valor total VENDIDO do item. */
  total: number;
  /** Desconto absoluto aplicado no item. */
  discount: number;
  /** Tabela de preço associada ao item, se houver. */
  price_table: {
    id: string | null;
    name: string | null;
  } | null;
  /** Custo de produção total snapshot, se houver. */
  custo_producao_total: number | null;
}

export interface ProposalContextTotais {
  /** Valor total dos PRODUTOS (Σ tabela × qtd). */
  valor_produtos: number | null;
  /** Valor total VENDIDO (Σ unit_price × qtd − descontos). */
  valor_total_vendido: number | null;
  /** Desconto líquido (concedido − ágio). */
  valor_descontos: number | null;
  desconto_concedido: number;
  agio_sobre_tabela: number;
  valor_liquido: number | null;
  custos_producao: number | null;
  custos_administrativos: number | null;
  lucro_bruto: number | null;
  lucro_liquido: number | null;
  margem_bruta_pct: number | null;
  margem_liquida_pct: number | null;
  impostos_total: number;
  outras_despesas_total: number;
  custo_taxa_financeira: number;
  /** "snapshot_local" | "nomus" | "fallback" — origem dominante. */
  source: "snapshot_local" | "nomus" | "fallback";
}

export interface ProposalContextImpostos {
  ipi: string;
  icms: string;
  pis: string;
  cofins: string;
  // valores absolutos (quando disponíveis no Nomus)
  ipi_valor: number | null;
  icms_valor: number | null;
  pis_valor: number | null;
  cofins_valor: number | null;
}

export interface ProposalContextParcela {
  forma_pagamento: string;
  parcela: string;
  porcentagem: string;
  valor: number | null;
  dias: number | null;
}

export interface ProposalContextPagamento {
  condicao_nome: string | null;
  parcelas: ProposalContextParcela[];
}

export interface ProposalContextTaxaFinanceira {
  monthly_rate_pct: number | null;
  rate_type: string | null;
  avg_term_days: number | null;
  factor_pct: number | null;
  additional_cost: number;
  final_amount: number | null;
  original_amount: number | null;
  preset_id: string | null;
}

export interface ProposalContextBancario {
  banco: string;
  agencia: string | null;
  conta: string | null;
  pix: string | null;
  titular: string | null;
}

export interface ProposalContextEscopo {
  /** Itens incluídos (descrições resumidas). */
  inclusos: string[];
  /** Itens NÃO inclusos (do template). */
  nao_inclusos: string[];
  /** Garantias estruturadas do template. */
  garantias: Array<{ titulo: string; descricao: string }>;
  garantia_texto: string | null;
}

export interface ProposalContextColdProEnvironment {
  id: string;
  name: string;
  environment_type: string | null;
  volume_m3: number | null;
  internal_temp_c: number | null;
  external_temp_c: number | null;
  total_required_kcal_h: number | null;
  total_required_kw: number | null;
  total_required_tr: number | null;
  selected_equipments: Array<{
    model: string | null;
    quantity: number | null;
    capacity_total_kcal_h: number | null;
    refrigerant: string | null;
    surplus_percent: number | null;
  }>;
}

export interface ProposalContextColdPro {
  project_id: string;
  project_name: string | null;
  application_type: string | null;
  status: string | null;
  revision: number | null;
  /** Soma de todas as cargas térmicas requeridas (kcal/h). */
  total_load_kcal_h: number;
  total_load_kw: number;
  total_load_tr: number;
  environments: ProposalContextColdProEnvironment[];
}

export interface ProposalContextTemplateRef {
  id: string | null;
  name: string | null;
  primary_color: string | null;
  accent_color: string | null;
  accent_color_2: string | null;
}

/**
 * Estrutura única que alimenta TODO o editor de propostas. Construída por
 * `buildProposalDocumentContext(proposalId)` no servidor, exposta via server
 * fn `getProposalDocumentContext` e consumida pelos blocos via hook
 * `useProposalDocumentContext`.
 */
export interface ProposalDocumentContext {
  /** Versão do shape — incrementar quando houver breaking change. */
  schema_version: 1;
  /** Quando foi montado. */
  built_at: string;
  empresa: ProposalContextEmpresa;
  proposal: ProposalContextProposal;
  cliente: ProposalContextCliente;
  contato: ProposalContextContato | null;
  vendedor: ProposalContextVendedor;
  itens: ProposalContextItem[];
  totais: ProposalContextTotais;
  impostos: ProposalContextImpostos;
  pagamento: ProposalContextPagamento;
  taxa_financeira: ProposalContextTaxaFinanceira;
  dados_bancarios: ProposalContextBancario[];
  escopo: ProposalContextEscopo;
  /** Presente apenas quando há ColdPro vinculado à proposta. */
  coldpro: ProposalContextColdPro | null;
  template: ProposalContextTemplateRef;
}
