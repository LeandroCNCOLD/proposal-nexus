import * as React from "react";
import { Box, DraftingCompass, Droplets, Grid3X3, Save, ShieldCheck, Thermometer } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ColdProField,
  ColdProInput,
  ColdProSelect,
} from "./ColdProField";
import {
  ColdProCalculatedInfo,
  ColdProFieldHint,
  ColdProFormSection,
  ColdProValidationMessage,
  fmtColdPro,
  numberOrNull,
} from "./ColdProFormPrimitives";
import { calculateFaceTransmission, calculateSeedDehumidificationLoad } from "@/features/coldpro/coldpro-calculation.engine";

type Props = {
  environment: any;
  insulationMaterials: any[];
  thermalMaterials?: any[];
  onSave: (patch: Record<string, unknown>) => void;
};

type ChamberLayout = "rectangular" | "l_shape" | "irregular_l" | "custom_polygon";

type Geometry = {
  local: "__GEOMETRY__";
  cutout_length_m?: number | null;
  cutout_width_m?: number | null;
};

const APPLICATIONS = [
  { value: "cold_room", label: "Câmara resfriados" },
  { value: "freezer_room", label: "Câmara congelados" },
  { value: "antechamber", label: "Antecâmara" },
  { value: "blast_freezer", label: "Túnel congelamento" },
  { value: "cooling_tunnel", label: "Túnel resfriamento" },
  { value: "seed_storage", label: "Câmara de sementes" },
  { value: "climatized_room", label: "Ambiente climatizado" },
];

const CHAMBER_LAYOUTS: Array<{ value: ChamberLayout; label: string; description: string; walls: number }> = [
  { value: "rectangular", label: "Retangular", description: "4 paredes, teto e piso", walls: 4 },
  { value: "l_shape", label: "Formato em L", description: "6 paredes com recorte", walls: 6 },
  { value: "irregular_l", label: "Irregular", description: "8 laterais com recorte duplo", walls: 8 },
  { value: "custom_polygon", label: "Personalizada", description: "Quantidade manual de paredes", walls: 4 },
];

const INSULATION_THICKNESS_OPTIONS_MM = [50, 75, 100, 120, 150, 200];
const SOIL_TEMPERATURE_REGIONS = [
  { value: "sul", label: "Sul", range: "16 – 18°C", temp: 17 },
  { value: "sudeste", label: "Sudeste", range: "18 – 22°C", temp: 20 },
  { value: "centro_oeste", label: "Centro-Oeste", range: "20 – 24°C", temp: 22 },
  { value: "nordeste", label: "Nordeste", range: "22 – 26°C", temp: 24 },
];
const SOLAR_FACE_OPTIONS = [
  { value: "", label: "Sem sol direto" },
  { value: "PAREDE 1", label: "Parede 1" },
  { value: "PAREDE 2", label: "Parede 2" },
  { value: "PAREDE 3", label: "Parede 3" },
  { value: "PAREDE 4", label: "Parede 4" },
  { value: "TETO", label: "Teto" },
];

const GLASS_TYPE_OPTIONS = [
  { value: "none", label: "Sem vidro", u: 0, solarFactor: 0 },
  { value: "simple", label: "Vidro simples", u: 5.8, solarFactor: 0.85 },
  { value: "double", label: "Vidro duplo", u: 2.8, solarFactor: 0.75 },
  { value: "triple", label: "Vidro triplo", u: 1.8, solarFactor: 0.65 },
  { value: "low_e_double", label: "Vidro low-e duplo", u: 1.6, solarFactor: 0.4 },
  { value: "heated_refrigerated", label: "Vidro frigorífico aquecido", u: 2.5, solarFactor: 0.55 },
];

const SOLAR_RADIATION_OPTIONS = [
  { value: 0, label: "Sem sol" },
  { value: 150, label: "Sol moderado" },
  { value: 300, label: "Sol forte" },
  { value: 500, label: "Sol crítico" },
];

const FLOOR_CONDITION_OPTIONS = [
  { value: "insulated", label: "Piso isolado" },
  { value: "soil", label: "Sem isolamento / contato com solo" },
  { value: "lower_room", label: "Sobre ambiente inferior" },
];

const UNINSULATED_FLOOR_U_VALUE_W_M2K = 1.75;
const DEFAULT_SOLAR_FACE = "TETO";
const DEFAULT_SOIL_TEMP_C = 20;
const W_TO_KCAL_H = 0.859845;
const KCAL_H_PER_TR = 3024;

const LEGACY_LAYOUTS = new Set(["industrial", "modular", "climatized_storage", "blast_freezer", "cooling_tunnel", "climatized_room"]);

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLayout(value: unknown): ChamberLayout {
  const current = String(value ?? "rectangular");
  if (current === "l_shape" || current === "irregular_l" || current === "custom_polygon" || current === "rectangular") return current;
  if (current === "triangular") return "irregular_l";
  if (LEGACY_LAYOUTS.has(current)) return "rectangular";
  return "rectangular";
}

function wallCountForLayout(layout: ChamberLayout, manualCount: unknown) {
  if (layout === "custom_polygon") return Math.max(3, Math.min(12, Math.round(toNumber(manualCount) || 4)));
  return CHAMBER_LAYOUTS.find((item) => item.value === layout)?.walls ?? 4;
}

function getGeometry(value: unknown): Geometry {
  const faces = Array.isArray(value) ? value : [];
  const existing = faces.find((face: any) => face?.local === "__GEOMETRY__") ?? {};
  return {
    local: "__GEOMETRY__",
    cutout_length_m: existing.cutout_length_m ?? null,
    cutout_width_m: existing.cutout_width_m ?? null,
  };
}

function getFloorArea(layout: ChamberLayout, length: number, width: number, geometry: Geometry, constructionFaces?: any[]) {
  const wallLengths = (constructionFaces ?? []).filter((face: any) => String(face?.local ?? "").startsWith("PAREDE")).map((face: any) => toNumber(face.wall_length_m));
  const polygonDirections: Record<ChamberLayout, Array<[number, number]>> = {
    rectangular: [[1, 0], [0, 1], [-1, 0], [0, -1]],
    l_shape: [[1, 0], [0, 1], [-1, 0], [0, 1], [-1, 0], [0, -1]],
    irregular_l: [[1, 0], [0, 1], [-1, 0], [0, 1], [-1, 0], [0, 1], [-1, 0], [0, -1]],
    custom_polygon: [],
  };
  const directions = polygonDirections[layout];
  if (directions.length && wallLengths.length === directions.length && wallLengths.every((item) => item > 0)) {
    let x = 0;
    let y = 0;
    const points = [[x, y]];
    directions.forEach(([dx, dy], index) => {
      x += dx * wallLengths[index];
      y += dy * wallLengths[index];
      points.push([x, y]);
    });
    const area = Math.abs(points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + point[0] * next[1] - next[0] * point[1];
    }, 0)) / 2;
    if (area > 0) return area;
  }
  if (layout === "irregular_l") {
    const cutoutLength = Math.min(length, Math.max(0, toNumber(geometry.cutout_length_m)));
    const cutoutWidth = Math.min(width, Math.max(0, toNumber(geometry.cutout_width_m)));
    return Math.max(0, (length * width) - (cutoutLength * cutoutWidth));
  }
  if (layout === "l_shape") {
    const cutoutLength = Math.min(length, Math.max(0, toNumber(geometry.cutout_length_m)));
    const cutoutWidth = Math.min(width, Math.max(0, toNumber(geometry.cutout_width_m)));
    return Math.max(0, (length * width) - (cutoutLength * cutoutWidth));
  }
  if (layout === "custom_polygon") {
    const ceiling = constructionFaces?.find((face: any) => face?.local === "TETO");
    return Math.max(0, toNumber(ceiling?.panel_area_m2) || (length * width));
  }
  return Math.max(0, length * width);
}

function getWallLengths(layout: ChamberLayout, length: number, width: number, geometry: Geometry, count: number) {
  if (layout === "l_shape") {
    const cutoutLength = Math.min(length, Math.max(0, toNumber(geometry.cutout_length_m)));
    const cutoutWidth = Math.min(width, Math.max(0, toNumber(geometry.cutout_width_m)));
    return [length, Math.max(0, width - cutoutWidth), cutoutLength, cutoutWidth, Math.max(0, length - cutoutLength), width];
  }
  if (layout === "irregular_l") {
    const cutoutLength = Math.min(length, Math.max(0, toNumber(geometry.cutout_length_m)));
    const cutoutWidth = Math.min(width, Math.max(0, toNumber(geometry.cutout_width_m)));
    return [length, Math.max(0, width - cutoutWidth), cutoutLength, cutoutWidth, Math.max(0, cutoutLength), Math.max(0, width - cutoutWidth), Math.max(0, length - cutoutLength), width];
  }
  if (layout === "rectangular") return [length, width, length, width];
  return Array.from({ length: count }, () => 0);
}

function makeInsulationLayer(material: any, thicknessMm: unknown) {
  return {
    material_id: material?.rawId ?? material?.id ?? null,
    material_name: material?.name ?? material?.material_name ?? "Isolamento",
    category: "insulation",
    thickness_m: Math.max(0, toNumber(thicknessMm)) / 1000,
    conductivity_w_mk: toNumber(material?.conductivity_w_m_k ?? material?.thermal_conductivity_w_mk),
    position: 0,
  };
}

function applyLayerToFace(face: any, layer: any) {
  const layers = layer.thickness_m > 0 && layer.conductivity_w_mk > 0 ? [layer] : [];
  return { ...face, layers, u_value_w_m2k: calculateUValue(layers), material_thickness: layers.length ? `${layer.material_name} ${toNumber(layer.thickness_m) * 1000} mm` : face.material_thickness };
}

function applyUninsulatedFloorToFace(face: any) {
  return { ...face, layers: [], u_value_w_m2k: UNINSULATED_FLOOR_U_VALUE_W_M2K, material_thickness: "Piso sem isolamento" };
}

function prepareFaceForCalculation(face: any, hasFloorInsulation: boolean) {
  const prepared = face.local === "PISO" && !hasFloorInsulation ? applyUninsulatedFloorToFace(face) : face;
  const hasGlass = Boolean(prepared.has_glass) && toNumber(prepared.glass_area_m2) > 0;
  return {
    ...prepared,
    glass_area_m2: hasGlass ? prepared.glass_area_m2 : 0,
    glass_type: hasGlass ? (prepared.glass_type ?? "simple") : "none",
    solar_radiation_w_m2: hasGlass ? toNumber(prepared.solar_radiation_w_m2) : 0,
  };
}

function describeLayer(layer: any) {
  const uValue = calculateUValue(layer?.thickness_m > 0 && layer?.conductivity_w_mk > 0 ? [layer] : []);
  return {
    uValue,
    resistance: uValue > 0 ? 1 / uValue : 0,
    conductivity: toNumber(layer?.conductivity_w_mk),
  };
}

function normalizeInsulationOption(material: any, source: "legacy" | "thermal") {
  const id = `${source}:${material.id}`;
  return {
    id,
    source,
    rawId: material.id,
    name: material.name ?? material.material_name ?? "Isolante",
    conductivity_w_m_k: material.conductivity_w_m_k ?? material.thermal_conductivity_w_mk,
    conductivity_kcal_h_m_c: material.conductivity_kcal_h_m_c,
    default_thickness_mm: material.default_thickness_mm ?? material.typical_thickness_mm,
  };
}

function calculateUValue(layers: any[]) {
  const valid = layers.filter((layer) => toNumber(layer.thickness_m) > 0 && toNumber(layer.conductivity_w_mk) > 0);
  const rLayers = valid.reduce((sum, layer) => sum + toNumber(layer.thickness_m) / toNumber(layer.conductivity_w_mk), 0);
  const rTotal = 0.12 + rLayers + 0.08;
  return rTotal > 0 ? 1 / rTotal : 0;
}

function normalizeFaces(value: unknown, layout: ChamberLayout, wallCount: number, length: number, width: number, height: number, geometry: Geometry) {
  const faces = Array.isArray(value) ? value : [];
  const floorArea = getFloorArea(layout, length, width, geometry, faces);
  const wallLengths = getWallLengths(layout, length, width, geometry, wallCount);
  const labels = ["TETO", ...Array.from({ length: wallCount }, (_, index) => `PAREDE ${index + 1}`), "PISO"];
  const hasSelectedSolarFace = faces.some((face: any) => String(face?.solar_orientation ?? "") === "Sol direto");

  return labels.map((local) => {
    const existing = faces.find((face: any) => face?.local === local || face?.local === local.replace("PAREDE ", "PAREDE 0")) ?? {};
    const wallIndex = local.startsWith("PAREDE") ? Number(local.replace("PAREDE", "").trim()) - 1 : -1;
    const wallLength = wallIndex >= 0 ? (toNumber(existing.wall_length_m) || wallLengths[wallIndex] || 0) : null;
    const wallHeight = wallIndex >= 0 ? (toNumber(existing.wall_height_m) || height || 0) : null;
    const calculatedArea = wallIndex >= 0 ? toNumber(wallLength) * toNumber(wallHeight) : floorArea;
    const existingArea = toNumber(existing.panel_area_m2);
    const shouldUseCalculatedArea = local === "TETO" || local === "PISO" || existingArea <= 0;

    return {
      local,
      wall_length_m: wallLength,
      wall_height_m: wallHeight,
      material_thickness: existing.material_thickness ?? "",
      panel_area_m2: shouldUseCalculatedArea ? calculatedArea : existingArea,
      layers: Array.isArray(existing.layers) ? existing.layers : [],
      u_value_w_m2k: existing.u_value_w_m2k ?? null,
      transmission_w: existing.transmission_w ?? null,
      transmission_kcal_h: existing.transmission_kcal_h ?? null,
      external_temp_c: existing.external_temp_c ?? null,
      solar_orientation: existing.solar_orientation ?? (!hasSelectedSolarFace && local === DEFAULT_SOLAR_FACE ? "Sol direto" : ""),
      color: existing.color ?? "",
      glass_area_m2: existing.glass_area_m2 ?? 0,
      has_glass: existing.has_glass ?? toNumber(existing.glass_area_m2) > 0,
      glass_type: (existing.has_glass ?? toNumber(existing.glass_area_m2) > 0) ? (existing.glass_type ?? "simple") : "none",
      solar_radiation_w_m2: existing.solar_radiation_w_m2 ?? (!hasSelectedSolarFace && local === DEFAULT_SOLAR_FACE ? 150 : 0),
      floor_condition: existing.floor_condition ?? (local === "PISO" ? "soil" : null),
      door_area_m2: 0,
    };
  });
}

function ChamberShapePreview({ layout }: { layout: ChamberLayout }) {
  const points = {
    rectangular: "25,25 135,25 135,95 25,95",
    l_shape: "25,25 135,25 135,58 92,58 92,95 25,95",
    irregular_l: "25,25 135,25 135,45 118,45 118,58 92,58 92,95 25,95",
    custom_polygon: "55,25 125,38 135,82 92,98 35,82 25,42",
  }[layout];

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <svg viewBox="0 0 160 120" role="img" aria-label="Formato da câmara" className="h-28 w-full">
        <polygon points={points} className="fill-primary/10 stroke-primary" strokeWidth="4" />
        <g className="fill-primary text-[10px] font-semibold">
          <circle cx="25" cy="25" r="3" />
          <circle cx="135" cy="25" r="3" />
          <circle cx="135" cy="95" r="3" />
          <circle cx="25" cy="95" r="3" />
        </g>
      </svg>
    </div>
  );
}

export function ColdProEnvironmentForm({ environment, insulationMaterials, thermalMaterials = [], onSave }: Props) {
  const [form, setForm] = React.useState<any>(environment);
  const [floorInsulationMaterialId, setFloorInsulationMaterialId] = React.useState<string>(environment?.insulation_material_id ?? "");
  const [panelMaterialKey, setPanelMaterialKey] = React.useState<string>(environment?.insulation_material_id ? `legacy:${environment.insulation_material_id}` : "");
  const [soilRegion, setSoilRegion] = React.useState("");
  React.useEffect(() => setForm(environment), [environment]);
  React.useEffect(() => {
    const legacyKey = environment?.insulation_material_id ? `legacy:${environment.insulation_material_id}` : "";
    setFloorInsulationMaterialId(legacyKey);
    setPanelMaterialKey(legacyKey);
  }, [environment]);

  const isClimatized = form?.environment_type === "climatized_room";
  const isSeed = form?.environment_type === "seed_storage";

  const set = (key: string, value: unknown) => setForm((prev: any) => ({ ...prev, [key]: value }));

  const num = (key: string) => ({
    type: "number" as const,
    step: "0.0001",
    value: form?.[key] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, numberOrNull(e.target.value)),
  });

  const setDimension = (key: string, value: unknown) => {
    const nextValue = numberOrNull(value);
    setForm((prev: any) => {
      const next = { ...prev, [key]: nextValue };
      if (key === "dimension_a_m") next.length_m = nextValue;
      if (key === "dimension_b_m") next.width_m = nextValue;
      if (key === "height_m") next.height_m = nextValue;
      const nextLayout = normalizeLayout(next?.chamber_layout_type);
      const nextWallCount = wallCountForLayout(nextLayout, next?.wall_count);
      const nextGeometry = getGeometry(next?.construction_faces);
      const normalized = normalizeFaces(next?.construction_faces, nextLayout, nextWallCount, toNumber(next?.length_m), toNumber(next?.width_m), toNumber(next?.height_m), nextGeometry);
      next.construction_faces = [
        ...normalized.map((face) => {
          if (key !== "height_m" || !face.local.startsWith("PAREDE")) return face;
          return { ...face, wall_height_m: nextValue, panel_area_m2: toNumber(face.wall_length_m) * toNumber(nextValue) };
        }),
        nextGeometry,
      ];
      return next;
    });
  };

  const layout = normalizeLayout(form?.chamber_layout_type);
  const wallCount = wallCountForLayout(layout, form?.wall_count);
  const length = toNumber(form?.length_m);
  const width = toNumber(form?.width_m);
  const height = toNumber(form?.height_m);
  const geometry = React.useMemo(() => getGeometry(form?.construction_faces), [form?.construction_faces]);
  const constructionFaces = React.useMemo(() => normalizeFaces(form?.construction_faces, layout, wallCount, length, width, height, geometry), [form?.construction_faces, layout, wallCount, length, width, height, geometry]);
  const finalizedConstructionFaces = React.useMemo(() => constructionFaces.map((face) => prepareFaceForCalculation(face, Boolean(form?.has_floor_insulation))), [constructionFaces, form?.has_floor_insulation]);
  const insulationOptions = React.useMemo(() => {
    const legacy = insulationMaterials.map((material) => normalizeInsulationOption(material, "legacy"));
    const thermal = thermalMaterials.filter((material) => material.is_insulation).map((material) => normalizeInsulationOption(material, "thermal"));
    const seen = new Set<string>();
    return [...legacy, ...thermal].filter((material) => {
      const key = material.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [insulationMaterials, thermalMaterials]);
  const selectedInsulation = insulationOptions.find((item) => item.id === panelMaterialKey) ?? insulationOptions[0];
  const selectedFloorInsulation = insulationOptions.find((item) => item.id === floorInsulationMaterialId) ?? selectedInsulation;
  const wallLayerInfo = describeLayer(makeInsulationLayer(selectedInsulation, form?.wall_thickness_mm));
  const ceilingLayerInfo = describeLayer(makeInsulationLayer(selectedInsulation, form?.ceiling_thickness_mm));
  const floorLayerInfo = describeLayer(makeInsulationLayer(selectedFloorInsulation, form?.floor_thickness_mm));

  const geometricFloorArea = getFloorArea(layout, length, width, geometry, constructionFaces);
  const floorFace = finalizedConstructionFaces.find((face) => face.local === "PISO");
  const ceilingFace = finalizedConstructionFaces.find((face) => face.local === "TETO");
  const floorCondition = String(floorFace?.floor_condition ?? (form?.has_floor_insulation ? "insulated" : "soil"));
  const floorArea = toNumber(floorFace?.panel_area_m2) || geometricFloorArea;
  const ceilingArea = toNumber(ceilingFace?.panel_area_m2) || geometricFloorArea;
  const volume = floorArea * height;
  const deltaT = toNumber(form?.external_temp_c) - toNumber(form?.internal_temp_c);
  const totalPanelArea = finalizedConstructionFaces.reduce((sum, face) => sum + toNumber(face.panel_area_m2), 0);
  const totalGlassArea = finalizedConstructionFaces.reduce((sum, face) => sum + toNumber(face.glass_area_m2), 0);
  const wallPanelArea = finalizedConstructionFaces.filter((face) => face.local.startsWith("PAREDE")).reduce((sum, face) => sum + toNumber(face.panel_area_m2), 0);
  const dimensionError = layout !== "custom_polygon" && (length <= 0 || width <= 0 || height <= 0);
  const customDimensionError = layout === "custom_polygon" && (floorArea <= 0 || height <= 0 || wallCount < 3);
  const hoursError = toNumber(form?.operation_hours_day) < 0 || toNumber(form?.operation_hours_day) > 24 || toNumber(form?.compressor_runtime_hours_day) < 0 || toNumber(form?.compressor_runtime_hours_day) > 24;
  const safetyError = toNumber(form?.safety_factor_percent) < 0;
  const canSave = !dimensionError && !customDimensionError && !hoursError && !safetyError && String(form?.name ?? "").trim().length > 0;

  const setLayout = (nextLayout: ChamberLayout) => {
    const nextWallCount = wallCountForLayout(nextLayout, form?.wall_count);
    const nextGeometry = getGeometry(form?.construction_faces);
    setForm((prev: any) => ({
      ...prev,
      chamber_layout_type: nextLayout,
      wall_count: nextWallCount,
      construction_faces: [...normalizeFaces(prev?.construction_faces, nextLayout, nextWallCount, toNumber(prev?.length_m), toNumber(prev?.width_m), toNumber(prev?.height_m), nextGeometry), nextGeometry],
    }));
  };

  const setFace = (index: number, key: string, value: unknown) => {
    const next = normalizeFaces(form?.construction_faces, layout, wallCount, length, width, height, geometry);
    const updated = { ...next[index], [key]: value };
    if ((key === "wall_length_m" || key === "wall_height_m") && updated.local.startsWith("PAREDE")) {
      updated.panel_area_m2 = toNumber(updated.wall_length_m) * toNumber(updated.wall_height_m);
    }
    next[index] = updated;
    if (layout === "rectangular" && key === "wall_length_m") {
      const oppositeLocal = updated.local === "PAREDE 1" ? "PAREDE 3" : updated.local === "PAREDE 3" ? "PAREDE 1" : updated.local === "PAREDE 2" ? "PAREDE 4" : updated.local === "PAREDE 4" ? "PAREDE 2" : "";
      const oppositeIndex = next.findIndex((face) => face.local === oppositeLocal);
      if (oppositeIndex >= 0 && next[oppositeIndex]) {
        next[oppositeIndex] = { ...next[oppositeIndex], wall_length_m: numberOrNull(value) ?? 0, panel_area_m2: (numberOrNull(value) ?? 0) * toNumber(next[oppositeIndex].wall_height_m) };
      }
    }
    setForm((prev: any) => ({
      ...prev,
      ...(updated.local === "PAREDE 1" && key === "wall_length_m" ? { length_m: numberOrNull(value), dimension_a_m: numberOrNull(value) } : {}),
      ...(updated.local === "PAREDE 2" && key === "wall_length_m" ? { width_m: numberOrNull(value), dimension_b_m: numberOrNull(value) } : {}),
      construction_faces: [...next, geometry],
    }));
  };

  const applyInsulationToFaces = (materialKey = panelMaterialKey, wallThickness = form?.wall_thickness_mm, ceilingThickness = form?.ceiling_thickness_mm, floorThickness = form?.floor_thickness_mm, floorMaterialKey = floorInsulationMaterialId) => {
    const wallMaterial = insulationOptions.find((item) => item.id === materialKey) ?? selectedInsulation;
    const floorMaterial = insulationOptions.find((item) => item.id === floorMaterialKey) ?? wallMaterial;
    const next = normalizeFaces(form?.construction_faces, layout, wallCount, length, width, height, geometry).map((face) => {
      if (face.local === "PISO" && !form?.has_floor_insulation) return applyUninsulatedFloorToFace(face);
      if (face.local === "PISO") return applyLayerToFace(face, makeInsulationLayer(floorMaterial, floorThickness));
      if (face.local === "TETO") return applyLayerToFace(face, makeInsulationLayer(wallMaterial, ceilingThickness));
      return applyLayerToFace(face, makeInsulationLayer(wallMaterial, wallThickness));
    });
    set("construction_faces", [...next, geometry]);
  };

  const setInsulationMaterial = (materialKey: string) => {
    const material = insulationOptions.find((item) => item.id === materialKey);
    setPanelMaterialKey(materialKey);
    set("insulation_material_id", material?.source === "legacy" ? material.rawId : null);
    if (!floorInsulationMaterialId) setFloorInsulationMaterialId(materialKey);
    applyInsulationToFaces(materialKey, form?.wall_thickness_mm, form?.ceiling_thickness_mm, form?.floor_thickness_mm, floorInsulationMaterialId || materialKey);
  };

  const setInsulationThickness = (key: string, value: unknown) => {
    const thickness = numberOrNull(value);
    if (key === "wall_thickness_mm") {
      const shouldSyncCeiling = !form?.ceiling_thickness_mm || toNumber(form?.ceiling_thickness_mm) === toNumber(form?.wall_thickness_mm);
      setForm((prev: any) => ({ ...prev, wall_thickness_mm: thickness, ...(shouldSyncCeiling ? { ceiling_thickness_mm: thickness } : {}) }));
      applyInsulationToFaces(panelMaterialKey, thickness, shouldSyncCeiling ? thickness : form?.ceiling_thickness_mm, form?.floor_thickness_mm, floorInsulationMaterialId);
      return;
    }
    set(key, thickness);
    applyInsulationToFaces(panelMaterialKey, form?.wall_thickness_mm, key === "ceiling_thickness_mm" ? thickness : form?.ceiling_thickness_mm, key === "floor_thickness_mm" ? thickness : form?.floor_thickness_mm, floorInsulationMaterialId);
  };

  const setFloorInsulated = (enabled: boolean) => {
    setFloorCondition(enabled ? "insulated" : "soil");
  };

  const setFloorCondition = (condition: string) => {
    const enabled = condition === "insulated";
    const floorIndex = constructionFaces.findIndex((face) => face.local === "PISO");
    const next = [...constructionFaces];
    if (floorIndex >= 0) {
      const layer = makeInsulationLayer(selectedFloorInsulation, form?.floor_thickness_mm);
      const baseFace = {
        ...next[floorIndex],
        floor_condition: condition,
        external_temp_c: condition === "soil" ? toNumber(form?.floor_temp_c) || DEFAULT_SOIL_TEMP_C : (condition === "lower_room" ? form?.floor_temp_c : form?.external_temp_c),
      };
      next[floorIndex] = enabled ? applyLayerToFace(baseFace, layer) : applyUninsulatedFloorToFace(baseFace);
    }
    setForm((prev: any) => ({
      ...prev,
      has_floor_insulation: enabled,
      floor_temp_c: condition === "soil" ? (toNumber(prev?.floor_temp_c) || DEFAULT_SOIL_TEMP_C) : prev?.floor_temp_c,
      construction_faces: [...next, geometry],
    }));
  };

  const setSoilTemperatureRegion = (regionValue: string) => {
    setSoilRegion(regionValue);
    const region = SOIL_TEMPERATURE_REGIONS.find((item) => item.value === regionValue);
    if (region) {
      set("floor_temp_c", region.temp);
      const floorIndex = constructionFaces.findIndex((face) => face.local === "PISO");
      if (floorIndex >= 0) setFace(floorIndex, "external_temp_c", region.temp);
    }
  };

  const setSolarFace = (faceName: string) => {
    set("west_face_insolation", faceName !== "");
    const next = constructionFaces.map((face) => ({
      ...face,
      solar_orientation: faceName === face.local ? "Sol direto" : "",
      solar_radiation_w_m2: faceName === face.local ? (toNumber(face.solar_radiation_w_m2) || 150) : 0,
    }));
    set("construction_faces", [...next, geometry]);
  };

  const setGlassEnabled = (index: number, enabled: boolean) => {
    const next = normalizeFaces(form?.construction_faces, layout, wallCount, length, width, height, geometry);
    const face = next[index];
    next[index] = {
      ...face,
      has_glass: enabled,
      glass_area_m2: enabled ? face.glass_area_m2 : 0,
      glass_type: enabled ? (face.glass_type && face.glass_type !== "none" ? face.glass_type : "simple") : "none",
      solar_radiation_w_m2: enabled ? toNumber(face.solar_radiation_w_m2) : 0,
    };
    set("construction_faces", [...next, geometry]);
  };

  const displayedExternalTemp = (face: any) => {
    if (face.external_temp_c !== null && face.external_temp_c !== undefined) return face.external_temp_c;
    if (face.local !== "PISO") return form?.external_temp_c;
    if (String(face.floor_condition ?? floorCondition) === "soil") return form?.floor_temp_c ?? DEFAULT_SOIL_TEMP_C;
    if (String(face.floor_condition ?? floorCondition) === "lower_room") return form?.floor_temp_c;
    return form?.external_temp_c;
  };

  const currentSolarFace = constructionFaces.find((face) => face.solar_orientation === "Sol direto" || toNumber(face.solar_radiation_w_m2) > 0)?.local ?? "";
  const solarAdjustedConstructionFaces = React.useMemo(() => finalizedConstructionFaces.map((face) => ({
    ...face,
    solar_orientation: face.local === currentSolarFace && toNumber(face.solar_radiation_w_m2) > 0 ? "Sol direto" : "",
  })), [finalizedConstructionFaces, currentSolarFace]);
  const faceCalculationEnv = { ...form, construction_faces: solarAdjustedConstructionFaces, chamber_layout_type: layout, wall_count: wallCount };
  const transmissionPreviewRows = constructionFaces.map((face, index) => {
    const hasGlass = Boolean(face.has_glass) && toNumber(face.glass_area_m2) > 0;
    const preparedFace = {
      ...prepareFaceForCalculation(face, Boolean(form?.has_floor_insulation)),
      solar_orientation: face.local === currentSolarFace && toNumber(face.solar_radiation_w_m2) > 0 ? "Sol direto" : "",
    };
    const load = calculateFaceTransmission({
      ...preparedFace,
      external_temp_c: displayedExternalTemp(preparedFace),
      glass_area_m2: hasGlass ? preparedFace.glass_area_m2 : 0,
      glass_type: hasGlass ? preparedFace.glass_type : "none",
      solar_radiation_w_m2: hasGlass ? preparedFace.solar_radiation_w_m2 : 0,
    }, faceCalculationEnv as any);
    return { face, index, isWall: face.local.startsWith("PAREDE"), hasGlass, preparedFace, load };
  });
  const transmissionTotals = transmissionPreviewRows.reduce((acc, row) => {
    acc.w += toNumber((row.load as any).transmission_w);
    acc.glassW += toNumber((row.load as any).glass_transmission_w) + toNumber((row.load as any).glass_solar_w);
    return acc;
  }, { w: 0, glassW: 0 });
  const transmissionTotalKcalH = transmissionTotals.w * W_TO_KCAL_H;
  const transmissionTotalKw = transmissionTotals.w / 1000;
  const transmissionTotalTr = transmissionTotalKcalH / KCAL_H_PER_TR;
  const seedDehumidificationPreview = calculateSeedDehumidificationLoad({ ...form, volume_m3: volume } as any);

  return (
    <div className="min-w-0 rounded-xl border bg-background p-3 shadow-sm sm:p-5">
      <div className="mb-5 flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Ambiente</h2>
          <p className="mt-1 text-sm text-muted-foreground">Dimensões, geometria da câmara, temperatura, umidade e isolamento do espaço refrigerado.</p>
        </div>
      </div>

      <Tabs defaultValue="gerais" className="w-full">
        <TabsList className="mb-4 flex h-auto w-full justify-start gap-1 overflow-x-auto p-1">
          <TabsTrigger value="gerais">Dados gerais</TabsTrigger>
          <TabsTrigger value="dimensoes">Dimensões, condições e isolamento</TabsTrigger>
        </TabsList>

        <TabsContent value="gerais">
          <ColdProFormSection title="Dados gerais" description="Identifique o ambiente e defina o regime diário de operação." icon={<Box className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
              <div>
                <ColdProField label="Nome do ambiente">
                  <ColdProInput type="text" value={form?.name ?? ""} onChange={(e) => set("name", e.target.value)} className="text-left tabular-nums" />
                  <ColdProValidationMessage tone="error">{String(form?.name ?? "").trim() ? "" : "Informe um nome para o ambiente."}</ColdProValidationMessage>
                </ColdProField>
                <ColdProField label="Tipo de aplicação">
                  <ColdProSelect value={form?.environment_type ?? "cold_room"} onChange={(e) => set("environment_type", e.target.value)}>
                    {APPLICATIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </ColdProSelect>
                </ColdProField>
              </div>
              <div>
                <ColdProField label="Operação diária" unit="h/dia">
                  <ColdProInput {...num("operation_hours_day")} />
                </ColdProField>
                <ColdProField label="Tempo compressor" unit="h/dia">
                  <ColdProInput {...num("compressor_runtime_hours_day")} />
                  <ColdProValidationMessage tone="error">{hoursError ? "Horas devem estar entre 0 e 24." : ""}</ColdProValidationMessage>
                </ColdProField>
              </div>
            </div>
          </ColdProFormSection>
        </TabsContent>

        <TabsContent value="dimensoes">
          <div className="space-y-5">
            <ColdProFormSection title="Dados psicrométricos" description="Condições base usadas no cálculo térmico da câmara." icon={<Thermometer className="h-4 w-4" />}>
              <div className="grid gap-x-10 md:grid-cols-2 xl:grid-cols-3">
                <ColdProField label="Temp. externa" unit="°C"><ColdProInput {...num("external_temp_c")} /></ColdProField>
                <ColdProField label="Temp. interna" unit="°C"><ColdProInput {...num("internal_temp_c")} /></ColdProField>
                <ColdProField label="Temp. sob o piso" unit="°C"><ColdProInput {...num("floor_temp_c")} /></ColdProField>
                {!form?.has_floor_insulation ? (
                  <ColdProField label="Região do solo">
                    <ColdProSelect value={soilRegion} onChange={(e) => setSoilTemperatureRegion(e.target.value)}>
                      <option value="">Selecione</option>
                      {SOIL_TEMPERATURE_REGIONS.map((region) => <option key={region.value} value={region.value}>{region.label} · {region.range}</option>)}
                    </ColdProSelect>
                  </ColdProField>
                ) : null}
                <ColdProField label="UR externa" unit="%"><ColdProInput {...num("external_relative_humidity_percent")} placeholder="70" /></ColdProField>
                <ColdProField label="UR interna" unit="%"><ColdProInput {...num("relative_humidity_percent")} placeholder="70" /></ColdProField>
                <ColdProField label="Pressão atm." unit="kPa"><ColdProInput {...num("atmospheric_pressure_kpa")} placeholder="92,6" /></ColdProField>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <ColdProCalculatedInfo label="Diferença térmica" value={`${fmtColdPro(deltaT)} °C`} description="Temperatura externa menos interna." tone={deltaT > 0 ? "info" : "warning"} />
                {deltaT <= 0 ? <ColdProValidationMessage>Temperatura externa menor ou igual à interna. Confira se o regime está correto.</ColdProValidationMessage> : null}
              </div>
            </ColdProFormSection>

            {isSeed ? (
              <ColdProFormSection title="Carga latente / desumidificação" description="Controle específico de umidade para câmara de sementes, separado da carga sensível comum." icon={<Droplets className="h-4 w-4" />}>
                <div className="grid gap-x-10 md:grid-cols-2 xl:grid-cols-3">
                  <ColdProField label="Trocas de ar" unit="1/h"><ColdProInput {...num("air_changes_per_hour")} /></ColdProField>
                  <ColdProField label="Renovação de ar" unit="m³/h"><ColdProInput {...num("fresh_air_m3_h")} /></ColdProField>
                  <ColdProField label="Infiltração portas" unit="m³/h"><ColdProInput {...num("door_infiltration_m3_h")} /></ColdProField>
                  <ColdProField label="Massa sementes" unit="kg"><ColdProInput {...num("seed_mass_kg")} /></ColdProField>
                  <ColdProField label="Umidade inicial" unit="% b.u."><ColdProInput {...num("seed_initial_moisture_percent")} /></ColdProField>
                  <ColdProField label="Umidade final" unit="% b.u."><ColdProInput {...num("seed_final_moisture_percent")} /></ColdProField>
                  <ColdProField label="Tempo estabilização" unit="h"><ColdProInput {...num("seed_stabilization_time_h")} /></ColdProField>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <ColdProCalculatedInfo label="W externo" value={`${fmtColdPro((seedDehumidificationPreview as any).external_absolute_humidity_kg_kg, 5)} kg/kg`} description="Umidade absoluta externa." />
                  <ColdProCalculatedInfo label="W interno" value={`${fmtColdPro((seedDehumidificationPreview as any).internal_absolute_humidity_kg_kg, 5)} kg/kg`} description="Umidade absoluta desejada." />
                  <ColdProCalculatedInfo label="Água do ar" value={`${fmtColdPro((seedDehumidificationPreview as any).water_removed_air_kg_h, 2)} kg/h`} description="Remoção por infiltração/renovação." />
                  <ColdProCalculatedInfo label="Desumidificação" value={`${fmtColdPro((seedDehumidificationPreview as any).total_kw, 2)} kW`} description={`${fmtColdPro((seedDehumidificationPreview as any).total_kcal_h)} kcal/h`} tone="success" />
                </div>
                {Array.isArray((seedDehumidificationPreview as any).warnings) && (seedDehumidificationPreview as any).warnings.length ? <ColdProValidationMessage>{(seedDehumidificationPreview as any).warnings.join(" ")}</ColdProValidationMessage> : null}
              </ColdProFormSection>
            ) : null}

            <ColdProFormSection title="Formato, dimensões e paredes" description="Selecione o desenho da câmara para calcular volume, teto, piso e paredes com medidas diferentes." icon={<DraftingCompass className="h-4 w-4" />}>
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_180px]">
                <div className="space-y-5">
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {CHAMBER_LAYOUTS.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setLayout(item.value)}
                        className={`rounded-md border p-2 text-left transition hover:border-primary ${layout === item.value ? "border-primary bg-primary/10" : "bg-background"}`}
                      >
                        <div className="hidden lg:block"><ChamberShapePreview layout={item.value} /></div>
                        <span className="block text-sm font-semibold">{item.label}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">{item.description}</span>
                      </button>
                    ))}
                  </div>

                      <div className="grid grid-cols-1 gap-x-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(220px,0.9fr)]">
                    <div>
                           <div className="grid gap-x-8 lg:grid-cols-2">
                            {constructionFaces.filter((face) => face.local.startsWith("PAREDE")).map((face, faceListIndex) => {
                              const index = constructionFaces.findIndex((item) => item.local === face.local);
                              return <ColdProField key={face.local} label={`Dim. ${String.fromCharCode(65 + faceListIndex)}`} unit="m"><ColdProInput type="number" value={face.wall_length_m ?? ""} onChange={(e) => setFace(index, "wall_length_m", numberOrNull(e.target.value) ?? 0)} /></ColdProField>;
                            })}
                            <ColdProField label="Altura" unit="m"><ColdProInput type="number" value={form?.height_m ?? ""} onChange={(e) => setDimension("height_m", e.target.value)} /></ColdProField>
                          </div>
                      {layout === "custom_polygon" ? (
                        <ColdProField label="Quantidade de paredes" unit="un">
                          <ColdProInput type="number" value={wallCount} onChange={(e) => set("wall_count", numberOrNull(e.target.value) ?? 4)} />
                        </ColdProField>
                      ) : null}
                      <ColdProValidationMessage tone="error">{dimensionError || customDimensionError ? "Informe medidas válidas para volume, piso e paredes." : ""}</ColdProValidationMessage>
                    </div>
                    <div className="space-y-3">
                      <ColdProCalculatedInfo label="Formato" value={`${wallCount} paredes`} description="Áreas calculadas pelas dimensões." />
                      <ColdProCalculatedInfo label="Teto e piso" value={`${fmtColdPro(geometricFloorArea)} m²`} description="Área da planta da câmara." tone={dimensionError || customDimensionError ? "warning" : "info"} />
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <ChamberShapePreview layout={layout} />
                  {layout === "rectangular" ? <ColdProCalculatedInfo label="Preenchimento rápido" value="Paredes opostas" description="Ao informar uma parede, a parede oposta recebe a mesma medida." /> : null}
                  <ColdProFieldHint>Em câmaras não retangulares, ajuste cada parede abaixo. A área do painel da parede é recalculada por comprimento × altura.</ColdProFieldHint>
                </div>
              </div>
            </ColdProFormSection>

            <ColdProFormSection title="Isolamento dos painéis" description="Selecione o painel isotérmico e a espessura para preencher automaticamente paredes, teto e piso." icon={<ShieldCheck className="h-4 w-4" />}>
              <div className="grid gap-x-10 lg:grid-cols-2">
                <div>
                  <ColdProField label="Material paredes/teto">
                    <ColdProSelect value={panelMaterialKey} onChange={(e) => setInsulationMaterial(e.target.value)}>
                      <option value="">Selecione</option>
                      {insulationOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </ColdProSelect>
                  </ColdProField>
                  <ColdProField label="Esp. paredes" unit="mm"><ColdProSelect value={form?.wall_thickness_mm ?? ""} onChange={(e) => setInsulationThickness("wall_thickness_mm", e.target.value)}>{!INSULATION_THICKNESS_OPTIONS_MM.includes(toNumber(form?.wall_thickness_mm)) && form?.wall_thickness_mm ? <option value={form.wall_thickness_mm}>{form.wall_thickness_mm}</option> : null}{INSULATION_THICKNESS_OPTIONS_MM.map((value) => <option key={value} value={value}>{value}</option>)}</ColdProSelect></ColdProField>
                  <ColdProField label="Esp. teto" unit="mm"><ColdProSelect value={form?.ceiling_thickness_mm ?? ""} onChange={(e) => setInsulationThickness("ceiling_thickness_mm", e.target.value)}>{!INSULATION_THICKNESS_OPTIONS_MM.includes(toNumber(form?.ceiling_thickness_mm)) && form?.ceiling_thickness_mm ? <option value={form.ceiling_thickness_mm}>{form.ceiling_thickness_mm}</option> : null}{INSULATION_THICKNESS_OPTIONS_MM.map((value) => <option key={value} value={value}>{value}</option>)}</ColdProSelect></ColdProField>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ColdProCalculatedInfo label="U paredes" value={`${fmtColdPro(wallLayerInfo.uValue, 3)} W/m²K`} description={`k ${fmtColdPro(wallLayerInfo.conductivity, 3)} W/mK`} tone={wallLayerInfo.uValue > 0 ? "success" : "warning"} />
                    <ColdProCalculatedInfo label="U teto" value={`${fmtColdPro(ceilingLayerInfo.uValue, 3)} W/m²K`} description={`R ${fmtColdPro(ceilingLayerInfo.resistance, 2)} m²K/W`} tone={ceilingLayerInfo.uValue > 0 ? "success" : "warning"} />
                  </div>
                </div>
                <div>
                  <ColdProField label="Condição do piso">
                    <ColdProSelect value={floorCondition} onChange={(e) => setFloorCondition(e.target.value)}>
                      {FLOOR_CONDITION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </ColdProSelect>
                  </ColdProField>
                  <ColdProField label="Material piso">
                    <ColdProSelect disabled={!form?.has_floor_insulation} value={floorInsulationMaterialId || panelMaterialKey || ""} onChange={(e) => { setFloorInsulationMaterialId(e.target.value); applyInsulationToFaces(panelMaterialKey, form?.wall_thickness_mm, form?.ceiling_thickness_mm, form?.floor_thickness_mm, e.target.value); }}>
                      <option value="">Mesmo das paredes</option>
                      {insulationOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </ColdProSelect>
                  </ColdProField>
                  <ColdProField label="Esp. piso" unit="mm"><ColdProSelect disabled={!form?.has_floor_insulation} value={form?.floor_thickness_mm ?? ""} onChange={(e) => setInsulationThickness("floor_thickness_mm", e.target.value)}>{!INSULATION_THICKNESS_OPTIONS_MM.includes(toNumber(form?.floor_thickness_mm)) && form?.floor_thickness_mm ? <option value={form.floor_thickness_mm}>{form.floor_thickness_mm}</option> : null}{INSULATION_THICKNESS_OPTIONS_MM.map((value) => <option key={value} value={value}>{value}</option>)}</ColdProSelect></ColdProField>
                  {floorCondition === "lower_room" ? <ColdProField label="Temp. ambiente inferior" unit="°C"><ColdProInput {...num("floor_temp_c")} /></ColdProField> : null}
                  <ColdProCalculatedInfo label="U piso" value={form?.has_floor_insulation ? `${fmtColdPro(floorLayerInfo.uValue, 3)} W/m²K` : `${fmtColdPro(UNINSULATED_FLOOR_U_VALUE_W_M2K, 3)} W/m²K`} description={form?.has_floor_insulation ? `k ${fmtColdPro(floorLayerInfo.conductivity, 3)} W/mK` : floorCondition === "lower_room" ? "Piso sobre ambiente inferior." : `Solo ${fmtColdPro(form?.floor_temp_c ?? DEFAULT_SOIL_TEMP_C)} °C.`} tone={form?.has_floor_insulation && floorLayerInfo.uValue > 0 ? "success" : "warning"} />
                </div>
              </div>
            </ColdProFormSection>

            <ColdProFormSection title="Paredes, painéis e aberturas" description="Revise áreas das faces, escolha a face com sol direto e informe áreas de vidro quando houver." icon={<Grid3X3 className="h-4 w-4" />}>
              <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <ColdProCalculatedInfo label="Volume final" value={`${fmtColdPro(volume)} m³`} description="Área do piso × altura" tone={dimensionError || customDimensionError ? "warning" : "success"} />
                <ColdProCalculatedInfo label="Piso / teto" value={`${fmtColdPro(floorArea)} / ${fmtColdPro(ceilingArea)} m²`} />
                <ColdProCalculatedInfo label="Área de paredes" value={`${fmtColdPro(wallPanelArea)} m²`} />
                <ColdProCalculatedInfo label="Área de vidro" value={`${fmtColdPro(totalGlassArea)} m²`} />
                <ColdProCalculatedInfo label="Total transmissão" value={`${fmtColdPro(transmissionTotalKw, 2)} kW`} description={`${fmtColdPro(transmissionTotalKcalH)} kcal/h · ${fmtColdPro(transmissionTotalTr, 2)} TR`} tone="success" />
              </div>
              <div className="mb-4 grid gap-x-10 md:grid-cols-2">
                <div>
                  <ColdProField label="Face com sol">
                    <ColdProSelect value={currentSolarFace ?? ""} onChange={(e) => setSolarFace(e.target.value)}>
                      {SOLAR_FACE_OPTIONS.filter((option) => option.value === "" || constructionFaces.some((face) => face.local === option.value)).map((option) => <option key={option.value || "none"} value={option.value}>{option.label}</option>)}
                    </ColdProSelect>
                  </ColdProField>
                </div>
                <div>
                  <ColdProField label="Módulos/painéis" unit="un"><ColdProInput {...num("module_count")} /></ColdProField>
                </div>
              </div>

              <div className="max-w-full overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[1320px] text-sm">
                  <thead className="bg-muted/50 text-sm text-muted-foreground">
                    <tr>
                      <th className="px-3 py-3 text-left font-medium">Local</th>
                      <th className="px-3 py-3 text-left font-medium">Comp. m</th>
                      <th className="px-3 py-3 text-left font-medium">Altura m</th>
                      <th className="px-3 py-3 text-left font-medium">Área total m²</th>
                      <th className="px-3 py-3 text-left font-medium">Temp. ext °C</th>
                      <th className="px-3 py-3 text-left font-medium">Material aplicado</th>
                      <th className="px-3 py-3 text-left font-medium">U painel</th>
                      <th className="px-3 py-3 text-left font-medium">Vidro</th>
                      <th className="px-3 py-3 text-left font-medium">Área vidro m²</th>
                      <th className="px-3 py-3 text-left font-medium">Tipo de vidro</th>
                      <th className="px-3 py-3 text-left font-medium">Incidência solar</th>
                      <th className="px-3 py-3 text-left font-medium">Área opaca m²</th>
                      <th className="px-3 py-3 text-left font-medium">ΔT °C</th>
                      <th className="px-3 py-3 text-left font-medium">Painel W</th>
                      <th className="px-3 py-3 text-left font-medium">Vidro W</th>
                      <th className="px-3 py-3 text-left font-medium">Solar vidro W</th>
                      <th className="px-3 py-3 text-left font-medium">Total W</th>
                      <th className="px-3 py-3 text-left font-medium">kW</th>
                      <th className="px-3 py-3 text-left font-medium">kcal/h</th>
                      <th className="px-3 py-3 text-left font-medium">TR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transmissionPreviewRows.map(({ face, index, isWall, hasGlass, preparedFace, load }) => (
                        <tr key={face.local} className="border-t align-middle">
                          <td className="px-3 py-3 font-medium text-foreground">{face.local}</td>
                          <td className="px-3 py-3"><ColdProInput type="number" disabled={!isWall} value={isWall ? face.wall_length_m ?? "" : ""} onChange={(e) => setFace(index, "wall_length_m", numberOrNull(e.target.value) ?? 0)} /></td>
                          <td className="px-3 py-3"><ColdProInput type="number" disabled={!isWall} value={isWall ? face.wall_height_m ?? "" : ""} onChange={(e) => setFace(index, "wall_height_m", numberOrNull(e.target.value) ?? 0)} /></td>
                          <td className="px-3 py-3"><ColdProInput type="number" readOnlyValue={face.local === "TETO" || face.local === "PISO"} value={face.panel_area_m2 ?? ""} onChange={(e) => setFace(index, "panel_area_m2", numberOrNull(e.target.value) ?? 0)} /></td>
                          <td className="px-3 py-3"><ColdProInput type="number" value={displayedExternalTemp(preparedFace) ?? ""} onChange={(e) => setFace(index, "external_temp_c", numberOrNull(e.target.value))} /></td>
                          <td className="max-w-48 px-3 py-3 text-sm text-muted-foreground">{preparedFace.material_thickness || "—"}</td>
                          <td className="px-3 py-3 tabular-nums">{fmtColdPro(preparedFace.u_value_w_m2k, 3)}</td>
                          <td className="px-3 py-3"><Checkbox checked={hasGlass} onCheckedChange={(checked) => setGlassEnabled(index, Boolean(checked))} /></td>
                          <td className="px-3 py-3"><ColdProInput type="number" disabled={!hasGlass} value={hasGlass ? face.glass_area_m2 ?? "" : ""} onChange={(e) => setFace(index, "glass_area_m2", numberOrNull(e.target.value) ?? 0)} /></td>
                          <td className="px-3 py-3"><ColdProSelect disabled={!hasGlass} value={hasGlass ? face.glass_type ?? "simple" : "none"} onChange={(e) => setFace(index, "glass_type", e.target.value)}>{GLASS_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label} · U {fmtColdPro(option.u, 1)}</option>)}</ColdProSelect></td>
                          <td className="px-3 py-3"><ColdProSelect disabled={!hasGlass} value={toNumber(face.solar_radiation_w_m2)} onChange={(e) => setFace(index, "solar_radiation_w_m2", numberOrNull(e.target.value) ?? 0)}>{SOLAR_RADIATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label} · {option.value} W/m²</option>)}</ColdProSelect></td>
                          <td className="px-3 py-3 tabular-nums">{fmtColdPro(load.insulated_area_m2)}</td>
                          <td className="px-3 py-3 tabular-nums">{fmtColdPro(load.delta_t_c)}</td>
                          <td className="px-3 py-3 tabular-nums">{fmtColdPro((load as any).panel_transmission_w)}</td>
                          <td className="px-3 py-3 tabular-nums">{fmtColdPro((load as any).glass_transmission_w)}</td>
                          <td className="px-3 py-3 tabular-nums">{fmtColdPro((load as any).glass_solar_w)}</td>
                          <td className="px-3 py-3 tabular-nums font-medium">{fmtColdPro((load as any).transmission_w)}</td>
                          <td className="px-3 py-3 tabular-nums">{fmtColdPro((load as any).transmission_kw, 2)}</td>
                          <td className="px-3 py-3 tabular-nums font-medium">{fmtColdPro(load.transmission_kcal_h)}</td>
                          <td className="px-3 py-3 tabular-nums">{fmtColdPro((load as any).transmission_tr, 3)}</td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ColdProFormSection>
          </div>
        </TabsContent>

        <TabsContent value="condicoes">
          <ColdProFormSection title="Condições de operação" description="Temperaturas, umidade e piso usados no cálculo do ambiente." icon={<Thermometer className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
              <div>
                <ColdProField label="Temperatura interna" unit="°C"><ColdProInput {...num("internal_temp_c")} /></ColdProField>
                <ColdProField label="Temperatura externa" unit="°C"><ColdProInput {...num("external_temp_c")} /></ColdProField>
                <ColdProField label="Temperatura sob o piso" unit="°C"><ColdProInput {...num("floor_temp_c")} /></ColdProField>
              </div>
              <div className="space-y-3">
                {(isClimatized || isSeed) ? (
                  <ColdProField label="Umidade relativa interna" unit="%"><ColdProInput {...num("relative_humidity_percent")} /></ColdProField>
                ) : null}
                <ColdProCalculatedInfo label="Diferença térmica" value={`${fmtColdPro(deltaT)} °C`} description="Quanto maior o ΔT, maior a carga de transmissão." tone={deltaT > 0 ? "info" : "warning"} />
                {deltaT <= 0 ? <ColdProValidationMessage>Temperatura externa menor ou igual à interna. Confira se o regime está correto.</ColdProValidationMessage> : null}
              </div>
            </div>
          </ColdProFormSection>
        </TabsContent>

        <TabsContent value="isolamento">
          <ColdProFormSection title="Isolamento" description="Material, espessuras e condição do piso isolado." icon={<ShieldCheck className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
              <div>
                <ColdProField label="Material isolante">
                  <ColdProSelect value={form?.insulation_material_id ?? ""} onChange={(e) => set("insulation_material_id", e.target.value)}>
                    <option value="">Selecione</option>
                    {insulationMaterials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </ColdProSelect>
                </ColdProField>
                <ColdProField label="Piso isolado">
                  <ColdProSelect value={form?.has_floor_insulation ? "sim" : "nao"} onChange={(e) => set("has_floor_insulation", e.target.value === "sim")}>
                    <option value="nao">Não</option>
                    <option value="sim">Sim</option>
                  </ColdProSelect>
                </ColdProField>
              </div>
              <div>
                <ColdProField label="Espessura parede" unit="mm"><ColdProInput {...num("wall_thickness_mm")} /></ColdProField>
                <ColdProField label="Espessura teto" unit="mm"><ColdProInput {...num("ceiling_thickness_mm")} /></ColdProField>
                <ColdProField label="Espessura piso" unit="mm"><ColdProInput {...num("floor_thickness_mm")} /></ColdProField>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><ColdProFieldHint>Espessuras maiores reduzem a carga de transmissão. Use valores reais do painel instalado/projetado.</ColdProFieldHint> Referência técnica de isolamento.</div>
              </div>
            </div>
          </ColdProFormSection>
        </TabsContent>
      </Tabs>

      <div className="mt-5 flex justify-end border-t pt-4">
        <button type="button" disabled={!canSave} onClick={() => onSave({ ...form, name: String(form?.name ?? "").trim(), chamber_layout_type: layout, wall_count: wallCount, volume_m3: volume, west_face_insolation: Boolean(currentSolarFace), construction_faces: [...solarAdjustedConstructionFaces, geometry], total_panel_area_m2: totalPanelArea, total_glass_area_m2: totalGlassArea, total_door_area_m2: 0 })} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
          <Save className="h-4 w-4" /> Salvar ambiente
        </button>
      </div>
    </div>
  );
}
