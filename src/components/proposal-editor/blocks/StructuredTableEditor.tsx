import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProposalTableRow, TableColumn } from "@/integrations/proposal-editor/types";

interface Props {
  columns: TableColumn[];
  rows: ProposalTableRow[];
  onChange: (rows: ProposalTableRow[]) => void;
  showTotal?: boolean;
}

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function computeRowTotal(row: ProposalTableRow): number {
  const q = Number(row.quantidade ?? 0);
  const u = Number(row.valor_unitario ?? 0);
  return q * u;
}

export function StructuredTableEditor({ columns, rows, onChange, showTotal }: Props) {
  const totalGeral = useMemo(
    () => (showTotal ? rows.reduce((s, r) => s + computeRowTotal(r), 0) : 0),
    [rows, showTotal],
  );

  const setCell = (rowIndex: number, key: string, value: string) => {
    const next = rows.map((r, i) => (i === rowIndex ? { ...r, [key]: value } : r));
    onChange(next);
  };

  const addRow = () => {
    const empty: ProposalTableRow = {};
    columns.forEach((c) => {
      empty[c.key] = "";
    });
    onChange([...rows, empty]);
  };

  const removeRow = (rowIndex: number) => {
    onChange(rows.filter((_, i) => i !== rowIndex));
  };

  /** Cola TSV/CSV para preencher múltiplas linhas a partir da linha/coluna alvo. */
  const handlePaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    rowIndex: number,
    colIndex: number,
  ) => {
    const text = e.clipboardData.getData("text");
    if (!text || (!text.includes("\t") && !text.includes("\n"))) return;
    e.preventDefault();
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.length > 0);
    const matrix = lines.map((l) => (l.includes("\t") ? l.split("\t") : l.split(",")));
    const next = [...rows];
    matrix.forEach((line, dy) => {
      const targetIdx = rowIndex + dy;
      if (!next[targetIdx]) {
        const empty: ProposalTableRow = {};
        columns.forEach((c) => (empty[c.key] = ""));
        next[targetIdx] = empty;
      }
      line.forEach((val, dx) => {
        const col = columns[colIndex + dx];
        if (col) next[targetIdx] = { ...next[targetIdx], [col.key]: val };
      });
    });
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className="border-b px-2 py-1.5 text-left font-medium"
                  style={{ width: c.width ? `${c.width * 80}px` : undefined }}
                >
                  {c.label}
                  {c.computed ? <span className="ml-1 text-muted-foreground">(auto)</span> : null}
                </th>
              ))}
              <th className="w-8 border-b" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="p-3 text-center text-muted-foreground">
                  Nenhuma linha. Clique em "Adicionar linha".
                </td>
              </tr>
            ) : (
              rows.map((row, ri) => (
                <tr key={ri} className="border-b last:border-b-0">
                  {columns.map((c, ci) => {
                    const computedValue =
                      c.computed && c.key === "valor_total" ? fmtBRL(computeRowTotal(row)) : null;
                    return (
                      <td key={c.key} className="border-r p-0 last:border-r-0">
                        {c.computed ? (
                          <div className="px-2 py-1.5 text-right text-muted-foreground">
                            {computedValue}
                          </div>
                        ) : (
                          <Input
                            value={(row[c.key] as string | number | undefined) ?? ""}
                            onChange={(e) => setCell(ri, c.key, e.target.value)}
                            onPaste={(e) => handlePaste(e, ri, ci)}
                            type={c.type === "number" || c.type === "currency" ? "number" : "text"}
                            step="any"
                            className={`h-8 rounded-none border-0 bg-transparent text-xs focus-visible:ring-1 focus-visible:ring-inset ${
                              c.align === "right" ? "text-right" : ""
                            }`}
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeRow(ri)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {showTotal && rows.length > 0 ? (
            <tfoot>
              <tr className="bg-muted/50">
                <td colSpan={columns.length + 1} className="px-2 py-2 text-right font-semibold">
                  Total geral: {fmtBRL(totalGeral)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={addRow}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar linha
        </Button>
        <span className="text-[10px] text-muted-foreground">
          Dica: cole valores tabulados (TSV/CSV) para preencher várias linhas.
        </span>
      </div>
    </div>
  );
}
