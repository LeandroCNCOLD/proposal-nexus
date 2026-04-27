export type TunnelType =
  | "continuous_belt"
  | "spiral_girofreezer"
  | "static_cart"
  | "static_pallet"
  | "fluidized_bed"
  | "blast_freezer";

export type ArrangementType =
  | "individual_units"
  | "single_layer_blocks"
  | "trays"
  | "stacked_packages"
  | "packaged_units"
  | "trays_on_racks"
  | "boxes_on_cart"
  | "hanging_product"
  | "palletized_boxes"
  | "palletized_blocks"
  | "bulk_on_pallet"
  | "loose_particles"
  | "small_individual_units"
  | "boxes"
  | "racks"
  | "bulk_container";

const MODES: Record<TunnelType, { operationRegime: "continuous" | "batch"; isStatic: boolean; allowedArrangements: ArrangementType[] }> = {
  continuous_belt: { operationRegime: "continuous", isStatic: false, allowedArrangements: ["individual_units", "single_layer_blocks", "trays", "stacked_packages"] },
  spiral_girofreezer: { operationRegime: "continuous", isStatic: false, allowedArrangements: ["individual_units", "trays", "packaged_units"] },
  static_cart: { operationRegime: "batch", isStatic: true, allowedArrangements: ["trays_on_racks", "boxes_on_cart", "hanging_product"] },
  static_pallet: { operationRegime: "batch", isStatic: true, allowedArrangements: ["palletized_boxes", "palletized_blocks", "bulk_on_pallet"] },
  fluidized_bed: { operationRegime: "continuous", isStatic: false, allowedArrangements: ["loose_particles", "small_individual_units"] },
  blast_freezer: { operationRegime: "batch", isStatic: true, allowedArrangements: ["boxes", "racks", "bulk_container"] },
};

function inferTunnelType(input: any): TunnelType {
  const raw = String(input?.tunnelType ?? input?.tunnel_type ?? "").toLowerCase().trim();
  if (raw in MODES) return raw as TunnelType;
  const processType = String(input?.processType ?? input?.process_type ?? "").toLowerCase();
  if (processType === "static_cart_freezing") return "static_cart";
  if (processType === "static_pallet_freezing") return "static_pallet";
  if (processType.includes("girofreezer") || processType.includes("spiral") || processType.includes("giro")) return "spiral_girofreezer";
  if ((input?.operationMode ?? input?.operation_mode) === "batch") return "blast_freezer";
  return "continuous_belt";
}

export function resolveTunnelMode(input: any) {
  const tunnelType = inferTunnelType(input);
  const mode = MODES[tunnelType];
  const arrangementType = (input?.arrangementType ?? input?.arrangement_type ?? null) as string | null;
  const warnings: string[] = [];
  const missingFields: string[] = [];

  if (!arrangementType) missingFields.push("tipo de arranjo");
  else if (!mode.allowedArrangements.includes(arrangementType as ArrangementType)) warnings.push("Arranjo selecionado não é típico para este tipo de túnel.");

  return {
    tunnelType,
    arrangementType,
    operationRegime: mode.operationRegime,
    isStatic: mode.isStatic,
    allowedArrangements: mode.allowedArrangements,
    warnings,
    missingFields,
  };
}
