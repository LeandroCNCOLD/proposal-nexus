import { safeNumber } from "./units";

function positive(value: unknown): number {
  const parsed = safeNumber(value, 0);
  return parsed > 0 ? parsed : 0;
}

export function resolveAirflowSection(input: any) {
  const tunnelType = String(input?.tunnelType ?? input?.tunnel_type ?? "").toLowerCase();
  const arrangementType = String(input?.arrangementType ?? input?.arrangement_type ?? "").toLowerCase();
  const blockage = Math.min(Math.max(positive(input?.blockageFactor ?? input?.blockage_factor), 0), 0.95);
  const usefulHeight = positive(input?.usefulAirHeightM ?? input?.useful_air_height_m ?? input?.tunnelCrossSectionHeightM ?? input?.tunnel_cross_section_height_m);
  let width = positive(input?.tunnelCrossSectionWidthM ?? input?.tunnel_cross_section_width_m);
  let height = usefulHeight;
  let source = "manual_effective_section";
  const warnings: string[] = [];
  const missingFields: string[] = [];

  if (tunnelType === "static_pallet" || /pallet|block|bloco/.test(arrangementType)) {
    width = positive(input?.airCorridorWidthM ?? input?.air_corridor_width_m) || positive(input?.palletWidthM ?? input?.pallet_width_m) || width;
    height = positive(input?.palletHeightM ?? input?.pallet_height_m) || usefulHeight;
    source = "pallet_block_effective_section";
  } else if (tunnelType === "static_cart" || /cart|rack|carrinho/.test(arrangementType)) {
    width = positive(input?.cartWidthM ?? input?.cart_width_m) || width;
    height = positive(input?.traySpacingM ?? input?.tray_spacing_m) * Math.max(positive(input?.traysPerCart ?? input?.trays_per_cart) - 1, 1) || positive(input?.usefulAirHeightM ?? input?.useful_air_height_m) || height;
    source = "cart_free_area_between_trays";
    if (positive(input?.traySpacingM ?? input?.tray_spacing_m) <= 0) warnings.push("Seção livre do carrinho sem espaçamento entre bandejas; foi usada altura útil/manual.");
  } else if (tunnelType === "continuous_belt") {
    width = positive(input?.beltWidthM ?? input?.belt_width_m) || width;
    height = positive(input?.usefulAirHeightM ?? input?.useful_air_height_m) || height;
    source = "belt_width_by_useful_height";
  } else if (tunnelType === "spiral_girofreezer") {
    width = positive(input?.beltWidthM ?? input?.belt_width_m) || width;
    height = positive(input?.usefulAirHeightM ?? input?.useful_air_height_m) || positive(input?.levelHeightM ?? input?.level_height_m) || height;
    source = "spiral_effective_level_section";
  } else if (tunnelType === "fluidized_bed") {
    const bedArea = positive(input?.bedAreaM2 ?? input?.bed_area_m2) || positive(input?.bedWidthM ?? input?.bed_width_m) * positive(input?.bedLengthM ?? input?.bed_length_m);
    if (bedArea > 0) return { source: "iqf_bed_area", grossAreaM2: bedArea, freeAreaM2: bedArea * (1 - blockage), blockageFactor: blockage, widthM: null, heightM: null, warnings, missingFields: [] };
    source = "iqf_bed_area_missing";
  } else if (!tunnelType) {
    source = "room_general_section";
  }

  if (width <= 0) missingFields.push("largura da seção efetiva de ar");
  if (height <= 0) missingFields.push("altura útil da seção efetiva de ar");
  const grossAreaM2 = width > 0 && height > 0 ? width * height : null;
  const freeAreaM2 = grossAreaM2 !== null ? grossAreaM2 * (1 - blockage) : null;
  return { source, grossAreaM2, freeAreaM2, blockageFactor: blockage, widthM: width || null, heightM: height || null, warnings, missingFields };
}