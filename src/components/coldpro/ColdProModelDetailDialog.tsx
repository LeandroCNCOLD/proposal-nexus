import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { Loader2, Snowflake, Wind, Cog, Activity, Info, Zap, ImageIcon, Upload } from "lucide-react";
import { toast } from "sonner";

type Props = {
  modelId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type EquipmentImageKind = "plugin" | "split" | "biblock";

const IMAGE_FIELD_BY_KIND: Record<EquipmentImageKind, string> = {
  plugin: "plugin_image_path",
  split: "split_image_path",
  biblock: "biblock_image_path",
};

const IMAGE_GALLERY_FIELD_BY_KIND: Record<EquipmentImageKind, string> = {
  plugin: "plugin_image_paths",
  split: "split_image_paths",
  biblock: "biblock_image_paths",
};

const IMAGE_LABEL_BY_KIND: Record<EquipmentImageKind, string> = {
  plugin: "Plug-in",
  split: "Split",
  biblock: "Bi-bloco",
};

export function ColdProModelDetailDialog({ modelId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
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

  const imageMutation = useMutation({
    mutationFn: async ({ kind, file }: { kind: EquipmentImageKind; file: File }) => {
      if (!modelId) throw new Error("Modelo não selecionado");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${modelId}/${kind}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("coldpro-equipment-images")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const currentGallery = ((detailQuery.data?.model?.[
        IMAGE_GALLERY_FIELD_BY_KIND[kind] as keyof typeof detailQuery.data.model
      ] as string[] | null) ?? []).filter(Boolean);
      const { error: updateError } = await supabase
        .from("coldpro_equipment_models")
        .update({
          [IMAGE_FIELD_BY_KIND[kind]]: path,
          [IMAGE_GALLERY_FIELD_BY_KIND[kind]]: [path, ...currentGallery],
        } as never)
        .eq("id", modelId);
      if (updateError) throw updateError;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["coldpro-model-detail", modelId] });
      toast.success("Foto do equipamento atualizada.");
    },
    onError: (err) => toast.error(`Falha ao enviar foto: ${err instanceof Error ? err.message : "desconhecido"}`),
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
              <TabsList className="grid w-full grid-cols-7">
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
              <TabsTrigger value="electrical">
                <Zap className="mr-1 h-4 w-4" />
                Elétrico
              </TabsTrigger>
              <TabsTrigger value="images">
                <ImageIcon className="mr-1 h-4 w-4" />
                Fotos
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
                <Field label="Configuração elétrica" value={m.electrical_configuration} />
                <Field label="Tensão nominal (V)" value={m.voltage_value_v} />
                <Field label="Fases" value={m.phase_count} />
                <Field label="Frequência (Hz)" value={m.frequency_hz} />
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

              {/* Resumo de versões/condições deste modelo */}
              {data.perfPoints.length > 0 && (() => {
                const voltages = Array.from(
                  new Set(data.perfPoints.map((p) => p.voltage).filter(Boolean))
                ) as string[];
                const rooms = Array.from(
                  new Set(
                    data.perfPoints
                      .map((p) => p.temperature_room_c)
                      .filter((v) => v != null)
                  )
                ).sort((a, b) => Number(b) - Number(a));
                const evapTemps = data.perfPoints
                  .map((p) => p.evaporation_temp_c)
                  .filter((v): v is number => typeof v === "number");
                const capacities = data.perfPoints
                  .map((p) => p.evaporator_capacity_kcal_h)
                  .filter((v): v is number => typeof v === "number");
                return (
                  <div className="rounded-md border bg-primary/5 border-primary/20 p-4 space-y-3">
                    <div className="text-sm font-semibold flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      Versões e faixa de operação cadastradas
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
                          Tensões disponíveis ({voltages.length})
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {voltages.map((v) => (
                            <Badge key={v} variant="outline" className="font-mono text-xs">
                              <Zap className="mr-1 h-3 w-3" />
                              {v}
                            </Badge>
                          ))}
                          {voltages.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
                          Temperaturas de câmara ({rooms.length})
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {rooms.map((r) => (
                            <Badge key={String(r)} variant="secondary" className="text-xs">
                              {Number(r)}°C
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
                          Faixa T. evaporação
                        </div>
                        <div className="text-sm font-medium">
                          {evapTemps.length > 0
                            ? `${fmt(Math.min(...evapTemps))} a ${fmt(Math.max(...evapTemps))} °C`
                            : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
                          Faixa de capacidade evaporador
                        </div>
                        <div className="text-sm font-medium">
                          {capacities.length > 0
                            ? `${fmt(Math.min(...capacities), 0)} a ${fmt(Math.max(...capacities), 0)} kcal/h`
                            : "—"}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground pt-1 border-t">
                      Total: <strong className="text-foreground">{data.perfPoints.length}</strong> pontos de operação ={" "}
                      <strong className="text-foreground">{voltages.length}</strong> tensão(ões) ×{" "}
                      <strong className="text-foreground">{rooms.length}</strong> temperatura(s) de câmara ×{" "}
                      <strong className="text-foreground">{Math.round(data.perfPoints.length / Math.max(1, voltages.length * rooms.length))}</strong> condição(ões) de condensação
                    </div>
                  </div>
                );
              })()}

              {m.notes && (
                <div className="rounded-md border bg-muted/30 p-3">
                  <div className="text-xs font-medium text-muted-foreground">Notas</div>
                  <p className="mt-1 text-sm">{m.notes}</p>
                </div>
              )}

              <SmartDescriptionBlock model={m as Record<string, unknown>} />

              <CommercialFeaturesBlock
                features={normalizeCommercialFeatures(m.commercial_features)}
                source={m.commercial_description_source as string | null}
              />
            </TabsContent>

            <TabsContent value="images" className="mt-4">
              <div className="grid gap-3 md:grid-cols-3">
                {(["plugin", "split", "biblock"] as EquipmentImageKind[]).map((kind) => (
                  <EquipmentImageCard
                    key={kind}
                    kind={kind}
                    path={m[IMAGE_FIELD_BY_KIND[kind] as keyof typeof m] as string | null}
                    paths={(m[IMAGE_GALLERY_FIELD_BY_KIND[kind] as keyof typeof m] as string[] | null) ?? []}
                    uploading={imageMutation.isPending}
                    onSelect={(file) => imageMutation.mutate({ kind, file })}
                  />
                ))}
              </div>
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

            {/* Elétrico */}
            <TabsContent value="electrical" className="mt-4">
              {data.perfPoints.length === 0 ? (
                <EmptyBlock label="Sem dados elétricos. Importe pontos de performance para ver as informações elétricas." />
              ) : (
                (() => {
                  const elec = aggregateElectrical(data.perfPoints);
                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <Field label="Configuração elétrica oficial" value={m.electrical_configuration ?? elec.voltages.join(" / ") ?? "—"} />
                        <Field label="Tensão nominal (V)" value={m.voltage_value_v} />
                        <Field label="Fases" value={m.phase_count} />
                        <Field label="Frequência (Hz)" value={m.frequency_hz} />
                        <Field label="Pot. compressor (kW)" value={elec.compPowerRange} />
                        <Field label="Pot. ventiladores (kW)" value={elec.fanPowerRange} />
                        <Field label="Pot. total (kW)" value={elec.totalPowerRange} />
                        <Field label="Corrente compressor (A)" value={elec.compCurrentRange} />
                        <Field label="Corrente ventiladores (A)" value={elec.fanCurrentRange} />
                        <Field label="Corrente nominal estim. (A)" value={elec.estCurrentRange} />
                        <Field label="Corrente de partida (A)" value={elec.startCurrentRange} />
                        <Field label="Carga de fluido (kg)" value={elec.fluidChargeRange} />
                      </div>

                      <div className="rounded-md border">
                        <div className="border-b bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Detalhamento por ponto de operação
                        </div>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-right">T. Evap (°C)</TableHead>
                                <TableHead className="text-right">T. Cond (°C)</TableHead>
                                <TableHead>Tensão</TableHead>
                                <TableHead className="text-right">I. Comp (A)</TableHead>
                                <TableHead className="text-right">I. Vent (A)</TableHead>
                                <TableHead className="text-right">I. Nom. (A)</TableHead>
                                <TableHead className="text-right">I. Partida (A)</TableHead>
                                <TableHead className="text-right">P. Comp (kW)</TableHead>
                                <TableHead className="text-right">P. Vent (kW)</TableHead>
                                <TableHead className="text-right">P. Total (kW)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {data.perfPoints.map((p) => (
                                <TableRow key={p.id}>
                                  <TableCell className="text-right">{fmt(p.evaporation_temp_c)}</TableCell>
                                  <TableCell className="text-right">{fmt(p.condensation_temp_c)}</TableCell>
                                  <TableCell>{p.voltage ?? "—"}</TableCell>
                                  <TableCell className="text-right">{fmt(p.compressor_current_a, 2)}</TableCell>
                                  <TableCell className="text-right">{fmt(p.fan_current_a, 2)}</TableCell>
                                  <TableCell className="text-right">{fmt(p.estimated_current_a, 2)}</TableCell>
                                  <TableCell className="text-right">{fmt(p.starting_current_a, 1)}</TableCell>
                                  <TableCell className="text-right">{fmt(p.compressor_power_kw, 2)}</TableCell>
                                  <TableCell className="text-right">{fmt(p.fan_power_kw, 2)}</TableCell>
                                  <TableCell className="text-right font-medium">{fmt(p.total_power_kw, 2)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      <div className="rounded-md border bg-amber-500/5 border-amber-500/30 p-3 text-xs text-muted-foreground">
                        💡 Dica para dimensionamento de cabos: use a <strong>corrente nominal estimada</strong> mais alta como base
                        e a <strong>corrente de partida</strong> para selecionar disjuntores e dispositivos de proteção.
                      </div>
                    </div>
                  );
                })()
              )}
            </TabsContent>


            <TabsContent value="performance" className="mt-4">
              {data.perfPoints.length === 0 ? (
                <EmptyBlock label="Nenhum ponto de curva cadastrado para este modelo." />
              ) : (
                (() => {
                  const byVoltage = groupBy(data.perfPoints, (p) => p.voltage ?? "Sem tensão");
                  const voltages = Array.from(byVoltage.keys()).sort();
                  return (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Versões elétricas:</span>
                        {voltages.map((v) => (
                          <Badge key={v} variant="outline" className="font-mono">
                            <Zap className="mr-1 h-3 w-3" />
                            {v} ({byVoltage.get(v)!.length} pts)
                          </Badge>
                        ))}
                      </div>

                      {voltages.map((v) => {
                        const pts = byVoltage.get(v)!;
                        const byRoom = groupBy(pts, (p) =>
                          p.temperature_room_c == null ? "—" : `${p.temperature_room_c}°C`
                        );
                        return (
                          <div key={v} className="rounded-md border">
                            <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                              <div className="flex items-center gap-2 text-sm font-semibold">
                                <Zap className="h-4 w-4 text-primary" />
                                {v}
                              </div>
                              <Badge variant="secondary">{pts.length} pontos</Badge>
                            </div>
                            <div className="overflow-x-auto">
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
                                    <TableHead className="text-right">Pot. Total (kW)</TableHead>
                                    <TableHead className="text-right">COP</TableHead>
                                    <TableHead className="text-right">Carga (kg)</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {Array.from(byRoom.entries()).map(([room, items]) => (
                                    <>
                                      <TableRow key={`${v}-${room}-h`} className="bg-muted/20 hover:bg-muted/20">
                                        <TableCell colSpan={10} className="py-1.5 text-xs font-semibold text-muted-foreground">
                                          Câmara a {room} • {items.length} pontos
                                        </TableCell>
                                      </TableRow>
                                      {items.map((p) => (
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
                                          <TableCell className="text-right">{fmt(p.total_power_kw, 2)}</TableCell>
                                          <TableCell className="text-right">{fmt(p.cop, 2)}</TableCell>
                                          <TableCell className="text-right">{fmt(p.fluid_charge_kg, 2)}</TableCell>
                                        </TableRow>
                                      ))}
                                    </>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
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

function SmartDescriptionBlock({ model }: { model: Record<string, unknown> }) {
  const description = typeof model.smart_description === "string" ? model.smart_description : "";
  const applications = Array.isArray(model.recommended_applications)
    ? model.recommended_applications.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const commercial = normalizeCommercialFeatures(model.commercial_highlights);
  const technical = normalizeCommercialFeatures(model.technical_highlights);
  const source = typeof model.description_source === "string" ? model.description_source : null;
  const confidence = typeof model.description_confidence === "string" ? model.description_confidence : null;

  if (!description && applications.length === 0 && commercial.length === 0 && technical.length === 0) {
    return <EmptyBlock label="Sem descrição inteligente cadastrada para este modelo." />;
  }

  return (
    <div className="rounded-md border bg-primary/5 border-primary/20 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Descrição inteligente do modelo</div>
          {source && <div className="text-xs text-muted-foreground">Origem: {source}</div>}
        </div>
        {confidence && <Badge variant="secondary">Confiança {confidence}</Badge>}
      </div>
      {description && <p className="text-sm leading-relaxed">{description}</p>}
      {applications.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {applications.map((item) => (
            <Badge key={item} variant="outline" className="bg-background/70">{item}</Badge>
          ))}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <HighlightList title="Diferenciais comerciais" items={commercial} />
        <HighlightList title="Diferenciais técnicos" items={technical} />
      </div>
    </div>
  );
}

function HighlightList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-md border bg-background/70 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <ul className="space-y-1.5 text-sm">
        {items.map((item) => (
          <li key={item} className="leading-relaxed">{item}</li>
        ))}
      </ul>
    </div>
  );
}

function CommercialFeaturesBlock({ features, source }: { features: string[]; source: string | null }) {
  if (features.length === 0) {
    return <EmptyBlock label="Sem características comerciais cadastradas para este modelo." />;
  }

  return (
    <div className="rounded-md border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Características comerciais e técnicas</div>
          {source && <div className="text-xs text-muted-foreground">Origem: {source}</div>}
        </div>
        <Badge variant="secondary">{features.length} itens</Badge>
      </div>
      <ul className="grid gap-2 text-sm md:grid-cols-2">
        {features.map((feature) => (
          <li key={feature} className="rounded-md border bg-muted/20 px-3 py-2 leading-relaxed">
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}

function normalizeCommercialFeatures(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function EquipmentImageCard({
  kind,
  path,
  paths,
  uploading,
  onSelect,
}: {
  kind: EquipmentImageKind;
  path: string | null;
  paths: string[];
  uploading: boolean;
  onSelect: (file: File) => void;
}) {
  const inputId = `coldpro-image-${kind}`;
  const gallery = Array.from(new Set([path, ...paths].filter((p): p is string => !!p)));

  return (
    <div className="rounded-md border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">Foto {IMAGE_LABEL_BY_KIND[kind]}</div>
        <Button asChild size="sm" variant="outline" disabled={uploading}>
          <label htmlFor={inputId} className="cursor-pointer">
            {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
            Enviar
          </label>
        </Button>
      </div>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onSelect(file);
          event.currentTarget.value = "";
        }}
      />
      {gallery.length > 0 ? (
        <div className="grid gap-2">
          <img src={toEquipmentImageUrl(gallery[0])} alt={`Foto ${IMAGE_LABEL_BY_KIND[kind]} do equipamento`} className="aspect-[4/3] w-full rounded-md border object-contain" />
          {gallery.length > 1 && (
            <div className="grid grid-cols-3 gap-2">
              {gallery.slice(1).map((item) => (
                <img key={item} src={toEquipmentImageUrl(item)} alt={`Foto adicional ${IMAGE_LABEL_BY_KIND[kind]}`} className="aspect-square rounded-md border object-cover" />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          Sem foto cadastrada
        </div>
      )}
    </div>
  );
}

function toEquipmentImageUrl(path: string): string {
  return supabase.storage.from("coldpro-equipment-images").getPublicUrl(path).data.publicUrl;
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

type PerfPoint = {
  voltage: string | null;
  compressor_power_kw: number | null;
  fan_power_kw: number | null;
  total_power_kw: number | null;
  compressor_current_a: number | null;
  fan_current_a: number | null;
  estimated_current_a: number | null;
  starting_current_a: number | null;
  fluid_charge_kg: number | null;
};

function aggregateElectrical(points: PerfPoint[]) {
  const voltages = Array.from(
    new Set(points.map((p) => p.voltage).filter((v): v is string => !!v))
  );
  const range = (key: keyof PerfPoint, digits = 2) => {
    const vals = points
      .map((p) => p[key])
      .filter((v): v is number => typeof v === "number" && !isNaN(v));
    if (vals.length === 0) return "—";
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    if (min === max) return fmt(min, digits);
    return `${fmt(min, digits)} – ${fmt(max, digits)}`;
  };
  return {
    voltages,
    compPowerRange: range("compressor_power_kw", 2),
    fanPowerRange: range("fan_power_kw", 2),
    totalPowerRange: range("total_power_kw", 2),
    compCurrentRange: range("compressor_current_a", 2),
    fanCurrentRange: range("fan_current_a", 2),
    estCurrentRange: range("estimated_current_a", 2),
    startCurrentRange: range("starting_current_a", 1),
    fluidChargeRange: range("fluid_charge_kg", 2),
  };
}

function groupBy<T, K extends string>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return map;
}

