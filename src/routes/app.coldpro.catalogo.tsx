import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Database,
  Loader2, ArrowLeft, History, Layers, Thermometer,
  ChevronLeft, ChevronRight, FolderTree, Download, FileCode2,
  Package, CircleDollarSign, Clock3, XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  parseCatalogFile,
  type ParseResult,
} from "@/features/coldpro/catalog-import.parser";
import {
  importParsedCatalog,
  type ImportProgress,
} from "@/features/coldpro/catalog-import.functions";
import { ColdProModelDetailDialog } from "@/components/coldpro/ColdProModelDetailDialog";

export const Route = createFileRoute("/app/coldpro/catalogo")({
  component: CatalogoPage,
});

function CatalogoPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [search, setSearch] = useState("");
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<"csv" | "xml" | null>(null);

  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState<number>(1);
  const [groupByLine, setGroupByLine] = useState<boolean>(false);

  // Lista de modelos do catálogo + agregado de tensões/pontos por modelo
  const modelsQuery = useQuery({
    queryKey: ["coldpro-models"],
    queryFn: async () => {
      const [modelsRes, perfRes, voltageRes] = await Promise.all([
        supabase
          .from("coldpro_equipment_models")
          .select("*")
          .order("linha", { ascending: true, nullsFirst: false })
          .order("modelo", { ascending: true })
          .limit(5000),
        supabase
          .from("coldpro_equipment_performance_points")
          .select("equipment_model_id, voltage")
          .limit(10000),
        supabase
          .from("coldpro_equipment_models")
          .select("voltage_value_v, phase_count"),
      ]);
      if (modelsRes.error) throw modelsRes.error;
      if (perfRes.error) throw perfRes.error;
      if (voltageRes.error) throw voltageRes.error;

      const stats = new Map<string, { points: number; voltages: Set<string> }>();
      for (const p of perfRes.data ?? []) {
        const key = p.equipment_model_id;
        if (!key) continue;
        if (!stats.has(key)) stats.set(key, { points: 0, voltages: new Set() });
        const s = stats.get(key)!;
        s.points++;
        if (p.voltage) s.voltages.add(p.voltage);
      }
      const voltageSummary = {
        total: voltageRes.data?.length ?? 0,
        v220_3f: voltageRes.data?.filter((m) => m.voltage_value_v === 220 && m.phase_count === 3).length ?? 0,
        v380_3f: voltageRes.data?.filter((m) => m.voltage_value_v === 380 && m.phase_count === 3).length ?? 0,
        points220_3f: (perfRes.data ?? []).filter((p) => /220/i.test(p.voltage ?? "") && /(3F|tri|trif)/i.test(p.voltage ?? "")).length,
        points380_3f: (perfRes.data ?? []).filter((p) => /380/i.test(p.voltage ?? "") && /(3F|tri|trif)/i.test(p.voltage ?? "")).length,
      };

      const rows = (modelsRes.data ?? []).map((m) => {
        const model = m as typeof m & { electrical_configuration?: string | null };
        const s = stats.get(m.id);
        return {
          ...model,
          point_count: s?.points ?? 0,
          voltages: s ? Array.from(s.voltages).sort() : model.electrical_configuration ? [model.electrical_configuration] : [],
        };
      });
      return { rows, voltageSummary };
    },
  });

  // Histórico de importações
  const importsQuery = useQuery({
    queryKey: ["coldpro-imports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coldpro_catalog_imports")
        .select("id, filename, total_rows, valid_rows, models_created, models_updated, performance_points_created, status, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setParsed(null);
    setParsing(true);
    try {
      const result = await parseCatalogFile(f);
      setParsed(result);
      toast.success(
        `Planilha lida: ${result.totalRows} linhas, ${result.uniqueModels} modelos únicos`
      );
    } catch (err) {
      toast.error(
        `Erro ao ler planilha: ${err instanceof Error ? err.message : "desconhecido"}`
      );
      setFile(null);
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (!file || !parsed) return;
    setImporting(true);
    setProgress({ phase: "creating-import", current: 0, total: 1, message: "Iniciando..." });
    try {
      const out = await importParsedCatalog(file, parsed, (p) => setProgress(p));
      toast.success(
        `Importação concluída: ${out.modelsCreated} modelos novos, ${out.modelsUpdated} atualizados, ${out.performancePoints} pontos de curva.`
      );
      setFile(null);
      setParsed(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await qc.invalidateQueries({ queryKey: ["coldpro-models"] });
      await qc.invalidateQueries({ queryKey: ["coldpro-imports"] });
    } catch (err) {
      toast.error(
        `Falha na importação: ${err instanceof Error ? err.message : "desconhecido"}`
      );
    } finally {
      setImporting(false);
      setProgress(null);
    }
  }

  const catalogRows = modelsQuery.data?.rows ?? [];
  const latestSyncAt = importsQuery.data?.[0]?.created_at ?? null;
  const productsWithoutPrice = catalogRows.filter((m) => !hasPositiveCatalogValue(readCatalogValue(m, PRICE_ALIASES))).length;
  const productsWithoutCost = catalogRows.filter((m) => !hasPositiveCatalogValue(readCatalogValue(m, COST_ALIASES))).length;
  const productsWithAlerts = catalogRows.filter((m) => getCatalogAlerts(m).length > 0).length;
  const filteredModels = catalogRows.filter((m) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      m.modelo?.toLowerCase().includes(q) ||
      m.linha?.toLowerCase().includes(q) ||
      m.refrigerante?.toLowerCase().includes(q) ||
      m.tipo_gabinete?.toLowerCase().includes(q) ||
      m.gabinete?.toLowerCase().includes(q)
    );
  });

  // Reset de página quando filtros mudam
  const totalPages = Math.max(1, Math.ceil(filteredModels.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedModels = filteredModels.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Agrupamento por linha (aplicado sobre página atual)
  const groupedModels = (() => {
    if (!groupByLine) return null;
    const map = new Map<string, typeof pagedModels>();
    for (const m of pagedModels) {
      const key = m.linha ?? "Sem linha";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  })();

  async function handleCatalogExport(format: "csv" | "xml") {
    if (catalogRows.length === 0) {
      toast.warning("Nenhum produto disponível para exportar.");
      return;
    }

    setExportingFormat(format);
    const toastId = toast.loading(`Preparando catálogo completo em ${format.toUpperCase()}...`);
    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      const completeCatalog = await fetchCompleteCatalogExportData();
      const content = format === "csv" ? toCatalogCsv(completeCatalog) : toCatalogXml(completeCatalog);
      downloadTextFile(content, `catalogo-coldpro-${timestamp}.${format}`, format === "csv" ? "text/csv;charset=utf-8" : "application/xml;charset=utf-8");
      toast.success(`${format.toUpperCase()} completo baixado com ${completeCatalog.models.length} produto(s) e ${completeCatalog.performancePoints.length} ponto(s) de curva.`, { id: toastId });
    } catch (err) {
      toast.error(`Não foi possível baixar o ${format.toUpperCase()}: ${err instanceof Error ? err.message : "erro desconhecido"}`, { id: toastId });
    } finally {
      setExportingFormat(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/app/coldpro" className="flex items-center gap-1 hover:text-foreground">
                <ArrowLeft className="h-3.5 w-3.5" />
                ColdPro
              </Link>
              <span>/</span>
              <span>Catálogo de Equipamentos</span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Database className="h-6 w-6 text-primary" />
              Catálogo CN ColdPro
            </h1>
            <p className="text-sm text-muted-foreground">
              Importe a planilha técnica e o sistema distribui automaticamente nos bancos certos.
            </p>
          </div>
        </div>

        {/* Bloco de importação */}
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Importar planilha do catálogo</h2>
              <p className="text-sm text-muted-foreground">
                Selecione um arquivo .xlsx com a estrutura padrão (modelo, linha, refrigerante, performance).
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  disabled={parsing || importing}
                  className="hidden"
                  id="catalog-file"
                />
                <Button
                  asChild
                  variant="outline"
                  disabled={parsing || importing}
                >
                  <label htmlFor="catalog-file" className="cursor-pointer">
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Escolher arquivo
                  </label>
                </Button>
                {file && (
                  <span className="text-sm text-muted-foreground">
                    {file.name} • {(file.size / 1024).toFixed(0)} KB
                  </span>
                )}
                {parsing && (
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Lendo planilha...
                  </span>
                )}
              </div>

              {/* Preview */}
              {parsed && (
                <div className="mt-6 rounded-lg border bg-muted/30 p-4">
                  <h3 className="mb-3 text-sm font-semibold">Prévia da importação</h3>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <Stat label="Linhas totais" value={parsed.totalRows} />
                    <Stat label="Linhas válidas" value={parsed.validRows} valid />
                    <Stat label="Linhas ignoradas" value={parsed.skippedRows} warn />
                  <Stat label="Variações oficiais" value={parsed.uniqueModels} />
                  </div>
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">Refrigerantes</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {parsed.refrigerants.slice(0, 12).map((r) => (
                          <Badge key={r} variant="secondary">{r}</Badge>
                        ))}
                        {parsed.refrigerants.length === 0 && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">Linhas (HT/MT/LT)</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {parsed.lines.map((l) => (
                          <Badge key={l} variant="outline">{l}</Badge>
                        ))}
                        {parsed.lines.length === 0 && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {parsed.unmappedHeaders.length > 0 && (
                    <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                      <div className="flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {parsed.unmappedHeaders.length} colunas não foram mapeadas (serão preservadas em "raw")
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setParsed(null);
                        setFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      disabled={importing}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleImport} disabled={importing || parsed.validRows === 0}>
                      {importing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Importando...
                        </>
                      ) : (
                        <>
                          <Database className="mr-2 h-4 w-4" />
                          Importar catálogo ({parsed.validRows} pontos)
                        </>
                      )}
                    </Button>
                  </div>

                  {progress && (
                    <div className="mt-3 text-xs text-muted-foreground">
                      {progress.message} ({progress.current}/{progress.total})
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Modelos no catálogo */}
        <Card className="p-6">
          <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_auto]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Catálogo de produtos integrado ao Nomus</h2>
                <Badge variant="secondary">{catalogRows.length} produtos</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Visualização operacional de código, preço, custo, margem, status e sincronização.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <CatalogSummaryPill icon={Package} label="Produtos" value={catalogRows.length.toLocaleString("pt-BR")} />
              <CatalogSummaryPill icon={CircleDollarSign} label="Sem preço" value={productsWithoutPrice.toLocaleString("pt-BR")} warn={productsWithoutPrice > 0} />
              <CatalogSummaryPill icon={AlertTriangle} label="Alertas" value={productsWithAlerts.toLocaleString("pt-BR")} warn={productsWithAlerts > 0} />
              <CatalogSummaryPill icon={Clock3} label="Última sync" value={formatCatalogDate(latestSyncAt)} />
            </div>
          </div>

          {(productsWithoutPrice > 0 || productsWithoutCost > 0) && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-background">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-foreground">Produtos precisam de atenção comercial</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-muted-foreground">
                    {productsWithoutPrice > 0 && <Badge variant="destructive">{productsWithoutPrice} sem preço</Badge>}
                    {productsWithoutCost > 0 && <Badge variant="destructive">{productsWithoutCost} sem custo</Badge>}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {modelsQuery.data?.voltageSummary && (
                <>
                  <Badge variant="outline" className="font-mono">220V 3F: {modelsQuery.data.voltageSummary.v220_3f}</Badge>
                  <Badge variant="outline" className="font-mono">380V 3F: {modelsQuery.data.voltageSummary.v380_3f}</Badge>
                  <Badge variant="secondary" className="font-mono">Curvas 220V 3F: {modelsQuery.data.voltageSummary.points220_3f}</Badge>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleCatalogExport("csv")}
                  disabled={modelsQuery.isLoading || exportingFormat !== null || catalogRows.length === 0}
                  className="bg-card"
                >
                  {exportingFormat === "csv" ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-1.5 h-4 w-4" />
                  )}
                  Baixar CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleCatalogExport("xml")}
                  disabled={modelsQuery.isLoading || exportingFormat !== null || catalogRows.length === 0}
                  className="bg-card"
                >
                  {exportingFormat === "xml" ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <FileCode2 className="mr-1.5 h-4 w-4" />
                  )}
                  Baixar XML
                </Button>
              </div>
              <Button
                variant={groupByLine ? "default" : "outline"}
                size="sm"
                onClick={() => { setGroupByLine((v) => !v); setPage(1); }}
              >
                <FolderTree className="mr-1.5 h-4 w-4" />
                Agrupar por linha
              </Button>
              <Input
                placeholder="Buscar modelo, linha ou refrigerante..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full sm:w-[320px]"
              />
            </div>
          </div>

          {modelsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Thermometer className="mb-2 h-10 w-10 opacity-30" />
              <p className="text-sm">Nenhum modelo cadastrado ainda. Importe a planilha acima para começar.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Código</TableHead>
                      <TableHead className="min-w-[280px]">Nome</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead className="text-right">Margem</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Última sincronização</TableHead>
                      <TableHead>Alertas</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedModels
                      ? groupedModels.map(([linha, items]) => (
                          <Fragment key={`group-${linha}`}>
                            <TableRow key={`group-${linha}`} className="bg-muted/40 hover:bg-muted/40">
                              <TableCell colSpan={9} className="py-2 font-semibold text-sm">
                                <span className="inline-flex items-center gap-2">
                                  <FolderTree className="h-4 w-4 text-primary" />
                                  {linha}
                                  <Badge variant="secondary">{items.length} modelos</Badge>
                                </span>
                              </TableCell>
                            </TableRow>
                            {items.map((m) => (
                              <ModelRow key={m.id} m={m} indent onClick={() => setSelectedModelId(m.id)} />
                            ))}
                          </Fragment>
                        ))
                      : pagedModels.map((m) => (
                          <ModelRow key={m.id} m={m} onClick={() => setSelectedModelId(m.id)} />
                        ))}
                  </TableBody>
                </Table>
              </div>

              {/* Paginação */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                <div className="text-muted-foreground">
                  Mostrando{" "}
                  <span className="font-medium text-foreground">
                    {(safePage - 1) * pageSize + 1}
                    {" – "}
                    {Math.min(safePage * pageSize, filteredModels.length)}
                  </span>{" "}
                  de{" "}
                  <span className="font-medium text-foreground">{filteredModels.length}</span> modelos
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Por página:</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}
                  >
                    <SelectTrigger className="w-[90px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="30">30</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="9999">Todos</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[80px] text-center text-muted-foreground">
                    Página {safePage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>

        {/* Histórico */}
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Histórico de importações</h2>
          </div>
          {importsQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : (importsQuery.data ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhuma importação realizada ainda.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead className="text-right">Linhas</TableHead>
                    <TableHead className="text-right">Modelos novos</TableHead>
                    <TableHead className="text-right">Atualizados</TableHead>
                    <TableHead className="text-right">Pontos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Quando</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(importsQuery.data ?? []).map((imp) => (
                    <TableRow key={imp.id}>
                      <TableCell className="font-medium">{imp.filename}</TableCell>
                      <TableCell className="text-right">{imp.total_rows}</TableCell>
                      <TableCell className="text-right">{imp.models_created}</TableCell>
                      <TableCell className="text-right">{imp.models_updated}</TableCell>
                      <TableCell className="text-right">{imp.performance_points_created}</TableCell>
                      <TableCell>
                        {imp.status === "success" ? (
                          <Badge className="bg-emerald-600">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Sucesso
                          </Badge>
                        ) : imp.status === "error" ? (
                          <Badge variant="destructive">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Erro
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{imp.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(imp.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

      <ColdProModelDetailDialog
        modelId={selectedModelId}
        open={!!selectedModelId}
        onOpenChange={(o) => { if (!o) setSelectedModelId(null); }}
      />
      </div>
  );
}

function Stat({ label, value, valid, warn }: { label: string; value: number; valid?: boolean; warn?: boolean }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${valid ? "text-emerald-600" : warn && value > 0 ? "text-amber-600" : "text-foreground"}`}>
        {value.toLocaleString("pt-BR")}
      </div>
    </div>
  );
}

type ModelRowData = {
  id: string;
  modelo: string | null;
  linha: string | null;
  designacao_hp: string | null;
  gabinete: string | null;
  tipo_gabinete: string | null;
  tipo_degelo: string | null;
  electrical_configuration?: string | null;
  voltage_value_v?: number | null;
  phase_count?: number | null;
  frequency_hz?: number | null;
  catalog_variant_key?: string | null;
  active: boolean;
  smart_description?: string | null;
  description_confidence?: string | null;
  point_count: number;
  voltages: string[];
  created_at?: string | null;
  updated_at?: string | null;
  source_import_id?: string | null;
  raw?: unknown;
};

type CatalogExportData = {
  models: Record<string, unknown>[];
  compressors: Record<string, unknown>[];
  condensers: Record<string, unknown>[];
  evaporators: Record<string, unknown>[];
  performancePoints: Record<string, unknown>[];
  refrigerants: Record<string, unknown>[];
};

const CODE_ALIASES = ["codigo", "código", "sku", "cod_produto", "codigo_produto", "codigoNomus", "codigo_nomus", "idProduto", "produtoId"];
const PRICE_ALIASES = ["preco", "preço", "preco_venda", "preço_venda", "valor_venda", "unit_price", "price", "precoUnitario", "valorUnitario"];
const COST_ALIASES = ["custo", "custo_unitario", "valor_custo", "cost", "cost_price", "preco_custo", "preço_custo", "custoUnitario"];
const MARGIN_ALIASES = ["margem", "margin", "margem_percentual", "margem_pct", "percentual_margem", "markup"];

function CatalogSummaryPill({ icon: Icon, label, value, warn }: { icon: LucideIcon; label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
      <Icon className={`h-4 w-4 ${warn ? "text-destructive" : "text-primary"}`} />
      <div>
        <div className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold tabular-nums">{value}</div>
      </div>
    </div>
  );
}

function CatalogAlertBadges({ alerts }: { alerts: string[] }) {
  if (alerts.length === 0) {
    return <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3" /> OK</Badge>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {alerts.map((alert) => (
        <Badge key={alert} variant="destructive" className="gap-1 whitespace-nowrap">
          <XCircle className="h-3 w-3" />
          {alert}
        </Badge>
      ))}
    </div>
  );
}

function getCatalogCode(row: ModelRowData): string {
  const code = readCatalogText(row, CODE_ALIASES);
  return code || row.catalog_variant_key || row.modelo || "—";
}

function getCatalogAlerts(row: ModelRowData): string[] {
  const alerts: string[] = [];
  if (!hasPositiveCatalogValue(readCatalogValue(row, PRICE_ALIASES))) alerts.push("Sem preço");
  if (!hasPositiveCatalogValue(readCatalogValue(row, COST_ALIASES))) alerts.push("Sem custo");
  return alerts;
}

function readCatalogMargin(row: ModelRowData): number | null {
  return readCatalogValue(row, MARGIN_ALIASES);
}

function readCatalogValue(row: ModelRowData, aliases: string[]): number | null {
  const value = readCatalogUnknown(row, aliases);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[^0-9,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function readCatalogText(row: ModelRowData, aliases: string[]): string | null {
  const value = readCatalogUnknown(row, aliases);
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function readCatalogUnknown(row: ModelRowData, aliases: string[]): unknown {
  const sources = [row, isPlainRecord(row.raw) ? row.raw : null].filter(Boolean) as Record<string, unknown>[];
  const normalizedAliases = aliases.map(normalizeCatalogKey);
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (normalizedAliases.includes(normalizeCatalogKey(key))) return value;
    }
  }
  return null;
}

function hasPositiveCatalogValue(value: number | null): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function formatCatalogMoney(value: number | null): string {
  if (!hasPositiveCatalogValue(value)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value as number);
}

function formatCatalogMargin(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const margin = Math.abs(value) <= 1 ? value * 100 : value;
  return `${margin.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatCatalogDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function normalizeCatalogKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "").toLowerCase();
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ModelRow({ m, indent, onClick }: { m: ModelRowData; indent?: boolean; onClick: () => void }) {
  const code = getCatalogCode(m);
  const price = readCatalogValue(m, PRICE_ALIASES);
  const cost = readCatalogValue(m, COST_ALIASES);
  const margin = readCatalogMargin(m);
  const alerts = getCatalogAlerts(m);

  return (
    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onClick}>
      <TableCell className={`font-mono text-xs font-semibold text-muted-foreground ${indent ? "pl-8" : ""}`}>
        {code}
      </TableCell>
      <TableCell className="font-medium text-primary">
        <div className="flex flex-col">
          <span>{m.modelo}</span>
          {m.designacao_hp && m.designacao_hp !== "-" && (
            <span className="text-[11px] font-normal text-muted-foreground">{m.designacao_hp}</span>
          )}
          {m.smart_description && (
            <span className="mt-1 text-[11px] font-normal text-muted-foreground line-clamp-1">
              {m.smart_description}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">{formatCatalogMoney(price)}</TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">{formatCatalogMoney(cost)}</TableCell>
      <TableCell className="text-right">{formatCatalogMargin(margin)}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {m.linha && <Badge variant="secondary" className="text-[10px] py-0 px-1.5">{m.linha}</Badge>}
          {splitEquipmentTypes(m.tipo_gabinete).map((tipo) => (
            <Badge key={tipo} variant="outline" className="text-[10px] py-0 px-1.5">
              {tipo}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        <div className="flex flex-col">
          <span>{formatCatalogDate(m.updated_at)}</span>
          <span>{m.source_import_id ? "Importado" : "Sem vínculo"}</span>
        </div>
      </TableCell>
      <TableCell><CatalogAlertBadges alerts={alerts} /></TableCell>
      <TableCell className="text-right">
        {m.active ? (
          <Badge variant="default" className="bg-emerald-600">Ativo</Badge>
        ) : (
          <Badge variant="secondary">Inativo</Badge>
        )}
      </TableCell>
    </TableRow>
  );
}

function splitEquipmentTypes(value: string | null): string[] {
  if (!value) return ["—"];
  const types = value
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return types.length ? types : [value];
}

async function fetchCompleteCatalogExportData(): Promise<CatalogExportData> {
  const [models, compressors, condensers, evaporators, performancePoints, refrigerants] = await Promise.all([
    fetchAllRows("coldpro_equipment_models", "*", "modelo"),
    fetchAllRows("coldpro_equipment_compressors", "*", "equipment_model_id"),
    fetchAllRows("coldpro_equipment_condensers", "*", "equipment_model_id"),
    fetchAllRows("coldpro_equipment_evaporators", "*", "equipment_model_id"),
    fetchAllRows("coldpro_equipment_performance_points", "*", "equipment_model_id"),
    fetchAllRows("coldpro_equipment_model_refrigerants", "*, refrigerant:coldpro_refrigerants(*)", "equipment_model_id"),
  ]);
  return { models, compressors, condensers, evaporators, performancePoints, refrigerants };
}

async function fetchAllRows(table: string, select: string, orderColumn: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await (supabase as any)
      .from(table)
      .select(select)
      .order(orderColumn, { ascending: true, nullsFirst: false })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

function toCatalogCsv(data: CatalogExportData): string {
  const headers = buildCsvHeaders(data);
  const related = buildRelatedIndexes(data);
  const body = data.models.flatMap((model) => {
    const modelId = String(model.id ?? "");
    const base = flattenCatalogRecord("geral", model);
    const common = {
      ...base,
      curva_total_pontos: String(related.performance.get(modelId)?.length ?? 0),
      refrigerantes_total: String(related.refrigerants.get(modelId)?.length ?? 0),
    };
    const rows = related.performance.get(modelId) ?? [null];
    return rows.map((point, index) => serializeCsvRecord(headers, {
      ...common,
      ...flattenCatalogRecord("compressor", related.compressors.get(modelId)),
      ...flattenCatalogRecord("condensador", related.condensers.get(modelId)),
      ...flattenCatalogRecord("evaporador", related.evaporators.get(modelId)),
      refrigerantes: stringifyCatalogValue(related.refrigerants.get(modelId) ?? []),
      curva_indice: point ? String(index + 1) : "",
      ...flattenCatalogRecord("curva", point),
    }));
  });
  return [headers, ...body].map((line) => line.map(escapeCsvCell).join(";")).join("\n");
}

function toCatalogXml(data: CatalogExportData): string {
  const related = buildRelatedIndexes(data);
  const items = data.models.map((model) => {
    const modelId = String(model.id ?? "");
    return `  <produto id="${escapeXml(modelId)}">
    <geral>${recordToXml(model)}</geral>
    <compressor>${recordToXml(related.compressors.get(modelId))}</compressor>
    <condensador>${recordToXml(related.condensers.get(modelId))}</condensador>
    <evaporador>${recordToXml(related.evaporators.get(modelId))}</evaporador>
    <refrigerantes>${(related.refrigerants.get(modelId) ?? []).map((row) => `<refrigerante>${recordToXml(row)}</refrigerante>`).join("")}</refrigerantes>
    <curva>${(related.performance.get(modelId) ?? []).map((row) => `<ponto>${recordToXml(row)}</ponto>`).join("")}</curva>
  </produto>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<catalogoColdPro totalProdutos="${data.models.length}" totalPontosCurva="${data.performancePoints.length}">\n${items.join("\n")}\n</catalogoColdPro>\n`;
}

function escapeCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function escapeXml(value: string): string {
  const xmlEntities: Record<string, string> = {
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  };
  return value.replace(/[<>&"']/g, (char) => xmlEntities[char] ?? char);
}

function downloadTextFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
