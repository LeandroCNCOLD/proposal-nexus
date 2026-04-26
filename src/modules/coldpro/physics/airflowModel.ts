import { safeNumber } from "../core/units";

export type AirflowSource = "manual_velocity" | "airflow_by_fans";

function positive(value: unknown): number {
  const parsed = safeNumber(value, 0);
  return parsed > 0 ? parsed : 0;
}

export function calculateAirflowModel(input: any) {
  const rawSource = input?.airflowSource ?? input?.airflow_source;
  const airflowSource = (rawSource || "manual_velocity") as AirflowSource;
  const warnings: string[] = rawSource ? [] : ["Fonte da velocidade do ar assumida como manual."];
  const missingFields: string[] = [];
  const invalidFields: string[] = [];

  if (airflowSource !== "airflow_by_fans") {
    const airVelocityUsedMS = positive(input?.airVelocityMS ?? input?.air_velocity_m_s) || null;
    if (!airVelocityUsedMS) missingFields.push("velocidade manual do ar");
    return {
      airflowSource: "manual_velocity",
      fanAirflowM3H: null,
      grossAreaM2: null,
      freeAreaM2: null,
      blockageFactor: 0,
      calculatedAirVelocityMS: null,
      airVelocityUsedMS,
      source: "manual_velocity",
      warnings,
      missingFields,
      invalidFields,
    };
  }

  const fanAirflowM3H = positive(input?.fanAirflowM3H ?? input?.fan_airflow_m3_h);
  const width = positive(input?.tunnelCrossSectionWidthM ?? input?.tunnel_cross_section_width_m);
  const height = positive(input?.tunnelCrossSectionHeightM ?? input?.tunnel_cross_section_height_m);
  const rawBlockage = safeNumber(input?.blockageFactor ?? input?.blockage_factor, 0);
  const blockageFactor = Math.min(Math.max(rawBlockage, 0), 0.95);
  if (rawBlockage > 0.95) invalidFields.push("fator de bloqueio");
  if (fanAirflowM3H <= 0) missingFields.push("vazão de ar dos ventiladores");
  if (width <= 0) missingFields.push("largura da seção de passagem do ar");
  if (height <= 0) missingFields.push("altura da seção de passagem do ar");

  const grossAreaM2 = width > 0 && height > 0 ? width * height : null;
  const freeAreaM2 = grossAreaM2 !== null ? grossAreaM2 * (1 - blockageFactor) : null;
  if (grossAreaM2 !== null && (!freeAreaM2 || freeAreaM2 <= 0)) invalidFields.push("área livre de passagem do ar");
  const calculatedAirVelocityMS = fanAirflowM3H > 0 && freeAreaM2 && freeAreaM2 > 0 ? fanAirflowM3H / 3600 / freeAreaM2 : null;
  if (calculatedAirVelocityMS !== null && calculatedAirVelocityMS > 15) warnings.push("Velocidade de ar calculada muito alta. Verificar vazão, seção livre e bloqueio.");
  if (calculatedAirVelocityMS !== null && calculatedAirVelocityMS < 0.1) warnings.push("Velocidade de ar calculada muito baixa para congelamento/resfriamento eficiente.");

  return {
    airflowSource,
    fanAirflowM3H: fanAirflowM3H || null,
    grossAreaM2,
    freeAreaM2,
    blockageFactor,
    calculatedAirVelocityMS,
    airVelocityUsedMS: calculatedAirVelocityMS,
    source: "airflow_by_fans",
    warnings,
    missingFields,
    invalidFields,
  };
}
