export type UnitScale = "m" | "cm" | "mm";
export type WeightScale = "kg" | "g";
export type CycleScale = "cycles_per_hour" | "cycles_per_min";
export type TimeScale = "h" | "min";

export interface ContinuousGirofreezerInput {
  dimensionScale: UnitScale;
  productLength: number;
  productWidth: number;
  productThickness: number;
  weightScale: WeightScale;
  unitWeight: number;
  unitsPerCycle: number;
  cycleScale: CycleScale;
  cycles: number;
  directMassKgH?: number;
  timeScale: TimeScale;
  retentionTime: number;
  airTemperatureC?: number;
  airVelocityMs?: number;
  minAirVelocityMs?: number;
  maxAirVelocityMs?: number;
  manualDensityKgM3?: number;
  ashraeDensityKgM3?: number;
  productDensityKgM3?: number;
  frozenConductivityWmK?: number;
  freezingPointC?: number;
  initialTempC?: number;
  finalTempC?: number;
  cpAboveKjKgK?: number;
  cpBelowKjKgK?: number;
  latentHeatKjKg?: number;
  frozenWaterFraction?: number;
  packagingMassKgH?: number;
  packagingCpKjKgK?: number;
  deltaTAirK?: number;
  airDensityKgM3?: number;
  airExposureFactor?: number;
  thermalPenetrationFactor?: number;
}

export interface ProductThermalInput {
  initialTempC: number;
  finalTempC: number;
  freezingPointC: number;
  cpAboveKjKgK: number;
  cpBelowKjKgK: number;
  latentHeatKjKg: number;
  frozenWaterFraction: number;
  packagingMassKgH?: number;
  packagingCpKjKgK?: number;
}

export interface AirProcessInput {
  airTemperatureC: number;
  airVelocityMs: number;
  deltaTAirK: number;
  airDensityKgM3?: number;
  airExposureFactor?: number;
  thermalPenetrationFactor?: number;
  frozenConductivityWmK?: number;
}

export interface ProductThermalResult {
  qSpecificAboveKjKg: number;
  qSpecificLatentKjKg: number;
  qSpecificBelowKjKg: number;
  qSpecificTotalKjKg: number;
  productLoadKw: number;
  productLoadKcalH: number;
  productLoadTr: number;
  packagingLoadKw: number;
  totalProcessLoadKw: number;
  totalProcessLoadKcalH: number;
  totalProcessLoadTr: number;
  requiredAirflowM3H: number | null;
  requiredAirflowM3S: number | null;
}

export interface ContinuousGirofreezerResult {
  dimensionsM: {
    lengthM: number;
    widthM: number;
    thicknessM: number;
    volumeM3: number;
    characteristicDimensionM: number;
    distanceToCoreM: number;
  };
  mass: {
    unitWeightKg: number;
    cyclesPerHour: number;
    calculatedMassKgH: number;
    directMassKgH: number | null;
    usedMassKgH: number;
    massSource: "direct" | "calculated";
    massInsideTunnelKg: number;
    massDifferencePercent: number | null;
  };
  physics: {
    implicitDensityKgM3: number;
    densityCalculatedKgM3: number | null;
    densityUsedKgM3: number;
    densitySource: "manual" | "calculated_from_geometry" | "ashrae" | "default_estimated";
    densityValidationStatus: "valid" | "warning" | "critical" | "missing";
    densityValidationMessage: string;
    hBaseWm2K: number | null;
    hEffectiveWm2K: number | null;
    kEffectiveWmK: number | null;
    airTemperatureUsedC: number;
    airVelocityUsedMs: number;
    airVelocitySource: "manual" | "suggested" | "missing";
    suggestedAirVelocityMs: number | null;
    estimatedFreezingTimeMin: number | null;
    retentionTimeMin: number;
    retentionMargin: number | null;
    processStatus: "adequate" | "insufficient" | "missing_data" | "invalid_input";
  };
  thermal: ProductThermalResult;
  warnings: string[];
  errors: string[];
}

function convertDimensionToM(value: number, scale: UnitScale): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (scale === "cm") return value / 100;
  if (scale === "mm") return value / 1000;
  return value;
}

function convertWeightToKg(value: number, scale: WeightScale): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return scale === "g" ? value / 1000 : value;
}

function convertCyclesToHour(value: number, scale: CycleScale): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return scale === "cycles_per_min" ? value * 60 : value;
}

function convertTimeToMinutes(value: number, scale: TimeScale): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return scale === "h" ? value * 60 : value;
}

function percentDifference(a: number, b: number): number | null {
  if (a <= 0 || b <= 0) return null;
  return (Math.abs(a - b) / ((a + b) / 2)) * 100;
}

function calculateConvectionCoefficient(airVelocityMs: number): number {
  if (!Number.isFinite(airVelocityMs) || airVelocityMs <= 0) return 0;
  return 10 + 10 * Math.pow(airVelocityMs, 0.8);
}

function calculatePlankFreezingTimeMin(params: {
  densityKgM3: number;
  latentHeatKjKg: number;
  frozenWaterFraction: number;
  freezingPointC: number;
  airTemperatureC: number;
  distanceToCoreM: number;
  hEffectiveWm2K: number;
  kEffectiveWmK: number;
}): number | null {
  const deltaT = params.freezingPointC - params.airTemperatureC;
  if (
    params.densityKgM3 <= 0 ||
    params.latentHeatKjKg <= 0 ||
    params.frozenWaterFraction <= 0 ||
    deltaT <= 0 ||
    params.distanceToCoreM <= 0 ||
    params.hEffectiveWm2K <= 0 ||
    params.kEffectiveWmK <= 0
  ) {
    return null;
  }

  const latentEffectiveJkg = params.latentHeatKjKg * params.frozenWaterFraction * 1000;
  const timeSeconds =
    (params.densityKgM3 * latentEffectiveJkg / deltaT) *
    (params.distanceToCoreM / params.hEffectiveWm2K +
      Math.pow(params.distanceToCoreM, 2) / (2 * params.kEffectiveWmK));

  return timeSeconds / 60;
}

function suggestAirVelocityMs(params: {
  densityKgM3: number;
  latentHeatKjKg: number;
  frozenWaterFraction: number;
  freezingPointC: number;
  airTemperatureC: number;
  distanceToCoreM: number;
  kEffectiveWmK: number;
  retentionTimeMin: number;
  airExposureFactor: number;
  minAirVelocityMs?: number;
  maxAirVelocityMs?: number;
}): number | null {
  const deltaT = params.freezingPointC - params.airTemperatureC;
  const retentionSeconds = params.retentionTimeMin * 60;
  if (params.densityKgM3 <= 0 || params.latentHeatKjKg <= 0 || params.frozenWaterFraction <= 0 || deltaT <= 0 || params.distanceToCoreM <= 0 || params.kEffectiveWmK <= 0 || retentionSeconds <= 0) return null;
  const latentEffectiveJkg = params.latentHeatKjKg * params.frozenWaterFraction * 1000;
  const targetTerm = retentionSeconds * deltaT / (params.densityKgM3 * latentEffectiveJkg);
  const conductionTerm = Math.pow(params.distanceToCoreM, 2) / (2 * params.kEffectiveWmK);
  const convectionTerm = targetTerm - conductionTerm;
  if (convectionTerm <= 0) return null;
  const hEffectiveRequired = params.distanceToCoreM / convectionTerm;
  const exposure = Math.max(0.01, params.airExposureFactor || 1);
  const hBaseRequired = hEffectiveRequired / exposure;
  const velocity = Math.pow(Math.max(0, (hBaseRequired - 10) / 10), 1 / 0.8);
  const minVelocity = Math.max(0.1, params.minAirVelocityMs ?? 1);
  const maxVelocity = Math.max(minVelocity, params.maxAirVelocityMs ?? 8);
  return Math.min(maxVelocity, Math.max(minVelocity, velocity));
}

export function calculateProductThermalLoad(params: {
  usedMassKgH: number;
  product: ProductThermalInput;
  air?: AirProcessInput;
}): ProductThermalResult {
  const { usedMassKgH, product, air } = params;
  const crossesFreezing = product.initialTempC > product.freezingPointC && product.finalTempC < product.freezingPointC;

  let qSpecificAboveKjKg = 0;
  let qSpecificLatentKjKg = 0;
  let qSpecificBelowKjKg = 0;

  if (crossesFreezing) {
    qSpecificAboveKjKg = product.cpAboveKjKgK * Math.max(product.initialTempC - product.freezingPointC, 0);
    qSpecificLatentKjKg = product.latentHeatKjKg * Math.max(product.frozenWaterFraction, 0);
    qSpecificBelowKjKg = product.cpBelowKjKgK * Math.max(product.freezingPointC - product.finalTempC, 0);
  } else {
    const cp = product.finalTempC < product.freezingPointC ? product.cpBelowKjKgK : product.cpAboveKjKgK;
    qSpecificAboveKjKg = cp * Math.abs(product.initialTempC - product.finalTempC);
  }

  const qSpecificTotalKjKg = qSpecificAboveKjKg + qSpecificLatentKjKg + qSpecificBelowKjKg;
  const productLoadKw = Math.max(0, usedMassKgH) * qSpecificTotalKjKg / 3600;
  const packagingMassKgH = product.packagingMassKgH ?? 0;
  const packagingCpKjKgK = product.packagingCpKjKgK ?? 0;
  const packagingLoadKw = packagingMassKgH > 0 && packagingCpKjKgK > 0
    ? packagingMassKgH * packagingCpKjKgK * Math.abs(product.initialTempC - product.finalTempC) / 3600
    : 0;
  const totalProcessLoadKw = productLoadKw + packagingLoadKw;

  let requiredAirflowM3S: number | null = null;
  let requiredAirflowM3H: number | null = null;
  if (air && air.deltaTAirK > 0) {
    const airDensity = air.airDensityKgM3 ?? 1.2;
    requiredAirflowM3S = totalProcessLoadKw / (airDensity * 1.005 * air.deltaTAirK);
    requiredAirflowM3H = requiredAirflowM3S * 3600;
  }

  return {
    qSpecificAboveKjKg,
    qSpecificLatentKjKg,
    qSpecificBelowKjKg,
    qSpecificTotalKjKg,
    productLoadKw,
    productLoadKcalH: productLoadKw * 860,
    productLoadTr: productLoadKw / 3.517,
    packagingLoadKw,
    totalProcessLoadKw,
    totalProcessLoadKcalH: totalProcessLoadKw * 860,
    totalProcessLoadTr: totalProcessLoadKw / 3.517,
    requiredAirflowM3H,
    requiredAirflowM3S,
  };
}

export function calculateImplicitDensityKgM3(params: {
  lengthM: number;
  widthM: number;
  thicknessM: number;
  unitWeightKg: number;
}): {
  volumeM3: number;
  densityKgM3: number | null;
  status: "valid" | "warning" | "critical" | "missing";
  message: string;
} {
  const { lengthM, widthM, thicknessM, unitWeightKg } = params;

  if (lengthM <= 0 || widthM <= 0 || thicknessM <= 0 || unitWeightKg <= 0) {
    return {
      volumeM3: 0,
      densityKgM3: null,
      status: "missing",
      message: "Informe comprimento, largura, espessura e peso unitário para calcular a densidade.",
    };
  }

  const volumeM3 = lengthM * widthM * thicknessM;
  const densityKgM3 = unitWeightKg / volumeM3;

  if (densityKgM3 < 100) {
    return {
      volumeM3,
      densityKgM3,
      status: "critical",
      message: `Densidade calculada muito baixa (${densityKgM3.toFixed(1)} kg/m³). Verifique se as dimensões ou peso unitário estão em unidade incorreta.`,
    };
  }

  if (densityKgM3 < 250) {
    return {
      volumeM3,
      densityKgM3,
      status: "warning",
      message: `Densidade calculada baixa (${densityKgM3.toFixed(1)} kg/m³). Validar dimensões, peso unitário ou empacotamento.`,
    };
  }

  if (densityKgM3 > 1800) {
    return {
      volumeM3,
      densityKgM3,
      status: "critical",
      message: `Densidade calculada muito alta (${densityKgM3.toFixed(1)} kg/m³). Verifique se peso ou dimensões foram informados corretamente.`,
    };
  }

  if (densityKgM3 > 1200) {
    return {
      volumeM3,
      densityKgM3,
      status: "warning",
      message: `Densidade calculada alta (${densityKgM3.toFixed(1)} kg/m³). Validar se o produto é muito compacto ou se há erro de unidade.`,
    };
  }

  return {
    volumeM3,
    densityKgM3,
    status: "valid",
    message: `Densidade calculada automaticamente: ${densityKgM3.toFixed(1)} kg/m³.`,
  };
}

export function calculateContinuousGirofreezer(input: ContinuousGirofreezerInput): ContinuousGirofreezerResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const lengthM = convertDimensionToM(input.productLength, input.dimensionScale);
  const widthM = convertDimensionToM(input.productWidth, input.dimensionScale);
  const thicknessM = convertDimensionToM(input.productThickness, input.dimensionScale);
  const unitWeightKg = convertWeightToKg(input.unitWeight, input.weightScale);
  const cyclesPerHour = convertCyclesToHour(input.cycles, input.cycleScale);
  const retentionTimeMin = convertTimeToMinutes(input.retentionTime, input.timeScale);
  const densityResult = calculateImplicitDensityKgM3({ lengthM, widthM, thicknessM, unitWeightKg });
  const volumeM3 = densityResult.volumeM3 || lengthM * widthM * thicknessM;
  const characteristicDimensionM = thicknessM;
  const distanceToCoreM = characteristicDimensionM / 2;
  const calculatedMassKgH = unitWeightKg * input.unitsPerCycle * cyclesPerHour;
  const directMassKgH = input.directMassKgH && input.directMassKgH > 0 ? input.directMassKgH : null;
  const usedMassKgH = directMassKgH ?? calculatedMassKgH;
  const massSource = directMassKgH ? "direct" : "calculated";
  const massInsideTunnelKg = usedMassKgH * (retentionTimeMin / 60);
  const massDifferencePercent = directMassKgH && calculatedMassKgH > 0 ? percentDifference(directMassKgH, calculatedMassKgH) : null;
  const thermal = calculateProductThermalLoad({
    usedMassKgH,
    product: {
      initialTempC: input.initialTempC ?? 0,
      finalTempC: input.finalTempC ?? 0,
      freezingPointC: input.freezingPointC ?? 0,
      cpAboveKjKgK: input.cpAboveKjKgK ?? 0,
      cpBelowKjKgK: input.cpBelowKjKgK ?? 0,
      latentHeatKjKg: input.latentHeatKjKg ?? 0,
      frozenWaterFraction: input.frozenWaterFraction ?? 0,
      packagingMassKgH: input.packagingMassKgH ?? 0,
      packagingCpKjKgK: input.packagingCpKjKgK ?? 0,
    },
    air: {
      airTemperatureC: input.airTemperatureC ?? 0,
      airVelocityMs: input.airVelocityMs ?? 0,
      deltaTAirK: input.deltaTAirK ?? 5,
      airDensityKgM3: input.airDensityKgM3 ?? 1.2,
    },
  });
  const implicitDensityKgM3 = densityResult.densityKgM3 ?? 0;
  const manualDensityKgM3 = input.manualDensityKgM3 && input.manualDensityKgM3 > 0 ? input.manualDensityKgM3 : input.productDensityKgM3 && input.productDensityKgM3 > 0 ? input.productDensityKgM3 : 0;
  const ashraeDensityKgM3 = input.ashraeDensityKgM3 && input.ashraeDensityKgM3 > 0 ? input.ashraeDensityKgM3 : 0;
  const densityUsedKgM3 = manualDensityKgM3 > 0 ? manualDensityKgM3 : densityResult.densityKgM3 ? densityResult.densityKgM3 : ashraeDensityKgM3 || 1000;
  const densitySource = manualDensityKgM3 > 0 ? "manual" : densityResult.densityKgM3 ? "calculated_from_geometry" : ashraeDensityKgM3 > 0 ? "ashrae" : "default_estimated";

  if (lengthM <= 0 || widthM <= 0 || thicknessM <= 0) errors.push("Informe comprimento, largura e espessura do produto.");
  if (unitWeightKg <= 0) errors.push("Informe o peso unitário do produto.");
  if (usedMassKgH <= 0) errors.push("Informe massa direta em kg/h ou dados suficientes para calcular pela cadência.");
  if (retentionTimeMin <= 0) errors.push("Informe o tempo de retenção.");

  if (massDifferencePercent !== null && massDifferencePercent > 20) {
    warnings.push(`A massa direta (${directMassKgH?.toFixed(2)} kg/h) difere da massa calculada por ciclos (${calculatedMassKgH.toFixed(2)} kg/h) em ${massDifferencePercent.toFixed(1)}%. Validar cadência, peso unitário ou massa direta.`);
  }
  if (densityResult.status === "critical") errors.push(densityResult.message);
  if (densityResult.status === "warning") warnings.push(densityResult.message);
  if (densitySource === "default_estimated") warnings.push("Densidade não informada e não calculável; usando densidade padrão estimada de 1000 kg/m³. Validar produto, dimensões e peso unitário.");
  if (thicknessM > 0.08) warnings.push(`Espessura de ${(thicknessM * 1000).toFixed(0)} mm é alta para processo contínuo/girofreezer. Validar tempo até núcleo.`);

  const airTemperatureUsedC = input.airTemperatureC ?? 0;
  const frozenConductivityWmK = input.frozenConductivityWmK && input.frozenConductivityWmK > 0 ? input.frozenConductivityWmK : 1.5;
  const kEffectiveWmK = frozenConductivityWmK * (input.thermalPenetrationFactor ?? 1);
  const suggestedAirVelocityMs = suggestAirVelocityMs({
    densityKgM3: densityUsedKgM3,
    latentHeatKjKg: input.latentHeatKjKg ?? 0,
    frozenWaterFraction: input.frozenWaterFraction ?? 0,
    freezingPointC: input.freezingPointC ?? 0,
    airTemperatureC: airTemperatureUsedC,
    distanceToCoreM,
    kEffectiveWmK: kEffectiveWmK ?? 0,
    retentionTimeMin,
    airExposureFactor: input.airExposureFactor ?? 1,
    minAirVelocityMs: input.minAirVelocityMs,
    maxAirVelocityMs: input.maxAirVelocityMs,
  });
  const fallbackAirVelocityMs = Math.max(0.1, input.minAirVelocityMs ?? 1);
  const airVelocityUsedMs = input.airVelocityMs && input.airVelocityMs > 0 ? input.airVelocityMs : suggestedAirVelocityMs ?? fallbackAirVelocityMs;
  const airVelocitySource = input.airVelocityMs && input.airVelocityMs > 0 ? "manual" : "suggested";
  const hBaseWm2K = airVelocityUsedMs > 0 ? calculateConvectionCoefficient(airVelocityUsedMs) : null;
  const hEffectiveWm2K = hBaseWm2K !== null ? hBaseWm2K * (input.airExposureFactor ?? 1) : null;
  const estimatedFreezingTimeMin = hEffectiveWm2K && kEffectiveWmK
    ? calculatePlankFreezingTimeMin({
      densityKgM3: densityUsedKgM3,
      latentHeatKjKg: input.latentHeatKjKg ?? 0,
      frozenWaterFraction: input.frozenWaterFraction ?? 0,
      freezingPointC: input.freezingPointC ?? 0,
      airTemperatureC: airTemperatureUsedC,
      distanceToCoreM,
      hEffectiveWm2K,
      kEffectiveWmK,
    })
    : null;

  let processStatus: ContinuousGirofreezerResult["physics"]["processStatus"] = errors.length > 0 ? "invalid_input" : "missing_data";
  let retentionMargin: number | null = null;

  if (estimatedFreezingTimeMin !== null && retentionTimeMin > 0) {
    retentionMargin = retentionTimeMin / estimatedFreezingTimeMin;
    processStatus = retentionTimeMin >= estimatedFreezingTimeMin ? "adequate" : "insufficient";
    if (processStatus === "insufficient") warnings.push(`Tempo de retenção insuficiente. Estimado: ${estimatedFreezingTimeMin.toFixed(1)} min; disponível: ${retentionTimeMin.toFixed(1)} min.`);
  } else if (errors.length === 0) {
    warnings.push("Não foi possível estimar o tempo de congelamento. Valide temperatura do ar, calor latente, fração congelável e ponto de congelamento do produto.");
  }

  return {
    dimensionsM: { lengthM, widthM, thicknessM, volumeM3, characteristicDimensionM, distanceToCoreM },
    mass: { unitWeightKg, cyclesPerHour, calculatedMassKgH, directMassKgH, usedMassKgH, massSource, massInsideTunnelKg, massDifferencePercent },
    physics: { implicitDensityKgM3, densityCalculatedKgM3: densityResult.densityKgM3, densityUsedKgM3, densitySource, densityValidationStatus: densityResult.status, densityValidationMessage: densityResult.message, hBaseWm2K, hEffectiveWm2K, kEffectiveWmK, airTemperatureUsedC, airVelocityUsedMs, airVelocitySource, suggestedAirVelocityMs, estimatedFreezingTimeMin, retentionTimeMin, retentionMargin, processStatus },
    thermal,
    warnings,
    errors,
  };
}
