import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const payloadSchema = z.object({
  name: z.string().trim().min(1).max(160),
  applicationMode: z.string().trim().min(1).max(80),
  state: z.record(z.string(), z.unknown()),
  result: z.record(z.string(), z.unknown()).optional(),
});

export const saveColdProSeletorCalculation = createServerFn({ method: "POST" })
  .inputValidator(payloadSchema)
  .handler(async ({ data }) => {
    const { data: project, error: projectError } = await supabaseAdmin
      .from("coldpro_projects")
      .insert({ name: data.name, application_type: data.applicationMode, notes: JSON.stringify({ seletor_state: data.state }) })
      .select("*")
      .single();
    if (projectError) throw new Error(projectError.message);

    const result = data.result ?? {};
    const correctedKw = Number(result.correctedTotalKw ?? 0);
    const totalKcalH = Number(result.totalKcalH ?? 0);
    const totalTr = Number(result.totalTr ?? 0);
    const { error: reportError } = await (supabaseAdmin as any)
      .from("coldpro_reports")
      .insert({
        project_id: project.id,
        title: `Memória de cálculo - ${data.name}`,
        calculation_memory: result.calculationMemory ?? {},
        report_text: `Carga corrigida: ${correctedKw.toFixed(2)} kW · ${totalKcalH.toFixed(0)} kcal/h · ${totalTr.toFixed(2)} TR`,
      });
    if (reportError) throw new Error(reportError.message);
    return project;
  });

export const duplicateColdProSeletorCalculation = createServerFn({ method: "POST" })
  .inputValidator(payloadSchema)
  .handler(async ({ data }) => {
    const { data: project, error } = await supabaseAdmin
      .from("coldpro_projects")
      .insert({ name: `${data.name} (cópia)`, application_type: data.applicationMode, notes: JSON.stringify({ seletor_state: data.state, duplicated: true }) })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return project;
  });

export const listColdProEquipmentSuggestions = createServerFn({ method: "GET" })
  .inputValidator(z.object({ requiredKw: z.number().min(0), limit: z.number().min(1).max(20).default(8) }))
  .handler(async ({ data }) => {
    const requiredKcalH = data.requiredKw * 1000 * 0.859845;
    const { data: points, error } = await supabaseAdmin
      .from("coldpro_equipment_performance_points")
      .select("equipment_model_id, evaporator_capacity_kcal_h, total_power_kw, refrigerant, coldpro_equipment_models(modelo, linha, designacao_hp, gabinete, refrigerante)")
      .not("evaporator_capacity_kcal_h", "is", null)
      .gte("evaporator_capacity_kcal_h", requiredKcalH * 0.85)
      .limit(200);
    if (error) throw new Error(error.message);

    const bestByModel = new Map<string, any>();
    for (const row of points ?? []) {
      const capacity = Number(row.evaporator_capacity_kcal_h ?? 0);
      if (capacity <= 0) continue;
      const marginPercent = requiredKcalH > 0 ? ((capacity - requiredKcalH) / requiredKcalH) * 100 : 0;
      const score = Math.abs(Math.max(5, Math.min(25, marginPercent)) - marginPercent) + Math.abs(marginPercent - 15) * 0.1;
      const current = bestByModel.get(row.equipment_model_id);
      if (!current || score < current.score) {
        bestByModel.set(row.equipment_model_id, { row, capacity, marginPercent, score });
      }
    }

    return Array.from(bestByModel.values())
      .sort((a, b) => a.score - b.score)
      .slice(0, data.limit)
      .map((item) => {
        const model = Array.isArray(item.row.coldpro_equipment_models) ? item.row.coldpro_equipment_models[0] : item.row.coldpro_equipment_models;
        return {
          id: item.row.equipment_model_id,
          model: model?.modelo ?? "Equipamento",
          line: model?.linha ?? null,
          nominalCapacityKcalH: item.capacity,
          nominalCapacityKw: item.capacity / 859.845,
          marginPercent: item.marginPercent,
          refrigerant: item.row.refrigerant ?? model?.refrigerante ?? null,
          powerKw: item.row.total_power_kw ?? null,
          undersized: item.marginPercent < 0,
          oversized: item.marginPercent > 35,
        };
      });
  });
