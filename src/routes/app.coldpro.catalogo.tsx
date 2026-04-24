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
} from "lucide-react";
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

  // Lista de modelos do catálogo
  const modelsQuery = useQuery({
    queryKey: ["coldpro-models"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coldpro_equipment_models")
        .select("id, modelo, linha, designacao_hp, refrigerante, gabinete, tipo_degelo, active, created_at")
        .order("modelo")
        .limit(500);
      if (error) throw error;
      return data;
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
      m.refrigerante?.toLowerCase().includes(q)
    );
  });

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
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Modelos no catálogo</h2>
              <Badge variant="secondary">{modelsQuery.data?.length ?? 0}</Badge>
            </div>
            <Input
              placeholder="Buscar modelo, linha ou refrigerante..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Linha</TableHead>
                    <TableHead>HP</TableHead>
                    <TableHead>Refrigerante</TableHead>
                    <TableHead>Gabinete</TableHead>
                    <TableHead>Degelo</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredModels.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.modelo}</TableCell>
                      <TableCell>{m.linha ?? "—"}</TableCell>
                      <TableCell>{m.designacao_hp ?? "—"}</TableCell>
                      <TableCell>{m.refrigerante ?? "—"}</TableCell>
                      <TableCell>{m.gabinete ?? "—"}</TableCell>
                      <TableCell>{m.tipo_degelo ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {m.active ? (
                          <Badge variant="default" className="bg-emerald-600">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
