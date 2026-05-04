/**
 * simulation.functions.ts
 * Server functions para persistência, versionamento e consulta
 * das simulações dinâmicas do ColdPro.
 *
 * A simulação numérica é executada no cliente (hook useColdRoomSimulation);
 * estas funções recebem o resultado pré-computado e o persistem.
 */

import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ─── Schemas ────────────────────────────────────────────────────────────────

const simulationConfigSchema = z.object({
  weatherProfile: z
    .enum(["hot_day", "cold_day", "rainy_day", "dry_day", "humid_day", "annual_average", "custom"])
    .default("hot_day"),
  simulationPeriodDays: z.number().int().min(1).max(365).default(1),
  timeStepMinutes: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(30), z.literal(60)]).default(15),
  setpointC: z.number().finite(),
  differentialC: z.number().finite().min(0.5).max(5).default(1),
  customExternalTempC: z.number().finite().nullable().optional(),
  customSolarRadiationW: z.number().finite().min(0).nullable().optional(),
});

const simulationResultSchema = z.object({
  maxInternalTempC: z.number().nullable().optional(),
  minInternalTempC: z.number().nullable().optional(),
  avgInternalTempC: z.number().nullable().optional(),
  hoursAboveSetpoint: z.number().default(0),
  hoursBelowSetpoint: z.number().default(0),
  compressorOnHours: z.number().default(0),
  compressorOnPercent: z.number().default(0),
  totalEnergyKwh: z.number().default(0),
  avgCop: z.number().nullable().optional(),
  peakLoadKcalH: z.number().default(0),
  equipmentAdequacy: z.string().default("adequate"),
  timeline: z.array(z.record(z.string(), z.unknown())).default([]),
  alerts: z.array(z.record(z.string(), z.unknown())).default([]),
});

// ─── Salvar Simulação ────────────────────────────────────────────────────────

export const saveSimulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      environmentId: z.string().uuid(),
      name: z.string().trim().min(1).max(120).default("Simulação"),
      config: simulationConfigSchema,
      result: simulationResultSchema,
    }),
  )
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;

    const { data: result } = await supabase
      .from("coldpro_results")
      .select("id")
      .eq("environment_id", data.environmentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { count } = await supabase
      .from("coldpro_simulations" as any)
      .select("id", { count: "exact", head: true })
      .eq("environment_id", data.environmentId);

    const version = (count ?? 0) + 1;

    const insertRow: any = {
      environment_id: data.environmentId,
      result_id: result?.id ?? null,
      name: data.name,
      version,
      is_latest: true,
      weather_profile: data.config.weatherProfile,
      simulation_period_days: data.config.simulationPeriodDays,
      time_step_minutes: data.config.timeStepMinutes,
      setpoint_c: data.config.setpointC,
      differential_c: data.config.differentialC,
      max_internal_temp_c: data.result.maxInternalTempC ?? null,
      min_internal_temp_c: data.result.minInternalTempC ?? null,
      avg_internal_temp_c: data.result.avgInternalTempC ?? null,
      hours_above_setpoint: data.result.hoursAboveSetpoint,
      hours_below_setpoint: data.result.hoursBelowSetpoint,
      compressor_on_hours: data.result.compressorOnHours,
      compressor_on_percent: data.result.compressorOnPercent,
      total_energy_kwh: data.result.totalEnergyKwh,
      avg_cop: data.result.avgCop ?? null,
      peak_load_kcal_h: data.result.peakLoadKcalH,
      equipment_adequacy: data.result.equipmentAdequacy,
      simulation_data: data.result.timeline,
      alerts: data.result.alerts,
    };

    const { data: saved, error } = await (supabase.from("coldpro_simulations" as any) as any)
      .insert(insertRow)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return { simulation: saved as { id: string } & any };
  });

// ─── Listar Simulações ───────────────────────────────────────────────────────

export const listSimulations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ environmentId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;
    const { data: simulations, error } = await (supabase.from("coldpro_simulations" as any) as any)
      .select(
        "id, name, version, is_latest, weather_profile, simulation_period_days, time_step_minutes, setpoint_c, max_internal_temp_c, avg_internal_temp_c, compressor_on_percent, total_energy_kwh, avg_cop, peak_load_kcal_h, equipment_adequacy, alerts, created_at",
      )
      .eq("environment_id", data.environmentId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (simulations ?? []) as Array<any>;
  });

// ─── Buscar Simulação por ID ─────────────────────────────────────────────────

export const getSimulation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ simulationId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;
    const { data: simulation, error } = await (supabase.from("coldpro_simulations" as any) as any)
      .select("*")
      .eq("id", data.simulationId)
      .single();

    if (error) throw new Error(error.message);
    return simulation as any;
  });

// ─── Buscar Última Simulação do Ambiente ─────────────────────────────────────

export const getLatestSimulation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ environmentId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;
    const { data: simulation, error } = await (supabase.from("coldpro_simulations" as any) as any)
      .select("*")
      .eq("environment_id", data.environmentId)
      .eq("is_latest", true)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return (simulation ?? null) as any | null;
  });

// ─── Deletar Simulação ───────────────────────────────────────────────────────

export const deleteSimulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ simulationId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;
    const { error } = await (supabase.from("coldpro_simulations" as any) as any)
      .delete()
      .eq("id", data.simulationId);

    if (error) throw new Error(error.message);
    return { success: true };
  });

// ─── Snapshots de cálculo ────────────────────────────────────────────────────

export const saveCalculationSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      environmentId: z.string().uuid(),
      label: z.string().trim().min(1).max(120).default("Cálculo"),
      isBaseline: z.boolean().default(false),
      snapshotData: z.record(z.string(), z.unknown()),
      inputHash: z.string().default(""),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;

    const { count } = await (supabase.from("coldpro_calculation_snapshots" as any) as any)
      .select("id", { count: "exact", head: true })
      .eq("environment_id", data.environmentId);

    const version = (count ?? 0) + 1;

    const { data: result } = await supabase
      .from("coldpro_results")
      .select("id")
      .eq("environment_id", data.environmentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: saved, error } = await (supabase.from("coldpro_calculation_snapshots" as any) as any)
      .insert({
        environment_id: data.environmentId,
        result_id: result?.id ?? null,
        label: data.label,
        version,
        is_baseline: data.isBaseline,
        input_hash: data.inputHash,
        snapshot_data: data.snapshotData,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return saved as any;
  });

export const listCalculationSnapshots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ environmentId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;
    const { data: snapshots, error } = await (supabase.from("coldpro_calculation_snapshots" as any) as any)
      .select("id, label, version, is_baseline, input_hash, created_at")
      .eq("environment_id", data.environmentId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (snapshots ?? []) as Array<any>;
  });
