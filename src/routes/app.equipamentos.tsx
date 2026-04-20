import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { Upload, Loader2, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/app/equipamentos")({ component: EquipmentsPage });

function EquipmentsPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [lineFilter, setLineFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: lines = [] } = useQuery({
    queryKey: ["equipment-lines"],
    queryFn: async () => (await supabase.from("equipment_lines").select("*").order("code")).data ?? [],
  });

  const { data: equipments = [] } = useQuery({
    queryKey: ["equipments"],
    queryFn: async () => (await supabase.from("equipments").select("*, equipment_lines(code, name)").order("model")).data ?? [],
  });

  const filtered = equipments.filter((e) => {
    if (lineFilter !== "all" && e.line_id !== lineFilter) return false;
    if (search && !`${e.model} ${e.cabinet ?? ""} ${e.refrigerant ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      let totalInserted = 0;

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null });
        if (rows.length === 0) continue;

        // normalize sheet name -> line code
        const normalizedCode = sheetName.toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
        let line = lines.find((l) => l.code === normalizedCode || l.name.toUpperCase() === sheetName.toUpperCase());
        if (!line) {
          const { data: newLine } = await supabase.from("equipment_lines")
            .insert({ code: normalizedCode || sheetName, name: sheetName })
            .select().single();
          if (newLine) line = newLine;
        }

        const get = (r: any, ...keys: string[]) => {
          for (const k of keys) {
            const found = Object.keys(r).find((rk) => rk.toUpperCase().replace(/[\s.\-_]+/g, "") === k.toUpperCase().replace(/[\s.\-_]+/g, ""));
            if (found && r[found] != null && r[found] !== "") return r[found];
          }
          return null;
        };
        const num = (v: any) => { const n = Number(v); return isNaN(n) ? null : n; };

        const payload = rows.map((r) => ({
          line_id: line?.id ?? null,
          model: String(get(r, "MODELO", "MODEL") ?? "").trim() || `[${sheetName}-${Math.random().toString(36).slice(2, 7)}]`,
          cabinet: get(r, "GABINETE", "CABINET"),
          cabinet_type: get(r, "TIPODEGABINETE", "TIPO_DE_GABINETE", "CABINET_TYPE"),
          refrigerant: get(r, "REFRIGERANTE", "REFRIGERANT"),
          compressor_copeland: get(r, "COPELAND"),
          compressor_bitzer: get(r, "BITZER"),
          compressor_danfoss_bock: get(r, "DANFOSS", "DANFOSS_BOCK", "BOCK"),
          compressor_dorin: get(r, "DORIN"),
          condenser_model: get(r, "MODELOCONDENSADOR", "MODELO_CONDENSADOR", "CONDENSADOR"),
          condenser_fan: get(r, "VENTILADORCONDENSADOR", "VENTILADOR_CONDENSADOR"),
          condenser_fan_flow: num(get(r, "VAZAOVENTILADORCONDENSADOR", "VAZAO_CONDENSADOR")),
          evaporator_model: get(r, "MODELOEVAPORADOR", "MODELO_EVAPORADOR", "EVAPORADOR"),
          evaporator_fan: get(r, "VENTILADOREVAPORADOR", "VENTILADOR_EVAPORADOR"),
          evaporator_fan_flow: num(get(r, "VAZAOVENTILADOREVAPORADOR", "VAZAO_EVAPORADOR")),
        }));

        // batch insert
        const { data: insertedEq, error } = await supabase.from("equipments").insert(payload).select("id");
        if (error) { console.error(sheetName, error); continue; }
        totalInserted += insertedEq?.length ?? 0;

        // performance curves
        if (insertedEq) {
          const curves = rows.map((r, idx) => ({
            equipment_id: insertedEq[idx].id,
            chamber_temperature: num(get(r, "TEMPERATURADACAMARA", "TEMP_CAMARA", "TEMPERATURA_CAMARA")),
            chamber_humidity: num(get(r, "UMIDADEDACAMARA", "UMIDADE_CAMARA")),
            evaporation_temperature: num(get(r, "TEMPERATURADEEVAPORACAO", "TEMP_EVAPORACAO")),
            condensation_temperature: num(get(r, "TEMPERATURADECONDENSACAO", "TEMP_CONDENSACAO")),
            cooling_capacity: num(get(r, "CAPACIDADEFRIGORIFICA", "CAPACIDADE")),
            rejected_heat: num(get(r, "CALORREJEITADO", "CALOR_REJEITADO")),
          })).filter((c) => c.chamber_temperature || c.cooling_capacity || c.evaporation_temperature);
          if (curves.length > 0) await supabase.from("equipment_performance_curves").insert(curves);
        }
      }

      toast.success(`${totalInserted} equipamentos importados`);
      qc.invalidateQueries({ queryKey: ["equipments"] });
      qc.invalidateQueries({ queryKey: ["equipment-lines"] });
    } catch (e: any) {
      toast.error("Erro na importação: " + e.message);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <PageHeader title="Equipamentos" subtitle={`${equipments.length} equipamentos · ${lines.length} linhas`} actions={
        <>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden
            onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
            Importar planilha
          </Button>
        </>
      } />

      <div className="mb-4 flex flex-wrap gap-3">
        <Input placeholder="Buscar modelo, gabinete, refrigerante..." className="max-w-md" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={lineFilter} onValueChange={setLineFilter}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as linhas</SelectItem>
            {lines.map((l) => <SelectItem key={l.id} value={l.id}>{l.code} — {l.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {equipments.length === 0 && (
        <div className="rounded-xl border-2 border-dashed bg-card/50 p-12 text-center">
          <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-3 text-sm font-semibold">Nenhum equipamento cadastrado</h3>
          <p className="mt-1 text-xs text-muted-foreground">Importe sua planilha técnica .xlsx — o sistema normaliza automaticamente as colunas (MODELO, GABINETE, COPELAND, BITZER, REFRIGERANTE, etc.) e cria as linhas de produto.</p>
        </div>
      )}

      {equipments.length > 0 && (
        <div className="rounded-xl border bg-card shadow-[var(--shadow-sm)] overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Linha</TableHead><TableHead>Modelo</TableHead><TableHead>Gabinete</TableHead>
              <TableHead>Refrigerante</TableHead><TableHead>Condensador</TableHead><TableHead>Evaporador</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs font-mono">{(e.equipment_lines as any)?.code ?? "—"}</TableCell>
                  <TableCell className="font-medium">{e.model}</TableCell>
                  <TableCell className="text-sm">{e.cabinet ?? "—"}</TableCell>
                  <TableCell className="text-sm">{e.refrigerant ?? "—"}</TableCell>
                  <TableCell className="text-sm">{e.condenser_model ?? "—"}</TableCell>
                  <TableCell className="text-sm">{e.evaporator_model ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
