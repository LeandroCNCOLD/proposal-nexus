import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SaveSelectionSchema = z.object({
  environmentId: z.string().uuid(),
  modelName: z.string(),
  quantity: z.number().int().positive(),
  capacityUnitKcalH: z.number(),
  capacityTotalKcalH: z.number(),
  airFlowUnitM3H: z.number().nullable(),
  airFlowTotalM3H: z.number(),
  surplusKcalH: z.number(),
  surplusPercent: z.number(),
  airChangesHour: z.number().nullable(),
  notes: z.string().nullable().optional(),
});

export const saveCatalogEquipmentSelection = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SaveSelectionSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;

    // Substitui a seleção atual do ambiente (apenas 1 por ambiente)
    await supabase
      .from("coldpro_equipment_selections")
      .delete()
      .eq("environment_id", data.environmentId);

    const { data: selection, error } = await supabase
      .from("coldpro_equipment_selections")
      .insert({
        environment_id: data.environmentId,
        model: data.modelName,
        quantity: data.quantity,
        capacity_unit_kcal_h: data.capacityUnitKcalH,
        capacity_total_kcal_h: data.capacityTotalKcalH,
        air_flow_unit_m3_h: data.airFlowUnitM3H ?? 0,
        air_flow_total_m3_h: data.airFlowTotalM3H,
        surplus_kcal_h: data.surplusKcalH,
        surplus_percent: data.surplusPercent,
        air_changes_hour: data.airChangesHour ?? 0,
        notes: data.notes ?? "Selecionado pelo catálogo (curva real)",
      })
      .select("*")
      .single();

    if (error) throw new Error(`Falha ao salvar seleção: ${error.message}`);
    return selection;
  });
