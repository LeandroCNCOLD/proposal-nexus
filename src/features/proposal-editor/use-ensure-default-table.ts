import * as React from "react";
import {
  useProposalTables,
  useUpsertProposalTable,
} from "./use-proposal-tables";
import {
  getDefaultTableRows,
  getDefaultTableSettings,
} from "./proposal-tables.defaults";
import type { ProposalTableType } from "./proposal-tables.types";

function mapPageTypeToTableType(pageType: string): ProposalTableType | null {
  switch (pageType) {
    case "investimento":
    case "equipamento":
      return "investimento";
    case "impostos":
      return "impostos";
    case "pagamento":
      return "pagamento";
    case "caracteristicas":
      return "caracteristicas";
    default:
      return null;
  }
}

export function useEnsureDefaultTable(params: {
  proposalId: string;
  pageId: string;
  pageType: string;
  enabled?: boolean;
}) {
  const { proposalId, pageId, pageType, enabled = true } = params;
  const { data, isLoading } = useProposalTables({ proposalId, pageId });
  const upsert = useUpsertProposalTable(proposalId, pageId);

  const seededRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    if (!proposalId || !pageId || !pageType) return;
    if (isLoading) return;
    if ((data?.tables?.length ?? 0) > 0) return;

    const tableType = mapPageTypeToTableType(pageType);
    if (!tableType) return;

    // Avoid double-seed for same page in this session
    const key = `${proposalId}:${pageId}`;
    if (seededRef.current === key) return;
    seededRef.current = key;

    void upsert.mutateAsync({
      proposal_id: proposalId,
      page_id: pageId,
      table_type: tableType,
      title: null,
      subtitle: null,
      rows: getDefaultTableRows(tableType),
      settings: getDefaultTableSettings(tableType),
      sort_order: 0,
    });
  }, [enabled, proposalId, pageId, pageType, data, isLoading, upsert]);
}
