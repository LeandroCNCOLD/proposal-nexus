import type { ProposalTable } from "@/features/proposal-editor/proposal-tables.types";
import { ProposalTableEditor } from "./ProposalTableEditor";

type Props = {
  table: ProposalTable;
  onChange: (next: ProposalTable) => void;
};

export function TaxTableEditor({ table, onChange }: Props) {
  return <ProposalTableEditor table={table} onChange={onChange} />;
}
