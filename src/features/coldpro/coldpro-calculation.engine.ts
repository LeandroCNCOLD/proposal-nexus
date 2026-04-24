import type {
  ColdProEnvironment,
  ColdProEnvironmentProduct,
  ColdProInsulationMaterial,
  ColdProResult,
  ColdProTunnel,
} from "./coldpro.types";
import {
  AIR_DENSITY_KG_M3,
  AIR_SPECIFIC_HEAT_KCAL_KG_C,
  DEFAULT_PEOPLE_LOAD_KCAL_H,
  kcalhToKw,
  kcalhToTr,
  kwToKcalh,
  round2,
} from "./coldpro.constants";

const W_TO_KCAL_H = 0.859845;

function n(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positive(value: number): number {
  return Math.max(0, value);
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

export function calculateTransmissionLoad(params: {
  env: ColdProEnvironment;
  insulation: ColdProInsulationMaterial;
}): number {
  const { env, insulation } = params;
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
    [0, product.respiration_rate_0c_w_kg],
    [5, product.respiration_rate_5c_w_kg],
    [10, product.respiration_rate_10c_w_kg],
    [15, product.respiration_rate_15c_w_kg],
    [20, product.respiration_rate_20c_w_kg],
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

  const cpAbove = n(product.specific_heat_above_kcal_kg_c);
  const cpBelow = n(product.specific_heat_below_kcal_kg_c);
  const latent = n(product.latent_heat_kcal_kg);

  let sensibleAbove = 0;
  let latentLoad = 0;
  let sensibleBelow = 0;

  if (tfreeze !== null && tfreeze !== undefined && tin > tfreeze && tout < tfreeze) {
    sensibleAbove = massDay * cpAbove * positive(tin - tfreeze);
    latentLoad = massDay * latent;
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
    latent_heat_kcal_kg: latent,
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
  const massHour = n(tunnel.mass_kg_hour) > 0
    ? n(tunnel.mass_kg_hour)
    : n(tunnel.product_unit_weight_kg) * n(tunnel.units_per_cycle) * n(tunnel.cycles_per_hour);

  const tin = n(tunnel.inlet_temp_c);
  const tout = n(tunnel.outlet_temp_c);
  const tfreeze = tunnel.freezing_temp_c;
  const cpAbove = n(tunnel.specific_heat_above_kcal_kg_c);
  const cpBelow = n(tunnel.specific_heat_below_kcal_kg_c);
  const latent = n(tunnel.latent_heat_kcal_kg);

  let sensibleAbove = 0;
  let latentLoad = 0;
  let sensibleBelow = 0;

  if (tunnel.tunnel_type === "blast_freezer" && tfreeze !== null && tfreeze !== undefined && tin > tfreeze && tout < tfreeze) {
    sensibleAbove = massHour * cpAbove * positive(tin - tfreeze);
    latentLoad = massHour * latent;
    sensibleBelow = massHour * cpBelow * positive(tfreeze - tout);
  } else {
    const cp = tin >= 0 && tout >= 0 ? cpAbove : cpBelow || cpAbove;
    sensibleAbove = massHour * cp * Math.abs(tin - tout);
  }

  const packaging = n(tunnel.packaging_mass_kg_hour) * n(tunnel.packaging_specific_heat_kcal_kg_c) * Math.abs(tin - tout);
  const internalLoads = kwToKcalh(n(tunnel.belt_motor_kw) + n(tunnel.internal_fans_kw) + n(tunnel.other_internal_kw));
  const total = sensibleAbove + latentLoad + sensibleBelow + packaging + internalLoads;

  return {
    mass_kg_hour: round2(massHour),
    sensible_above_kcal_h: round2(sensibleAbove),
    latent_kcal_h: round2(latentLoad),
    sensible_below_kcal_h: round2(sensibleBelow),
    packaging_kcal_h: round2(packaging),
    internal_loads_kcal_h: round2(internalLoads),
    total_kcal_h: round2(total),
    total_kw: round2(kcalhToKw(total)),
    total_tr: round2(kcalhToTr(total)),
    air_velocity_m_s: n(tunnel.air_velocity_m_s),
    process_time_min: n(tunnel.process_time_min),
  };
}

export function calculateColdProLoad(params: {
  env: ColdProEnvironment;
  products: ColdProEnvironmentProduct[];
  insulation: ColdProInsulationMaterial;
  tunnel?: ColdProTunnel | null;
}): ColdProResult {
  const transmission = calculateTransmissionLoad(params);
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
      tunnel: tunnelResult,
      products: productBreakdown,
      respiration_kcal_h: round2(respiration),
      formulas: {
        transmission: "Q = U × A × ΔT",
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
