import * as React from "react";
import { Loader2, PlusCircle } from "lucide-react";
import type {
  ProposalTable,
  ProposalTableType,
} from "@/features/proposal-editor/proposal-tables.types";
import {
  useProposalTables,
  useUpsertProposalTable,
  useDeleteProposalTable,
} from "@/features/proposal-editor/use-proposal-tables";
import {
  getDefaultTableRows,
  getDefaultTableSettings,
} from "@/features/proposal-editor/proposal-tables.defaults";
import { InvestmentTableEditor } from "./InvestmentTableEditor";
import { PaymentTableEditor } from "./PaymentTableEditor";
import { TaxTableEditor } from "./TaxTableEditor";
import { CharacteristicsTableEditor } from "./CharacteristicsTableEditor";
import { ProposalTableEditor } from "./ProposalTableEditor";
import { Button } from "@/components/ui/button";

type Props = {
  proposalId: string;
  pageId: string;
  pageType: string;
};

function inferDefaultTableTypeFromPageType(pageType: string): ProposalTableType {
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
      return "custom";
  }
}

function renderTableEditor(
  table: ProposalTable,
  onChange: (next: ProposalTable) => void,
) {
  switch (table.table_type) {
    case "investimento":
    case "equipamentos":
      return <InvestmentTableEditor table={table} onChange={onChange} />;

    case "impostos":
      return <TaxTableEditor table={table} onChange={onChange} />;

    case "pagamento":
      return <PaymentTableEditor table={table} onChange={onChange} />;

    case "caracteristicas":
      return <CharacteristicsTableEditor table={table} onChange={onChange} />;

    default:
      return <ProposalTableEditor table={table} onChange={onChange} />;
  }
}

export function PageTablesEditor({ proposalId, pageId, pageType }: Props) {
  const { data, isLoading } = useProposalTables({
    proposalId,
    pageId,
  });

  const upsertMutation = useUpsertProposalTable(proposalId, pageId);
  const deleteMutation = useDeleteProposalTable(proposalId, pageId);

  const [localTables, setLocalTables] = React.useState<ProposalTable[]>([]);

  React.useEffect(() => {
    setLocalTables(data ?? []);
  }, [data]);

  const handleLocalChange = (index: number, nextTable: ProposalTable) => {
    const next = [...localTables];
    next[index] = nextTable;
    setLocalTables(next);
  };

  const handleSave = async (table: ProposalTable) => {
    await upsertMutation.mutateAsync({
      id: table.id,
      proposal_id: table.proposal_id,
      page_id: table.page_id,
      table_type: table.table_type,
      title: table.title,
      subtitle: table.subtitle,
      rows: table.rows,
      settings: table.settings,
      sort_order: table.sort_order,
    });
  };

  const handleCreateDefault = async () => {
    const tableType = inferDefaultTableTypeFromPageType(pageType);

    await upsertMutation.mutateAsync({
      proposal_id: proposalId,
      page_id: pageId,
      table_type: tableType,
      title: null,
      subtitle: null,
      rows: getDefaultTableRows(tableType),
      settings: getDefaultTableSettings(tableType),
      sort_order: localTables.length,
    });
  };

  const handleDelete = async (tableId: string) => {
    await deleteMutation.mutateAsync(tableId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando tabelas...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {localTables.length === 0 && (
        <div className="rounded-md border border-dashed p-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            Esta página ainda não possui tabela estruturada.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={handleCreateDefault}
            disabled={upsertMutation.isPending}
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Criar tabela desta página
          </Button>
        </div>
      )}

      {localTables.map((table, index) => (
        <div key={table.id} className="rounded-md border p-4 space-y-4">
          {renderTableEditor(table, (next) => handleLocalChange(index, next))}

          <div className="flex items-center justify-end gap-2 border-t pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(table.id)}
              disabled={deleteMutation.isPending}
            >
              Excluir tabela
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => handleSave(localTables[index])}
              disabled={upsertMutation.isPending}
            >
              {upsertMutation.isPending ? "Salvando..." : "Salvar tabela"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
