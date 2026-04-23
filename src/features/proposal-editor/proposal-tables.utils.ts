import type { ProposalTable, ProposalTableRow } from "./proposal-tables.types";

export function formatCurrencyBRL(value: unknown): string {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/[^\d,-]/g, "").replace(".", "").replace(",", "."))
        : 0;
  const safe = Number.isFinite(numberValue) ? numberValue : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(safe);
}

export function sumColumn(rows: ProposalTableRow[], columnKey: string): number {
  return rows.reduce((acc, row) => {
    const raw = row[columnKey];
    const value = typeof raw === "number" ? raw : Number(raw ?? 0);
    return acc + (Number.isFinite(value) ? value : 0);
  }, 0);
}

export function getGrandTotal(table: ProposalTable): number {
  const firstSumColumn = table.settings.sum_columns?.[0];
  if (!firstSumColumn) return 0;
  return sumColumn(table.rows, firstSumColumn);
}
