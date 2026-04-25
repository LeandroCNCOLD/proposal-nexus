import { roundAdvanced, sensiblePurgeLoadKw, toNumber } from "./psychrometricHumidityService";

export function calculateCo2Control(input: any) {
  const warnings: string[] = [];
  const productMass = toNumber(input.product_mass_kg);
  const generationRate = toNumber(input.co2_generation_rate_m3_kg_h);
  const generatedM3H = productMass * generationRate;
  const chamberVolume = toNumber(input.chamber_volume_m3);
  const limitPercent = toNumber(input.co2_limit_percent);
  const externalPercent = toNumber(input.external_co2_percent, 0.04);
  const limitFrac = limitPercent / 100;
  const externalFrac = externalPercent / 100;
  const co2MaximumM3 = chamberVolume * limitPercent / 100;
  let purgeAirflowM3H = toNumber(input.purge_airflow_m3_h);
  if (purgeAirflowM3H <= 0 && limitFrac > externalFrac) purgeAirflowM3H = generatedM3H / (limitFrac - externalFrac);
  if (limitFrac <= externalFrac && generatedM3H > 0) warnings.push("Limite de CO₂ menor ou igual ao CO₂ externo: cálculo de purga bloqueado como inviável.");
  if (limitPercent >= 1) warnings.push("CO₂ elevado oferece risco a pessoas; prever sensores, alarme e renovação segura.");
  const purgeKw = sensiblePurgeLoadKw({ airflowM3H: purgeAirflowM3H, externalTemperatureC: input.external_temperature_c, internalTemperatureC: input.internal_temperature_c ?? input.target_temperature_c });
  return {
    co2_generated_m3_h: roundAdvanced(generatedM3H, 5),
    co2_maximum_m3: roundAdvanced(co2MaximumM3, 3),
    purge_airflow_m3_h: roundAdvanced(purgeAirflowM3H),
    purge_thermal_load_kw: roundAdvanced(purgeKw),
    purge_thermal_load_kcal_h: roundAdvanced(purgeKw * 860),
    limit_co2_percent: roundAdvanced(limitPercent, 3),
    external_co2_percent: roundAdvanced(externalPercent, 3),
    warnings,
    memory: {
      formula_generation: "CO2_gerado_m3_h = massa_produto_kg × taxa_co2_m3_kg_h",
      formula_purge: "vazao_purga_m3_h = CO2_gerado_m3_h / (limite_CO2_frac - CO2_externo_frac)",
      formula_purge_load: "Q_purga = ρ_ar × vazao_purga_m3_s × Cp_ar × ΔT",
    },
  };
}
