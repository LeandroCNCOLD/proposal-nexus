import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Snowflake, Wind, Cog, Activity, Info } from "lucide-react";

type Props = {
  modelId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ColdProModelDetailDialog({ modelId, open, onOpenChange }: Props) {
  const detailQuery = useQuery({
    queryKey: ["coldpro-model-detail", modelId],
    enabled: !!modelId && open,
    queryFn: async () => {
      if (!modelId) return null;

      const [model, compressors, condenser, evaporator, perfPoints] = await Promise.all([
        supabase
          .from("coldpro_equipment_models")
          .select("*")
          .eq("id", modelId)
          .maybeSingle(),
        supabase
          .from("coldpro_equipment_compressors")
          .select("*")
          .eq("equipment_model_id", modelId)
          .maybeSingle(),
        supabase
          .from("coldpro_equipment_condensers")
          .select("*")
          .eq("equipment_model_id", modelId)
          .maybeSingle(),
        supabase
          .from("coldpro_equipment_evaporators")
          .select("*")
          .eq("equipment_model_id", modelId)
          .maybeSingle(),
        supabase
          .from("coldpro_equipment_performance_points")
          .select("*")
          .eq("equipment_model_id", modelId)
          .order("evaporation_temp_c", { ascending: false })
          .order("condensation_temp_c", { ascending: true })
          .limit(500),
      ]);

      return {
        model: model.data,
        compressors: compressors.data,
        condenser: condenser.data,
        evaporator: evaporator.data,
        perfPoints: perfPoints.data ?? [],
      };
    },
  });

  const data = detailQuery.data;
  const m = data?.model;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Snowflake className="h-5 w-5 text-primary" />
            {m?.modelo ?? "Carregando..."}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap gap-2 pt-1">
            {m?.linha && <Badge variant="outline">{m.linha}</Badge>}
            {m?.designacao_hp && <Badge variant="secondary">{m.designacao_hp}</Badge>}
            {m?.refrigerante && <Badge variant="outline">{m.refrigerante}</Badge>}
            {m?.gabinete && <Badge variant="outline">Gab. {m.gabinete}</Badge>}
            {m?.tipo_degelo && <Badge variant="outline">Degelo: {m.tipo_degelo}</Badge>}
          </DialogDescription>
        </DialogHeader>

        {detailQuery.isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Carregando detalhes técnicos...
          </div>
        ) : !data || !m ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Modelo não encontrado.
          </div>
        ) : (
          <Tabs defaultValue="overview" className="mt-2">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">
                <Info className="mr-1 h-4 w-4" />
                Geral
              </TabsTrigger>
              <TabsTrigger value="compressors">
                <Cog className="mr-1 h-4 w-4" />
                Compressores
              </TabsTrigger>
              <TabsTrigger value="condenser">
                <Wind className="mr-1 h-4 w-4" />
                Condensador
              </TabsTrigger>
              <TabsTrigger value="evaporator">
                <Snowflake className="mr-1 h-4 w-4" />
                Evaporador
              </TabsTrigger>
              <TabsTrigger value="performance">
                <Activity className="mr-1 h-4 w-4" />
                Curva ({data.perfPoints.length})
              </TabsTrigger>
            </TabsList>

            {/* Geral */}
            <TabsContent value="overview" className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Modelo" value={m.modelo} />
                <Field label="Linha" value={m.linha} />
                <Field label="Designação HP" value={m.designacao_hp} />
                <Field label="Refrigerante" value={m.refrigerante} />
                <Field label="Gabinete" value={m.gabinete} />
                <Field label="Tipo gabinete" value={m.tipo_gabinete} />
                <Field label="Tipo degelo" value={m.tipo_degelo} />
                <Field label="GWP (AR6)" value={m.gwp_ar6} />
                <Field label="ODP (AR6)" value={m.odp_ar6} />
                <Field
                  label="Status"
                  value={m.active ? "Ativo" : "Inativo"}
                />
                <Field
                  label="Cadastrado"
                  value={new Date(m.created_at).toLocaleDateString("pt-BR")}
                />
              </div>
              {m.notes && (
                <div className="rounded-md border bg-muted/30 p-3">
                  <div className="text-xs font-medium text-muted-foreground">Notas</div>
                  <p className="mt-1 text-sm">{m.notes}</p>
                </div>
              )}
            </TabsContent>

            {/* Compressores */}
            <TabsContent value="compressors" className="mt-4">
              {!data.compressors ? (
                <EmptyBlock label="Sem dados de compressores cadastrados." />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Copeland" value={data.compressors.copeland} />
                  <Field label="Copeland (sec.)" value={data.compressors.copeland_secondary} />
                  <Field label="Bitzer" value={data.compressors.bitzer} />
                  <Field label="Bitzer (sec.)" value={data.compressors.bitzer_secondary} />
                  <Field label="Danfoss / Bock" value={data.compressors.danfoss_bock} />
                  <Field label="Danfoss (sec.)" value={data.compressors.danfoss_secondary} />
                  <Field label="Dorin" value={data.compressors.dorin} />
                </div>
              )}
            </TabsContent>

            {/* Condensador */}
            <TabsContent value="condenser" className="mt-4">
              {!data.condenser ? (
                <EmptyBlock label="Sem dados do condensador cadastrados." />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Modelo" value={data.condenser.condenser_model} />
                  <Field label="Ø tubo (in)" value={data.condenser.tube_diameter_in} />
                  <Field label="Ø tubo (mm)" value={data.condenser.tube_diameter_mm} />
                  <Field label="Espessura tubo (mm)" value={data.condenser.tube_thickness_mm} />
                  <Field label="Geometria" value={data.condenser.geometry} />
                  <Field label="Volume interno (L)" value={data.condenser.internal_volume_l} />
                  <Field label="Modelo ventilador" value={data.condenser.fan_model} />
                  <Field label="Vazão de ar (m³/h)" value={data.condenser.airflow_m3_h} />
                </div>
              )}
            </TabsContent>

            {/* Evaporador */}
            <TabsContent value="evaporator" className="mt-4">
              {!data.evaporator ? (
                <EmptyBlock label="Sem dados do evaporador cadastrados." />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Modelo" value={data.evaporator.evaporator_model} />
                  <Field label="Reaquecimento" value={data.evaporator.reheating} />
                  <Field label="Quantidade" value={data.evaporator.evaporator_quantity} />
                  <Field label="Ø tubo (in)" value={data.evaporator.tube_diameter_in} />
                  <Field label="Ø tubo (mm)" value={data.evaporator.tube_diameter_mm} />
                  <Field label="Espessura tubo (mm)" value={data.evaporator.tube_thickness_mm} />
                  <Field label="Geometria" value={data.evaporator.geometry} />
                  <Field label="Volume interno (L)" value={data.evaporator.internal_volume_l} />
                  <Field label="Área superfície (m²)" value={data.evaporator.surface_area_m2} />
                  <Field label="Modelo ventilador" value={data.evaporator.fan_model} />
                  <Field label="Vazão de ar (m³/h)" value={data.evaporator.airflow_m3_h} />
                </div>
              )}
            </TabsContent>

            {/* Curva de performance */}
            <TabsContent value="performance" className="mt-4">
              {data.perfPoints.length === 0 ? (
                <EmptyBlock label="Nenhum ponto de curva cadastrado para este modelo." />
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">T. Câm. (°C)</TableHead>
                        <TableHead className="text-right">UR (%)</TableHead>
                        <TableHead className="text-right">T. Evap. (°C)</TableHead>
                        <TableHead className="text-right">T. Cond. (°C)</TableHead>
                        <TableHead className="text-right">T. Ext. (°C)</TableHead>
                        <TableHead className="text-right">Cap. Evap. (kcal/h)</TableHead>
                        <TableHead className="text-right">Cap. Comp. (kcal/h)</TableHead>
                        <TableHead className="text-right">Pot. Comp. (kW)</TableHead>
                        <TableHead className="text-right">Pot. Vent. (kW)</TableHead>
                        <TableHead className="text-right">Pot. Total (kW)</TableHead>
                        <TableHead className="text-right">COP</TableHead>
                        <TableHead className="text-right">Carga (kg)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.perfPoints.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-right">{fmt(p.temperature_room_c)}</TableCell>
                          <TableCell className="text-right">{fmt(p.humidity_room_percent)}</TableCell>
                          <TableCell className="text-right">{fmt(p.evaporation_temp_c)}</TableCell>
                          <TableCell className="text-right">{fmt(p.condensation_temp_c)}</TableCell>
                          <TableCell className="text-right">{fmt(p.external_temp_c)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {fmt(p.evaporator_capacity_kcal_h, 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            {fmt(p.compressor_capacity_kcal_h, 0)}
                          </TableCell>
                          <TableCell className="text-right">{fmt(p.compressor_power_kw, 2)}</TableCell>
                          <TableCell className="text-right">{fmt(p.fan_power_kw, 2)}</TableCell>
                          <TableCell className="text-right">{fmt(p.total_power_kw, 2)}</TableCell>
                          <TableCell className="text-right">{fmt(p.cop, 2)}</TableCell>
                          <TableCell className="text-right">{fmt(p.fluid_charge_kg, 2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  const display =
    value === null || value === undefined || value === ""
      ? "—"
      : typeof value === "number"
      ? value.toLocaleString("pt-BR")
      : String(value);
  return (
    <div className="rounded-md border bg-card p-2.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium">{display}</div>
    </div>
  );
}

function EmptyBlock({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function fmt(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined) return "—";
  return Number(v).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
