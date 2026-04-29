import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { syncNomusPriceTablesFn } from "@/integrations/nomus/server.functions";

export const Route = createFileRoute("/app/propostas/tabelas-preco")({
  component: ProposalPriceTablesPage,
});

type PriceTableRow = {
  id: string;
  nomus_id: string;
  name: string;
  code: string | null;
  currency: string | null;
  is_active: boolean;
  synced_at: string;
};

type PriceTableItemRow = {
  id: string;
  price_table_id: string;
  nomus_product_id: string;
  unit_price: number;
  currency: string | null;
  custo_producao_total: number | null;
  margem_contribuicao: number | null;
  unidade_medida: string | null;
  synced_at: string;
};

function escapeCsv(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const escaped = text.replace(/"/g, '""');
  return /[;"\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
}

function downloadTextFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportCsv(tables: PriceTableRow[], items: PriceTableItemRow[]) {
  const tableById = new Map(tables.map((table) => [table.id, table]));
  const header = [
    "tabela",
    "codigo_tabela",
    "produto_nomus_id",
    "preco",
    "custo",
    "margem",
    "moeda",
    "unidade",
    "sincronizado_em",
  ];
  const rows = items.map((item) => {
    const table = tableById.get(item.price_table_id);
    return [
      table?.name,
      table?.code,
      item.nomus_product_id,
      item.unit_price,
      item.custo_producao_total,
      item.margem_contribuicao,
      item.currency ?? table?.currency,
      item.unidade_medida,
      item.synced_at,
    ]
      .map(escapeCsv)
      .join(";");
  });
  downloadTextFile([header.join(";"), ...rows].join("\n"), "tabelas-preco-nomus.csv", "text/csv");
}

function exportXml(tables: PriceTableRow[], items: PriceTableItemRow[]) {
  const itemsByTable = new Map<string, PriceTableItemRow[]>();
  for (const item of items) {
    const list = itemsByTable.get(item.price_table_id) ?? [];
    list.push(item);
    itemsByTable.set(item.price_table_id, list);
  }
  const xmlEscape = (value: unknown) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  const body = tables
    .map((table) => {
      const tableItems = (itemsByTable.get(table.id) ?? [])
        .map(
          (item) => `    <item>
      <produtoId>${xmlEscape(item.nomus_product_id)}</produtoId>
      <preco>${xmlEscape(item.unit_price)}</preco>
      <custo>${xmlEscape(item.custo_producao_total)}</custo>
      <margem>${xmlEscape(item.margem_contribuicao)}</margem>
      <moeda>${xmlEscape(item.currency ?? table.currency)}</moeda>
      <unidade>${xmlEscape(item.unidade_medida)}</unidade>
    </item>`,
        )
        .join("\n");
      return `  <tabela>
    <id>${xmlEscape(table.nomus_id)}</id>
    <nome>${xmlEscape(table.name)}</nome>
    <codigo>${xmlEscape(table.code)}</codigo>
    <moeda>${xmlEscape(table.currency)}</moeda>
${tableItems}
  </tabela>`;
    })
    .join("\n");
  downloadTextFile(
    `<?xml version="1.0" encoding="UTF-8"?>\n<tabelasPreco>\n${body}\n</tabelasPreco>`,
    "tabelas-preco-nomus.xml",
    "application/xml",
  );
}

function ProposalPriceTablesPage() {
  const queryClient = useQueryClient();
  const syncFn = useServerFn(syncNomusPriceTablesFn);

  const tablesQuery = useQuery({
    queryKey: ["nomus-price-tables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nomus_price_tables")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PriceTableRow[];
    },
  });

  const itemsQuery = useQuery({
    queryKey: ["nomus-price-table-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nomus_price_table_items")
        .select("*")
        .order("synced_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as PriceTableItemRow[];
    },
  });

  const invalidatePriceTableQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["nomus-price-tables"] }),
      queryClient.invalidateQueries({ queryKey: ["nomus-price-table-items"] }),
    ]);
  };

  const handleSync = async () => {
    const result = await syncFn();
    if (!result.success) {
      const message = result.errors[0] ?? "Erro ao sincronizar com Nomus.";
      if (/autentica|authentication|401/i.test(message)) {
        throw new Error("Erro de autenticação com Nomus");
      }
      throw new Error(message);
    }
    await invalidatePriceTableQueries();
    toast.success(
      `Sincronização concluída: ${result.tables} tabelas e ${result.items} produtos importados.`,
    );
    return result;
  };

  const syncMutation = useMutation({
    mutationFn: handleSync,
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Falha ao sincronizar com o Nomus.";
      toast.error(`Erro ao sincronizar com Nomus: ${message}`);
    },
  });

  const refreshLocal = async () => {
    await invalidatePriceTableQueries();
    toast.success("Tela atualizada com dados locais.");
  };

  const tables = tablesQuery.data ?? [];
  const items = itemsQuery.data ?? [];
  const loadingLocal = tablesQuery.isLoading || itemsQuery.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tabelas de preço Nomus</h1>
          <p className="text-sm text-muted-foreground">
            Dados comerciais sincronizados do Nomus para uso em propostas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={refreshLocal} disabled={loadingLocal}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar tela
          </Button>
          <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
            {syncMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sincronizar com Nomus
          </Button>
          <Button
            variant="outline"
            onClick={() => exportCsv(tables, items)}
            disabled={items.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => exportXml(tables, items)}
            disabled={items.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            XML
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Tabelas</div>
          <div className="mt-1 text-2xl font-semibold">{tables.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Itens</div>
          <div className="mt-1 text-2xl font-semibold">{items.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Sem custo</div>
          <div className="mt-1 text-2xl font-semibold">
            {items.filter((item) => item.custo_producao_total == null).length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Última atualização</div>
          <div className="mt-1 text-sm font-medium">
            {tables[0]?.synced_at ? new Date(tables[0].synced_at).toLocaleString("pt-BR") : "—"}
          </div>
        </Card>
      </div>

      <Card className="p-0">
        {loadingLocal ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tabela</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Moeda</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Itens</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tables.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhuma tabela de preço sincronizada. Clique em Sincronizar com Nomus para
                    importar.
                  </TableCell>
                </TableRow>
              ) : (
                tables.map((table) => (
                  <TableRow key={table.id}>
                    <TableCell className="font-medium">{table.name}</TableCell>
                    <TableCell className="font-mono text-xs">{table.code ?? "—"}</TableCell>
                    <TableCell>{table.currency ?? "—"}</TableCell>
                    <TableCell>{table.is_active ? "Ativa" : "Inativa"}</TableCell>
                    <TableCell className="text-right">
                      {items.filter((item) => item.price_table_id === table.id).length}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
