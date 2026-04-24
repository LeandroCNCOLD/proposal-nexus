import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { calculateColdProLoad } from "./coldpro-calculation.engine";

export const listColdProProjects = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = supabaseAdmin;
  const { data, error } = await supabase.from("coldpro_projects").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const createColdProProject = createServerFn({ method: "POST" })
  .inputValidator(z.object({ proposal_id: z.string().uuid().nullable().optional(), name: z.string().min(1), application_type: z.string().default("cold_room") }))
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
    const { data: productCatalog } = await supabase.from("coldpro_products").select("*").order("name");
    return { project, environments: environments ?? [], products: products ?? [], tunnels: tunnels ?? [], results: results ?? [], selections: selections ?? [], insulationMaterials: insulationMaterials ?? [], productCatalog: productCatalog ?? [] };
  });

export const createColdProEnvironment = createServerFn({ method: "POST" })
  .inputValidator(z.object({ projectId: z.string().uuid(), name: z.string().min(1), environment_type: z.string().default("cold_room") }))
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
    id: z.string().uuid().optional(), environment_id: z.string().uuid(), product_name: z.string().min(1), mass_kg_day: z.number().default(0), mass_kg_hour: z.number().default(0), inlet_temp_c: z.number().default(0), outlet_temp_c: z.number().default(0), process_time_h: z.number().default(24), packaging_mass_kg_day: z.number().default(0), packaging_specific_heat_kcal_kg_c: z.number().default(0.4), specific_heat_above_kcal_kg_c: z.number().default(0), specific_heat_below_kcal_kg_c: z.number().default(0), latent_heat_kcal_kg: z.number().default(0), initial_freezing_temp_c: z.number().nullable().optional()
  }))
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;
    const { data: row, error } = await supabase.from("coldpro_environment_products").upsert(data, { onConflict: "id" }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const upsertColdProTunnel = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    id: z.string().uuid().optional(), environment_id: z.string().uuid(), tunnel_type: z.string().default("blast_freezer"), operation_mode: z.string().default("continuous"), product_name: z.string().default("Produto"), product_thickness_mm: z.number().default(0), product_unit_weight_kg: z.number().default(0), units_per_cycle: z.number().default(0), cycles_per_hour: z.number().default(0), mass_kg_hour: z.number().default(0), inlet_temp_c: z.number().default(0), outlet_temp_c: z.number().default(-18), freezing_temp_c: z.number().nullable().optional(), air_temp_c: z.number().default(-35), air_velocity_m_s: z.number().default(3), process_time_min: z.number().default(60), specific_heat_above_kcal_kg_c: z.number().default(0.8), specific_heat_below_kcal_kg_c: z.number().default(0.4), latent_heat_kcal_kg: z.number().default(60), packaging_mass_kg_hour: z.number().default(0), packaging_specific_heat_kcal_kg_c: z.number().default(0.4), belt_motor_kw: z.number().default(0), internal_fans_kw: z.number().default(0), other_internal_kw: z.number().default(0)
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
    const result = calculateColdProLoad({ env, products: products ?? [], insulation, tunnel: tunnel ?? null });
    const { data: saved, error } = await supabase.from("coldpro_results").insert({ environment_id: data.environmentId, ...result, calculation_input: { environment: env, products: products ?? [], tunnel, insulation } }).select("*").single();
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
    const { data: equipmentList } = await supabase.from("coldpro_equipment_catalog").select("*").eq("active", true).eq("application_type", env.environment_type).order("capacity_kcal_h", { ascending: true });
    const catalog = equipmentList ?? [];
    if (catalog.length === 0) throw new Error("Nenhum equipamento cadastrado para esta aplicação.");
    let best = catalog[0];
    let qty = Math.ceil(Number(result.total_required_kcal_h) / Number(best.capacity_kcal_h));
    for (const eq of catalog) {
      const q = Math.ceil(Number(result.total_required_kcal_h) / Number(eq.capacity_kcal_h));
      if (q <= qty) { best = eq; qty = q; }
    }
    const capacityTotal = Number(best.capacity_kcal_h) * qty;
    const surplus = capacityTotal - Number(result.total_required_kcal_h);
    const surplusPercent = Number(result.total_required_kcal_h) > 0 ? (surplus / Number(result.total_required_kcal_h)) * 100 : 0;
    const airFlowTotal = Number(best.air_flow_m3_h ?? 0) * qty;
    const airChanges = Number(env.volume_m3) > 0 ? airFlowTotal / Number(env.volume_m3) : 0;
    const { data: selection, error } = await supabase.from("coldpro_equipment_selections").insert({ environment_id: data.environmentId, equipment_id: best.id, model: best.model, quantity: qty, capacity_unit_kcal_h: best.capacity_kcal_h, capacity_total_kcal_h: capacityTotal, air_flow_unit_m3_h: best.air_flow_m3_h, air_flow_total_m3_h: airFlowTotal, air_throw_m: best.air_throw_m, surplus_kcal_h: surplus, surplus_percent: surplusPercent, air_changes_hour: airChanges }).select("*").single();
    if (error) throw new Error(error.message);
    return selection;
  });
