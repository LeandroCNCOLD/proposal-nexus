import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useState } from "react";
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
  tablesReceived: number;
  tablesSaved: number;
  itemsReceived: number;
  itemsMapped?: number;
  itemsSaved: number;
  errors: string[];
  error: string | null;
};

type JsonRecord = Record<string, unknown>;

type PriceTableItem = {
  id: string;
  nomus_product_id: string | null;
  unit_price: number | null;
  preco_liquido: number | null;
  preco_calculado: number | null;
  unidade_medida: string | null;
  raw: JsonRecord | null;
  equipments?: { model: string | null; normalized_model_code: string | null } | null;
};

type PriceTable = {
  id: string;
  nomus_id: string;
  code: string | null;
  name: string;
  currency: string | null;
  is_active: boolean;
  synced_at: string | null;
  nomus_price_table_items?: PriceTableItem[] | null;
};

function asRaw(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function pickRawString(raw: JsonRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key];
    if (value !== null && value !== undefined && value !== "") return String(value);
  }
  return null;
}

function parseNomusNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value).trim();
  if (!raw) return null;
  const cleaned = raw.replace(/\s+por\s+\w+/i, "").replace(/[^\d,.\-+]/g, "");
  if (!cleaned) return null;
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getItemName(item: PriceTableItem): string {
  const raw = asRaw(item.raw);
  return (
    item.equipments?.model ??
    pickRawString(raw, "nomeProduto") ??
    pickRawString(raw, "descricaoProduto") ??
    "Produto Nomus"
  );
}

function getItemCode(item: PriceTableItem): string {
  const raw = asRaw(item.raw);
  return (
    item.equipments?.normalized_model_code ??
    pickRawString(raw, "idProduto") ??
    pickRawString(raw, "codigoProduto") ??
    item.nomus_product_id ??
    ""
  );
}

function getItemDescription(item: PriceTableItem): string {
  const raw = asRaw(item.raw);
  return pickRawString(raw, "descricaoProduto") ?? pickRawString(raw, "nomeProduto") ?? "";
}

function getItemPrice(item: PriceTableItem): number | null {
  return (
    item.preco_liquido ??
    item.preco_calculado ??
    item.unit_price ??
    parseNomusNumber(asRaw(item.raw).preco)
  );
}

function getItemUnit(item: PriceTableItem): string {
  return item.unidade_medida ?? pickRawString(asRaw(item.raw), "siglaUnidadeMedidaProduto") ?? "";
}

function getItemAlerts(item: PriceTableItem): string[] {
  const alerts: string[] = [];
  if (!item.raw) alerts.push("sem raw");
  if (!item.equipments) alerts.push("sem vínculo");
  if (getItemPrice(item) === null) alerts.push("sem preço");
  return alerts;
}

function formatCurrency(value: number | null): string {
  if (value === null) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function PriceTablesPage() {
  const qc = useQueryClient();
  const syncPriceTables = useServerFn(syncNomusPriceTables);
  const [syncing, setSyncing] = useState(false);

  const { data: priceTables = [], isLoading } = useQuery({
    queryKey: ["nomus_price_tables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nomus_price_tables")
        .select(
          `
          id,
          nomus_id,
          code,
          name,
          currency,
          is_active,
          synced_at,
          nomus_price_table_items (
            id,
            nomus_product_id,
            unit_price,
            preco_liquido,
            preco_calculado,
            unidade_medida,
            raw,
            equipments (
              model,
              normalized_model_code
            )
          )
        `,
        )
        .order("name");
      if (error) throw error;
      return (data ?? []) as PriceTable[];
    },
  });

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = (await syncPriceTables({})) as SyncNomusPriceTablesResult;
      const debugMessage = `Recebido: ${res.tablesReceived} tabelas / ${res.itemsReceived} itens\nGravado: ${res.tablesSaved} tabelas / ${res.itemsSaved} itens`;
      if (!res.success) {
        toast.error(
          `${debugMessage}\nErro ao sincronizar com Nomus: ${res.error ?? "Falha desconhecida"}`,
        );
        return;
      }
      toast.success(debugMessage);
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
                <Fragment key={table.id}>
                  <TableRow key={table.id}>
                    <TableCell className="font-medium">{table.name}</TableCell>
                    <TableCell>{table.code ?? table.nomus_id}</TableCell>
                    <TableCell>{table.currency ?? "BRL"}</TableCell>
                    <TableCell>{table.is_active ? "Ativa" : "Inativa"}</TableCell>
                    <TableCell>
                      {table.synced_at ? new Date(table.synced_at).toLocaleString("pt-BR") : "-"}
                    </TableCell>
                  </TableRow>
                  <TableRow key={`${table.id}-items`}>
                    <TableCell colSpan={5} className="bg-muted/20 p-0">
                      <PriceTableItemsList items={table.nomus_price_table_items ?? []} />
                    </TableCell>
                  </TableRow>
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function PriceTableItemsList({ items }: { items: PriceTableItem[] }) {
  if (items.length === 0) {
    return (
      <div className="px-4 py-3 text-xs text-muted-foreground">
        Nenhum produto sincronizado nesta tabela.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto px-4 py-3">
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-1 pr-3 text-left font-medium">Produto</th>
            <th className="py-1 pr-3 text-left font-medium">Código/ID</th>
            <th className="py-1 pr-3 text-left font-medium">Unidade</th>
            <th className="py-1 pr-3 text-right font-medium">Preço</th>
            <th className="py-1 text-left font-medium">Alertas</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const description = getItemDescription(item);
            const alerts = getItemAlerts(item);
            return (
              <tr key={item.id} className="border-t">
                <td className="py-2 pr-3">
                  <div className="font-medium text-foreground">{getItemName(item)}</div>
                  {description ? (
                    <div className="mt-0.5 text-muted-foreground">{description}</div>
                  ) : null}
                </td>
                <td className="py-2 pr-3 font-mono text-[11px]">{getItemCode(item) || "-"}</td>
                <td className="py-2 pr-3">{getItemUnit(item) || "-"}</td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {formatCurrency(getItemPrice(item))}
                </td>
                <td className="py-2">
                  {alerts.length > 0 ? (
                    <span className="text-muted-foreground">{alerts.join(", ")}</span>
                  ) : (
                    <span className="text-primary">ok</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
