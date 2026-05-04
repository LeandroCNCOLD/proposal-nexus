/**
 * simulation.functions.ts
 * Server functions para persistência, versionamento e consulta
 * das simulações dinâmicas do ColdPro.
 */

import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runColdRoomSimulation } from "@/modules/coldpro/simulation/services/coldRoomDynamicSimulationService";

// ─── Schemas ────────────────────────────────────────────────────────────────

const simulationConfigSchema = z.object({
  weatherProfile: z.enum([
    "hot_day",
    "cold_day",
    "rainy_day",
    "dry_day",
    "humid_day",
    "annual_average",
    "custom",
  ]).default("hot_day"),
  simulationPeriodDays: z.number().int().min(1).max(365).default(1),
  timeStepMinutes: z.enum([5, 15, 30, 60]).default(15),
  setpointC: z.number().finite(),
  differentialC: z.number().finite().min(0.5).max(5).default(1),
  customExternalTempC: z.number().finite().nullable().optional(),
  customSolarRadiationW: z.number().finite().min(0).nullable().optional(),
});

// ─── Salvar Simulação ────────────────────────────────────────────────────────

/**
 * Executa a simulação dinâmica no servidor e persiste o resultado.
 * Marca versões anteriores como is_latest=false automaticamente via trigger.
 */
export const saveSimulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      environmentId: z.string().uuid(),
      name: z.string().trim().min(1).max(120).default("Simulação"),
      config: simulationConfigSchema,
    }),
  )
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;

    // Buscar ambiente e resultado mais recente
    const { data: env, error: envError } = await supabase
      .from("coldpro_environments")
      .select("*")
      .eq("id", data.environmentId)
      .single();
    if (envError) throw new Error(envError.message);

    const { data: result } = await supabase
      .from("coldpro_results")
      .select("*")
      .eq("environment_id", data.environmentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!result) {
      throw new Error(
        "Calcule a carga térmica antes de executar a simulação dinâmica.",
      );
    }

    // Buscar seleção de equipamento
    const { data: selection } = await supabase
      .from("coldpro_equipment_selections")
      .select("*")
      .eq("environment_id", data.environmentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Determinar versão
    const { count } = await supabase
      .from("coldpro_simulations")
      .select("id", { count: "exact", head: true })
      .eq("environment_id", data.environmentId);

    const version = (count ?? 0) + 1;

    // Executar simulação
    const simInput = {
      environment: env as any,
      staticResult: result as any,
      selection: selection as any,
      config: {
        weatherProfile: data.config.weatherProfile,
        simulationPeriodDays: data.config.simulationPeriodDays,
        timeStepMinutes: data.config.timeStepMinutes,
        setpointC: data.config.setpointC,
        differentialC: data.config.differentialC,
        customExternalTempC: data.config.customExternalTempC ?? null,
        customSolarRadiationW: data.config.customSolarRadiationW ?? null,
      },
    };

    const simResult = runColdRoomSimulation(simInput);

    // Persistir no banco
    const { data: saved, error } = await supabase
      .from("coldpro_simulations")
      .insert({
        environment_id: data.environmentId,
        result_id: result.id,
        name: data.name,
        version,
        is_latest: true,
        weather_profile: data.config.weatherProfile,
        simulation_period_days: data.config.simulationPeriodDays,
        time_step_minutes: data.config.timeStepMinutes,
        setpoint_c: data.config.setpointC,
        differential_c: data.config.differentialC,
        // KPIs
        max_internal_temp_c: simResult.summary.maxInternalTempC,
        min_internal_temp_c: simResult.summary.minInternalTempC,
        avg_internal_temp_c: simResult.summary.avgInternalTempC,
        hours_above_setpoint: simResult.summary.hoursAboveSetpoint,
        hours_below_setpoint: simResult.summary.hoursBelowSetpoint,
        compressor_on_hours: simResult.summary.compressorOnHours,
        compressor_on_percent: simResult.summary.compressorOnPercent,
        total_energy_kwh: simResult.summary.totalEnergyKwh,
        avg_cop: simResult.summary.avgCop,
        peak_load_kcal_h: simResult.summary.peakLoadKcalH,
        equipment_adequacy: simResult.summary.equipmentAdequacy,
        // Série temporal completa
        simulation_data: simResult.timeSteps as any,
        // Alertas
        alerts: simResult.alerts as any,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return { simulation: saved, summary: simResult.summary, alerts: simResult.alerts };
  });

// ─── Listar Simulações ───────────────────────────────────────────────────────

/**
 * Lista todas as simulações de um ambiente, ordenadas da mais recente.
 */
export const listSimulations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ environmentId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;
    const { data: simulations, error } = await supabase
      .from("coldpro_simulations")
      .select(
        "id, name, version, is_latest, weather_profile, simulation_period_days, time_step_minutes, setpoint_c, max_internal_temp_c, avg_internal_temp_c, compressor_on_percent, total_energy_kwh, avg_cop, peak_load_kcal_h, equipment_adequacy, alerts, created_at",
      )
      .eq("environment_id", data.environmentId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return simulations ?? [];
  });

// ─── Buscar Simulação por ID ─────────────────────────────────────────────────

/**
 * Retorna uma simulação completa com a série temporal.
 */
export const getSimulation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ simulationId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;
    const { data: simulation, error } = await supabase
      .from("coldpro_simulations")
      .select("*")
      .eq("id", data.simulationId)
      .single();

    if (error) throw new Error(error.message);
    return simulation;
  });

// ─── Buscar Última Simulação do Ambiente ─────────────────────────────────────

/**
 * Retorna a simulação mais recente (is_latest=true) de um ambiente.
 */
export const getLatestSimulation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ environmentId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;
    const { data: simulation, error } = await supabase
      .from("coldpro_simulations")
      .select("*")
      .eq("environment_id", data.environmentId)
      .eq("is_latest", true)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return simulation ?? null;
  });

// ─── Deletar Simulação ───────────────────────────────────────────────────────

export const deleteSimulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ simulationId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;
    const { error } = await supabase
      .from("coldpro_simulations")
      .delete()
      .eq("id", data.simulationId);

    if (error) throw new Error(error.message);
    return { success: true };
  });

// ─── Salvar Snapshot de Cálculo ──────────────────────────────────────────────

/**
 * Persiste um snapshot imutável do cálculo estático para versionamento.
 */
export const saveCalculationSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      environmentId: z.string().uuid(),
      label: z.string().trim().min(1).max(120).default("Cálculo"),
      isBaseline: z.boolean().default(false),
      snapshotData: z.record(z.unknown()),
      inputHash: z.string().default(""),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;

    // Determinar versão
    const { count } = await supabase
      .from("coldpro_calculation_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("environment_id", data.environmentId);

    const version = (count ?? 0) + 1;

    // Buscar resultado mais recente
    const { data: result } = await supabase
      .from("coldpro_results")
      .select("id")
      .eq("environment_id", data.environmentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: saved, error } = await supabase
      .from("coldpro_calculation_snapshots")
      .insert({
        environment_id: data.environmentId,
        result_id: result?.id ?? null,
        label: data.label,
        version,
        is_baseline: data.isBaseline,
        input_hash: data.inputHash,
        snapshot_data: data.snapshotData as any,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return saved;
  });

// ─── Listar Snapshots ────────────────────────────────────────────────────────

export const listCalculationSnapshots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ environmentId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;
    const { data: snapshots, error } = await supabase
      .from("coldpro_calculation_snapshots")
      .select(
        "id, label, version, is_baseline, input_hash, created_at",
      )
      .eq("environment_id", data.environmentId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return snapshots ?? [];
  });
