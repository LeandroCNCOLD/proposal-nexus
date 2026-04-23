import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  listProposalTables,
  upsertProposalTable,
} from "@/integrations/proposal-editor/tables.functions";
import {
  DEFAULT_TABLE_COLUMNS,
  type ProposalTable,
  type ProposalTableRow,
  type TableColumn,
} from "@/integrations/proposal-editor/types";
import { StructuredTableEditor } from "./StructuredTableEditor";

interface Props {
  proposalId: string;
  pageId: string;
  type: keyof typeof DEFAULT_TABLE_COLUMNS;
  defaultTitle: string;
  showTotal?: boolean;
  helpText?: string;
}

export function TableBlockEditor({
  proposalId,
  pageId,
  type,
  defaultTitle,
  showTotal,
  helpText,
}: Props) {
  const list = useServerFn(listProposalTables);
  const upsert = useServerFn(upsertProposalTable);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["proposal-tables", proposalId],
    queryFn: () => list({ data: { proposalId } }),
  });

  const existing: ProposalTable | undefined = data?.tables.find((t) => t.page_id === pageId);
  const columns: TableColumn[] =
    (existing?.columns as TableColumn[] | null | undefined) ?? DEFAULT_TABLE_COLUMNS[type];

  const [title, setTitle] = useState(defaultTitle);
  const [rows, setRows] = useState<ProposalTableRow[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (existing) {
      setTitle(existing.title || defaultTitle);
      setRows(existing.rows ?? []);
      setDirty(false);
    } else {
      setTitle(defaultTitle);
      setRows([]);
      setDirty(false);
    }
  }, [existing, defaultTitle, pageId]);

  const saveMut = useMutation({
    mutationFn: () =>
      upsert({
        data: { proposalId, pageId, type, title, rows, columns: null },
      }),
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["proposal-tables", proposalId] });
      toast.success("Tabela salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // auto-save debounced
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => saveMut.mutate(), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, title, dirty]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Carregando tabela…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Título da seção</Label>
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setDirty(true);
          }}
          className="h-8 text-sm"
        />
      </div>
      {helpText ? (
        <p className="text-[11px] text-muted-foreground">{helpText}</p>
      ) : null}
      <StructuredTableEditor
        columns={columns}
        rows={rows}
        onChange={(next) => {
          setRows(next);
          setDirty(true);
        }}
        showTotal={showTotal}
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={() => saveMut.mutate()}
          disabled={!dirty || saveMut.isPending}
        >
          {saveMut.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-3.5 w-3.5" />
          )}
          Salvar tabela
        </Button>
      </div>
    </div>
  );
}
