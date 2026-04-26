import { buildCalculationLog } from "../core/calculationLogger";
import type { TunnelCalculationInput, TunnelEngineResult, TunnelProcessStatus } from "../core/calculationTypes";
import { validateTunnelInput } from "../core/validators";
import { kwToKcalH, kwToTr, roundColdPro, safeNumber } from "../core/units";
import { calculateConvectiveCoefficient } from "../physics/heatTransfer";
import { calculateBatchProductLoadKW, calculateContinuousProductLoadKW, calculateProductSpecificEnergy } from "../physics/productThermal";
import { calculatePlankFreezingTimeMin } from "../physics/freezingTime";

function isStaticProcess(processType: string, operationMode?: string | null) {
  return processType === "static_cart_freezing" || processType === "static_pallet_freezing" || operationMode === "batch";
}

function positiveOrNull(value: number) {
  return value > 0 ? roundColdPro(value, 4) : null;
}

export function calculateTunnelEngine(input: TunnelCalculationInput): TunnelEngineResult {
  const processType = String(input.processType ?? (input.operationMode === "batch" ? "static_pallet_freezing" : "continuous_individual_freezing"));
  const isStatic = isStaticProcess(processType, input.operationMode);
  const warnings: string[] = [];
  const calculatedMassKgH = safeNumber(input.unitWeightKg, 0) * safeNumber(input.unitsPerCycle, 0) * safeNumber(input.cyclesPerHour, 0);
  const directMassKgH = safeNumber(input.directMassKgH, 0);
  if (!isStatic && directMassKgH > 0 && calculatedMassKgH > 0) {
    const diffPercent = Math.abs(directMassKgH - calculatedMassKgH) / ((directMassKgH + calculatedMassKgH) / 2) * 100;
    if (diffPercent > 15) warnings.push(`Massa direta difere da massa por cadência em ${roundColdPro(diffPercent, 1)}%.`);
  }
  const usedMassKgH = isStatic ? 0 : directMassKgH > 0 ? directMassKgH : calculatedMassKgH;
  const staticMassKg = safeNumber(input.staticMassKg, 0);
  const staticDims = [safeNumber(input.palletLengthM, 0), safeNumber(input.palletWidthM, 0), safeNumber(input.palletHeightM, 0)].filter((value) => value > 0);
  const characteristicDimensionM = isStatic ? (staticDims.length ? Math.min(...staticDims) : 0) : safeNumber(input.productThicknessM, 0);
  const distanceToCoreM = characteristicDimensionM > 0 ? characteristicDimensionM / 2 : 0;
  const airExposureFactor = safeNumber(input.airExposureFactor, 1) || 1;
  const h = calculateConvectiveCoefficient({ manualConvectiveCoefficientWM2K: input.manualConvectiveCoefficientWM2K, convective_coefficient_manual_w_m2_k: input.convective_coefficient_manual_w_m2_k, airVelocityMS: input.airVelocityMS, airExposureFactor });
  const kEffectiveWMK = safeNumber(input.frozenConductivityWMK, 0) > 0 ? safeNumber(input.frozenConductivityWMK, 0) * (safeNumber(input.thermalPenetrationFactor, 1) || 1) : 0;
  const energy = calculateProductSpecificEnergy(input);
  const productLoadKW = isStatic
    ? calculateBatchProductLoadKW({ massKg: staticMassKg, specificEnergyKJkg: energy.totalKJkg, timeH: input.batchTimeH })
    : calculateContinuousProductLoadKW({ massKgH: usedMassKgH, specificEnergyKJkg: energy.totalKJkg });
  const packagingLoadKW = calculateContinuousProductLoadKW({
    massKgH: input.packagingMassKgH,
    specificEnergyKJkg: safeNumber(input.packagingCpKJkgK, 0) * Math.abs(safeNumber(input.initialTempC, 0) - safeNumber(input.finalTempC, 0)),
  });
  const internalLoadKW = roundColdPro(safeNumber(input.beltMotorKW, 0) + safeNumber(input.internalFansKW, 0) + safeNumber(input.otherInternalKW, 0), 4);
  const totalKW = roundColdPro(productLoadKW + packagingLoadKW + internalLoadKW, 4);
  const totalKcalH = roundColdPro(kwToKcalH(totalKW), 2);
  const totalTR = roundColdPro(kwToTr(totalKW), 4);
  const availableTimeMin = isStatic ? safeNumber(input.batchTimeH, 0) * 60 : safeNumber(input.retentionTimeMin, 0);
  const estimatedTimeMin = calculatePlankFreezingTimeMin({
    densityKgM3: input.densityKgM3,
    latentHeatKJkg: input.latentHeatKJkg,
    frozenWaterFraction: input.frozenWaterFraction,
    freezingPointC: input.freezingPointC,
    airTempC: input.airTempC,
    distanceToCoreM,
    hEffectiveWM2K: h.hEffectiveWM2K,
    kEffectiveWMK,
  });
  const validation = validateTunnelInput(input);
  warnings.push(...validation.warnings);
  const missingFields = [...validation.missingFields];
  if (isStatic && staticMassKg <= 0) missingFields.push("staticMassKg");
  if (isStatic && safeNumber(input.batchTimeH, 0) <= 0) missingFields.push("batchTimeH");
  if (!isStatic && usedMassKgH <= 0) missingFields.push("usedMassKgH");
  if (!isStatic && safeNumber(input.retentionTimeMin, 0) <= 0) missingFields.push("retentionTimeMin");
  if (characteristicDimensionM <= 0) missingFields.push(isStatic ? "pallet dimensions" : "productThicknessM");
  if (h.source === "missing") missingFields.push("airVelocityMS or manualConvectiveCoefficientWM2K");
  const uniqueMissing = Array.from(new Set(missingFields));
  let status: TunnelProcessStatus = "adequate";
  if (validation.isInvalid) status = "invalid_input";
  else if (uniqueMissing.length > 0 || estimatedTimeMin === null || availableTimeMin <= 0) status = "missing_data";
  else if (estimatedTimeMin > availableTimeMin) status = "insufficient";
  const calculationBreakdown = {
    mass: { calculatedMassKgH: roundColdPro(calculatedMassKgH, 4), directMassKgH: roundColdPro(directMassKgH, 4), usedMassKgH: roundColdPro(usedMassKgH, 4), staticMassKg: roundColdPro(staticMassKg, 4) },
    geometry: { characteristicDimensionM: positiveOrNull(characteristicDimensionM), distanceToCoreM: positiveOrNull(distanceToCoreM) },
    energy,
    heatTransfer: { h, kEffectiveWMK: positiveOrNull(kEffectiveWMK), airExposureFactor, thermalPenetrationFactor: safeNumber(input.thermalPenetrationFactor, 1) || 1 },
    loadsKW: { productLoadKW, packagingLoadKW, internalLoadKW, totalKW },
    loadsConverted: { totalKcalH, totalTR },
    time: { estimatedTimeMin, availableTimeMin: roundColdPro(availableTimeMin, 2) },
    status,
  };
  const resultSummary = { status, totalKW, totalKcalH, totalTR, estimatedTimeMin, availableTimeMin };
  const calculationLog = buildCalculationLog({
    originalInputs: input.originalInput ?? input,
    normalizedInputs: input,
    unitConversions: input.unitConversions,
    estimatedData: { calculatedMassKgH, characteristicDimensionM, distanceToCoreM, kEffectiveWMK },
    missingFields: uniqueMissing,
    warnings: Array.from(new Set(warnings)),
    formulas: {
      mass: "unitWeightKg × unitsPerCycle × cyclesPerHour; massa direta prevalece em processo contínuo quando > 0",
      h: "manual prevalece; senão h = (10 + 10 × velocidade^0.8) × fator_exposição",
      k: "kEffective = frozenConductivityWMK × thermalPenetrationFactor",
      energy: "q = sensível acima + latente + sensível abaixo, em kJ/kg",
      productLoad: isStatic ? "kW = massa_lote × q_kJ_kg / (tempo_h × 3600)" : "kW = kg_h × q_kJ_kg / 3600",
      plank: "t = (ρ × L_eff / ΔT) × [a/h + a²/(2k)]",
    },
    finalResult: resultSummary,
  });
  return {
    processType,
    isStatic,
    calculatedMassKgH: roundColdPro(calculatedMassKgH, 4),
    usedMassKgH: roundColdPro(usedMassKgH, 4),
    staticMassKg: roundColdPro(staticMassKg, 4),
    characteristicDimensionM: positiveOrNull(characteristicDimensionM),
    distanceToCoreM: positiveOrNull(distanceToCoreM),
    energy,
    h,
    kEffectiveWMK: positiveOrNull(kEffectiveWMK),
    estimatedTimeMin,
    availableTimeMin: availableTimeMin > 0 ? roundColdPro(availableTimeMin, 2) : null,
    status,
    productLoadKW,
    packagingLoadKW,
    internalLoadKW,
    totalKW,
    totalKcalH,
    totalTR,
    missingFields: uniqueMissing,
    warnings: Array.from(new Set(warnings)),
    calculationBreakdown,
    calculationLog,
  };
}
