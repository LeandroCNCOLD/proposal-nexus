import { buildCalculationLog } from "../core/calculationLogger";
import { kwToKcalH, kwToTr } from "../core/units";
import { validateTunnelInput } from "../core/validators";
import { calculatePlankFreezingTimeMin } from "../physics/freezingTime";
import { calculateConvectiveCoefficient } from "../physics/heatTransfer";
import {
  calculateBatchProductLoadKW,
  calculateContinuousProductLoadKW,
  calculateProductSpecificEnergy,
} from "../physics/productThermal";

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isProvided(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

function positiveNumber(value: unknown): number {
  const parsed = toNumber(value, 0);
  return parsed > 0 ? parsed : 0;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function getSmallestValidDimension(values: unknown[]): number {
  const dimensions = values.map((value) => positiveNumber(value)).filter((value) => value > 0);
  return dimensions.length > 0 ? Math.min(...dimensions) : 0;
}

function isStaticTunnel(input: any, processType: string | null): boolean {
  const normalizedProcessType = String(processType ?? "").toLowerCase();
  return (
    normalizedProcessType === "static_cart_freezing" ||
    normalizedProcessType === "static_pallet_freezing" ||
    normalizedProcessType.includes("static") ||
    input?.operationMode === "batch" ||
    input?.operation_mode === "batch" ||
    input?.tunnelMode === "static" ||
    input?.tunnel_mode === "static"
  );
}

function requiredPositiveFields(input: any, isStatic: boolean, staticMassKg: number, characteristicDimensionM: number, crossesFreezing: boolean): string[] {
  const requiredNumericFields = ["initialTempC", "finalTempC", "freezingPointC"];
  const commonPositiveFields = ["cpAboveKJkgK"];
  const freezingPositiveFields = crossesFreezing ? ["cpBelowKJkgK", "latentHeatKJkg", "frozenWaterFraction"] : [];

  const missingNumericFields = requiredNumericFields.filter((field) => !isProvided(input?.[field]) || !Number.isFinite(Number(input?.[field])));
  const missingPositiveFields = [...commonPositiveFields, ...freezingPositiveFields].filter((field) => !isProvided(input?.[field]) || toNumber(input?.[field], 0) <= 0);
  const processFields = isStatic
    ? [
        staticMassKg <= 0 ? "massa estática do lote" : "",
        positiveNumber(input?.batchTimeH) <= 0 ? "tempo de batelada" : "",
        characteristicDimensionM <= 0 ? "dimensões do pallet/bloco" : "",
      ]
    : [
        positiveNumber(input?.productThicknessM) <= 0 ? "espessura do produto" : "",
        positiveNumber(input?.retentionTimeMin) <= 0 ? "tempo de retenção" : "",
        positiveNumber(input?.directMassKgH) <= 0 && positiveNumber(input?.unitWeightKg) * positiveNumber(input?.unitsPerCycle) * positiveNumber(input?.cyclesPerHour) <= 0 ? "massa usada" : "",
      ];

  return [...missingNumericFields, ...missingPositiveFields, ...processFields];
}

function canEstimateFreezingTime(input: any, distanceToCoreM: number, hEffectiveWM2K: number | null, kEffectiveWMK: number): boolean {
  return (
    positiveNumber(input?.densityKgM3) > 0 &&
    positiveNumber(input?.latentHeatKJkg) > 0 &&
    positiveNumber(input?.frozenWaterFraction) > 0 &&
    distanceToCoreM > 0 &&
    toNumber(hEffectiveWM2K, 0) > 0 &&
    kEffectiveWMK > 0 &&
    isProvided(input?.airTempC) &&
    isProvided(input?.freezingPointC)
  );
}

export function calculateTunnelEngine(input: any) {
  const validation = validateTunnelInput(input);
  const processType = input?.processType ?? input?.process_type ?? null;
  const isStatic = isStaticTunnel(input, processType);
  const mode = isStatic ? "static" : "continuous";

  const calculatedMassKgH = positiveNumber(input?.unitWeightKg) * positiveNumber(input?.unitsPerCycle) * positiveNumber(input?.cyclesPerHour);
  const directMassKgH = positiveNumber(input?.directMassKgH);
  const usedMassKgH = !isStatic && directMassKgH > 0 ? directMassKgH : calculatedMassKgH;
  const palletMassKg = positiveNumber(input?.palletMassKg ?? input?.pallet_mass_kg);
  const numberOfPallets = Math.max(1, positiveNumber(input?.numberOfPallets ?? input?.number_of_pallets) || 1);
  const staticMassKg = positiveNumber(input?.staticMassKg ?? input?.static_mass_kg) || (palletMassKg * numberOfPallets);
  const airDeltaTK = positiveNumber(input?.airDeltaTK) || 6;
  const airDensityKgM3 = positiveNumber(input?.airDensityKgM3) || 1.2;
  const suggestedAirApproachK = positiveNumber(input?.suggestedAirApproachK) || 8;
  const cpAirKJkgK = 1.005;
  const suggestedAirTempC = toNumber(input?.finalTempC, 0) - suggestedAirApproachK;
  const informedAirTempC = isProvided(input?.airTempC) ? toNumber(input?.airTempC, 0) : null;
  const suggestedAirTempComparisonC = informedAirTempC === null ? null : informedAirTempC - suggestedAirTempC;

  const engineWarnings: string[] = [];
  if (!isStatic && directMassKgH > 0 && calculatedMassKgH > 0) {
    const massDifferencePercent = Math.abs(directMassKgH - calculatedMassKgH) / calculatedMassKgH * 100;
    if (massDifferencePercent > 15) {
      engineWarnings.push(`Massa direta difere da massa por cadência em ${massDifferencePercent.toFixed(1)}%.`);
    }
  }
  if (suggestedAirTempComparisonC !== null && suggestedAirTempComparisonC > 5) {
    engineWarnings.push("Temperatura do ar informada pode ser insuficiente para atingir a temperatura final do produto no tempo desejado.");
  }

  const characteristicDimensionM = isStatic
    ? getSmallestValidDimension([input?.palletLengthM, input?.palletWidthM, input?.palletHeightM])
    : positiveNumber(input?.productThicknessM);
  const distanceToCoreM = characteristicDimensionM > 0 ? characteristicDimensionM / 2 : 0;

  const h = calculateConvectiveCoefficient({
    airVelocityMS: input?.airVelocityMS,
    manualCoefficientWM2K: input?.manualConvectiveCoefficientWM2K,
    airExposureFactor: input?.airExposureFactor,
  });

  const frozenConductivityWMK = positiveNumber(input?.frozenConductivityWMK);
  const thermalPenetrationFactor = positiveNumber(input?.thermalPenetrationFactor);
  const kEffectiveWMK = frozenConductivityWMK > 0 && thermalPenetrationFactor > 0
    ? frozenConductivityWMK * thermalPenetrationFactor
    : 0;

  const energy = calculateProductSpecificEnergy({
    initialTempC: input?.initialTempC,
    finalTempC: input?.finalTempC,
    freezingPointC: input?.freezingPointC,
    cpAboveKJkgK: input?.cpAboveKJkgK,
    cpBelowKJkgK: input?.cpBelowKJkgK,
    latentHeatKJkg: input?.latentHeatKJkg,
    frozenWaterFraction: input?.frozenWaterFraction,
    allowPhaseChange: input?.allowPhaseChange,
  });

  const productLoadKW = isStatic
    ? calculateBatchProductLoadKW({
        massKg: staticMassKg,
        specificEnergyKJkg: energy.totalKJkg,
        timeH: input?.batchTimeH,
      })
    : calculateContinuousProductLoadKW({
        massKgH: usedMassKgH,
        specificEnergyKJkg: energy.totalKJkg,
      });

  const productEnergyBreakdown = {
    sensibleAboveKJkg: energy.sensibleAboveKJkg,
    latentKJkg: energy.latentKJkg,
    sensibleBelowKJkg: energy.sensibleBelowKJkg,
    totalKJkg: energy.totalKJkg,
    crossesFreezing: energy.crossesFreezingPoint,
  };

  const packagingMassKgH = positiveNumber(input?.packagingMassKgH);
  const packagingCpKJkgK = positiveNumber(input?.packagingCpKJkgK);
  const packagingLoadKW = packagingMassKgH > 0 && packagingCpKJkgK > 0
    ? packagingMassKgH * packagingCpKJkgK * Math.abs(toNumber(input?.initialTempC) - toNumber(input?.finalTempC)) / 3600
    : 0;

  const internalLoadKW =
    toNumber(input?.beltMotorKW, 0) +
    toNumber(input?.internalFansKW, 0) +
    toNumber(input?.otherInternalKW, 0);
  const totalKW = productLoadKW + packagingLoadKW + internalLoadKW;
  const totalKcalH = kwToKcalH(totalKW);
  const totalTR = kwToTr(totalKW);
  const airFlowM3H = airDeltaTK > 0 && airDensityKgM3 > 0
    ? (totalKW * 3600) / (airDensityKgM3 * cpAirKJkgK * airDeltaTK)
    : 0;

  const estimatedTimeMin = canEstimateFreezingTime(input, distanceToCoreM, h.hEffectiveWM2K, kEffectiveWMK)
    ? calculatePlankFreezingTimeMin({
        densityKgM3: input?.densityKgM3,
        latentHeatKJkg: input?.latentHeatKJkg,
        frozenWaterFraction: input?.frozenWaterFraction,
        freezingPointC: input?.freezingPointC,
        airTempC: input?.airTempC,
        distanceToCoreM,
        hEffectiveWM2K: h.hEffectiveWM2K,
        kEffectiveWMK,
      })
    : null;
  const availableTimeMin = isStatic ? positiveNumber(input?.batchTimeH) * 60 : positiveNumber(input?.retentionTimeMin);

  const missingFields = unique([...validation.missingFields, ...requiredPositiveFields(input, isStatic, staticMassKg, characteristicDimensionM, energy.crossesFreezingPoint)]);
  const warnings = unique([...validation.warnings, ...engineWarnings]);
  const invalidFields = unique(validation.invalidFields);

  const status = invalidFields.length > 0
    ? "invalid_input"
    : missingFields.length > 0
      ? "missing_data"
      : estimatedTimeMin !== null && estimatedTimeMin <= availableTimeMin
        ? "adequate"
        : estimatedTimeMin !== null && estimatedTimeMin > availableTimeMin
          ? "insufficient"
          : "missing_data";

  const calculationBreakdown = {
    mass: {
      mode,
      calculatedMassKgH,
      usedMassKgH,
      staticMassKg,
      palletMassKg,
      numberOfPallets,
      batchTimeH: input?.batchTimeH ?? null,
      retentionTimeMin: input?.retentionTimeMin ?? null,
    },
    geometry: {
      characteristicDimensionM,
      distanceToCoreM,
      palletLengthM: input?.palletLengthM ?? null,
      palletWidthM: input?.palletWidthM ?? null,
      palletHeightM: input?.palletHeightM ?? null,
      productThicknessM: input?.productThicknessM ?? null,
    },
    air: {
      airTempC: input?.airTempC ?? null,
      airDeltaTK,
      airDensityKgM3,
      airFlowM3H,
      suggestedAirTempC,
      suggestedAirApproachK,
      hSource: h.source,
      hBaseWM2K: h.hBaseWM2K,
      hEffectiveWM2K: h.hEffectiveWM2K,
      comparison: suggestedAirTempComparisonC,
    },
    productEnergy: productEnergyBreakdown,
    loads: {
      productLoadKW,
      packagingLoadKW,
      internalLoadKW,
      totalKW,
      totalKcalH,
      totalTR,
    },
    timing: {
      estimatedTimeMin,
      availableTimeMin,
      status,
      retentionTimeMin: input?.retentionTimeMin ?? null,
      batchTimeH: input?.batchTimeH ?? null,
    },
    validation: {
      missingFields,
      warnings,
      invalidFields,
    },
  };

  const formulasUsed = {
    calculatedMassKgH: "unitWeightKg × unitsPerCycle × cyclesPerHour",
    h: "manualCoefficientWM2K || (10 + 10 × airVelocityMS^0.8) × airExposureFactor",
    kEffectiveWMK: "frozenConductivityWMK × thermalPenetrationFactor",
    continuousProductLoadKW: "massKgH × specificEnergyKJkg / 3600",
    batchProductLoadKW: "massKg × specificEnergyKJkg / (timeH × 3600)",
    packagingLoadKW: "packagingMassKgH × packagingCpKJkgK × abs(initialTempC - finalTempC) / 3600",
    internalLoadKW: "beltMotorKW + internalFansKW + otherInternalKW",
    totalKW: "productLoadKW + packagingLoadKW + internalLoadKW",
    airFlowM3H: "totalKW × 3600 / (airDensityKgM3 × 1.005 × airDeltaTK)",
    suggestedAirTempC: "finalTempC - suggestedAirApproachK",
    plankFreezingTime: "Plank equation using density, latent heat, core distance, h and effective k",
  };

  const resultSummary = {
    processType,
    status,
    productLoadKW,
    packagingLoadKW,
    internalLoadKW,
    totalKW,
    estimatedTimeMin,
    availableTimeMin,
  };

  const calculationLog = buildCalculationLog({
    originalInput: input,
    normalizedInput: input,
    unitConversions: input?.unitConversions ?? null,
    warnings,
    missingFields,
    invalidFields,
    formulasUsed,
    resultSummary,
  });

  return {
    mode,
    processType,
    isStatic,
    calculatedMassKgH,
    usedMassKgH,
    staticMassKg,
    characteristicDimensionM,
    distanceToCoreM,
    energy,
    h,
    kEffectiveWMK,
    estimatedTimeMin,
    availableTimeMin,
    status,
    productLoadKW,
    packagingLoadKW,
    internalLoadKW,
    totalKW,
    totalKcalH,
    totalTR,
    airFlowM3H,
    suggestedAirTempC,
    suggestedAirApproachK,
    airDeltaTK,
    missingFields,
    warnings,
    invalidFields,
    calculationBreakdown,
    calculationLog,
  };
}
