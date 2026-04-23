import * as React from "react";
import type { ProposalTable } from "@/features/proposal-editor/proposal-tables.types";
import { EditorHtmlTable } from "../EditorHtmlTable";

type Props = {
  title?: string;
  tables: ProposalTable[];
  palette: any;
};

export function EditorCharacteristicsPreview({
  title = "Características técnicas",
  tables,
  palette,
}: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold" style={{ color: palette.primary }}>
        {title}
      </h2>

      {tables.length === 0 ? (
        <div className="text-sm" style={{ color: palette.muted }}>
          Nenhuma característica técnica cadastrada.
        </div>
      ) : (
        tables.map((table) => (
          <EditorHtmlTable key={table.id} table={table} palette={palette} />
        ))
      )}
    </div>
  );
}
