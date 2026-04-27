import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import type {
  ProposalTable,
  ProposalTableColumn,
  ProposalTableRow,
} from "@/features/proposal-editor/proposal-tables.types";
import {
  getGrandTotal,
  formatCurrencyBRL,
} from "@/features/proposal-editor/proposal-tables.utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  table: ProposalTable;
  readOnly?: boolean;
  onChange: (next: ProposalTable) => void;
};

function normalizeValueByType(
  value: string,
  column: ProposalTableColumn,
): string | number {
  if (column.type === "number" || column.type === "currency") {
    const normalized = value.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return value;
}

function toInputValue(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function buildEmptyRow(columns: ProposalTableColumn[]): ProposalTableRow {
  const row: ProposalTableRow = {
    id: crypto.randomUUID(),
  };

  for (const column of columns) {
    row[column.key] =
      column.type === "number" || column.type === "currency" ? 0 : "";
  }

  return row;
}

export function ProposalTableEditor({
  table,
  readOnly = false,
  onChange,
}: Props) {
  const settings = table.settings;
  const columns = settings.columns ?? [];

  const handleRowChange = (
    rowIndex: number,
    column: ProposalTableColumn,
    rawValue: string,
  ) => {
    const nextRows = [...table.rows];
    const currentRow = { ...(nextRows[rowIndex] ?? {}) };
    currentRow[column.key] = normalizeValueByType(rawValue, column);

    // cálculo simples de valor_total se existir quantidade * valor_unitario
    if (
      Object.prototype.hasOwnProperty.call(currentRow, "quantidade") &&
      Object.prototype.hasOwnProperty.call(currentRow, "valor_unitario") &&
      Object.prototype.hasOwnProperty.call(currentRow, "valor_total")
    ) {
      const quantidade = Number(currentRow.quantidade ?? 0);
      const valorUnitario = Number(currentRow.valor_unitario ?? 0);
      currentRow.valor_total =
        Number.isFinite(quantidade) && Number.isFinite(valorUnitario)
          ? quantidade * valorUnitario
          : 0;
    }

    nextRows[rowIndex] = currentRow;
    onChange({
      ...table,
      rows: nextRows,
    });
  };

  const handleAddRow = () => {
    const nextRows = [...table.rows, buildEmptyRow(columns)];
    onChange({
      ...table,
      rows: nextRows,
    });
  };

  const handleDeleteRow = (rowIndex: number) => {
    const nextRows = table.rows.filter((_, index) => index !== rowIndex);
    onChange({
      ...table,
      rows: nextRows,
    });
  };

  const handleTitleChange = (field: "title" | "subtitle", value: string) => {
    onChange({
      ...table,
      [field]: value,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Input
          value={table.title ?? ""}
          onChange={(e) => handleTitleChange("title", e.target.value)}
          placeholder="Título da tabela"
          disabled={readOnly}
          className="font-semibold"
        />
        <Input
          value={table.subtitle ?? ""}
          onChange={(e) => handleTitleChange("subtitle", e.target.value)}
          placeholder="Subtítulo da tabela"
          disabled={readOnly}
        />
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          {settings.show_header !== false && (
            <thead className="bg-muted/50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className="px-3 py-2 text-left font-medium"
                    style={{
                      width: column.width ? `${column.width}%` : undefined,
                      textAlign: column.align ?? "left",
                    }}
                  >
                    {column.label}
                  </th>
                ))}
                {!readOnly && (
                  <th className="px-3 py-2 text-right font-medium w-16">
                    Ações
                  </th>
                )}
              </tr>
            </thead>
          )}

          <tbody>
            {table.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (readOnly ? 0 : 1)}
                  className="px-3 py-4 text-center text-muted-foreground"
                >
                  Nenhuma linha cadastrada.
                </td>
              </tr>
            ) : (
              table.rows.map((row, rowIndex) => (
                <tr key={(row.id as string) ?? rowIndex} className="border-t">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className="px-2 py-1"
                      style={{ textAlign: column.align ?? "left" }}
                    >
                      <Input
                        value={toInputValue(row[column.key])}
                        onChange={(e) =>
                          handleRowChange(rowIndex, column, e.target.value)
                        }
                        disabled={readOnly}
                        className="h-8"
                      />
                    </td>
                  ))}

                  {!readOnly && (
                    <td className="px-2 py-1 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteRow(rowIndex)}
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddRow}
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar linha
          </Button>

          {table.settings.show_grand_total && (
            <div className="text-sm font-medium">
              {table.settings.grand_total_label ?? "Total"}:{" "}
              {formatCurrencyBRL(getGrandTotal(table))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
