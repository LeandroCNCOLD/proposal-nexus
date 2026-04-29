import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { syncNomusPriceTables } from "@/integrations/nomus/server.functions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/app/propostas/tabelas-preco")({
  component: PriceTablesPage,
});

type SyncNomusPriceTablesResult = {
  success: boolean;
  tables: number;
  items: number;
  errors: Array<{ scope: "api" | "mapper" | "database"; message: string }>;
  error: string | null;
};

function PriceTablesPage() {
  const qc = useQueryClient();
  const syncPriceTables = useServerFn(syncNomusPriceTables);
  const [syncing, setSyncing] = useState(false);

  const { data: priceTables = [], isLoading } = useQuery({
    queryKey: ["nomus_price_tables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nomus_price_tables")
        .select("id, nomus_id, code, name, currency, is_active, synced_at")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = (await syncPriceTables({})) as SyncNomusPriceTablesResult;
      if (!res.success) {
        toast.error(`Erro ao sincronizar com Nomus: ${res.error ?? "Falha desconhecida"}`);
        return;
      }
      toast.success(
        `Sincronização concluída: ${res.tables} tabelas e ${res.items} produtos importados.`,
      );
      qc.invalidateQueries({ queryKey: ["nomus_price_tables"] });
      qc.invalidateQueries({ queryKey: ["nomus_price_table_items"] });
      qc.invalidateQueries({ queryKey: ["nomus_sync_state"] });
      qc.invalidateQueries({ queryKey: ["nomus_sync_log"] });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Erro ao sincronizar com Nomus: ${message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Tabelas de preço"
        subtitle={`${priceTables.length} tabela(s) importada(s) do Nomus`}
        actions={
          <Button onClick={handleSync} disabled={syncing}>
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sincronizar Nomus
          </Button>
        }
      />

      <div className="overflow-x-auto rounded-xl border bg-card shadow-[var(--shadow-sm)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Moeda</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Última sincronização</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Carregando tabelas...
                </TableCell>
              </TableRow>
            ) : priceTables.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Nenhuma tabela de preço importada.
                </TableCell>
              </TableRow>
            ) : (
              priceTables.map((table) => (
                <TableRow key={table.id}>
                  <TableCell className="font-medium">{table.name}</TableCell>
                  <TableCell>{table.code ?? table.nomus_id}</TableCell>
                  <TableCell>{table.currency ?? "BRL"}</TableCell>
                  <TableCell>{table.is_active ? "Ativa" : "Inativa"}</TableCell>
                  <TableCell>
                    {table.synced_at ? new Date(table.synced_at).toLocaleString("pt-BR") : "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
