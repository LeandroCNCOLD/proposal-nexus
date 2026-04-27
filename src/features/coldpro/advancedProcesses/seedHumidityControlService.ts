import { AIR_DENSITY_KG_M3, WATER_LATENT_HEAT_KJ_KG, humidityRatioKgKg, roundAdvanced, toNumber } from "./psychrometricHumidityService";

export function calculateHumidityControl(input: any) {
  const warnings: string[] = [];
  const externalW = humidityRatioKgKg({ temperatureC: input.external_temperature_c, relativeHumidityPercent: input.external_relative_humidity, atmosphericPressureKpa: input.atmospheric_pressure_kpa });
  const internalW = humidityRatioKgKg({ temperatureC: input.internal_temperature_c ?? input.target_temperature_c, relativeHumidityPercent: input.internal_relative_humidity ?? input.target_relative_humidity, atmosphericPressureKpa: input.atmospheric_pressure_kpa });
  const deltaW = externalW - internalW;
  const chamberVolume = toNumber(input.chamber_volume_m3);
  const airChanges = toNumber(input.air_changes_per_hour);
  const airflowM3H = toNumber(input.air_renewal_m3_h) || chamberVolume * airChanges;
  const dryAirFlowKgH = airflowM3H * AIR_DENSITY_KG_M3;
  const waterRemovedAirKgH = deltaW > 0 ? dryAirFlowKgH * deltaW : 0;

  if (deltaW <= 0) warnings.push("Umidade externa menor ou igual à umidade interna desejada: não foi calculada remoção de umidade do ar externo.");

  const initialMoisture = toNumber(input.product_initial_moisture) / 100;
  const finalMoisture = toNumber(input.product_final_moisture) / 100;
  const productMass = toNumber(input.product_mass_kg);
  const timeH = toNumber(input.stabilization_time_h) || toNumber(input.process_time_h);
  const waterRemovedProductKg = initialMoisture > finalMoisture && finalMoisture < 1 ? productMass * (initialMoisture - finalMoisture) / (1 - finalMoisture) : 0;
  if (initialMoisture <= finalMoisture && (input.product_initial_moisture != null || input.product_final_moisture != null)) warnings.push("Umidade inicial do produto/semente menor ou igual à umidade final desejada: não foi calculada remoção de água do produto.");
  if (waterRemovedProductKg > 0 && timeH <= 0) warnings.push("Informe o tempo de estabilização para calcular a remoção de água do produto em kg/h.");
  const waterRemovedProductKgH = waterRemovedProductKg > 0 && timeH > 0 ? waterRemovedProductKg / timeH : 0;
  const latentAirKw = waterRemovedAirKgH * WATER_LATENT_HEAT_KJ_KG / 3600;
  const latentProductKw = waterRemovedProductKgH * WATER_LATENT_HEAT_KJ_KG / 3600;
  const totalKw = latentAirKw + latentProductKw;

  return {
    external_absolute_humidity_kg_kg: roundAdvanced(externalW, 5),
    internal_absolute_humidity_kg_kg: roundAdvanced(internalW, 5),
    delta_w_kg_kg: roundAdvanced(deltaW, 5),
    air_flow_m3_h: roundAdvanced(airflowM3H),
    dry_air_flow_kg_h: roundAdvanced(dryAirFlowKgH),
    water_removed_air_kg_h: roundAdvanced(waterRemovedAirKgH),
    water_removed_product_kg: roundAdvanced(waterRemovedProductKg),
    water_removed_product_kg_h: roundAdvanced(waterRemovedProductKgH),
    latent_air_kw: roundAdvanced(latentAirKw),
    latent_product_kw: roundAdvanced(latentProductKw),
    total_kw: roundAdvanced(totalKw),
    total_kcal_h: roundAdvanced(totalKw * 860),
    warnings,
    memory: {
      formula_w: "W = 0,62198 × Pv / (P_atm - Pv)",
      formula_air: "água_removida_ar_kg_h = vazão_ar_kg_h × (W_externo - W_interno)",
      formula_product: "água_removida_produto = massa × (Ui - Uf) / (1 - Uf)",
      formula_latent: "Q_latente_kW = água_kg_h × 2500 / 3600",
    },
  };
}
