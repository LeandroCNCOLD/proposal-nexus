import { supabase } from "@/integrations/supabase/client";
import type { ParsedRow, ParseResult } from "./catalog-import.parser";

export type ImportProgress = {
  phase: "creating-import" | "saving-models" | "saving-performance" | "finalizing";
  current: number;
  total: number;
  message: string;
};

type ProgressCb = (p: ImportProgress) => void;

export type ImportOutcome = {
  importId: string;
  modelsCreated: number;
  modelsUpdated: number;
  performancePoints: number;
};

/**
 * Persiste o resultado do parser no banco:
 * 1) cria registro em coldpro_catalog_imports
 * 2) upsert por (modelo, refrigerante, gabinete) em coldpro_equipment_models
 * 3) cria/atualiza compressores, condensador, evaporador
 * 4) insere os pontos de performance
 * 5) salva linhas brutas em coldpro_catalog_import_rows (em batches)
 */
export async function importParsedCatalog(
  file: File,
  result: ParseResult,
  onProgress?: ProgressCb
): Promise<ImportOutcome> {
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes?.user?.id ?? null;

  onProgress?.({
    phase: "creating-import",
    current: 0,
    total: 1,
    message: "Registrando importação...",
  });

  const { data: importRow, error: impErr } = await supabase
    .from("coldpro_catalog_imports")
    .insert({
      filename: file.name,
      file_size_bytes: file.size,
      sheet_name: result.sheetName,
      total_rows: result.totalRows,
      valid_rows: result.validRows,
      skipped_rows: result.skippedRows,
      status: "processing",
      imported_by: userId,
      started_at: new Date().toISOString(),
      summary: {
        unique_models: result.uniqueModels,
        refrigerants: result.refrigerants,
        lines: result.lines,
        unmapped_headers: result.unmappedHeaders,
      },
    })
    .select("id")
    .single();

  if (impErr || !importRow) {
    throw new Error(`Falha ao criar importação: ${impErr?.message}`);
  }
  const importId = importRow.id as string;

  // Agrupa linhas por chave de modelo para criar 1 modelo por (modelo+refrig+gabinete)
  const validRows = result.rows.filter((r) => r.isValid && r.modelo);
  const groups = new Map<string, ParsedRow[]>();
  for (const r of validRows) {
    const key = `${r.modelo}|${r.refrigerante ?? ""}|${r.gabinete ?? ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  let modelsCreated = 0;
  let modelsUpdated = 0;
  let perfPoints = 0;
  const totalGroups = groups.size;
  let processed = 0;

  onProgress?.({
    phase: "saving-models",
    current: 0,
    total: totalGroups,
    message: "Salvando modelos...",
  });

  // Para cada grupo: upsert do modelo, depois insere pontos de performance
  for (const [, rows] of groups) {
    const head = rows[0];
    // upsert manual: tenta achar
    const { data: existing } = await supabase
      .from("coldpro_equipment_models")
      .select("id")
      .eq("modelo", head.modelo!)
      .eq("refrigerante", head.refrigerante ?? "")
      .eq("gabinete", head.gabinete ?? "")
      .maybeSingle();

    let modelId: string;
    const modelPayload = {
      modelo: head.modelo!,
      linha: head.linha,
      designacao_hp: head.designacao_hp,
      gabinete: head.gabinete,
      tipo_gabinete: head.tipo_gabinete,
      refrigerante: head.refrigerante,
      gwp_ar6: head.gwp_ar6,
      odp_ar6: head.odp_ar6,
      tipo_degelo: head.tipo_degelo,
      source_import_id: importId,
      raw: head.raw,
      active: true,
    };

    if (existing?.id) {
      modelId = existing.id;
      const { error } = await supabase
        .from("coldpro_equipment_models")
        .update(modelPayload as never)
        .eq("id", modelId);
      if (error) throw new Error(`Falha update modelo ${head.modelo}: ${error.message}`);
      modelsUpdated++;
    } else {
      const { data: ins, error } = await supabase
        .from("coldpro_equipment_models")
        .insert(modelPayload as never)
        .select("id")
        .single();
      if (error || !ins) throw new Error(`Falha insert modelo ${head.modelo}: ${error?.message}`);
      modelId = ins.id;
      modelsCreated++;
    }

    // Compressores (upsert por equipment_model_id)
    await supabase
      .from("coldpro_equipment_compressors")
      .upsert(
        {
          equipment_model_id: modelId,
          copeland: head.copeland,
          bitzer: head.bitzer,
          danfoss_bock: head.danfoss_bock,
          dorin: head.dorin,
        },
        { onConflict: "equipment_model_id" }
      );

    // Condensador
    await supabase.from("coldpro_equipment_condensers").upsert(
      {
        equipment_model_id: modelId,
        condenser_model: head.condenser.model,
        tube_diameter_in: head.condenser.tube_in,
        tube_diameter_mm: head.condenser.tube_mm,
        tube_thickness_mm: head.condenser.tube_thickness,
        geometry: head.condenser.geometry,
        internal_volume_l: head.condenser.volume,
        fan_model: head.condenser.fan,
        airflow_m3_h: head.condenser.airflow,
      },
      { onConflict: "equipment_model_id" }
    );

    // Evaporador
    await supabase.from("coldpro_equipment_evaporators").upsert(
      {
        equipment_model_id: modelId,
        evaporator_model: head.evaporator.model,
        reheating: head.evaporator.reheat,
        tube_diameter_in: head.evaporator.tube_in,
        tube_diameter_mm: head.evaporator.tube_mm,
        tube_thickness_mm: head.evaporator.tube_thickness,
        geometry: head.evaporator.geometry,
        internal_volume_l: head.evaporator.volume,
        surface_area_m2: head.evaporator.area,
        evaporator_quantity: head.evaporator.qty,
        fan_model: head.evaporator.fan,
        airflow_m3_h: head.evaporator.airflow,
      },
      { onConflict: "equipment_model_id" }
    );

    // Pontos de performance: 1 por linha do grupo
    const perfRows = rows.map((r) => ({
      equipment_model_id: modelId,
      source_import_id: importId,
      temperature_room_c: r.performance.temp_room,
      humidity_room_percent: r.performance.hum_room,
      evaporation_temp_c: r.performance.evap_temp,
      condensation_temp_c: r.performance.cond_temp,
      external_temp_c: r.performance.ext_temp,
      external_humidity_percent: r.performance.ext_hum,
      altitude_m: r.performance.altitude,
      evaporator_capacity_kcal_h: r.performance.evap_capacity,
      compressor_capacity_kcal_h: r.performance.comp_capacity,
      heat_rejection_kcal_h: r.performance.heat_rejection,
      mass_flow_kg_h: r.performance.mass_flow_h,
      mass_flow_kg_s: r.performance.mass_flow_s,
      enthalpy_difference_kj_kg: r.performance.enthalpy_diff,
      total_superheat_k: r.performance.superheat_total,
      useful_superheat_k: r.performance.superheat_useful,
      subcooling_k: r.performance.subcool,
      additional_subcooling_k: r.performance.subcool_extra,
      compressor_power_kw: r.performance.comp_power,
      fan_power_kw: r.performance.fan_power,
      total_power_kw: r.performance.total_power,
      cop: r.performance.cop,
      cop_carnot: r.performance.cop_carnot,
      global_cop: r.performance.global_cop,
      voltage: r.performance.voltage,
      compressor_current_a: r.performance.comp_current,
      fan_current_a: r.performance.fan_current,
      estimated_current_a: r.performance.est_current,
      starting_current_a: r.performance.start_current,
      fluid_charge_kg: r.performance.fluid_charge,
      drain_water_l_h: r.performance.drain_water,
      drain_diameter: r.performance.drain_diameter,
      drain_quantity: r.performance.drain_qty,
      raw: r.raw,
    }));

    // insere em batches de 200
    const batchSize = 200;
    for (let i = 0; i < perfRows.length; i += batchSize) {
      const slice = perfRows.slice(i, i + batchSize);
      const { error } = await supabase
        .from("coldpro_equipment_performance_points")
        .insert(slice as never);
      if (error) throw new Error(`Falha insert performance: ${error.message}`);
      perfPoints += slice.length;
    }

    processed++;
    if (processed % 5 === 0 || processed === totalGroups) {
      onProgress?.({
        phase: "saving-performance",
        current: processed,
        total: totalGroups,
        message: `${processed}/${totalGroups} modelos`,
      });
    }
  }

  // Finaliza importação
  onProgress?.({
    phase: "finalizing",
    current: 1,
    total: 1,
    message: "Finalizando...",
  });

  await supabase
    .from("coldpro_catalog_imports")
    .update({
      status: "success",
      models_created: modelsCreated,
      models_updated: modelsUpdated,
      performance_points_created: perfPoints,
      finished_at: new Date().toISOString(),
    })
    .eq("id", importId);

  return {
    importId,
    modelsCreated,
    modelsUpdated,
    performancePoints: perfPoints,
  };
}
