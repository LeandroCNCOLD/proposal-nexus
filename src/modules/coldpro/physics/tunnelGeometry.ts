import { safeNumber } from "../core/units";

export type ProductGeometry = "slab" | "rectangular_prism" | "cube" | "cylinder" | "sphere" | "irregular" | "packed_box" | "bulk";
export type SurfaceExposureModel = "fully_exposed" | "one_side_contact" | "tray_contact" | "boxed" | "stacked" | "bulk_layer";
export type AirflowSource = "manual_velocity" | "airflow_by_fans";

function positive(value: unknown) {
  const parsed = safeNumber(value, 0);
  return parsed > 0 ? parsed : 0;
}

function minPositive(values: unknown[]) {
  const valid = values.map(positive).filter((value) => value > 0);
  return valid.length ? Math.min(...valid) : 0;
}

export function calculateCharacteristicDimension(input: any) {
  const geometry = String(input?.productGeometry ?? input?.product_geometry ?? "slab") as ProductGeometry;
  let characteristicDimensionM = 0;
  let distanceToCoreM = 0;
  let source: string = geometry;

  if (geometry === "slab") {
    characteristicDimensionM = positive(input?.productThicknessM ?? input?.product_thickness_m);
    distanceToCoreM = characteristicDimensionM / 2;
    source = "slab_thickness";
  } else if (geometry === "rectangular_prism") {
    characteristicDimensionM = minPositive([input?.productLengthM ?? input?.product_length_m, input?.productWidthM ?? input?.product_width_m, input?.productHeightM ?? input?.product_height_m]);
    distanceToCoreM = characteristicDimensionM / 2;
    source = "smallest_product_dimension";
  } else if (geometry === "cube") {
    characteristicDimensionM = positive(input?.productSideM ?? input?.product_side_m);
    distanceToCoreM = characteristicDimensionM / 2;
    source = "cube_side";
  } else if (geometry === "cylinder") {
    characteristicDimensionM = minPositive([input?.productDiameterM ?? input?.product_diameter_m, input?.productLengthM ?? input?.product_length_m]);
    distanceToCoreM = positive(input?.productDiameterM ?? input?.product_diameter_m) / 2 || characteristicDimensionM / 2;
    source = "cylinder_radial_or_length";
  } else if (geometry === "sphere") {
    characteristicDimensionM = positive(input?.productDiameterM ?? input?.product_diameter_m);
    distanceToCoreM = characteristicDimensionM / 2;
    source = "sphere_diameter";
  } else if (geometry === "packed_box") {
    characteristicDimensionM = minPositive([input?.boxLengthM ?? input?.box_length_m, input?.boxWidthM ?? input?.box_width_m, input?.boxHeightM ?? input?.box_height_m]);
    distanceToCoreM = characteristicDimensionM / 2;
    source = "smallest_box_dimension";
  } else if (geometry === "bulk") {
    const arrangement = String(input?.arrangementType ?? input?.arrangement_type ?? "");
    characteristicDimensionM = arrangement.includes("particle") || arrangement.includes("loose") || arrangement.includes("individual")
      ? positive(input?.equivalentParticleDiameterM ?? input?.equivalent_particle_diameter_m) || positive(input?.bulkLayerHeightM ?? input?.bulk_layer_height_m)
      : positive(input?.bulkLayerHeightM ?? input?.bulk_layer_height_m) || positive(input?.equivalentParticleDiameterM ?? input?.equivalent_particle_diameter_m);
    distanceToCoreM = characteristicDimensionM / 2;
    source = characteristicDimensionM === positive(input?.equivalentParticleDiameterM ?? input?.equivalent_particle_diameter_m) ? "equivalent_particle_diameter" : "bulk_layer_height";
  } else {
    characteristicDimensionM = positive(input?.characteristicDimensionM ?? input?.characteristic_dimension_m ?? input?.equivalentDiameterM ?? input?.equivalent_diameter_m);
    distanceToCoreM = characteristicDimensionM / 2;
    source = "manual_characteristic_dimension";
  }

  return { characteristicDimensionM, distanceToCoreM, source };
}

export function calculateExposureFactor(input: any) {
  const model = String(input?.surfaceExposureModel ?? input?.surface_exposure_model ?? "fully_exposed") as SurfaceExposureModel;
  const values: Record<SurfaceExposureModel, number> = {
    fully_exposed: 1,
    one_side_contact: 0.8,
    tray_contact: 0.65,
    boxed: 0.35,
    stacked: 0.45,
    bulk_layer: 0.55,
  };
  return { surfaceExposureModel: model, exposureFactor: values[model] ?? 1 };
}

export function calculateAirflowThroughFreeArea(input: any) {
  const airflowSource = String(input?.airflowSource ?? input?.airflow_source ?? "manual_velocity") as AirflowSource;
  const fanAirflowM3H = positive(input?.fanAirflowM3H ?? input?.fan_airflow_m3_h);
  const width = positive(input?.tunnelCrossSectionWidthM ?? input?.tunnel_cross_section_width_m);
  const height = positive(input?.tunnelCrossSectionHeightM ?? input?.tunnel_cross_section_height_m);
  const blockageFactor = Math.min(Math.max(safeNumber(input?.blockageFactor ?? input?.blockage_factor, 0), 0), 0.95);
  const grossAreaM2 = width * height;
  const freeAreaM2 = grossAreaM2 * (1 - blockageFactor);
  const airflowM3S = fanAirflowM3H / 3600;
  const calculatedAirVelocityMS = airflowSource === "airflow_by_fans" && freeAreaM2 > 0 ? airflowM3S / freeAreaM2 : 0;
  const manualAirVelocityMS = positive(input?.airVelocityMS ?? input?.air_velocity_m_s);
  const airVelocityUsedMS = airflowSource === "airflow_by_fans" ? calculatedAirVelocityMS : manualAirVelocityMS;
  const invalidFields = airflowSource === "airflow_by_fans" && grossAreaM2 > 0 && freeAreaM2 <= 0 ? ["freeAreaM2"] : [];

  return { airflowSource, fanAirflowM3H, grossAreaM2, freeAreaM2, blockageFactor, calculatedAirVelocityMS, airVelocityUsedMS, invalidFields };
}
