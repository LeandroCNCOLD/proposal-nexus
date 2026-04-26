import type { TunnelEngineResult } from "../core/calculationTypes";

export function calculationToTunnelPayload(result: TunnelEngineResult) {
  return {
    thermal_characteristic_dimension_m: result.characteristicDimensionM,
    distance_to_core_m: result.distanceToCoreM,
    calculation_warnings: result.warnings,
    missing_fields: result.missingFields,
    calculation_breakdown: result.calculationBreakdown,
    calculation_log: result.calculationLog,
    estimated_freezing_time_min: result.estimatedTimeMin,
    process_status: result.status,
    calculated_mass_kg_h: result.calculatedMassKgH,
    used_mass_kg_h: result.usedMassKgH,
    tunnel_product_load_kw: result.productLoadKW,
    tunnel_packaging_load_kw: result.packagingLoadKW,
    tunnel_internal_load_kw: result.internalLoadKW,
    tunnel_total_load_kw: result.totalKW,
    tunnel_total_load_kcal_h: result.totalKcalH,
    tunnel_total_load_tr: result.totalTR,
  };
}
