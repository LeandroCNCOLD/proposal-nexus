/**
 * SERVIÇO DE MASSA TÉRMICA
 * Calcula a capacidade térmica equivalente da câmara fria (C_térmica_total)
 * usada no balanço térmico dinâmico: ΔT = Q_saldo × Δt / C_térmica_total
 */

export interface ThermalMassInput {
  /** Volume interno da câmara (m³) */
  volume_m3: number;
  /** Área do piso (m²) */
  floor_area_m2: number;
  /** Área total das paredes + teto (m²) */
  wall_area_m2: number;
  /** Massa total do produto armazenado (kg) — usada como inércia */
  stored_product_mass_kg?: number;
  /** Cp do produto (kcal/kg·°C) */
  product_specific_heat_kcal_kg_c?: number;
  /** Massa estimada de embalagens (kg) */
  packaging_mass_kg?: number;
  /** Massa estimada de pallets/estrutura interna (kg) */
  structure_mass_kg?: number;
  /** Espessura média do painel (m) — para estimar massa da estrutura */
  panel_thickness_m?: number;
}

export interface ThermalMassResult {
  /** Capacidade térmica total (kcal/°C) */
  total_thermal_capacity_kcal_c: number;
  breakdown: {
    air_kcal_c: number;
    product_kcal_c: number;
    packaging_kcal_c: number;
    structure_kcal_c: number;
  };
}

// Constantes físicas
const AIR_DENSITY_KG_M3 = 1.2;
const AIR_CP_KCAL_KG_C = 0.24;
const PACKAGING_CP_KCAL_KG_C = 0.45; // papelão/plástico
const STRUCTURE_CP_KCAL_KG_C = 0.12; // aço + PU
const STRUCTURE_DENSITY_KG_M3 = 45;  // painel PU típico

export function calculateThermalMass(input: ThermalMassInput): ThermalMassResult {
  // Massa de ar interno
  const airMass = input.volume_m3 * AIR_DENSITY_KG_M3;
  const airCapacity = airMass * AIR_CP_KCAL_KG_C;

  // Massa e capacidade do produto armazenado (inércia — não é carga de produto)
  const productMass = input.stored_product_mass_kg ?? 0;
  const productCp = input.product_specific_heat_kcal_kg_c ?? 0.45;
  // Fator de participação: produto não está 100% em equilíbrio com o ar
  const productParticipation = 0.3;
  const productCapacity = productMass * productCp * productParticipation;

  // Embalagens
  const packagingMass = input.packaging_mass_kg ?? (productMass * 0.08);
  const packagingCapacity = packagingMass * PACKAGING_CP_KCAL_KG_C;

  // Estrutura (painéis, piso, equipamentos internos)
  const panelThickness = input.panel_thickness_m ?? 0.1;
  const structureMass = input.structure_mass_kg ??
    ((input.wall_area_m2 + input.floor_area_m2) * panelThickness * STRUCTURE_DENSITY_KG_M3);
  const structureCapacity = structureMass * STRUCTURE_CP_KCAL_KG_C;

  const total = airCapacity + productCapacity + packagingCapacity + structureCapacity;

  return {
    total_thermal_capacity_kcal_c: Math.max(total, airCapacity), // mínimo é o ar
    breakdown: {
      air_kcal_c: airCapacity,
      product_kcal_c: productCapacity,
      packaging_kcal_c: packagingCapacity,
      structure_kcal_c: structureCapacity,
    },
  };
}
