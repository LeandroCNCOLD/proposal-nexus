import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
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
  ChevronLeft, ChevronRight, FolderTree,
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

  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState<number>(1);
  const [groupByLine, setGroupByLine] = useState<boolean>(false);

  // Lista de modelos do catálogo + agregado de tensões/pontos por modelo
  const modelsQuery = useQuery({
    queryKey: ["coldpro-models"],
    queryFn: async () => {
      const [modelsRes, perfRes] = await Promise.all([
        supabase
          .from("coldpro_equipment_models")
          .select("id, modelo, linha, designacao_hp, refrigerante, gabinete, tipo_gabinete, tipo_degelo, active, created_at")
          .order("linha", { ascending: true, nullsFirst: false })
          .order("modelo", { ascending: true })
          .limit(5000),
        supabase
          .from("coldpro_equipment_performance_points")
          .select("equipment_model_id, voltage")
          .limit(10000),
      ]);
      if (modelsRes.error) throw modelsRes.error;
      if (perfRes.error) throw perfRes.error;

      const stats = new Map<string, { points: number; voltages: Set<string> }>();
      for (const p of perfRes.data ?? []) {
        const key = p.equipment_model_id;
        if (!key) continue;
        if (!stats.has(key)) stats.set(key, { points: 0, voltages: new Set() });
        const s = stats.get(key)!;
        s.points++;
        if (p.voltage) s.voltages.add(p.voltage);
      }
      return (modelsRes.data ?? []).map((m) => {
        const s = stats.get(m.id);
        return {
          ...m,
          point_count: s?.points ?? 0,
          voltages: s ? Array.from(s.voltages).sort() : [],
        };
      });
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

  const filteredModels = (modelsQuery.data ?? []).filter((m) => {
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
                    <Stat label="Modelos únicos" value={parsed.uniqueModels} />
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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Modelos no catálogo</h2>
              <Badge variant="secondary">{modelsQuery.data?.length ?? 0}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
                className="max-w-xs"
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
                      <TableHead>Modelo</TableHead>
                      <TableHead>Linha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Refrig.</TableHead>
                      <TableHead>Gabinete</TableHead>
                      <TableHead>Versões elétricas</TableHead>
                      <TableHead className="text-right">Pontos</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedModels
                      ? groupedModels.map(([linha, items]) => (
                          <>
                            <TableRow key={`group-${linha}`} className="bg-muted/40 hover:bg-muted/40">
                              <TableCell colSpan={8} className="py-2 font-semibold text-sm">
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
                          </>
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
  refrigerante: string | null;
  gabinete: string | null;
  tipo_gabinete: string | null;
  tipo_degelo: string | null;
  active: boolean;
  point_count: number;
  voltages: string[];
};

function ModelRow({ m, indent, onClick }: { m: ModelRowData; indent?: boolean; onClick: () => void }) {
  return (
    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onClick}>
      <TableCell className={`font-medium text-primary ${indent ? "pl-8" : ""}`}>
        <div className="flex flex-col">
          <span>{m.modelo}</span>
          {m.designacao_hp && m.designacao_hp !== "-" && (
            <span className="text-[11px] font-normal text-muted-foreground">{m.designacao_hp}</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-xs">{m.linha ?? "—"}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {splitEquipmentTypes(m.tipo_gabinete).map((tipo) => (
            <Badge key={tipo} variant="outline" className="text-[10px] py-0 px-1.5">
              {tipo}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="font-mono text-xs">{m.refrigerante ?? "—"}</Badge>
      </TableCell>
      <TableCell className="text-xs">{m.gabinete ?? "—"}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {m.voltages.length === 0 ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            m.voltages.map((v) => (
              <Badge key={v} variant="secondary" className="font-mono text-[10px] py-0 px-1.5">
                {v}
              </Badge>
            ))
          )}
        </div>
      </TableCell>
      <TableCell className="text-right text-sm font-medium tabular-nums">
        {m.point_count}
      </TableCell>
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
