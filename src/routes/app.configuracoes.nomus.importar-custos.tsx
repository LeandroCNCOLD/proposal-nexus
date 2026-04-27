import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, History } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { brl, num } from "@/lib/format";
import { decodeBytes, parseNomusCostsCsv, type ParseResult } from "@/integrations/nomus/csv-parser";
import { nomusImportPriceTableCosts } from "@/integrations/nomus/server.functions";

export const Route = createFileRoute("/app/configuracoes/nomus/importar-custos")({
  component: ImportarCustosPage,
});

type DryRunResult = {
  ok: true;
  dryRun: true;
  priceTableName: string;
  totalRows: number;
  toUpdate: number;
  toInsert: number;
  withCost: number;
  existingNotInCsv: number;
};

type CommitResult = {
  ok: true;
  dryRun: false;
  priceTableName: string;
  totalRows: number;
  inserted: number;
  updated: number;
  skipped: number;
  withCost: number;
};

function ImportarCustosPage() {
  const qc = useQueryClient();
  const importFn = useServerFn(nomusImportPriceTableCosts);
  const [priceTableId, setPriceTableId] = useState<string>("");
  const [filename, setFilename] = useState<string>("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: priceTables = [] } = useQuery({
    queryKey: ["nomus_price_tables"],
    queryFn: async () =>
      (await supabase.from("nomus_price_tables").select("id, name, code").order("name")).data ?? [],
  });

  const { data: history = [] } = useQuery({
    queryKey: ["nomus_cost_imports"],
    queryFn: async () =>
      (
        await supabase
          .from("nomus_cost_imports")
          .select("*, nomus_price_tables(name)")
          .order("imported_at", { ascending: false })
          .limit(10)
      ).data ?? [],
  });

  const handleFile = useCallback(async (file: File) => {
    setFilename(file.name);
    setDryRun(null);
    try {
      const buffer = await file.arrayBuffer();
      const text = decodeBytes(new Uint8Array(buffer));
      const result = parseNomusCostsCsv(text);
      setParseResult(result);
      if (result.rows.length === 0) {
        toast.error("Nenhuma linha válida encontrada no CSV.");
      } else {
        toast.success(`${result.rows.length} linha(s) parseada(s).`);
      }
    } catch (e) {
      toast.error(`Falha ao ler arquivo: ${e instanceof Error ? e.message : String(e)}`);
      setParseResult(null);
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const runDryRun = async () => {
    if (!priceTableId || !parseResult || parseResult.rows.length === 0) return;
    setRunning(true);
    try {
      const res = (await importFn({
        data: { priceTableId, filename, rows: parseResult.rows, dryRun: true },
      })) as DryRunResult | { ok: false; error: string };
      if (res.ok) {
        setDryRun(res);
        toast.success("Pré-visualização pronta — confira antes de confirmar.");
      } else {
        toast.error(res.error);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no dry-run.");
    } finally {
      setRunning(false);
    }
  };

  const commitImport = async () => {
    if (!dryRun || !parseResult) return;
    setRunning(true);
    try {
      const res = (await importFn({
        data: { priceTableId, filename, rows: parseResult.rows, dryRun: false },
      })) as CommitResult | { ok: false; error: string };
      if (res.ok) {
        toast.success(
          `Importação concluída: ${res.updated} atualizados, ${res.inserted} inseridos${
            res.skipped > 0 ? `, ${res.skipped} ignorados` : ""
          }.`,
        );
        setParseResult(null);
        setDryRun(null);
        setFilename("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        qc.invalidateQueries({ queryKey: ["nomus_cost_imports"] });
      } else {
        toast.error(res.error);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na importação.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Importar custos da tabela de preço"
        subtitle="Carregue o CSV exportado pelo Nomus para popular custos reais e habilitar análise de margem efetiva."
        actions={
          <Link to="/app/configuracoes/nomus">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upload + Tabela destino */}
        <section className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-sm)] space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Tabela de preço de destino</Label>
              <Select value={priceTableId} onValueChange={setPriceTableId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a tabela…" />
                </SelectTrigger>
                <SelectContent>
                  {priceTables.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} {t.code ? `(${t.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                O CSV não diz a qual tabela pertence — você precisa indicar manualmente.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Arquivo CSV</Label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors ${
                  dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="text-sm text-foreground">
                  {filename ? (
                    <>
                      <FileSpreadsheet className="inline h-4 w-4 mr-1" /> {filename}
                    </>
                  ) : (
                    <>Arraste o arquivo aqui ou clique para selecionar</>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Aceita CSV em Windows-1252 (Excel-PT-BR) ou UTF-8, separador `;`.
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </div>
            </div>
          </div>

          {parseResult && (
            <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-sm)] space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Pré-visualização do CSV</h2>
                <Badge variant="secondary">{parseResult.rows.length} linhas válidas</Badge>
              </div>

              {parseResult.warnings.length > 0 && (
                <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs space-y-1">
                  {parseResult.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-warning-foreground" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 text-xs">
                <Stat label="Total de linhas" value={parseResult.totalRowsRead} />
                <Stat
                  label="Com custo cadastrado"
                  value={parseResult.rows.filter((r) => r.hasCostData).length}
                />
                <Stat
                  label="Colunas reconhecidas"
                  value={Object.keys(parseResult.columnMap).length}
                />
              </div>

              <ScrollArea className="h-64 rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[11px]">Código</TableHead>
                      <TableHead className="text-[11px]">Descrição</TableHead>
                      <TableHead className="text-[11px] text-right">Preço</TableHead>
                      <TableHead className="text-[11px] text-right">Custo total</TableHead>
                      <TableHead className="text-[11px] text-right">Margem desej.</TableHead>
                      <TableHead className="text-[11px]">Custo?</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parseResult.rows.slice(0, 10).map((r) => (
                      <TableRow key={r.productCode}>
                        <TableCell className="font-mono text-[11px]">{r.productCode}</TableCell>
                        <TableCell className="text-xs truncate max-w-xs">{r.description}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {r.unitPrice != null ? brl(r.unitPrice) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {r.custoProducaoTotal != null ? brl(r.custoProducaoTotal) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {r.margemDesejadaPct != null ? `${num(r.margemDesejadaPct, 2)}%` : "—"}
                        </TableCell>
                        <TableCell>
                          {r.hasCostData ? (
                            <Badge variant="outline" className="text-[10px] text-success border-success/40">
                              sim
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              vazio
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  onClick={runDryRun}
                  disabled={!priceTableId || running || parseResult.rows.length === 0}
                  variant="outline"
                >
                  {running && !dryRun ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Simular importação (dry-run)
                </Button>
              </div>
            </div>
          )}

          {dryRun && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 shadow-[var(--shadow-sm)] space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <h2 className="text-sm font-semibold">Pronto para importar para "{dryRun.priceTableName}"</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <Stat label="Total no CSV" value={dryRun.totalRows} />
                <Stat label="Atualizar" value={dryRun.toUpdate} highlight="info" />
                <Stat label="Inserir" value={dryRun.toInsert} highlight="success" />
                <Stat label="Existentes não no CSV" value={Math.max(0, dryRun.existingNotInCsv)} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Itens existentes que NÃO estão no CSV serão mantidos intactos. {dryRun.withCost} item(s) trazem custo
                preenchido — os demais ficarão marcados como "sem custo cadastrado".
              </p>
              <div className="flex items-center gap-2 pt-2">
                <Button onClick={commitImport} disabled={running}>
                  {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Confirmar importação
                </Button>
                <Button variant="ghost" onClick={() => setDryRun(null)} disabled={running}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Histórico */}
        <section className="lg:col-span-1">
          <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-sm)] space-y-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Últimas importações</h2>
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma importação ainda.</p>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="rounded-md border bg-secondary/20 p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{h.filename}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(h.imported_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {(h as { nomus_price_tables?: { name?: string } }).nomus_price_tables?.name ?? "—"}
                    </div>
                    <div className="flex gap-2 text-[10px] flex-wrap pt-1">
                      <Badge variant="outline" className="text-success border-success/40">
                        +{h.inserted_count}
                      </Badge>
                      <Badge variant="outline" className="text-info border-info/40">
                        ~{h.updated_count}
                      </Badge>
                      {h.skipped_count > 0 && (
                        <Badge variant="outline" className="text-destructive border-destructive/40">
                          ✗{h.skipped_count}
                        </Badge>
                      )}
                      <Badge variant="secondary">{h.with_cost_count} c/ custo</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: "success" | "info";
}) {
  const color =
    highlight === "success"
      ? "text-success"
      : highlight === "info"
        ? "text-info"
        : "text-foreground";
  return (
    <div className="rounded-md border bg-card p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
