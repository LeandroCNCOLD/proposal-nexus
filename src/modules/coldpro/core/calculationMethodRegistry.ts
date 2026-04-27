export type ColdProCalculationMethodStatus = "official" | "official_with_limitations" | "allowed_simplified" | "preferred_for_low_temperature";

export type ColdProCalculationMethod = {
  method: string;
  formula?: string;
  units?: string;
  status: ColdProCalculationMethodStatus;
  limitation?: string;
};

export const COLDPRO_CALCULATION_METHODS = {
  transmission: {
    method: "ASHRAE-style steady-state transmission",
    formula: "Q = U × A × ΔT",
    units: "W, kW, kcal/h",
    status: "official",
  },
  productCoolingFreezing: {
    method: "Sensible + latent + sensible below freezing",
    formula: "q = Cp_above × ΔT_above + L × frozenFraction + Cp_below × ΔT_below",
    units: "kJ/kg",
    status: "official",
  },
  continuousProductLoad: {
    method: "Mass flow energy balance",
    formula: "Q(kW) = m_dot(kg/h) × q(kJ/kg) / 3600",
    units: "kW",
    status: "official",
  },
  batchProductLoad: {
    method: "Batch energy over process time",
    formula: "Q(kW) = m(kg) × q(kJ/kg) / (time_h × 3600)",
    units: "kW",
    status: "official",
  },
  packagingContinuousLoad: {
    method: "Packaging mass flow energy balance",
    formula: "Q(kW) = m_pack_dot(kg/h) × Cp_pack × ΔT / 3600",
    units: "kW",
    status: "official",
  },
  packagingBatchLoad: {
    method: "Batch packaging energy over process time",
    formula: "Q(kW) = m_pack_batch(kg) × Cp_pack × ΔT / (time_h × 3600)",
    units: "kW",
    status: "official",
  },
  airFlowBalance: {
    method: "Airflow from sensible heat balance",
    formula: "V(m³/h) = Q(kW) × 3600 / (rho_air × Cp_air × ΔT_air)",
    units: "m³/h",
    status: "official",
  },
  airVelocity: {
    method: "Air velocity through free area",
    formula: "v = (airflow_m3_h / 3600) / free_area_m2",
    units: "m/s",
    status: "official",
  },
  freezingTime: {
    method: "ASHRAE/Plank-style freezing time estimate",
    formula: "function of density, latent heat, dimension, h, k, freezing temp and air temp",
    units: "min",
    status: "official_with_limitations",
    limitation: "Tempo estimado; pallets compactos, caixas empilhadas e produtos irregulares exigem validação em campo.",
  },
  infiltrationSimple: {
    method: "Simplified air-change infiltration",
    formula: "Q = ρ × V × Cp_air × ΔT",
    units: "kW, kcal/h",
    status: "allowed_simplified",
  },
  infiltrationPsychrometric: {
    method: "Psychrometric enthalpy difference",
    formula: "Q = m_air × (h_out - h_in)",
    units: "kW, kcal/h",
    status: "preferred_for_low_temperature",
  },
} satisfies Record<string, ColdProCalculationMethod>;

export type ColdProCalculationMethodKey = keyof typeof COLDPRO_CALCULATION_METHODS;