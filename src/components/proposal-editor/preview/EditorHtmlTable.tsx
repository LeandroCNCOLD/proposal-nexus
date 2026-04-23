import * as React from "react";
import type {
  ProposalTable,
  ProposalTableColumn,
  ProposalTableRow,
} from "@/features/proposal-editor/proposal-tables.types";
import {
  formatCurrencyBRL,
  getGrandTotal,
} from "@/features/proposal-editor/proposal-tables.utils";

type Props = {
  table: ProposalTable;
  palette: {
    primary: string;
    border: string;
    text: string;
    muted: string;
  };
};

function formatCellValue(row: ProposalTableRow, column: ProposalTableColumn) {
  const value = row[column.key];

  if (value == null || value === "") return "";

  if (column.type === "currency") {
    return formatCurrencyBRL(value);
  }

  if (column.type === "percentage") {
    return String(value).includes("%") ? String(value) : `${value}%`;
  }

  return String(value);
}

export function EditorHtmlTable({ table, palette }: Props) {
  const columns = table.settings.columns ?? [];

  return (
    <div className="mb-6">
      {table.title ? (
        <div
          className="mb-1 text-sm font-semibold"
          style={{ color: palette.primary }}
        >
          {table.title}
        </div>
      ) : null}

      {table.subtitle ? (
        <div className="mb-2 text-xs" style={{ color: palette.muted }}>
          {table.subtitle}
        </div>
      ) : null}

      <div
        className="overflow-hidden rounded-md border"
        style={{ borderColor: palette.border }}
      >
        <table className="w-full border-collapse text-xs" style={{ color: palette.text }}>
          {table.settings.show_header !== false && (
            <thead>
              <tr style={{ backgroundColor: palette.primary }}>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className="px-3 py-2 text-white font-semibold"
                    style={{
                      width: column.width ? `${column.width}%` : undefined,
                      textAlign: column.align ?? "left",
                    }}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
          )}

          <tbody>
            {table.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length || 1}
                  className="px-3 py-4 text-center"
                  style={{ color: palette.muted }}
                >
                  Sem dados cadastrados.
                </td>
              </tr>
            ) : (
              table.rows.map((row, rowIndex) => (
                <tr
                  key={(row.id as string) ?? rowIndex}
                  style={{
                    backgroundColor: rowIndex % 2 === 0 ? "#FFFFFF" : "#F8FAFC",
                    borderTop: `1px solid ${palette.border}`,
                  }}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className="px-3 py-2 align-top"
                      style={{
                        textAlign: column.align ?? "left",
                        whiteSpace:
                          column.type === "multiline" ? "pre-wrap" : "normal",
                      }}
                    >
                      {formatCellValue(row, column)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {table.settings.show_grand_total ? (
        <div
          className="mt-2 flex items-center justify-between rounded-md px-3 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: palette.primary }}
        >
          <span>{table.settings.grand_total_label ?? "Total Geral"}</span>
          <span>{formatCurrencyBRL(getGrandTotal(table))}</span>
        </div>
      ) : null}
    </div>
  );
}
