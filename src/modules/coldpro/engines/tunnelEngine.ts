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

export type TunnelPhysicalModel = "continuous_individual" | "continuous_spiral" | "static_cart" | "static_block";
export type TunnelScenarioStatus = "adequate" | "insufficient" | "missing_data" | "invalid_input";

export type TunnelThermalScenario = {
  airTempC: number | null;
  airVelocityMS: number | null;
  airDeltaTK: number;
  airFlowM3H: number;
  informedAirFlowM3H: number | null;
  suggestedAirTempC: number;
  hEffectiveWM2K: number | null;
  hSource: string;
  productLoadKW: number;
  packagingLoadKW: number;
  internalLoadKW: number;
  totalKW: number;
  totalKcalH: number;
  totalTR: number;
  estimatedTimeMin: number | null;
  availableTimeMin: number;
  status: TunnelScenarioStatus;
  warnings: string[];
  missingFields: string[];
  invalidFields: string[];
};

const MODEL_META: Record<TunnelPhysicalModel, {
  label: string;
  mode: "continuous" | "static";
  physicalDescription: string;
  geometryAssumption: string;
  convectionAssumption: string;
}> = {
  continuous_individual: {
    label: "Túnel contínuo individual",
    mode: "continuous",
    physicalDescription: "Produto tratado como unidade individual em fluxo contínuo.",
    geometryAssumption: "Espessura do produto como dimensão crítica; núcleo na metade da espessura.",
    convectionAssumption: "Convecção estimada pela velocidade do ar ou coeficiente manual.",
  },
  continuous_spiral: {
    label: "Girofreezer contínuo",
    mode: "continuous",
    physicalDescription: "Produto em girofreezer contínuo com turbulência e alta troca convectiva.",
    geometryAssumption: "Espessura do produto como dimensão crítica; núcleo na metade da espessura.",
    convectionAssumption: "Convecção estimada pela velocidade do ar com fator de turbulência; manual prevalece sem multiplicador.",
  },
  static_cart: {
    label: "Estático em carrinho",
    mode: "static",
    physicalDescription: "Produto em carrinho, rack ou bandejas com circulação de ar entre camadas.",
    geometryAssumption: "Produto tratado como unidades/bandejas expostas; espessura do produto é a dimensão crítica.",
    convectionAssumption: "Convecção estimada pela velocidade do ar ou coeficiente manual.",
  },
  static_block: {
    label: "Estático em pallet/bloco",
    mode: "static",
    physicalDescription: "Produto tratado como bloco térmico equivalente ou pallet compacto.",
    geometryAssumption: "Menor dimensão válida do pallet/bloco como dimensão crítica.",
    convectionAssumption: "Convecção estimada com redução por baixa exposição; manual prevalece sem redução.",
  },
};

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

function nullableNumber(value: unknown): number | null {
  return isProvided(value) && Number.isFinite(Number(value)) ? Number(value) : null;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function getSmallestValidDimension(values: unknown[]): number {
  const dimensions = values.map((value) => positiveNumber(value)).filter((value) => value > 0);
  return dimensions.length > 0 ? Math.min(...dimensions) : 0;
}

function normalizePhysicalModel(input: any): TunnelPhysicalModel {
  const raw = String(input?.physicalModel ?? input?.tunnelPhysicalModel ?? input?.physical_model ?? input?.processType ?? input?.process_type ?? input?.tunnelMode ?? input?.tunnel_mode ?? "").toLowerCase().trim();
  if (["continuous_spiral", "girofreezer", "continuous_girofreezer", "girofreezer_continuous"].includes(raw)) return "continuous_spiral";
  if (["static_cart", "static_cart_freezing", "cart", "rack", "cart_rack"].includes(raw)) return "static_cart";
  if (["static_block", "static_pallet_freezing", "pallet_block", "bulk_static", "static_pallet"].includes(raw)) return "static_block";
  if (["continuous_individual", "continuous_individual_freezing", "continuous"].includes(raw)) return "continuous_individual";

  if (String(input?.processType ?? input?.process_type ?? "").toLowerCase().includes("giro")) return "continuous_spiral";
  if (String(input?.processType ?? input?.process_type ?? "").toLowerCase().includes("cart")) return "static_cart";
  if (String(input?.processType ?? input?.process_type ?? "").toLowerCase().includes("static")) return "static_block";
  if (input?.operationMode === "batch" || input?.operation_mode === "batch" || input?.tunnelMode === "static" || input?.tunnel_mode === "static") return "static_block";
  return "continuous_individual";
}

function isStaticTunnel(processType: unknown, operationMode: unknown) {
  return processType === "static_cart_freezing" || processType === "static_pallet_freezing" || operationMode === "batch";
}

function requiredPositiveFields(input: any, isStatic: boolean, staticMassKg: number, characteristicDimensionM: number, crossesFreezing: boolean): string[] {
  const commonNumericFields = ["initialTempC", "finalTempC", "freezingPointC"];
  const commonPositiveFields = ["cpAboveKJkgK"];
  const freezingPositiveFields = crossesFreezing ? ["cpBelowKJkgK", "latentHeatKJkg", "frozenWaterFraction"] : [];
  const missingNumericFields = commonNumericFields.filter((field) => !isProvided(input?.[field]) || !Number.isFinite(Number(input?.[field])));
  const missingPositiveFields = [...commonPositiveFields, ...freezingPositiveFields].filter((field) => !isProvided(input?.[field]) || toNumber(input?.[field], 0) <= 0);
  const hasHInput = positiveNumber(input?.manualConvectiveCoefficientWM2K) > 0 || positiveNumber(input?.airVelocityMS) > 0;

  const continuousFields = [
    positiveNumber(input?.directMassKgH) <= 0 && positiveNumber(input?.unitWeightKg) * positiveNumber(input?.unitsPerCycle) * positiveNumber(input?.cyclesPerHour) <= 0 ? "massa usada" : "",
    positiveNumber(input?.retentionTimeMin) <= 0 ? "tempo de retenção" : "",
    positiveNumber(input?.productThicknessM) <= 0 ? "espessura do produto" : "",
  ];
  const staticFields = [
    staticMassKg <= 0 ? "massa total da batelada" : "",
    positiveNumber(input?.batchTimeH) <= 0 ? "tempo de batelada" : "",
    characteristicDimensionM <= 0 ? "dimensões da carga/pallet" : "",
  ];

  return [
    ...missingNumericFields,
    ...missingPositiveFields,
    ...(isStatic ? staticFields : continuousFields),
    !hasHInput && (isStatic || positiveNumber(input?.airVelocityMS) <= 0) ? "velocidade do ar ou coeficiente convectivo manual" : "",
  ];
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

function calculateModelH(input: any, physicalModel: TunnelPhysicalModel) {
  const manual = positiveNumber(input?.manualConvectiveCoefficientWM2K);
  const baseH = calculateConvectiveCoefficient({
    airVelocityMS: input?.airVelocityMS,
    manualCoefficientWM2K: input?.manualConvectiveCoefficientWM2K,
    airExposureFactor: input?.airExposureFactor,
  });
  if (manual > 0 || baseH.source !== "velocity_estimated") return baseH;

  const airExposureFactor = positiveNumber(input?.airExposureFactor) || 1;
  const spiralTurbulenceFactor = positiveNumber(input?.spiralTurbulenceFactor) || 1.8;
  const blockExposureFactor = positiveNumber(input?.blockExposureFactor) || 0.7;
  const modelFactor = physicalModel === "continuous_spiral" ? spiralTurbulenceFactor : physicalModel === "static_block" ? blockExposureFactor : 1;

  return {
    ...baseH,
    hEffectiveWM2K: toNumber(baseH.hBaseWM2K, 0) * airExposureFactor * modelFactor,
  };
}

function calculateTunnelCore(input: any) {
  const physicalModel = normalizePhysicalModel(input);
  const modelMeta = MODEL_META[physicalModel];
  const mode = modelMeta.mode;
  const isStatic = mode === "static";
  const processType = input?.processType ?? input?.process_type ?? null;
  const spiralTurbulenceFactor = positiveNumber(input?.spiralTurbulenceFactor) || 1.8;
  const blockExposureFactor = positiveNumber(input?.blockExposureFactor) || 0.7;

  const validationInput = {
    ...input,
    densityKgM3: positiveNumber(input?.densityKgM3) > 0 ? input?.densityKgM3 : undefined,
    frozenConductivityWMK: positiveNumber(input?.frozenConductivityWMK) > 0 ? input?.frozenConductivityWMK : undefined,
    airVelocityMS: positiveNumber(input?.manualConvectiveCoefficientWM2K) > 0 || positiveNumber(input?.airVelocityMS) > 0 ? input?.airVelocityMS : undefined,
  };
  const validation = validateTunnelInput(validationInput);

  const calculatedMassKgH = positiveNumber(input?.unitWeightKg) * positiveNumber(input?.unitsPerCycle) * positiveNumber(input?.cyclesPerHour);
  const directMassKgH = positiveNumber(input?.directMassKgH);
  const usedMassKgH = !isStatic && directMassKgH > 0 ? directMassKgH : calculatedMassKgH;
  const palletMassKg = positiveNumber(input?.palletMassKg ?? input?.pallet_mass_kg);
  const cartMassKg = positiveNumber(input?.cartMassKg ?? input?.cart_mass_kg);
  const numberOfPallets = Math.max(1, positiveNumber(input?.numberOfPallets ?? input?.number_of_pallets) || 1);
  const numberOfCarts = Math.max(1, positiveNumber(input?.numberOfCarts ?? input?.number_of_carts) || numberOfPallets || 1);
  const staticMassKg = positiveNumber(input?.staticMassKg ?? input?.static_mass_kg) || (physicalModel === "static_cart" ? (cartMassKg || palletMassKg) * numberOfCarts : palletMassKg * numberOfPallets);
  const airDeltaTK = positiveNumber(input?.airDeltaTK) || 6;
  const airDensityKgM3 = positiveNumber(input?.airDensityKgM3) || 1.2;
  const suggestedAirApproachK = positiveNumber(input?.suggestedAirApproachK) || 8;
  const airFlowMethod = "thermal_balance_estimate";
  const suggestedAirMethod = "process_temperature_estimate";
  const cpAirKJkgK = 1.005;
  const suggestedAirTempC = toNumber(input?.finalTempC, 0) - suggestedAirApproachK;
  const informedAirTempC = isProvided(input?.airTempC) ? toNumber(input?.airTempC, 0) : null;
  const suggestedAirTempComparisonC = informedAirTempC === null ? null : informedAirTempC - suggestedAirTempC;
  const informedAirFlowM3H = nullableNumber(input?.informedAirFlowM3H ?? input?.airflow_m3_h);

  const characteristicDimensionM = physicalModel === "static_block"
    ? getSmallestValidDimension([input?.palletLengthM, input?.palletWidthM, input?.palletHeightM])
    : positiveNumber(input?.productThicknessM);
  const distanceToCoreM = characteristicDimensionM > 0 ? characteristicDimensionM / 2 : 0;
  const h = calculateModelH(input, physicalModel);

  const frozenConductivityWMK = positiveNumber(input?.frozenConductivityWMK);
  const thermalPenetrationFactor = positiveNumber(input?.thermalPenetrationFactor);
  const kEffectiveWMK = frozenConductivityWMK > 0 && thermalPenetrationFactor > 0 ? frozenConductivityWMK * thermalPenetrationFactor : 0;

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
    ? calculateBatchProductLoadKW({ massKg: staticMassKg, specificEnergyKJkg: energy.totalKJkg, timeH: input?.batchTimeH })
    : calculateContinuousProductLoadKW({ massKgH: usedMassKgH, specificEnergyKJkg: energy.totalKJkg });

  const productEnergyBreakdown = {
    sensibleAboveKJkg: energy.sensibleAboveKJkg,
    latentKJkg: energy.latentKJkg,
    sensibleBelowKJkg: energy.sensibleBelowKJkg,
    totalKJkg: energy.totalKJkg,
    crossesFreezing: energy.crossesFreezingPoint,
  };

  const packagingMassKgH = positiveNumber(input?.packagingMassKgH);
  const packagingCpKJkgK = positiveNumber(input?.packagingCpKJkgK);
  const packagingLoadKW = packagingMassKgH > 0 && packagingCpKJkgK > 0 ? packagingMassKgH * packagingCpKJkgK * Math.abs(toNumber(input?.initialTempC) - toNumber(input?.finalTempC)) / 3600 : 0;
  const internalLoadKW = toNumber(input?.beltMotorKW, 0) + toNumber(input?.internalFansKW, 0) + toNumber(input?.otherInternalKW, 0);
  const totalKW = productLoadKW + packagingLoadKW + internalLoadKW;
  const totalKcalH = kwToKcalH(totalKW);
  const totalTR = kwToTr(totalKW);
  const airFlowM3H = airDeltaTK > 0 && airDensityKgM3 > 0 ? (totalKW * 3600) / (airDensityKgM3 * cpAirKJkgK * airDeltaTK) : 0;

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

  const hasManualH = positiveNumber(input?.manualConvectiveCoefficientWM2K) > 0;
  const airVelocityMS = positiveNumber(input?.airVelocityMS);
  const airVelocityLimitWarnings = [
    airVelocityMS > 0 && airVelocityMS < positiveNumber(input?.minAirVelocityMS ?? input?.min_air_velocity_m_s) ? "Velocidade do ar abaixo do limite operacional informado." : "",
    positiveNumber(input?.maxAirVelocityMS ?? input?.max_air_velocity_m_s) > 0 && airVelocityMS > positiveNumber(input?.maxAirVelocityMS ?? input?.max_air_velocity_m_s) ? "Velocidade do ar acima do limite operacional informado." : "",
  ];
  const airFlowDeviation = informedAirFlowM3H !== null && airFlowM3H > 0 ? Math.abs(informedAirFlowM3H - airFlowM3H) / airFlowM3H : 0;
  const engineWarnings = [
    !isStatic && directMassKgH > 0 && calculatedMassKgH > 0 && Math.abs(directMassKgH - calculatedMassKgH) / calculatedMassKgH * 100 > 15 ? `Massa direta difere da massa por cadência em ${(Math.abs(directMassKgH - calculatedMassKgH) / calculatedMassKgH * 100).toFixed(1)}%.` : "",
    suggestedAirTempComparisonC !== null && suggestedAirTempComparisonC > 5 ? "Temperatura do ar informada pode ser insuficiente para atingir a temperatura final do produto no tempo desejado." : "",
    airFlowDeviation > 0.2 ? "Vazão de ar informada diverge da vazão estimada em mais de 20%." : "",
    hasManualH && positiveNumber(input?.manualConvectiveCoefficientWM2K) < 25 && energy.crossesFreezingPoint ? "h manual muito baixo para congelamento rápido." : "",
    isProvided(input?.thermalPenetrationFactor) && toNumber(input?.thermalPenetrationFactor) <= 0 ? "Fator de penetração térmica deve ser maior que zero." : "",
    isProvided(input?.airExposureFactor) && toNumber(input?.airExposureFactor) <= 0 ? "Fator de exposição ao ar deve ser maior que zero." : "",
    ...airVelocityLimitWarnings,
    physicalModel === "continuous_individual" && !hasManualH && airVelocityMS > 0 && airVelocityMS < 1 ? "Velocidade do ar baixa para túnel contínuo individual (< 1 m/s)." : "",
    physicalModel === "continuous_spiral" && !hasManualH && airVelocityMS > 0 && airVelocityMS < 2 ? "Velocidade do ar baixa para girofreezer contínuo (< 2 m/s)." : "",
    physicalModel === "continuous_spiral" && (spiralTurbulenceFactor < 1.2 || spiralTurbulenceFactor > 3) ? "Fator de turbulência do girofreezer fora da faixa recomendada de 1,2 a 3,0." : "",
    physicalModel === "static_cart" && positiveNumber(input?.productThicknessM) <= 0 ? "Espessura do produto ausente para estático em carrinho." : "",
    physicalModel === "static_cart" && positiveNumber(input?.batchTimeH) <= 0 ? "Tempo de batelada ausente para estático em carrinho." : "",
    physicalModel === "static_cart" && !hasManualH && airVelocityMS > 0 && airVelocityMS < 1 ? "Velocidade do ar baixa para estático em carrinho (< 1 m/s)." : "",
    physicalModel === "static_block" && characteristicDimensionM <= 0 ? "Dimensões do bloco/pallet ausentes para estático em pallet/bloco." : "",
    physicalModel === "static_block" ? "Modelo static_block é conservador para bloco compacto/pallet." : "",
    physicalModel === "static_block" && positiveNumber(input?.batchTimeH) <= 0 ? "Tempo de batelada ausente para estático em pallet/bloco." : "",
  ];

  const freezingTimeMissingFields = [
    positiveNumber(input?.densityKgM3) <= 0 ? "densidade do produto" : "",
    energy.crossesFreezingPoint && positiveNumber(input?.latentHeatKJkg) <= 0 ? "calor latente" : "",
    energy.crossesFreezingPoint && positiveNumber(input?.frozenWaterFraction) <= 0 ? "fração de água congelável" : "",
    !isProvided(input?.freezingPointC) ? "temperatura de congelamento" : "",
    !isProvided(input?.airTempC) ? "temperatura do ar" : "",
    distanceToCoreM <= 0 ? "distância até o núcleo" : "",
    toNumber(h.hEffectiveWM2K, 0) <= 0 ? "coeficiente convectivo efetivo" : "",
    kEffectiveWMK <= 0 ? "condutividade efetiva" : "",
  ];
  const invalidFields = unique([
    ...validation.invalidFields,
    isProvided(input?.thermalPenetrationFactor) && toNumber(input?.thermalPenetrationFactor) <= 0 ? "thermalPenetrationFactor" : "",
    isProvided(input?.airExposureFactor) && toNumber(input?.airExposureFactor) <= 0 ? "airExposureFactor" : "",
  ]);
  const missingFields = unique([
    ...validation.missingFields,
    ...requiredPositiveFields(input, physicalModel, staticMassKg, characteristicDimensionM, energy.crossesFreezingPoint),
    ...freezingTimeMissingFields,
  ]);
  const warnings = unique([...validation.warnings, ...engineWarnings]);

  const status: TunnelScenarioStatus = invalidFields.length > 0
    ? "invalid_input"
    : missingFields.length > 0
      ? "missing_data"
      : estimatedTimeMin !== null && estimatedTimeMin <= availableTimeMin
        ? "adequate"
        : estimatedTimeMin !== null && estimatedTimeMin > availableTimeMin
          ? "insufficient"
          : "missing_data";

  const scenario: TunnelThermalScenario = {
    airTempC: nullableNumber(input?.airTempC),
    airVelocityMS: nullableNumber(input?.airVelocityMS),
    airDeltaTK,
    airFlowM3H,
    informedAirFlowM3H,
    suggestedAirTempC,
    hEffectiveWM2K: nullableNumber(h.hEffectiveWM2K),
    hSource: h.source,
    productLoadKW,
    packagingLoadKW,
    internalLoadKW,
    totalKW,
    totalKcalH,
    totalTR,
    estimatedTimeMin,
    availableTimeMin,
    status,
    warnings,
    missingFields,
    invalidFields,
  };

  const calculationBreakdown = {
    model: {
      physicalModel,
      physicalModelLabel: modelMeta.label,
      physicalDescription: modelMeta.physicalDescription,
      geometryAssumption: modelMeta.geometryAssumption,
      convectionAssumption: modelMeta.convectionAssumption,
    },
    mass: { mode, calculatedMassKgH, usedMassKgH, staticMassKg, palletMassKg, numberOfPallets, batchTimeH: input?.batchTimeH ?? null, retentionTimeMin: input?.retentionTimeMin ?? null },
    geometry: { characteristicDimensionM, distanceToCoreM, productThicknessM: input?.productThicknessM ?? null, palletLengthM: input?.palletLengthM ?? null, palletWidthM: input?.palletWidthM ?? null, palletHeightM: input?.palletHeightM ?? null },
    productEnergy: productEnergyBreakdown,
    convection: { source: h.source, hBaseWM2K: h.hBaseWM2K, hEffectiveWM2K: h.hEffectiveWM2K, airVelocityMS: input?.airVelocityMS ?? null, airExposureFactor: input?.airExposureFactor ?? null, spiralTurbulenceFactor, blockExposureFactor },
    air: { airTempC: input?.airTempC ?? null, airDeltaTK, airDensityKgM3, airFlowM3H, informedAirFlowM3H, airFlowMethod, suggestedAirTempC, suggestedAirMethod, suggestedAirApproachK, comparison: suggestedAirTempComparisonC },
    scenarios: { adjustedScenario: scenario },
    loads: { productLoadKW, packagingLoadKW, internalLoadKW, totalKW, totalKcalH, totalTR },
    timing: { estimatedTimeMin, availableTimeMin, status },
    validation: { warnings, missingFields, invalidFields },
  };

  const formulasUsed = {
    physicalModel: "normalized processType/tunnelMode/operationMode",
    calculatedMassKgH: "unitWeightKg × unitsPerCycle × cyclesPerHour",
    h: "manualCoefficientWM2K || (10 + 10 × airVelocityMS^0.8) × airExposureFactor × modelFactor",
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

  const resultSummary = { physicalModel, processType, status, productLoadKW, packagingLoadKW, internalLoadKW, totalKW, estimatedTimeMin, availableTimeMin };
  const calculationLog = buildCalculationLog({ originalInput: input, normalizedInput: { ...input, physicalModel, mode }, unitConversions: input?.unitConversions ?? null, warnings, missingFields, invalidFields, formulasUsed, resultSummary });

  return {
    physicalModel,
    physicalModelLabel: modelMeta.label,
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
    airFlowM3H,
    informedAirFlowM3H,
    airFlowMethod,
    suggestedAirTempC,
    suggestedAirMethod,
    suggestedAirApproachK,
    airDeltaTK,
    productLoadKW,
    packagingLoadKW,
    internalLoadKW,
    totalKW,
    totalKcalH,
    totalTR,
    status,
    warnings,
    missingFields,
    invalidFields,
    scenario,
    calculationBreakdown,
    calculationLog,
  };
}

function buildApprovedScenario(input: any): TunnelThermalScenario | null {
  if (!input?.thermalConditionApproved && !input?.thermal_condition_approved) return null;
  return {
    airTempC: nullableNumber(input?.approvedAirTempC ?? input?.approved_air_temp_c),
    airVelocityMS: nullableNumber(input?.approvedAirVelocityMS ?? input?.approved_air_velocity_m_s),
    airDeltaTK: positiveNumber(input?.approvedAirDeltaTK ?? input?.approved_air_delta_t_k) || 0,
    airFlowM3H: positiveNumber(input?.approvedAirFlowM3H ?? input?.approved_air_flow_m3_h),
    informedAirFlowM3H: nullableNumber(input?.approvedAirFlowM3H ?? input?.approved_air_flow_m3_h),
    suggestedAirTempC: nullableNumber(input?.approvedSuggestedAirTempC ?? input?.suggestedAirTempC) ?? 0,
    hEffectiveWM2K: nullableNumber(input?.approvedConvectiveCoefficientWM2K ?? input?.approved_convective_coefficient_w_m2_k),
    hSource: "approved",
    productLoadKW: positiveNumber(input?.productLoadKW),
    packagingLoadKW: positiveNumber(input?.packagingLoadKW),
    internalLoadKW: positiveNumber(input?.internalLoadKW),
    totalKW: positiveNumber(input?.approvedTotalKW ?? input?.approved_total_kw),
    totalKcalH: positiveNumber(input?.approvedTotalKcalH ?? input?.approved_total_kcal_h),
    totalTR: positiveNumber(input?.approvedTotalTR ?? input?.approved_total_tr),
    estimatedTimeMin: nullableNumber(input?.approvedEstimatedTimeMin ?? input?.approved_estimated_time_min),
    availableTimeMin: positiveNumber(input?.approvedAvailableTimeMin ?? input?.availableTimeMin ?? input?.retentionTimeMin) || 0,
    status: String(input?.approvedProcessStatus ?? input?.approved_process_status ?? "adequate") as TunnelScenarioStatus,
    warnings: [],
    missingFields: [],
    invalidFields: [],
  };
}

export function calculateTunnelEngine(input: any) {
  const adjusted = calculateTunnelCore(input);
  const initialInput = input?.initialScenarioInput ?? input?.initial_scenario_input ?? input;
  const initial = initialInput === input ? adjusted : calculateTunnelCore({ ...input, ...initialInput, initialScenarioInput: undefined, initial_scenario_input: undefined, thermalConditionApproved: false, thermal_condition_approved: false });
  const approvedScenario = buildApprovedScenario(input);

  const calculationBreakdown = {
    ...adjusted.calculationBreakdown,
    scenarios: {
      initialScenario: initial.scenario,
      adjustedScenario: adjusted.scenario,
      approvedScenario,
    },
  };
  const calculationLog = buildCalculationLog({
    ...(adjusted.calculationLog ?? {}),
    resultSummary: {
      ...(adjusted.calculationLog?.resultSummary ?? {}),
      initialStatus: initial.scenario.status,
      adjustedStatus: adjusted.scenario.status,
      approvedStatus: approvedScenario?.status ?? null,
    },
  });

  return {
    ...adjusted,
    initialScenario: initial.scenario,
    adjustedScenario: adjusted.scenario,
    approvedScenario,
    calculationBreakdown,
    calculationLog,
  };
}
