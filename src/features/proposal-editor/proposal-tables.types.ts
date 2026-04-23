// Tipos dedicados para tabelas estruturadas de propostas.
// Espelha o schema atual de `public.proposal_tables` (table_type + settings.columns + sort_order).

export type ProposalTableType =
  | "caracteristicas"
  | "equipamentos"
  | "investimento"
  | "impostos"
  | "pagamento"
  | "itens_inclusos"
  | "itens_nao_inclusos"
  | "dados_bancarios"
  | "custom";

export type ProposalTableColumnType =
  | "text"
  | "number"
  | "currency"
  | "percentage"
  | "multiline";

export interface ProposalTableColumn {
  key: string;
  label: string;
  width?: number; // percent
  type?: ProposalTableColumnType;
  align?: "left" | "center" | "right";
}

export interface ProposalTableSettings {
  show_header?: boolean;
  repeat_header?: boolean;
  currency_columns?: string[];
  sum_columns?: string[];
  grand_total_label?: string;
  show_grand_total?: boolean;
  columns: ProposalTableColumn[];
}

export interface ProposalTableRowBase {
  id?: string;
  [key: string]: unknown;
}

export interface CaracteristicaRow extends ProposalTableRowBase {
  label: string;
  value: string;
}

export interface EquipamentoRow extends ProposalTableRowBase {
  item?: number;
  descricao: string;
  quantidade?: number;
  unidade?: string;
  valor_unitario?: number | null;
  valor_total?: number | null;
}

export interface InvestimentoRow extends ProposalTableRowBase {
  item?: number;
  descricao: string;
  quantidade?: number;
  unidade?: string;
  valor_unitario?: number | null;
  valor_total?: number | null;
}

export interface ImpostoRow extends ProposalTableRowBase {
  ipi?: string;
  icms?: string;
  pis?: string;
  cofins?: string;
  observacao?: string;
}

export interface PagamentoRow extends ProposalTableRowBase {
  forma_pagamento?: string;
  parcela?: string;
  porcentagem?: string;
}

export type ProposalTableRow =
  | CaracteristicaRow
  | EquipamentoRow
  | InvestimentoRow
  | ImpostoRow
  | PagamentoRow
  | ProposalTableRowBase;

export interface ProposalTable {
  id: string;
  proposal_id: string;
  page_id: string | null;
  table_type: ProposalTableType;
  title: string | null;
  subtitle: string | null;
  rows: ProposalTableRow[];
  settings: ProposalTableSettings;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface UpsertProposalTableInput {
  id?: string;
  proposal_id: string;
  page_id?: string | null;
  table_type: ProposalTableType;
  title?: string | null;
  subtitle?: string | null;
  rows: ProposalTableRow[];
  settings: ProposalTableSettings;
  sort_order?: number;
}

export interface ListProposalTablesInput {
  proposalId: string;
  pageId?: string;
}
