import type {
  ColdProEnvironment,
  ColdProEnvironmentProduct,
  ColdProConstructionFace,
  ColdProInsulationMaterial,
  ColdProResult,
  ColdProTunnel,
  ColdProWallLayer,
} from "./coldpro.types";
import {
  AIR_DENSITY_KG_M3,
  AIR_SPECIFIC_HEAT_KCAL_KG_C,
  DEFAULT_PEOPLE_LOAD_KCAL_H,
  KCAL_TO_KJ,
  kcalhToKw,
  kcalhToTr,
  kwToKcalh,
  round2,
} from "./coldpro.constants";

const W_TO_KCAL_H = 0.859845;
const R_INTERNAL_M2K_W = 0.12;
const R_EXTERNAL_M2K_W = 0.08;
const GLASS_U_VALUES_W_M2K: Record<string, number> = {
  none: 0,
  simple: 5.8,
  double: 2.8,
  triple: 1.8,
  low_e_double: 1.6,
  heated_refrigerated: 2.5,
  insulated: 1.8,
};
const GLASS_SOLAR_FACTORS: Record<string, number> = {
  none: 0,
  simple: 0.85,
  double: 0.75,
  triple: 0.65,
  low_e_double: 0.4,
  heated_refrigerated: 0.55,
  insulated: 0.55,
};

const TUNNEL_ARRANGEMENT_DEFAULTS: Record<string, { airExposure: number; penetration: number; label: string; warning?: string }> = {
  individual_exposed: { airExposure: 1, penetration: 1, label: "Produto individual exposto" },
  tray_layer: { airExposure: 0.8, penetration: 0.8, label: "Bandeja/camada exposta" },
  cart_rack: { airExposure: 0.7, penetration: 0.7, label: "Carrinho com bandejas espaçadas" },
  boxed_product: { airExposure: 0.35, penetration: 0.45, label: "Produto em caixa", warning: "Produto em caixa depende da abertura/perfuração e da passagem real de ar pela embalagem." },
  pallet_block: { airExposure: 0.15, penetration: 0.2, label: "Pallet/bloco compacto", warning: "Congelamento de pallet/bloco é estimativa conservadora e deve ser validado em campo ou por ensaio." },
  bulk_static: { airExposure: 0.1, penetration: 0.15, label: "Massa estática a granel", warning: "Produto a granel tem baixa penetração térmica e forte dependência do arranjo físico." },
};

function tunnelArrangementDefaults(type?: string | null) {
  return TUNNEL_ARRANGEMENT_DEFAULTS[String(type ?? "individual_exposed")] ?? TUNNEL_ARRANGEMENT_DEFAULTS.individual_exposed;
}

export function calculateConvectionCoefficient(airVelocityMS?: number | null, fallback?: number | null): number | null {
  const velocity = n(airVelocityMS);
  if (velocity <= 0) return fallback ?? null;
  return round2(10 + 10 * Math.pow(velocity, 0.8));
}

export function calculateRecommendedAirFlowM3H(powerKw: number, deltaTAirK = 6): number {
  const delta = deltaTAirK > 0 ? deltaTAirK : 6;
  const airCpKjKgK = AIR_SPECIFIC_HEAT_KCAL_KG_C * KCAL_TO_KJ;
  const m3s = n(powerKw) / (AIR_DENSITY_KG_M3 * airCpKjKgK * delta);
  return round2(m3s * 3600);
}

export function estimateFreezingTimePlankMin(params: {
  thicknessM?: number | null;
  distanceToCoreM?: number | null;
  densityKgM3?: number | null;
  thermalConductivityFrozenWMK?: number | null;
  effectiveConductivityWMK?: number | null;
  freezingTempC?: number | null;
  latentHeatKcalKg?: number | null;
  frozenWaterFraction?: number | null;
  airTempC?: number | null;
  airVelocityMS?: number | null;
  convectiveCoefficientWM2K?: number | null;
}): number | null {
  const thickness = n(params.thicknessM);
  const distanceToCore = n(params.distanceToCoreM) > 0 ? n(params.distanceToCoreM) : thickness / 2;
  const density = n(params.densityKgM3);
  const conductivity = n(params.effectiveConductivityWMK) || n(params.thermalConductivityFrozenWMK);
  const tfreeze = n(params.freezingTempC, NaN);
  const latent = n(params.latentHeatKcalKg) * KCAL_TO_KJ;
  const frozenFraction = n(params.frozenWaterFraction, 0.9) || 0.9;
  const h = n(params.convectiveCoefficientWM2K) || n(calculateConvectionCoefficient(params.airVelocityMS));
  const deltaT = tfreeze - n(params.airTempC);
  if (distanceToCore <= 0 || density <= 0 || conductivity <= 0 || !Number.isFinite(tfreeze) || latent <= 0 || h <= 0 || deltaT <= 0) return null;
  const latentJkg = latent * frozenFraction * 1000;
  const seconds = (density * latentJkg / deltaT) * (distanceToCore / h + (distanceToCore * distanceToCore) / (2 * conductivity));
  return round2(seconds / 60);
}

function n(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positive(value: number): number {
  return Math.max(0, value);
}

function kcalFromKj(value: unknown): number {
  const kj = n(value);
  return kj > 0 ? kj / KCAL_TO_KJ : 0;
}

function thermalValueKcal(kcal: unknown, kj: unknown): number {
  return n(kcal) || kcalFromKj(kj);
}

function waterFreezeFraction(item: Pick<ColdProEnvironmentProduct | ColdProTunnel, "frozen_water_fraction" | "freezable_water_content_percent" | "water_content_percent">): number {
  const explicit = n(item.frozen_water_fraction, NaN);
  if (Number.isFinite(explicit) && explicit > 0) return explicit > 1 ? explicit / 100 : explicit;
  const freezable = n(item.freezable_water_content_percent, NaN);
  if (Number.isFinite(freezable) && freezable > 0) return freezable / 100;
  const water = n(item.water_content_percent, NaN);
  if (Number.isFinite(water) && water > 0) return Math.min(1, water / 100);
  return 1;
}

export function calculateVolume(env: Pick<ColdProEnvironment, "length_m" | "width_m" | "height_m">): number {
  return positive(n(env.length_m) * n(env.width_m) * n(env.height_m));
}

export function calculateSurfaceAreas(env: ColdProEnvironment) {
  const length = n(env.length_m);
  const width = n(env.width_m);
  const height = n(env.height_m);

  return {
    wallArea: 2 * (length * height + width * height),
    ceilingArea: length * width,
    floorArea: length * width,
  };
}

export function calculateUValue(layers: Pick<ColdProWallLayer, "thickness_m" | "conductivity_w_mk">[]): number {
  const layerResistance = layers.reduce((sum, layer) => {
    const thickness = n(layer.thickness_m);
    const conductivity = n(layer.conductivity_w_mk);
    return conductivity > 0 ? sum + thickness / conductivity : sum;
  }, 0);
  const totalResistance = R_INTERNAL_M2K_W + layerResistance + R_EXTERNAL_M2K_W;
  return totalResistance > 0 ? 1 / totalResistance : 0;
}

function constructionFaces(env: ColdProEnvironment): ColdProConstructionFace[] {
  return Array.isArray(env.construction_faces) ? env.construction_faces.filter((face) => face.local !== "__GEOMETRY__") : [];
}

function faceArea(face: ColdProConstructionFace) {
  return positive(n(face.panel_area_m2));
}

function faceDeltaT(face: ColdProConstructionFace, env: ColdProEnvironment) {
  const targetTemp = face.local === "PISO"
    ? (face.external_temp_c ?? env.floor_temp_c ?? (env.has_floor_insulation ? env.external_temp_c : 20))
    : face.external_temp_c ?? env.external_temp_c;
  return positive(n(targetTemp) - n(env.internal_temp_c));
}

function glassUValue(face: ColdProConstructionFace) {
  const key = String(face.glass_type ?? "none").trim().toLowerCase();
  return GLASS_U_VALUES_W_M2K[key] ?? GLASS_U_VALUES_W_M2K.none;
}

function glassSolarFactor(face: ColdProConstructionFace) {
  const key = String(face.glass_type ?? "none").trim().toLowerCase();
  return GLASS_SOLAR_FACTORS[key] ?? GLASS_SOLAR_FACTORS.none;
}

export function calculateFaceTransmission(face: ColdProConstructionFace, env: ColdProEnvironment) {
  const layers = Array.isArray(face.layers) ? face.layers.filter((layer) => n(layer.thickness_m) > 0 && n(layer.conductivity_w_mk) > 0) : [];
  const area = faceArea(face);
  const glassArea = Math.min(area, positive(n(face.glass_area_m2)));
  const insulatedArea = positive(area - glassArea);
  const deltaT = faceDeltaT(face, env);
  const uValue = layers.length ? calculateUValue(layers) : n(face.u_value_w_m2k);
  const panelWatts = uValue * insulatedArea * deltaT;
  const glassU = glassArea > 0 ? glassUValue(face) : 0;
  const glassWatts = glassU * glassArea * deltaT;
  const solarRadiation = glassArea > 0 ? positive(n(face.solar_radiation_w_m2)) : 0;
  const solarFactor = glassArea > 0 ? glassSolarFactor(face) : 0;
  const glassSolarWatts = glassArea * solarRadiation * solarFactor;
  const watts = panelWatts + glassWatts + glassSolarWatts;
  const kcalH = watts * W_TO_KCAL_H;
  return {
    local: face.local,
    area_m2: round2(area),
    insulated_area_m2: round2(insulatedArea),
    glass_area_m2: round2(glassArea),
    delta_t_c: round2(deltaT),
    solar_radiation_w_m2: round2(solarRadiation),
    glass_solar_factor: round2(solarFactor),
    u_value_w_m2k: round2(uValue),
    glass_u_value_w_m2k: round2(glassU),
    panel_transmission_w: round2(panelWatts),
    glass_transmission_w: round2(glassWatts),
    glass_solar_w: round2(glassSolarWatts),
    panel_transmission_kcal_h: round2(panelWatts * W_TO_KCAL_H),
    glass_transmission_kcal_h: round2(glassWatts * W_TO_KCAL_H),
    glass_solar_kcal_h: round2(glassSolarWatts * W_TO_KCAL_H),
    transmission_w: round2(watts),
    transmission_kw: round2(watts / 1000),
    transmission_kcal_h: round2(kcalH),
    transmission_tr: round2(kcalhToTr(kcalH)),
    layers: layers.map((layer) => ({
      material_name: layer.material_name,
      thickness_m: n(layer.thickness_m),
      conductivity_w_mk: n(layer.conductivity_w_mk),
      position: n(layer.position),
    })),
  };
}

export function calculateConstructionTransmission(env: ColdProEnvironment) {
  const faces = constructionFaces(env).filter((face) => faceArea(face) > 0 && (Array.isArray(face.layers) || n(face.u_value_w_m2k) > 0));
  const faceResults = faces.map((face) => calculateFaceTransmission(face, env));
  const totalW = faceResults.reduce((sum, face) => sum + face.transmission_w, 0);
  const totalKcalH = totalW * W_TO_KCAL_H;
  const totalGlassW = faceResults.reduce((sum, face) => sum + face.glass_transmission_w + face.glass_solar_w, 0);
  return {
    total_w: round2(totalW),
    total_kw: round2(totalW / 1000),
    total_kcal_h: round2(totalKcalH),
    total_tr: round2(kcalhToTr(totalKcalH)),
    glass_total_w: round2(totalGlassW),
    glass_total_kcal_h: round2(totalGlassW * W_TO_KCAL_H),
    faces: faceResults,
  };
}

export function calculateTransmissionLoad(params: {
  env: ColdProEnvironment;
  insulation: ColdProInsulationMaterial;
}): number {
  const { env, insulation } = params;
  const construction = calculateConstructionTransmission(env);
  if (construction.faces.length > 0) return construction.total_kcal_h;
  const areas = calculateSurfaceAreas(env);
  const deltaT = positive(n(env.external_temp_c) - n(env.internal_temp_c));
  const k = n(insulation.conductivity_kcal_h_m_c);

  const wallThicknessM = positive(n(env.wall_thickness_mm) / 1000);
  const ceilingThicknessM = positive(n(env.ceiling_thickness_mm) / 1000);
  const floorThicknessM = positive(n(env.floor_thickness_mm) / 1000);

  const wallU = wallThicknessM > 0 ? k / wallThicknessM : 0;
  const ceilingU = ceilingThicknessM > 0 ? k / ceilingThicknessM : 0;
  const floorU = env.has_floor_insulation && floorThicknessM > 0 ? k / floorThicknessM : 0;

  const wallLoad = wallU * areas.wallArea * deltaT;
  const ceilingLoad = ceilingU * areas.ceilingArea * deltaT;

  const floorDeltaT =
    env.has_floor_insulation && env.floor_temp_c !== null && env.floor_temp_c !== undefined
      ? positive(n(env.floor_temp_c) - n(env.internal_temp_c))
      : deltaT;

  const floorLoad = floorU * areas.floorArea * floorDeltaT;

  return wallLoad + ceilingLoad + floorLoad;
}

export function calculateProductLoad(product: ColdProEnvironmentProduct): number {
  return calculateProductLoadBreakdown(product).total_kcal_h;
}

export function calculateProductRespirationLoad(product: ColdProEnvironmentProduct, storageTempC: number): number {
  const points = [
    [0, product.respiration_rate_0c_w_kg ?? (product.respiration_rate_0c_mw_kg != null ? product.respiration_rate_0c_mw_kg / 1000 : null)],
    [5, product.respiration_rate_5c_w_kg ?? (product.respiration_rate_5c_mw_kg != null ? product.respiration_rate_5c_mw_kg / 1000 : null)],
    [10, product.respiration_rate_10c_w_kg ?? (product.respiration_rate_10c_mw_kg != null ? product.respiration_rate_10c_mw_kg / 1000 : null)],
    [15, product.respiration_rate_15c_w_kg ?? (product.respiration_rate_15c_mw_kg != null ? product.respiration_rate_15c_mw_kg / 1000 : null)],
    [20, product.respiration_rate_20c_w_kg ?? (product.respiration_rate_20c_mw_kg != null ? product.respiration_rate_20c_mw_kg / 1000 : null)],
  ].filter((row): row is [number, number] => row[1] !== null && row[1] !== undefined && Number.isFinite(Number(row[1])));

  if (points.length === 0) return 0;
  const mass = n(product.mass_kg_day) > 0 ? n(product.mass_kg_day) : n(product.mass_kg_hour) * 24;
  const temp = Math.max(points[0][0], Math.min(points[points.length - 1][0], storageTempC));
  let rate = points[0][1];
  for (let i = 0; i < points.length - 1; i++) {
    const [t1, r1] = points[i];
    const [t2, r2] = points[i + 1];
    if (temp >= t1 && temp <= t2) {
      rate = r1 + ((r2 - r1) * (temp - t1)) / (t2 - t1);
      break;
    }
  }
  return mass * rate * W_TO_KCAL_H;
}

export function calculateProductLoadBreakdown(product: ColdProEnvironmentProduct) {
  const massDay =
    n(product.mass_kg_day) > 0
      ? n(product.mass_kg_day)
      : n(product.mass_kg_hour) * n(product.process_time_h);

  const hours = n(product.process_time_h, 24) || 24;
  const tin = n(product.inlet_temp_c);
  const tout = n(product.outlet_temp_c);
  const tfreeze = product.initial_freezing_temp_c;

  const cpAbove = thermalValueKcal(product.specific_heat_above_kcal_kg_c, product.specific_heat_above_kj_kg_k);
  const cpBelow = thermalValueKcal(product.specific_heat_below_kcal_kg_c, product.specific_heat_below_kj_kg_k);
  const latent = thermalValueKcal(product.latent_heat_kcal_kg, product.latent_heat_kj_kg);
  const allowPhaseChange = product.allow_phase_change !== false;
  const frozenFraction = waterFreezeFraction(product);

  let sensibleAbove = 0;
  let latentLoad = 0;
  let sensibleBelow = 0;

  if (allowPhaseChange && tfreeze !== null && tfreeze !== undefined && tin > tfreeze && tout < tfreeze) {
    sensibleAbove = massDay * cpAbove * positive(tin - tfreeze);
    latentLoad = massDay * latent * frozenFraction;
    sensibleBelow = massDay * cpBelow * positive(tfreeze - tout);
  } else {
    const cp = tin >= 0 && tout >= 0 ? cpAbove : cpBelow || cpAbove;
    sensibleAbove = massDay * cp * Math.abs(tin - tout);
  }

  const total = (sensibleAbove + latentLoad + sensibleBelow) / hours;
  return {
    product_name: product.product_name,
    mass_kg_day: round2(massDay),
    hours,
    inlet_temp_c: tin,
    outlet_temp_c: tout,
    freezing_temp_c: tfreeze ?? null,
    cp_above_kcal_kg_c: cpAbove,
    cp_below_kcal_kg_c: cpBelow,
    cp_above_kj_kg_k: product.specific_heat_above_kj_kg_k ?? round2(cpAbove * KCAL_TO_KJ),
    cp_below_kj_kg_k: product.specific_heat_below_kj_kg_k ?? round2(cpBelow * KCAL_TO_KJ),
    latent_heat_kcal_kg: latent,
    latent_heat_kj_kg: product.latent_heat_kj_kg ?? round2(latent * KCAL_TO_KJ),
    frozen_water_fraction: frozenFraction,
    composition_percent: {
      water: product.water_content_percent ?? null,
      protein: product.protein_content_percent ?? null,
      fat: product.fat_content_percent ?? null,
      carbohydrate: product.carbohydrate_content_percent ?? null,
      fiber: product.fiber_content_percent ?? null,
      ash: product.ash_content_percent ?? null,
    },
    sensible_above_kcal_h: round2(sensibleAbove / hours),
    latent_kcal_h: round2(latentLoad / hours),
    sensible_below_kcal_h: round2(sensibleBelow / hours),
    total_kcal_h: round2(total),
    source: product.product_id ? "Catálogo ASHRAE/CN ColdPro" : "Manual",
  };
}

export function calculatePackagingLoad(product: ColdProEnvironmentProduct): number {
  const mass = n(product.packaging_mass_kg_day);
  const cp = n(product.packaging_specific_heat_kcal_kg_c);
  const tin = product.packaging_inlet_temp_c ?? product.inlet_temp_c;
  const tout = product.packaging_outlet_temp_c ?? product.outlet_temp_c;
  const hours = n(product.process_time_h, 24) || 24;

  return (mass * cp * Math.abs(n(tin) - n(tout))) / hours;
}

export function calculateInfiltrationLoad(env: ColdProEnvironment): number {
  const doorArea = n(env.door_width_m) * n(env.door_height_m);
  const openings = n(env.door_openings_per_day);
  const factor = n(env.infiltration_factor);

  if (doorArea <= 0 || openings <= 0 || factor <= 0) return 0;

  const deltaT = positive(n(env.external_temp_c) - n(env.internal_temp_c));
  const airVolumeDay = doorArea * openings * factor;

  const kcalDay = airVolumeDay * AIR_DENSITY_KG_M3 * AIR_SPECIFIC_HEAT_KCAL_KG_C * deltaT;
  const hours = n(env.compressor_runtime_hours_day, 20) || 20;

  return kcalDay / hours;
}

export function calculatePeopleLoad(env: ColdProEnvironment): number {
  const compressorHours = n(env.compressor_runtime_hours_day, 20) || 20;
  return (n(env.people_count) * DEFAULT_PEOPLE_LOAD_KCAL_H * n(env.people_hours_day)) / compressorHours;
}

export function calculateLightingLoad(env: ColdProEnvironment): number {
  const compressorHours = n(env.compressor_runtime_hours_day, 20) || 20;
  return (kwToKcalh(n(env.lighting_power_w) / 1000) * n(env.lighting_hours_day)) / compressorHours;
}

export function calculateMotorsLoad(env: ColdProEnvironment): number {
  const compressorHours = n(env.compressor_runtime_hours_day, 20) || 20;
  return (kwToKcalh(n(env.motors_power_kw)) * n(env.motors_hours_day)) / compressorHours;
}

export function calculateTunnelLoad(tunnel: ColdProTunnel) {
  const processType = String(tunnel.process_type ?? (tunnel.operation_mode === "batch" ? "static_pallet_freezing" : "continuous_individual_freezing"));
  const isStatic = processType === "static_cart_freezing" || processType === "static_pallet_freezing" || tunnel.operation_mode === "batch";
  const arrangementType = String(tunnel.arrangement_type ?? (isStatic ? "pallet_block" : "individual_exposed"));
  const arrangementDefaults = tunnelArrangementDefaults(arrangementType);
  const airExposureFactor = n(tunnel.air_exposure_factor, arrangementDefaults.airExposure) || arrangementDefaults.airExposure;
  const penetrationFactor = n(tunnel.thermal_penetration_factor, arrangementDefaults.penetration) || arrangementDefaults.penetration;
  const unitWeight = n(tunnel.unit_weight_kg) || n(tunnel.product_unit_weight_kg);
  const massHour = isStatic
    ? 0
    : n(tunnel.mass_kg_hour) > 0
      ? n(tunnel.mass_kg_hour)
      : unitWeight * n(tunnel.units_per_cycle) * n(tunnel.cycles_per_hour);
  const staticMass = n(tunnel.pallet_mass_kg) * Math.max(1, n(tunnel.number_of_pallets, 1));
  const batchTimeH = n(tunnel.batch_time_h) || n(tunnel.process_time_min) / 60;
  const tin = n(tunnel.inlet_temp_c);
  const tout = n(tunnel.outlet_temp_c);
  const tfreeze = tunnel.freezing_temp_c;
  const cpAbove = thermalValueKcal(tunnel.specific_heat_above_kcal_kg_c, tunnel.specific_heat_above_kj_kg_k);
  const cpBelow = thermalValueKcal(tunnel.specific_heat_below_kcal_kg_c, tunnel.specific_heat_below_kj_kg_k);
  const latent = thermalValueKcal(tunnel.latent_heat_kcal_kg, tunnel.latent_heat_kj_kg);
  const frozenFraction = waterFreezeFraction(tunnel);
  const productThicknessM = n(tunnel.product_thickness_m) || n(tunnel.product_thickness_mm) / 1000;
  const blockDimensions = [n(tunnel.pallet_length_m), n(tunnel.pallet_width_m), n(tunnel.pallet_height_m)].filter((value) => value > 0);
  const blockCharacteristicM = blockDimensions.length ? Math.min(...blockDimensions) : 0;
  const characteristicDimensionM = isStatic ? blockCharacteristicM : productThicknessM;
  const distanceToCoreM = characteristicDimensionM > 0 ? characteristicDimensionM / 2 : 0;
  const baseConvectiveCoefficient = calculateConvectionCoefficient(tunnel.air_velocity_m_s, tunnel.convective_coefficient_manual_w_m2_k ?? tunnel.convective_coefficient_w_m2_k);
  const convectiveCoefficient = baseConvectiveCoefficient ? round2(baseConvectiveCoefficient * airExposureFactor) : null;
  const effectiveConductivity = n(tunnel.thermal_conductivity_frozen_w_m_k) > 0 ? n(tunnel.thermal_conductivity_frozen_w_m_k) * penetrationFactor : 0;
  const estimatedFreezingTimeMin = estimateFreezingTimePlankMin({
    thicknessM: characteristicDimensionM,
    distanceToCoreM,
    densityKgM3: tunnel.density_kg_m3,
    thermalConductivityFrozenWMK: tunnel.thermal_conductivity_frozen_w_m_k,
    effectiveConductivityWMK: effectiveConductivity,
    freezingTempC: tunnel.freezing_temp_c,
    latentHeatKcalKg: tunnel.latent_heat_kcal_kg,
    airTempC: tunnel.air_temp_c,
    airVelocityMS: tunnel.air_velocity_m_s,
    convectiveCoefficientWM2K: convectiveCoefficient,
  });

  let sensibleAbove = 0;
  let latentLoad = 0;
  let sensibleBelow = 0;
  const calculationMass = isStatic ? staticMass : massHour;

  if (tunnel.tunnel_type === "blast_freezer" && tfreeze !== null && tfreeze !== undefined && tin > tfreeze && tout < tfreeze) {
    sensibleAbove = calculationMass * cpAbove * positive(tin - tfreeze);
    latentLoad = calculationMass * latent * frozenFraction;
    sensibleBelow = calculationMass * cpBelow * positive(tfreeze - tout);
  } else {
    const cp = tin >= 0 && tout >= 0 ? cpAbove : cpBelow || cpAbove;
    sensibleAbove = calculationMass * cp * Math.abs(tin - tout);
  }

  const timeDivisor = isStatic && batchTimeH > 0 ? batchTimeH : 1;
  const productHourly = (sensibleAbove + latentLoad + sensibleBelow) / timeDivisor;
  const packaging = n(tunnel.packaging_mass_kg_hour) * n(tunnel.packaging_specific_heat_kcal_kg_c) * Math.abs(tin - tout);
  const internalLoads = kwToKcalh(n(tunnel.belt_motor_kw) + n(tunnel.internal_fans_kw) + n(tunnel.other_internal_kw));
  const total = productHourly + packaging + internalLoads;
  const availableTimeMin = isStatic ? batchTimeH * 60 : n(tunnel.process_time_min);
  const retentionMargin = estimatedFreezingTimeMin && availableTimeMin > 0 ? availableTimeMin / estimatedFreezingTimeMin : null;
  const retentionStatus = !retentionMargin ? "Sem dados suficientes" : retentionMargin < 1 ? "Insuficiente" : retentionMargin < 1.1 ? "Adequado com baixa margem" : "Adequado";
  const warnings = [arrangementDefaults.warning, !estimatedFreezingTimeMin ? "Tempo até núcleo não estimado por falta de densidade, condutividade congelada, calor latente, temperatura de congelamento ou dimensão térmica." : null].filter(Boolean);

  return {
    process_type: processType,
    arrangement_type: arrangementType,
    arrangement_label: arrangementDefaults.label,
    calculation_model: isStatic ? "static_equivalent_block" : "continuous_individual_unit",
    mass_kg_hour: round2(massHour),
    static_mass_kg: round2(staticMass),
    batch_time_h: round2(batchTimeH),
    total_energy_kcal: round2(sensibleAbove + latentLoad + sensibleBelow),
    sensible_above_kcal_h: round2(sensibleAbove / timeDivisor),
    latent_kcal_h: round2(latentLoad / timeDivisor),
    sensible_below_kcal_h: round2(sensibleBelow / timeDivisor),
    cp_above_kcal_kg_c: round2(cpAbove),
    cp_below_kcal_kg_c: round2(cpBelow),
    latent_heat_kcal_kg: round2(latent),
    frozen_water_fraction: round2(frozenFraction),
    composition_percent: {
      water: tunnel.water_content_percent ?? null,
      protein: tunnel.protein_content_percent ?? null,
      fat: tunnel.fat_content_percent ?? null,
      carbohydrate: tunnel.carbohydrate_content_percent ?? null,
      fiber: tunnel.fiber_content_percent ?? null,
      ash: tunnel.ash_content_percent ?? null,
    },
    packaging_kcal_h: round2(packaging),
    internal_loads_kcal_h: round2(internalLoads),
    total_kcal_h: round2(total),
    total_kw: round2(kcalhToKw(total)),
    total_tr: round2(kcalhToTr(total)),
    air_velocity_m_s: n(tunnel.air_velocity_m_s),
    airflow_m3_h: n(tunnel.airflow_m3_h),
    process_time_min: availableTimeMin,
    base_convective_coefficient_w_m2_k: baseConvectiveCoefficient,
    air_exposure_factor: round2(airExposureFactor),
    thermal_penetration_factor: round2(penetrationFactor),
    effective_thermal_conductivity_w_m_k: round2(effectiveConductivity),
    convective_coefficient_w_m2_k: convectiveCoefficient,
    convective_coefficient_effective_w_m2_k: convectiveCoefficient,
    thermal_characteristic_dimension_m: round2(characteristicDimensionM),
    distance_to_core_m: round2(distanceToCoreM),
    estimated_freezing_time_min: estimatedFreezingTimeMin,
    retention_margin: retentionMargin ? round2(retentionMargin) : null,
    retention_status: retentionStatus,
    technical_status: retentionStatus,
    warnings,
    recommended_airflow_m3_h: calculateRecommendedAirFlowM3H(kcalhToKw(total)),
  };
}

export function calculateColdProLoad(params: {
  env: ColdProEnvironment;
  products: ColdProEnvironmentProduct[];
  insulation: ColdProInsulationMaterial;
  tunnel?: ColdProTunnel | null;
}): ColdProResult {
  const transmission = calculateTransmissionLoad(params);
  const transmissionBreakdown = calculateConstructionTransmission(params.env);
  const productBreakdown = params.products.map(calculateProductLoadBreakdown);
  const product = productBreakdown.reduce((acc, item) => acc + item.total_kcal_h, 0);
  const packaging = params.products.reduce((acc, item) => acc + calculatePackagingLoad(item), 0);
  const respiration = params.products.reduce((acc, item) => acc + calculateProductRespirationLoad(item, n(params.env.internal_temp_c)), 0);
  const tunnelResult = params.tunnel ? calculateTunnelLoad(params.tunnel) : null;
  const tunnelInternalLoad = tunnelResult?.total_kcal_h ?? 0;
  const infiltration = calculateInfiltrationLoad(params.env);
  const people = calculatePeopleLoad(params.env);
  const lighting = calculateLightingLoad(params.env);
  const motors = calculateMotorsLoad(params.env);
  const fans = n(params.env.fans_kcal_h);
  const defrost = n(params.env.defrost_kcal_h);
  const other = n(params.env.other_kcal_h);

  const subtotal = transmission + product + packaging + respiration + tunnelInternalLoad + infiltration + people + lighting + motors + fans + defrost + other;
  const safetyFactor = n(params.env.safety_factor_percent);
  const safety = subtotal * (safetyFactor / 100);
  const total = subtotal + safety;

  return {
    transmission_kcal_h: round2(transmission),
    product_kcal_h: round2(product),
    packaging_kcal_h: round2(packaging),
    infiltration_kcal_h: round2(infiltration),
    people_kcal_h: round2(people),
    lighting_kcal_h: round2(lighting),
    motors_kcal_h: round2(motors),
    tunnel_internal_load_kcal_h: round2(tunnelInternalLoad),
    fans_kcal_h: round2(fans),
    defrost_kcal_h: round2(defrost),
    other_kcal_h: round2(other),
    subtotal_kcal_h: round2(subtotal),
    safety_factor_percent: round2(safetyFactor),
    safety_kcal_h: round2(safety),
    total_required_kcal_h: round2(total),
    total_required_kw: round2(kcalhToKw(total)),
    total_required_tr: round2(kcalhToTr(total)),
    calculation_breakdown: {
      transmission_summary: {
        total_w: transmissionBreakdown.total_w,
        total_kw: transmissionBreakdown.total_kw,
        total_kcal_h: transmissionBreakdown.total_kcal_h,
        total_tr: transmissionBreakdown.total_tr,
        glass_total_w: transmissionBreakdown.glass_total_w,
        glass_total_kcal_h: transmissionBreakdown.glass_total_kcal_h,
      },
      transmission_faces: transmissionBreakdown.faces,
      tunnel: tunnelResult,
      products: productBreakdown,
      respiration_kcal_h: round2(respiration),
      formulas: {
        transmission: "Q_linha = (Área opaca × U painel × ΔT) + (Área vidro × U vidro × ΔT) + (Área vidro × radiação solar × fator solar)",
        product: "Q = m × cp × ΔT / h; congelamento inclui calor latente",
        respiration: "Q_respiração = massa_kg × taxa_W_kg × 0,859845, com interpolação por temperatura",
        tunnel: "Q túnel = sensível acima + latente + sensível abaixo + embalagem + cargas internas",
        infiltration: "Q = V_ar × densidade_ar × cp_ar × ΔT / h",
        lighting: "Q = kW × 860 × horas / horas_compressor",
        motors: "Q = kW × 860 × horas / horas_compressor",
      },
    },
  };
}
