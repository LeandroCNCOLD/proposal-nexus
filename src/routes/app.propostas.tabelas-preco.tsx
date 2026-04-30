import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CloudCog,
  Download,
  FileCode2,
  Loader2,
  RefreshCw,
  Search,
  Table2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import {
  nomusAuditPriceTables,
  nomusImportPriceTableCsv,
  nomusSyncPriceTables,
} from "@/integrations/nomus/server.functions";
import { decodeBytes, parseNomusCostsCsv } from "@/integrations/nomus/csv-parser";
import type { Database, Json } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/propostas/tabelas-preco")({
  component: PriceTablesPage,
  errorComponent: () => <PriceTablesErrorFallback />,
});

type PriceTable = Database["public"]["Tables"]["nomus_price_tables"]["Row"];
type PriceTableItem = Database["public"]["Tables"]["nomus_price_table_items"]["Row"];
type EquipmentPreview = {
  model: string | null;
  normalized_model_code: string | null;
  sync_status: string | null;
} | null;
type PriceTableItemView = PriceTableItem & { equipments?: EquipmentPreview };
type AlertFilter = "all" | "sem_preco" | "sem_custo" | "margem_negativa" | "margem_baixa";
type StatusFilter = "all" | "active" | "inactive" | "synced" | "pending";
type AuditSeverity = "all" | "crítica" | "alta" | "média" | "baixa";
type AuditFinding = {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  tableName: string;
  tableCode: string | null;
  price: number | null;
  cost: number | null;
  margin: number | null;
  expectedMargin: number | null;
  medianPrice: number | null;
  medianCost: number | null;
  medianMargin: number | null;
  severity: Exclude<AuditSeverity, "all">;
  score: number;
  reasons: string[];
};
type AuditResult = {
  ok: true;
  analyzedTables: number;
  analyzedItems: number;
  analyzedProducts: number;
  productsWithAlerts: number;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  findings: AuditFinding[];
};

const LOW_MARGIN_THRESHOLD = 15;

function PriceTablesPage() {
  const queryClient = useQueryClient();
  const syncPriceTables = useServerFn(nomusSyncPriceTables);
  const importPriceTableCsv = useServerFn(nomusImportPriceTableCsv);
  const auditPriceTables = useServerFn(nomusAuditPriceTables);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string>("all");
  const [openedTableId, setOpenedTableId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [alertFilter, setAlertFilter] = useState<AlertFilter>("all");
  const [productSearch, setProductSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [auditSeverity, setAuditSeverity] = useState<AuditSeverity>("all");
  const [auditSearch, setAuditSearch] = useState("");
  const [exporting, setExporting] = useState<"csv" | "xml" | null>(null);

  const priceTablesQuery = useQuery({
    queryKey: ["nomus-price-tables-ui"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nomus_price_tables")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PriceTable[];
    },
  });

  const summaryItemsQuery = useQuery({
    queryKey: ["nomus-price-table-items-summary-ui"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nomus_price_table_items")
        .select(
          "price_table_id, synced_at, unit_price, preco_liquido, preco_calculado, custo_producao_total, has_cost_data, margem_contribuicao",
        )
        .limit(10000);
      if (error) throw error;
      return (data ?? []) as Array<
        Pick<
          PriceTableItem,
          | "price_table_id"
          | "synced_at"
          | "unit_price"
          | "preco_liquido"
          | "preco_calculado"
          | "custo_producao_total"
          | "has_cost_data"
          | "margem_contribuicao"
        >
      >;
    },
  });

  const selectedTable = useMemo(
    () =>
      priceTablesQuery.data?.find((table) => table.id === openedTableId) ??
      priceTablesQuery.data?.[0] ??
      null,
    [openedTableId, priceTablesQuery.data],
  );
  const activeTableId = openedTableId ?? selectedTable?.id ?? null;

  const tableItemsQuery = useQuery({
    queryKey: ["nomus-price-table-items-ui", activeTableId],
    enabled: !!activeTableId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nomus_price_table_items")
        .select("*, equipments(model, normalized_model_code, sync_status)")
        .eq("price_table_id", activeTableId!)
        .order("synced_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as PriceTableItemView[];
    },
  });

  const tableSummaries = useMemo(
    () => buildTableSummaries(priceTablesQuery.data ?? [], summaryItemsQuery.data ?? []),
    [priceTablesQuery.data, summaryItemsQuery.data],
  );

  const filteredTables = useMemo(
    () =>
      tableSummaries.filter((table) => filterTableSummary(table, selectedTableId, statusFilter)),
    [tableSummaries, selectedTableId, statusFilter],
  );

  const filteredItems = useMemo(
    () =>
      (tableItemsQuery.data ?? []).filter((item) =>
        filterPriceTableItem(item, productSearch, alertFilter, statusFilter),
      ),
    [alertFilter, productSearch, statusFilter, tableItemsQuery.data],
  );

  const filteredAuditFindings = useMemo(
    () => filterAuditFindings(auditResult?.findings ?? [], auditSearch, auditSeverity),
    [auditResult?.findings, auditSearch, auditSeverity],
  );

  async function refreshData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["nomus-price-tables-ui"] }),
      queryClient.invalidateQueries({ queryKey: ["nomus-price-table-items-summary-ui"] }),
      queryClient.invalidateQueries({ queryKey: ["nomus-price-table-items-ui"] }),
    ]);
    toast.success("Dados atualizados.");
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await syncPriceTables();
      if (!result.ok) {
        toast.error(result.error || "Falha ao sincronizar tabelas de preço do Nomus.");
        return;
      }
      await refreshData();
      toast.success(
        `Sincronização concluída: ${result.count} tabela(s), ${result.itemsUpserted ?? 0} item(ns).`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Erro ao sincronizar com Nomus: ${message}`);
    } finally {
      setSyncing(false);
    }
  }

  async function handleAudit() {
    setAuditing(true);
    try {
      const result = await auditPriceTables({
        data: { maxResults: 500, priceDiffPct: 8, costDiffPct: 5, lowMarginPct: LOW_MARGIN_THRESHOLD },
      });
      setAuditResult(result as AuditResult);
      toast.success(`Auditoria concluída: ${result.findingsCount} divergência(s) encontrada(s).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Erro ao auditar tabelas: ${message}`);
    } finally {
      setAuditing(false);
    }
  }

  async function handleImportCsv(files: FileList | File[] | null | undefined) {
    const selectedFiles = Array.from(files ?? []).filter((file) =>
      file.name.toLowerCase().endsWith(".csv"),
    );
    if (selectedFiles.length === 0) return;
    setImporting(true);
    try {
      let importedTables = 0;
      let insertedTotal = 0;
      let updatedTotal = 0;
      let skippedTotal = 0;
      let lastPriceTableId: string | null = null;
      const warnings: string[] = [];
      const failures: string[] = [];

      for (const file of selectedFiles) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const parsed = parseNomusCostsCsv(decodeBytes(bytes));
        if (parsed.rows.length === 0) {
          failures.push(`${file.name}: ${parsed.warnings[0] ?? "CSV sem linhas válidas."}`);
          continue;
        }

        const result = await importPriceTableCsv({
          data: { filename: file.name, rows: parsed.rows },
        });
        if (!result.ok) {
          failures.push(`${file.name}: ${result.error || "Falha ao importar tabela CSV."}`);
          continue;
        }

        importedTables++;
        insertedTotal += result.inserted;
        updatedTotal += result.updated;
        skippedTotal += result.skipped;
        lastPriceTableId = result.priceTableId;
        if (parsed.warnings.length > 0) warnings.push(`${file.name}: ${parsed.warnings.join(" ")}`);
      }

      if (lastPriceTableId) {
        setOpenedTableId(lastPriceTableId);
        setSelectedTableId("all");
        await refreshData();
      }

      if (warnings.length > 0) toast.warning(warnings.join(" "));
      if (failures.length > 0) toast.error(failures.join(" "));
      if (importedTables > 0) {
        toast.success(
          `${importedTables} tabela(s) importada(s): ${insertedTotal} novo(s), ${updatedTotal} atualizado(s), ${skippedTotal} ignorado(s).`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Erro ao importar CSV(s): ${message}`);
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  async function exportItems(format: "csv" | "xml") {
    if (filteredItems.length === 0) {
      toast.warning("Nenhum produto disponível para exportação com os filtros atuais.");
      return;
    }
    setExporting(format);
    try {
      const filename = `tabela-preco-${selectedTable?.code ?? selectedTable?.name ?? "nomus"}-${new Date().toISOString().slice(0, 10)}.${format}`;
      const content =
        format === "csv" ? toItemsCsv(filteredItems) : toItemsXml(filteredItems, selectedTable);
      downloadTextFile(
        content,
        sanitizeFilename(filename),
        format === "csv" ? "text/csv;charset=utf-8" : "application/xml;charset=utf-8",
      );
      toast.success(`${format.toUpperCase()} exportado com ${filteredItems.length} produto(s).`);
    } finally {
      setExporting(null);
    }
  }

  function exportAuditCsv() {
    if (filteredAuditFindings.length === 0) {
      toast.warning("Nenhuma divergência disponível para exportação.");
      return;
    }
    downloadTextFile(
      toAuditCsv(filteredAuditFindings),
      `auditoria-tabelas-preco-${new Date().toISOString().slice(0, 10)}.csv`,
      "text/csv;charset=utf-8",
    );
    toast.success(`Auditoria exportada com ${filteredAuditFindings.length} divergência(s).`);
  }

  const isLoading = priceTablesQuery.isLoading || summaryItemsQuery.isLoading;
  const hasPageError = priceTablesQuery.isError || summaryItemsQuery.isError;
  const hasItemsError = tableItemsQuery.isError;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Tabelas de Preço"
        subtitle="Gestão das tabelas comerciais vindas do Nomus"
        actions={
          <>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,text/csv"
              multiple
              className="hidden"
              onChange={(event) => void handleImportCsv(event.target.files)}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Importar tabelas
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleSync()}
              disabled={syncing}
            >
              {syncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CloudCog className="mr-2 h-4 w-4" />
              )}
              Sincronizar com Nomus
            </Button>
            <Button variant="outline" size="sm" onClick={() => void refreshData()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </>
        }
      />

      <section className="grid gap-3 md:grid-cols-4">
        <SummaryBox label="Tabelas" value={tableSummaries.length.toLocaleString("pt-BR")} />
        <SummaryBox
          label="Produtos vinculados"
          value={summaryItemsQuery.data?.length.toLocaleString("pt-BR") ?? "—"}
        />
        <SummaryBox
          label="Tabelas ativas"
          value={tableSummaries.filter((table) => table.is_active).length.toLocaleString("pt-BR")}
        />
        <SummaryBox
          label="Com alertas"
          value={tableSummaries
            .filter((table) => table.alertsCount > 0)
            .length.toLocaleString("pt-BR")}
          warn
        />
      </section>

      <Card className="p-5 shadow-[var(--shadow-sm)]">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Table2 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Lista de tabelas comerciais</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Selecione uma tabela para ver preços, custos, margens e alertas por produto.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedTableId} onValueChange={setSelectedTableId}>
              <SelectTrigger className="w-full sm:w-[240px]">
                <SelectValue placeholder="Filtrar por tabela" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as tabelas</SelectItem>
                {tableSummaries.map((table) => (
                  <SelectItem key={table.id} value={table.id}>
                    {table.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="inactive">Inativas</SelectItem>
                <SelectItem value="synced">Sincronizados</SelectItem>
                <SelectItem value="pending">Pendências</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {hasPageError ? (
          <PriceTablesErrorFallback />
        ) : isLoading ? (
          <LoadingLine label="Carregando tabelas de preço..." />
        ) : filteredTables.length === 0 ? (
          <EmptyLine label="Nenhuma tabela encontrada com os filtros atuais." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {filteredTables.map((table) => (
              <button
                key={table.id}
                type="button"
                onClick={() => setOpenedTableId(table.id)}
                className={cn(
                  "rounded-lg border bg-card p-4 text-left shadow-[var(--shadow-sm)] transition hover:border-primary/50 hover:bg-muted/30",
                  activeTableId === table.id && "border-primary bg-muted/40",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{table.name}</div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">
                      {table.code ?? table.nomus_id}
                    </div>
                  </div>
                  <StatusBadge active={table.is_active} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <Metric label="Produtos" value={table.productCount.toLocaleString("pt-BR")} />
                  <Metric
                    label="Última sync"
                    value={formatDateTime(table.latestSyncAt ?? table.synced_at)}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {table.alertsCount > 0 ? (
                    <Badge variant="destructive">{table.alertsCount} alerta(s)</Badge>
                  ) : (
                    <Badge variant="secondary">Sem alertas</Badge>
                  )}
                  <Badge variant="outline">{table.currency ?? "BRL"}</Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5 shadow-[var(--shadow-sm)]">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">Produtos da tabela</h2>
              {selectedTable && <Badge variant="outline">{selectedTable.name}</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Detalhe comercial com preço, custo, margem, status e alertas visuais.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleSync()}
              disabled={syncing}
            >
              {syncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CloudCog className="mr-2 h-4 w-4" />
              )}
              Sincronizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void exportItems("csv")}
              disabled={exporting !== null || filteredItems.length === 0}
            >
              {exporting === "csv" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Exportar CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void exportItems("xml")}
              disabled={exporting !== null || filteredItems.length === 0}
            >
              {exporting === "xml" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileCode2 className="mr-2 h-4 w-4" />
              )}
              Exportar XML
            </Button>
          </div>
        </div>

        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_180px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filtrar por produto ou código..."
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={alertFilter}
            onValueChange={(value) => setAlertFilter(value as AlertFilter)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Alerta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os alertas</SelectItem>
              <SelectItem value="sem_preco">Sem preço</SelectItem>
              <SelectItem value="sem_custo">Sem custo</SelectItem>
              <SelectItem value="margem_negativa">Margem negativa</SelectItem>
              <SelectItem value="margem_baixa">Margem baixa</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
              <SelectItem value="synced">Sincronizados</SelectItem>
              <SelectItem value="pending">Pendências</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasItemsError ? (
          <PriceTablesErrorFallback />
        ) : tableItemsQuery.isLoading ? (
          <LoadingLine label="Carregando produtos da tabela..." />
        ) : filteredItems.length === 0 ? (
          <EmptyLine label="Nenhum produto encontrado para a tabela e filtros selecionados." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Código</TableHead>
                  <TableHead className="min-w-[260px]">Produto</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="min-w-[220px]">Alertas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const alerts = getItemAlerts(item);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{getItemCode(item)}</TableCell>
                      <TableCell>
                        <div className="font-medium">{getItemName(item)}</div>
                        <div className="text-xs text-muted-foreground">
                          Atualizado em {formatDateTime(item.synced_at)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(getItemPrice(item), item.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(getItemCost(item), item.currency)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          getItemMargin(item) != null &&
                            getItemMargin(item)! < 0 &&
                            "text-destructive",
                        )}
                      >
                        {formatPercent(getItemMargin(item))}
                      </TableCell>
                      <TableCell>
                        <ItemStatusBadge item={item} />
                      </TableCell>
                      <TableCell>
                        <AlertBadges alerts={alerts} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

function buildTableSummaries(
  tables: PriceTable[],
  items: Array<
    Pick<
      PriceTableItem,
      | "price_table_id"
      | "synced_at"
      | "unit_price"
      | "preco_liquido"
      | "preco_calculado"
      | "custo_producao_total"
      | "has_cost_data"
      | "margem_contribuicao"
    >
  >,
) {
  return tables.map((table) => {
    const tableItems = items.filter((item) => item.price_table_id === table.id);
    return {
      ...table,
      productCount: tableItems.length,
      latestSyncAt: getLatestDate(tableItems.map((item) => item.synced_at)),
      alertsCount: tableItems.filter((item) => getSummaryAlerts(item).length > 0).length,
    };
  });
}

function filterTableSummary(
  table: ReturnType<typeof buildTableSummaries>[number],
  selectedTableId: string,
  status: StatusFilter,
) {
  if (selectedTableId !== "all" && table.id !== selectedTableId) return false;
  if (status === "active" && !table.is_active) return false;
  if (status === "inactive" && table.is_active) return false;
  if (status === "pending" && table.alertsCount === 0) return false;
  return true;
}

function filterPriceTableItem(
  item: PriceTableItemView,
  search: string,
  alert: AlertFilter,
  status: StatusFilter,
) {
  const term = search.trim().toLowerCase();
  if (term && !`${getItemCode(item)} ${getItemName(item)}`.toLowerCase().includes(term))
    return false;
  if (alert !== "all" && !getItemAlerts(item).some((itemAlert) => itemAlert.key === alert))
    return false;
  if (status === "synced" && getItemAlerts(item).length > 0) return false;
  if (status === "pending" && getItemAlerts(item).length === 0) return false;
  return true;
}

function getSummaryAlerts(
  item: Pick<
    PriceTableItem,
    | "unit_price"
    | "preco_liquido"
    | "preco_calculado"
    | "custo_producao_total"
    | "has_cost_data"
    | "margem_contribuicao"
  >,
) {
  const price = firstNumber(item.preco_liquido, item.preco_calculado, item.unit_price);
  const cost = item.custo_producao_total;
  const margin = item.margem_contribuicao;
  return [
    ...(!price || price <= 0 ? ["sem_preco"] : []),
    ...(!item.has_cost_data || !cost || cost <= 0 ? ["sem_custo"] : []),
    ...(margin != null && margin < 0 ? ["margem_negativa"] : []),
    ...(margin != null && margin >= 0 && margin < LOW_MARGIN_THRESHOLD ? ["margem_baixa"] : []),
  ];
}

function getItemAlerts(item: PriceTableItemView): Array<{ key: AlertFilter; label: string }> {
  const alerts = getSummaryAlerts(item);
  return alerts.map((key) => ({
    key: key as AlertFilter,
    label:
      key === "sem_preco"
        ? "Sem preço"
        : key === "sem_custo"
          ? "Sem custo"
          : key === "margem_negativa"
            ? "Margem negativa"
            : "Margem baixa",
  }));
}

function getItemPrice(item: PriceTableItemView) {
  return firstNumber(item.preco_liquido, item.preco_calculado, item.unit_price);
}

function getItemCost(item: PriceTableItemView) {
  return firstNumber(item.custo_producao_total, item.custo_cif, item.custo_materiais);
}

function getItemMargin(item: PriceTableItemView) {
  return item.margem_contribuicao;
}

function getItemCode(item: PriceTableItemView) {
  return (
    item.equipments?.normalized_model_code ??
    readRawText(item.raw, ["codigo", "code", "produto_codigo", "model_code"]) ??
    item.nomus_product_id
  );
}

function getItemName(item: PriceTableItemView) {
  return (
    item.equipments?.model ??
    readRawText(item.raw, ["produto", "nome", "name", "descricao", "description"]) ??
    "Produto Nomus"
  );
}

function readRawText(raw: Json | null, keys: string[]) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return null;
}

function firstNumber(...values: Array<number | null | undefined>) {
  return values.find((value) => typeof value === "number" && Number.isFinite(value)) ?? null;
}

function getLatestDate(values: string[]) {
  const dates = values.map((value) => new Date(value).getTime()).filter(Number.isFinite);
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates)).toISOString();
}

function formatMoney(value: number | null, currency?: string | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency ?? "BRL" }).format(
    value,
  );
}

function formatPercent(value: number | null) {
  if (value == null) return "—";
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toItemsCsv(items: PriceTableItemView[]) {
  const rows = [["codigo", "produto", "preco", "custo", "margem", "status", "alertas"]];
  for (const item of items) {
    rows.push([
      getItemCode(item),
      getItemName(item),
      String(getItemPrice(item) ?? ""),
      String(getItemCost(item) ?? ""),
      String(getItemMargin(item) ?? ""),
      getItemAlerts(item).length > 0 ? "pendente" : "ok",
      getItemAlerts(item)
        .map((alert) => alert.label)
        .join("; "),
    ]);
  }
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

function toItemsXml(items: PriceTableItemView[], table: PriceTable | null) {
  const products = items
    .map(
      (item) => `  <produto codigo="${escapeXml(getItemCode(item))}">
    <nome>${escapeXml(getItemName(item))}</nome>
    <preco>${getItemPrice(item) ?? ""}</preco>
    <custo>${getItemCost(item) ?? ""}</custo>
    <margem>${getItemMargin(item) ?? ""}</margem>
    <status>${getItemAlerts(item).length > 0 ? "pendente" : "ok"}</status>
    <alertas>${escapeXml(
      getItemAlerts(item)
        .map((alert) => alert.label)
        .join("; "),
    )}</alertas>
  </produto>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<tabelaPreco nome="${escapeXml(table?.name ?? "")}" codigo="${escapeXml(table?.code ?? "")}">\n${products}\n</tabelaPreco>\n`;
}

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function sanitizeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}

function SummaryBox({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-[var(--shadow-sm)]">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold tabular-nums", warn && "text-destructive")}>
        {value}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge variant="secondary">
      <CheckCircle2 className="mr-1 h-3 w-3" />
      Ativa
    </Badge>
  ) : (
    <Badge variant="outline">Inativa</Badge>
  );
}

function ItemStatusBadge({ item }: { item: PriceTableItemView }) {
  return getItemAlerts(item).length > 0 ? (
    <Badge variant="destructive">
      <AlertTriangle className="mr-1 h-3 w-3" />
      Pendente
    </Badge>
  ) : (
    <Badge variant="secondary">
      <CheckCircle2 className="mr-1 h-3 w-3" />
      OK
    </Badge>
  );
}

function AlertBadges({ alerts }: { alerts: Array<{ key: AlertFilter; label: string }> }) {
  if (alerts.length === 0) return <Badge variant="secondary">Sem alertas</Badge>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {alerts.map((alert) => (
        <Badge key={alert.key} variant="destructive">
          {alert.label}
        </Badge>
      ))}
    </div>
  );
}

function PriceTablesErrorFallback() {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed py-12 text-sm text-muted-foreground">
      Erro ao carregar tabelas de preço.
    </div>
  );
}

function LoadingLine({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function EmptyLine({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed py-12 text-sm text-muted-foreground">
      {label}
    </div>
  );
}
