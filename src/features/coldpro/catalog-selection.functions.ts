import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SaveSelectionSchema = z.object({
  environmentId: z.string().uuid(),
  equipmentModelId: z.string().uuid().nullable().optional(),
  modelName: z.string(),
  refrigerant: z.string().nullable().optional(),
  quantity: z.number().int().positive(),
  capacityUnitKcalH: z.number(),
  capacityTotalKcalH: z.number(),
  airFlowUnitM3H: z.number().nullable(),
  airFlowTotalM3H: z.number(),
  totalPowerKw: z.number().nullable().optional(),
  cop: z.number().nullable().optional(),
  surplusKcalH: z.number(),
  surplusPercent: z.number(),
  airChangesHour: z.number().nullable(),
  selectionMethod: z.enum(["polynomial", "interpolated", "catalog_point", "legacy"]).default("catalog_point"),
  curveTemperatureRoomC: z.number().nullable().optional(),
  curveEvaporationTempC: z.number().nullable().optional(),
  curveCondensationTempC: z.number().nullable().optional(),
  curvePolynomialR2: z.number().nullable().optional(),
  curveInterpolated: z.boolean().default(false),
  curveMetadata: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().nullable().optional(),
});

export const saveCatalogEquipmentSelection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveSelectionSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;
    const selectionInsert = {
      environment_id: data.environmentId,
      equipment_model_id: data.equipmentModelId ?? null,
      model: data.modelName,
      refrigerant: data.refrigerant ?? null,
      quantity: data.quantity,
      capacity_unit_kcal_h: data.capacityUnitKcalH,
      capacity_total_kcal_h: data.capacityTotalKcalH,
      air_flow_unit_m3_h: data.airFlowUnitM3H ?? 0,
      air_flow_total_m3_h: data.airFlowTotalM3H,
      total_power_kw: data.totalPowerKw ?? null,
      cop: data.cop ?? null,
      surplus_kcal_h: data.surplusKcalH,
      surplus_percent: data.surplusPercent,
      air_changes_hour: data.airChangesHour ?? 0,
      selection_method: data.selectionMethod,
      curve_temperature_room_c: data.curveTemperatureRoomC ?? null,
      curve_evaporation_temp_c: data.curveEvaporationTempC ?? null,
      curve_condensation_temp_c: data.curveCondensationTempC ?? null,
      curve_polynomial_r2: data.curvePolynomialR2 ?? null,
      curve_interpolated: data.curveInterpolated,
      curve_metadata: {
        ...(data.curveMetadata ?? {}),
        capacidade_corrigida_kcal_h: data.capacityUnitKcalH,
        capacidade_total_corrigida_kcal_h: data.capacityTotalKcalH,
        fonte_curva: data.selectionMethod,
        modelo: data.modelName,
        quantidade: data.quantity,
        refrigerante: data.refrigerant ?? null,
        potencia_eletrica_kw: data.totalPowerKw ?? null,
        cop: data.cop ?? null,
        vazao_m3_h: data.airFlowTotalM3H,
        versao_calculo: "coldpro-validation-v1",
        data_curva: new Date().toISOString(),
      },
      notes: data.notes ?? "Selecionado pelo catálogo por curva de rendimento",
    } as any;

    // Substitui a seleção atual do ambiente (apenas 1 por ambiente)
    await supabase
      .from("coldpro_equipment_selections")
      .delete()
      .eq("environment_id", data.environmentId);

    const { data: selection, error } = await supabase
      .from("coldpro_equipment_selections")
      .insert(selectionInsert)
      .select("*")
      .single();

    if (error) throw new Error(`Falha ao salvar seleção: ${error.message}`);
    return selection;
  });
