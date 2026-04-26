import { safeNumber } from "../core/units";

export type ProductGeometry =
  | "slab"
  | "rectangular_prism"
  | "cube"
  | "cylinder"
  | "sphere"
  | "packed_box"
  | "bulk"
  | "irregular";

type GeometryResult = {
  characteristicDimensionM: number | null;
  distanceToCoreM: number | null;
  source: string;
  warnings: string[];
  missingFields: string[];
};

function positive(value: unknown): number {
  const parsed = safeNumber(value, 0);
  return parsed > 0 ? parsed : 0;
}

function smallest(values: unknown[]): number | null {
  const valid = values.map(positive).filter((value) => value > 0);
  return valid.length > 0 ? Math.min(...valid) : null;
}

function result(characteristicDimensionM: number | null, source: string, missingFields: string[] = [], distanceToCoreM: number | null = characteristicDimensionM ? characteristicDimensionM / 2 : null): GeometryResult {
  return { characteristicDimensionM, distanceToCoreM, source, warnings: [], missingFields };
}

export function calculateCharacteristicDimension(input: any): GeometryResult {
  let geometry = input?.productGeometry ?? input?.product_geometry;
  if (!geometry) {
    if (positive(input?.productThicknessM ?? input?.product_thickness_m) > 0) geometry = "slab";
    else if (input?.isStatic && smallest([input?.palletLengthM, input?.palletWidthM, input?.palletHeightM])) {
      const dim = smallest([input?.palletLengthM, input?.palletWidthM, input?.palletHeightM]);
      return result(dim, "static_pallet_or_load_dimension");
    } else {
      return result(null, "missing_product_geometry", ["geometria do produto"]);
    }
  }

  if (geometry === "slab") {
    const thickness = positive(input?.productThicknessM ?? input?.product_thickness_m);
    return thickness > 0 ? result(thickness, "slab_thickness") : result(null, "slab_thickness", ["espessura do produto"]);
  }

  if (geometry === "rectangular_prism") {
    const dimensions = [input?.productLengthM ?? input?.product_length_m, input?.productWidthM ?? input?.product_width_m, input?.productHeightM ?? input?.product_height_m];
    const dim = smallest(dimensions);
    const missing = dimensions.some((value) => positive(value) <= 0);
    return !missing && dim ? result(dim, "smallest_rectangular_prism_dimension") : result(dim, "smallest_rectangular_prism_dimension", ["dimensões do bloco retangular"]);
  }

  if (geometry === "cube") {
    const side = positive(input?.productSideM ?? input?.product_side_m);
    return side > 0 ? result(side, "cube_side") : result(null, "cube_side", ["lado do cubo"]);
  }

  if (geometry === "cylinder") {
    const diameter = positive(input?.productDiameterM ?? input?.product_diameter_m);
    const length = positive(input?.productLengthM ?? input?.product_length_m);
    const dim = smallest([diameter, length]);
    const missing = [diameter <= 0 ? "diâmetro do cilindro" : "", length <= 0 ? "comprimento do cilindro" : ""].filter(Boolean);
    return missing.length === 0 && dim ? result(dim, "smallest_cylinder_dimension", [], diameter / 2) : result(dim, "smallest_cylinder_dimension", missing, diameter > 0 ? diameter / 2 : null);
  }

  if (geometry === "sphere") {
    const diameter = positive(input?.productDiameterM ?? input?.product_diameter_m);
    return diameter > 0 ? result(diameter, "sphere_diameter") : result(null, "sphere_diameter", ["diâmetro da esfera"]);
  }

  if (geometry === "packed_box") {
    const dimensions = [input?.boxLengthM ?? input?.box_length_m, input?.boxWidthM ?? input?.box_width_m, input?.boxHeightM ?? input?.box_height_m];
    const dim = smallest(dimensions);
    const missing = dimensions.some((value) => positive(value) <= 0);
    return !missing && dim ? result(dim, "smallest_box_dimension") : result(dim, "smallest_box_dimension", ["dimensões da caixa"]);
  }

  if (geometry === "bulk") {
    const particle = positive(input?.equivalentParticleDiameterM ?? input?.equivalent_particle_diameter_m);
    const layer = positive(input?.bulkLayerHeightM ?? input?.bulk_layer_height_m);
    if (particle > 0) return result(particle, "equivalent_particle_diameter");
    if (layer > 0) return result(layer, "bulk_layer_height");
    return result(null, "bulk_missing_dimension", ["altura da camada ou diâmetro equivalente"]);
  }

  if (geometry === "irregular") {
    const manual = positive(input?.characteristicDimensionM ?? input?.characteristic_dimension_m);
    return manual > 0 ? result(manual, "manual_characteristic_dimension") : result(null, "manual_characteristic_dimension", ["dimensão característica manual"]);
  }

  return result(null, "unknown_product_geometry", ["geometria do produto"]);
}
