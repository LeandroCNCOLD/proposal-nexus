import type { UpsertProposalTableInput } from "./proposal-tables.types";
import { getDefaultTableRows, getDefaultTableSettings } from "./proposal-tables.defaults";

export function buildDefaultProposalTables(params: {
  proposalId: string;
  investimentoPageId?: string | null;
  impostosPageId?: string | null;
  pagamentoPageId?: string | null;
}): UpsertProposalTableInput[] {
  const { proposalId, investimentoPageId, impostosPageId, pagamentoPageId } = params;

  return [
    {
      proposal_id: proposalId,
      page_id: investimentoPageId ?? null,
      table_type: "investimento",
      title: "Resumo do escopo de fornecimento",
      subtitle: null,
      rows: [],
      settings: getDefaultTableSettings("investimento"),
      sort_order: 0,
    },
    {
      proposal_id: proposalId,
      page_id: impostosPageId ?? null,
      table_type: "impostos",
      title: "Base de cálculo dos impostos",
      subtitle: null,
      rows: getDefaultTableRows("impostos"),
      settings: getDefaultTableSettings("impostos"),
      sort_order: 0,
    },
    {
      proposal_id: proposalId,
      page_id: pagamentoPageId ?? null,
      table_type: "pagamento",
      title: "Condições de pagamento",
      subtitle: null,
      rows: getDefaultTableRows("pagamento"),
      settings: getDefaultTableSettings("pagamento"),
      sort_order: 0,
    },
  ];
}
