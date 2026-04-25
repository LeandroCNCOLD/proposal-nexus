import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { calculateColdProLoad } from "./coldpro-calculation.engine";
import { findEquipmentCandidates, suggestApplication, suggestEvaporationTemp } from "./equipment-selection.engine";

const finiteNumber = z.number().finite();
const nonNegativeNumber = finiteNumber.min(0);
const positiveNumber = finiteNumber.gt(0);
const dayHours = finiteNumber.min(0).max(24);
const trimmedName = z.string().trim().min(1).max(120);

const wallLayerSchema = z.object({
  material_id: z.string().uuid().nullable().optional(),
  material_name: z.string().trim().min(1).max(120),
  category: z.string().trim().max(50).nullable().optional(),
  thickness_m: nonNegativeNumber,
  conductivity_w_mk: positiveNumber,
  position: z.number().int().min(0).max(20),
});

const constructionFaceSchema = z.object({
  local: z.string().trim().max(40).default(""),
  layers: z.array(wallLayerSchema).max(8).nullable().optional(),
  u_value_w_m2k: nonNegativeNumber.nullable().optional(),
  transmission_w: nonNegativeNumber.nullable().optional(),
  transmission_kcal_h: nonNegativeNumber.nullable().optional(),
  wall_length_m: nonNegativeNumber.nullable().optional(),
  wall_height_m: nonNegativeNumber.nullable().optional(),
  cutout_length_m: nonNegativeNumber.nullable().optional(),
  cutout_width_m: nonNegativeNumber.nullable().optional(),
  material_thickness: z.string().trim().max(80).nullable().optional(),
  panel_area_m2: nonNegativeNumber.nullable().optional(),
  external_temp_c: finiteNumber.nullable().optional(),
  solar_orientation: z.string().trim().max(80).nullable().optional(),
  color: z.string().trim().max(60).nullable().optional(),
  glass_area_m2: nonNegativeNumber.nullable().optional(),
  glass_type: z.string().trim().max(80).nullable().optional(),
  solar_radiation_w_m2: nonNegativeNumber.nullable().optional(),
  floor_condition: z.string().trim().max(80).nullable().optional(),
  door_area_m2: nonNegativeNumber.nullable().optional(),
});

export const listColdProProjects = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = supabaseAdmin;
  const { data, error } = await supabase.from("coldpro_projects").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const createColdProProject = createServerFn({ method: "POST" })
  .inputValidator(z.object({ proposal_id: z.string().uuid().nullable().optional(), name: trimmedName, application_type: z.string().default("cold_room") }))
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;
    const { data: row, error } = await supabase.from("coldpro_projects").insert({ proposal_id: data.proposal_id ?? null, name: data.name, application_type: data.application_type }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getColdProProjectBundle = createServerFn({ method: "GET" })
  .inputValidator(z.object({ projectId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;
    const { data: project, error: projectError } = await supabase.from("coldpro_projects").select("*").eq("id", data.projectId).single();
    if (projectError) throw new Error(projectError.message);
    const { data: environments } = await supabase.from("coldpro_environments").select("*").eq("coldpro_project_id", data.projectId).order("sort_order", { ascending: true });
    const environmentIds = (environments ?? []).map((e) => e.id);
    const { data: products } = environmentIds.length ? await supabase.from("coldpro_environment_products").select("*").in("environment_id", environmentIds) : { data: [] as any[] };
    const { data: tunnels } = environmentIds.length ? await supabase.from("coldpro_tunnels").select("*").in("environment_id", environmentIds) : { data: [] as any[] };
    const { data: results } = environmentIds.length ? await supabase.from("coldpro_results").select("*").in("environment_id", environmentIds).order("created_at", { ascending: false }) : { data: [] as any[] };
    const { data: selections } = environmentIds.length ? await supabase.from("coldpro_equipment_selections").select("*").in("environment_id", environmentIds) : { data: [] as any[] };
    const { data: insulationMaterials } = await supabase.from("coldpro_insulation_materials").select("*").order("name");
    const { data: thermalMaterials } = await supabase.from("coldpro_thermal_materials").select("*").order("category").order("material_name");
    const { data: productCatalog } = await supabase.from("coldpro_products").select("*").order("name");
    return { project, environments: environments ?? [], products: products ?? [], tunnels: tunnels ?? [], results: results ?? [], selections: selections ?? [], insulationMaterials: insulationMaterials ?? [], thermalMaterials: thermalMaterials ?? [], productCatalog: productCatalog ?? [] };
  });

export const createColdProEnvironment = createServerFn({ method: "POST" })
  .inputValidator(z.object({ projectId: z.string().uuid(), name: trimmedName, environment_type: z.string().default("cold_room") }))
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;
    const { data: insulation } = await supabase.from("coldpro_insulation_materials").select("id").eq("name", "PIR").limit(1).maybeSingle();
    const { data: row, error } = await supabase.from("coldpro_environments").insert({ coldpro_project_id: data.projectId, name: data.name, environment_type: data.environment_type, insulation_material_id: insulation?.id ?? null }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateColdProEnvironment = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid(), patch: z.record(z.string(), z.unknown()) }))
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;
    const patch = { ...data.patch } as any;
    if (typeof patch.name === "string") patch.name = patch.name.trim().slice(0, 120);
    const nonNegativeKeys = ["length_m", "width_m", "height_m", "wall_thickness_mm", "ceiling_thickness_mm", "floor_thickness_mm", "operation_hours_day", "compressor_runtime_hours_day", "door_openings_per_day", "door_width_m", "door_height_m", "infiltration_factor", "people_count", "people_hours_day", "lighting_power_w", "lighting_hours_day", "motors_power_kw", "motors_hours_day", "fans_kcal_h", "defrost_kcal_h", "other_kcal_h", "safety_factor_percent", "wall_count", "module_count", "total_panel_area_m2", "total_glass_area_m2", "total_door_area_m2", "construction_load_kcal_h", "external_relative_humidity_percent", "atmospheric_pressure_kpa", "dimension_a_m", "dimension_b_m", "dimension_c_m", "dimension_d_m", "dimension_e_m", "dimension_f_m"];
    for (const key of nonNegativeKeys) {
      if (patch[key] !== undefined && patch[key] !== null && (!Number.isFinite(Number(patch[key])) || Number(patch[key]) < 0)) throw new Error(`Valor inválido em ${key}.`);
    }
    for (const key of ["operation_hours_day", "compressor_runtime_hours_day", "people_hours_day", "lighting_hours_day", "motors_hours_day"]) {
      if (patch[key] !== undefined && patch[key] !== null && Number(patch[key]) > 24) throw new Error(`Horas inválidas em ${key}.`);
    }
    if (patch.chamber_layout_type !== undefined) patch.chamber_layout_type = String(patch.chamber_layout_type ?? "industrial").trim().slice(0, 40);
    if (patch.construction_faces !== undefined) {
      const parsed = z.array(constructionFaceSchema).max(12).parse(patch.construction_faces);
      patch.construction_faces = parsed;
    }
    if (patch.length_m !== undefined || patch.width_m !== undefined || patch.height_m !== undefined) {
      const { data: current } = await supabase.from("coldpro_environments").select("*").eq("id", data.id).single();
      patch.volume_m3 = Number(patch.length_m ?? current?.length_m ?? 0) * Number(patch.width_m ?? current?.width_m ?? 0) * Number(patch.height_m ?? current?.height_m ?? 0);
    }
    const { data: row, error } = await supabase.from("coldpro_environments").update(patch).eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const upsertColdProEnvironmentProduct = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    id: z.string().uuid().optional(), environment_id: z.string().uuid(), product_id: z.string().uuid().nullable().optional(), product_name: trimmedName, mass_kg_day: z.number().default(0), mass_kg_hour: z.number().default(0), inlet_temp_c: z.number().default(0), outlet_temp_c: z.number().default(0), process_time_h: z.number().default(24), packaging_mass_kg_day: z.number().default(0), packaging_specific_heat_kcal_kg_c: z.number().default(0.4), specific_heat_above_kcal_kg_c: z.number().default(0), specific_heat_below_kcal_kg_c: z.number().default(0), latent_heat_kcal_kg: z.number().default(0), initial_freezing_temp_c: z.number().nullable().optional(), density_kg_m3: z.number().nullable().optional(), thermal_conductivity_unfrozen_w_m_k: z.number().nullable().optional(), thermal_conductivity_frozen_w_m_k: z.number().nullable().optional(), frozen_water_fraction: z.number().nullable().optional(), freezable_water_content_percent: z.number().nullable().optional(), characteristic_thickness_m: z.number().nullable().optional(), default_convective_coefficient_w_m2_k: z.number().nullable().optional(), allow_phase_change: z.boolean().nullable().optional(), respiration_rate_0c_w_kg: z.number().nullable().optional(), respiration_rate_5c_w_kg: z.number().nullable().optional(), respiration_rate_10c_w_kg: z.number().nullable().optional(), respiration_rate_15c_w_kg: z.number().nullable().optional(), respiration_rate_20c_w_kg: z.number().nullable().optional()
  }))
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;
    const { data: row, error } = await supabase.from("coldpro_environment_products").upsert(data as any, { onConflict: "id" }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const upsertColdProTunnel = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    id: z.string().uuid().optional(), environment_id: z.string().uuid(), tunnel_type: z.enum(["blast_freezer", "cooling_tunnel"]).default("blast_freezer"), operation_mode: z.enum(["continuous", "batch"]).default("continuous"), product_name: trimmedName.default("Produto"), product_thickness_mm: nonNegativeNumber.default(0), product_unit_weight_kg: nonNegativeNumber.default(0), units_per_cycle: nonNegativeNumber.default(0), cycles_per_hour: nonNegativeNumber.default(0), mass_kg_hour: nonNegativeNumber.default(0), inlet_temp_c: finiteNumber.default(0), outlet_temp_c: finiteNumber.default(-18), freezing_temp_c: finiteNumber.nullable().optional(), density_kg_m3: nonNegativeNumber.nullable().optional(), thermal_conductivity_frozen_w_m_k: nonNegativeNumber.nullable().optional(), convective_coefficient_w_m2_k: nonNegativeNumber.nullable().optional(), estimated_freezing_time_min: nonNegativeNumber.nullable().optional(), retention_status: z.string().trim().max(80).nullable().optional(), recommended_airflow_m3_h: nonNegativeNumber.nullable().optional(), air_temp_c: finiteNumber.default(-35), air_velocity_m_s: nonNegativeNumber.default(3), process_time_min: positiveNumber.default(60), specific_heat_above_kcal_kg_c: nonNegativeNumber.default(0.8), specific_heat_below_kcal_kg_c: nonNegativeNumber.default(0.4), latent_heat_kcal_kg: nonNegativeNumber.default(60), packaging_mass_kg_hour: nonNegativeNumber.default(0), packaging_specific_heat_kcal_kg_c: nonNegativeNumber.default(0.4), belt_motor_kw: nonNegativeNumber.default(0), internal_fans_kw: nonNegativeNumber.default(0), other_internal_kw: nonNegativeNumber.default(0)
  }))
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;
    const { data: row, error } = await supabase.from("coldpro_tunnels").upsert(data, { onConflict: "id" }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const calculateColdProEnvironment = createServerFn({ method: "POST" })
  .inputValidator(z.object({ environmentId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;
    const { data: env, error: envError } = await supabase.from("coldpro_environments").select("*").eq("id", data.environmentId).single();
    if (envError) throw new Error(envError.message);
    const { data: products } = await supabase.from("coldpro_environment_products").select("*").eq("environment_id", data.environmentId);
    const { data: tunnel } = await supabase.from("coldpro_tunnels").select("*").eq("environment_id", data.environmentId).maybeSingle();
    let insulation = null;
    if (env.insulation_material_id) {
      const { data: row } = await supabase.from("coldpro_insulation_materials").select("*").eq("id", env.insulation_material_id).maybeSingle();
      insulation = row;
    }
    if (!insulation) {
      const { data: row } = await supabase.from("coldpro_insulation_materials").select("*").eq("name", "PIR").maybeSingle();
      insulation = row;
    }
    if (!insulation) throw new Error("Material isolante não encontrado.");
    const result = calculateColdProLoad({ env: env as any, products: (products ?? []) as any, insulation: insulation as any, tunnel: (tunnel ?? null) as any });
    const { calculation_breakdown, ...resultRest } = result;
    const { data: saved, error } = await supabase
      .from("coldpro_results")
      .insert({
        environment_id: data.environmentId,
        ...resultRest,
        calculation_breakdown: calculation_breakdown as any,
        calculation_input: { environment: env, products: products ?? [], tunnel, insulation } as any,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("coldpro_projects").update({ status: "calculated", calculated_at: new Date().toISOString() }).eq("id", env.coldpro_project_id);
    return saved;
  });

export const autoSelectColdProEquipment = createServerFn({ method: "POST" })
  .inputValidator(z.object({ environmentId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;
    const { data: env, error: envError } = await supabase.from("coldpro_environments").select("*").eq("id", data.environmentId).single();
    if (envError) throw new Error(envError.message);
    const { data: result, error: resultError } = await supabase.from("coldpro_results").select("*").eq("environment_id", data.environmentId).order("created_at", { ascending: false }).limit(1).single();
    if (resultError) throw new Error("Calcule a carga térmica antes de selecionar equipamento.");
    const candidates = await findEquipmentCandidates({
      required_kcal_h: Number(result.total_required_kcal_h),
      internal_temp_c: Number(env.internal_temp_c),
      evaporation_temp_c: suggestEvaporationTemp(Number(env.internal_temp_c)),
      condensation_temp_c: Math.max(40, Math.round(Number(env.external_temp_c ?? 35) + 10)),
      application: suggestApplication(Number(env.internal_temp_c)),
      refrigerant: null,
      volume_m3: Number(env.volume_m3 ?? 0),
    }, supabase);
    const best = candidates[0];
    if (!best) throw new Error("Nenhum equipamento encontrado com curva de rendimento para esta carga térmica.");

    await supabase.from("coldpro_equipment_selections").delete().eq("environment_id", data.environmentId);
    const { data: selection, error } = await supabase.from("coldpro_equipment_selections").insert({ environment_id: data.environmentId, equipment_model_id: best.model.id, model: best.model.modelo, refrigerant: best.refrigerant, quantity: best.quantity, capacity_unit_kcal_h: best.capacity_unit_kcal_h, capacity_total_kcal_h: best.capacity_total_kcal_h, air_flow_unit_m3_h: best.evaporator_airflow_m3_h ?? 0, air_flow_total_m3_h: best.air_flow_total_m3_h, total_power_kw: best.total_power_kw, cop: best.cop, surplus_kcal_h: best.surplus_kcal_h, surplus_percent: best.surplus_percent, air_changes_hour: best.air_changes_hour ?? 0, selection_method: best.point_used.polynomial ? "polynomial" : best.point_used.interpolated ? "interpolated" : "catalog_point", curve_temperature_room_c: best.point_used.temperature_room_c, curve_evaporation_temp_c: best.point_used.evaporation_temp_c, curve_condensation_temp_c: best.point_used.condensation_temp_c, curve_polynomial_r2: best.point_used.polynomial_r2, curve_interpolated: best.point_used.interpolated, curve_metadata: { score: best.score, warnings: best.warnings }, notes: `Curva de rendimento · Tevap ${best.point_used.evaporation_temp_c}°C / Tcond ${best.point_used.condensation_temp_c}°C${best.point_used.polynomial ? " · polinomial" : best.point_used.interpolated ? " · interpolado" : ""}` } as any).select("*").single();
    if (error) throw new Error(error.message);
    return selection;
  });
