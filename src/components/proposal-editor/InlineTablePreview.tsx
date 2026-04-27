// Renderização inline (no canvas do editor) das tabelas estruturadas da proposta.
// Mostra todas as linhas reais cadastradas para que o usuário visualize a tabela
// completa diretamente na página, em vez de um placeholder.
import { useProposalTables } from "@/features/proposal-editor/use-proposal-tables";
import type {
  ProposalTable,
  ProposalTableColumn,
  ProposalTableCellValue,
} from "@/features/proposal-editor/proposal-tables.types";
import type { BlockType } from "@/integrations/proposal-editor/types";

const TABLE_TYPE_BY_BLOCK: Partial<Record<BlockType, string>> = {
  investment_table: "investimento",
  tax_table: "impostos",
  payment_table: "pagamento",
  characteristics_table: "caracteristicas",
  equipments_table: "equipamentos",
  technical_table: "itens",
};

function formatCell(value: ProposalTableCellValue | undefined, col: ProposalTableColumn): string {
  if (value === null || value === undefined || value === "") return "—";
  const t = col.type;
  if (t === "currency" && typeof value === "number") {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (t === "percentage" && typeof value === "number") {
    return `${value}%`;
  }
  if (t === "number" && typeof value === "number") {
    return value.toLocaleString("pt-BR");
  }
  return String(value);
}

function computeGrandTotal(table: ProposalTable): { label: string; value: string } | null {
  const sumKeys = table.settings.sum_columns ?? [];
  if (!table.settings.show_grand_total || sumKeys.length === 0) return null;
  const totals: Record<string, number> = {};
  for (const row of table.rows) {
    for (const k of sumKeys) {
      const v = row[k];
      if (typeof v === "number") totals[k] = (totals[k] ?? 0) + v;
    }
  }
  const main = sumKeys[0];
  const col = table.settings.columns.find((c) => c.key === main);
  const formatted = col
    ? formatCell(totals[main] ?? 0, col)
    : (totals[main] ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return { label: table.settings.grand_total_label ?? "Total", value: formatted };
}

interface Props {
  proposalId: string;
  pageId: string;
  blockType: BlockType;
  title?: string | null;
}

export function InlineTablePreview({ proposalId, pageId, blockType, title }: Props) {
  const tableType = TABLE_TYPE_BY_BLOCK[blockType];
  const { data, isLoading } = useProposalTables({ proposalId, pageId });

  if (!tableType) return null;

  if (isLoading) {
    return (
      <div className="rounded border border-dashed bg-muted/30 p-3 text-xs opacity-70">
        Carregando tabela…
      </div>
    );
  }

  const tables = data?.tables ?? [];
  const table = tables.find((t) => t.table_type === tableType);

  if (!table || !table.rows || table.rows.length === 0) {
    return (
      <div className="rounded border border-dashed bg-muted/30 p-3 text-xs">
        <p className="font-semibold">{title ?? "Tabela"}</p>
        <p className="mt-1 opacity-70">
          Nenhum item cadastrado ainda. Adicione linhas na aba <strong>Tabelas</strong> desta página.
        </p>
      </div>
    );
  }

  const columns = table.settings.columns ?? [];
  const showHeader = table.settings.show_header !== false;
  const grandTotal = computeGrandTotal(table);

  return (
    <div className="h-full w-full overflow-auto text-[11px]">
      {title || table.title ? (
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider opacity-80">
          {title ?? table.title}
        </p>
      ) : null}
      <table className="w-full border-collapse">
        {showHeader && (
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className="border border-black/10 bg-black/5 px-1.5 py-1 text-left font-semibold"
                  style={{
                    width: c.width ? `${c.width}%` : undefined,
                    textAlign: c.align ?? "left",
                  }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={(row.id as string | undefined) ?? i}>
              {columns.map((c) => (
                <td
                  key={c.key}
                  className="border border-black/10 px-1.5 py-1 align-top"
                  style={{ textAlign: c.align ?? "left" }}
                >
                  {formatCell(row[c.key] as ProposalTableCellValue | undefined, c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {grandTotal ? (
          <tfoot>
            <tr>
              <td
                colSpan={Math.max(1, columns.length - 1)}
                className="border border-black/10 bg-black/5 px-1.5 py-1 text-right font-semibold"
              >
                {grandTotal.label}
              </td>
              <td className="border border-black/10 bg-black/5 px-1.5 py-1 text-right font-semibold">
                {grandTotal.value}
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>
      {table.subtitle ? (
        <p className="mt-1 text-[10px] opacity-70">{table.subtitle}</p>
      ) : null}
    </div>
  );
}
