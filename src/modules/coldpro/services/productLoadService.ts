import type { ColdProApplicationMode, ColdProProcessParameters } from "../types/coldPro.types";
import { round } from "../utils/numbers";

function isFreezingMode(mode: ColdProApplicationMode) {
  return ["cold_room_frozen", "continuous_girofreezer", "continuous_freezing_tunnel", "static_freezing"].includes(mode);
}

export function calculateConvectionCoefficient(airVelocityMS: number) {
  return 10 + 10 * Math.pow(Math.max(0, airVelocityMS), 0.8);
}

export function estimatePlankRetentionMinutes(process: ColdProProcessParameters) {
  const thickness = Number(process.productThicknessM ?? 0);
  const density = Number(process.productDensityKgM3 ?? 0);
  const conductivity = Number(process.productThermalConductivityWMK ?? 0);
  const airTemp = Number(process.airTempC ?? process.outletTempC);
  const velocity = Number(process.airVelocityMS ?? 0);
  const deltaT = process.freezingTempC - airTemp;
  if (thickness <= 0 || density <= 0 || conductivity <= 0 || process.latentHeatKjKg <= 0 || deltaT <= 0) return null;
  const a = thickness / 2;
  const h = calculateConvectionCoefficient(velocity);
  const lEff = process.latentHeatKjKg * process.freezableFraction * 1000;
  const seconds = (density * lEff / deltaT) * ((a / h) + ((a * a) / (2 * conductivity)));
  return round(seconds / 60, 1);
}

export function calculateProductLoad(process: ColdProProcessParameters, applicationMode: ColdProApplicationMode) {
  const warnings: string[] = [];
  const qSpecific = process.specificLoadKjKg && process.specificLoadKjKg > 0
    ? process.specificLoadKjKg
    : isFreezingMode(applicationMode)
      ? Math.max(0, process.cpAboveKjKgK * Math.max(0, process.inletTempC - process.freezingTempC))
        + Math.max(0, process.latentHeatKjKg * process.freezableFraction)
        + Math.max(0, process.cpBelowKjKgK * Math.max(0, process.freezingTempC - process.outletTempC))
      : Math.max(0, process.cpAboveKjKgK * Math.max(0, process.inletTempC - process.outletTempC));

  const productKw = process.operationMode === "continuous"
    ? (Math.max(0, process.productionKgH) * qSpecific) / 3600
    : (Math.max(0, process.batchMassKg || process.massKg) * qSpecific) / (Math.max(0.1, process.batchTimeH) * 3600);

  const meanMassInsideKg = process.operationMode === "continuous" && process.retentionTimeMin
    ? Math.max(0, process.productionKgH) * process.retentionTimeMin / 60
    : null;

  const estimatedRetentionMin = ["continuous_girofreezer", "continuous_freezing_tunnel", "static_freezing"].includes(applicationMode)
    ? estimatePlankRetentionMinutes(process)
    : null;

  if (["continuous_girofreezer", "continuous_freezing_tunnel", "static_freezing"].includes(applicationMode)) {
    if (estimatedRetentionMin === null) warnings.push("Faltam dados térmicos do produto para validar tempo de retenção.");
    if (estimatedRetentionMin !== null && Number(process.retentionTimeMin ?? 0) < estimatedRetentionMin) warnings.push("Tempo de retenção insuficiente para o congelamento estimado.");
    if (estimatedRetentionMin !== null && Number(process.retentionTimeMin ?? 0) >= estimatedRetentionMin) warnings.push("Tempo de retenção adequado pelo Plank simplificado.");
    const velocity = Number(process.airVelocityMS ?? 0);
    if (velocity > 0 && velocity < 2) warnings.push("Velocidade do ar está baixa para processo contínuo.");
    if (velocity > 6) warnings.push("Velocidade do ar está alta; validar desidratação e arraste.");
  }

  return { productKw: round(productKw, 3), qSpecificKjKg: round(qSpecific, 2), meanMassInsideKg: meanMassInsideKg === null ? null : round(meanMassInsideKg, 2), estimatedRetentionMin, warnings };
}
