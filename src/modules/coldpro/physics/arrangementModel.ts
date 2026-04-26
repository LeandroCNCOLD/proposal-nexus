export type SurfaceExposureModel =
  | "fully_exposed"
  | "one_side_contact"
  | "tray_contact"
  | "boxed"
  | "stacked"
  | "bulk_layer";

const EXPOSURE_VALUES: Record<SurfaceExposureModel, number> = {
  fully_exposed: 1,
  one_side_contact: 0.8,
  tray_contact: 0.65,
  boxed: 0.35,
  stacked: 0.45,
  bulk_layer: 0.55,
};

const ARRANGEMENT_FALLBACKS: Record<string, SurfaceExposureModel> = {
  individual_units: "fully_exposed",
  single_layer_blocks: "one_side_contact",
  trays: "tray_contact",
  trays_on_racks: "tray_contact",
  packaged_units: "boxed",
  palletized_boxes: "stacked",
  palletized_blocks: "stacked",
  boxes_on_cart: "boxed",
  loose_particles: "bulk_layer",
  small_individual_units: "fully_exposed",
  bulk_on_pallet: "bulk_layer",
  bulk_container: "bulk_layer",
  boxes: "boxed",
  racks: "tray_contact",
  stacked_packages: "stacked",
  hanging_product: "fully_exposed",
};

export function calculateExposureFactor(input: any) {
  const requested = input?.surfaceExposureModel ?? input?.surface_exposure_model;
  const arrangementType = String(input?.arrangementType ?? input?.arrangement_type ?? "");
  const model = (requested || ARRANGEMENT_FALLBACKS[arrangementType] || "fully_exposed") as SurfaceExposureModel;
  const hasExplicitOrArrangement = Boolean(requested || ARRANGEMENT_FALLBACKS[arrangementType]);

  return {
    exposureFactor: EXPOSURE_VALUES[model] ?? 1,
    surfaceExposureModel: model,
    source: requested ? "surface_exposure_model" : ARRANGEMENT_FALLBACKS[arrangementType] ? "arrangement_type" : "default_fully_exposed",
    warnings: hasExplicitOrArrangement ? [] : ["Fator de exposição assumido como totalmente exposto."],
  };
}
