import type { ProposalTable } from "./proposal-tables.types";

export function getTablesForPage(
  tables: ProposalTable[],
  pageId: string,
  fallbackType?: string,
): ProposalTable[] {
  const direct = tables.filter((table) => table.page_id === pageId);
  if (direct.length > 0) return direct;

  if (!fallbackType) return [];

  return tables.filter((table) => table.table_type === fallbackType);
}
