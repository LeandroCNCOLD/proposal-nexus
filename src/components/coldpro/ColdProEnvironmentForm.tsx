import * as React from "react";
import { Box, DraftingCompass, Grid3X3, Layers, Plus, Save, ShieldCheck, Thermometer, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
const SOLAR_FACE_OPTIONS = ["Sem sol direto", "Parede 1", "Parede 2", "Parede 3", "Parede 4", "Teto"];

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
    material_id: material?.id ?? null,
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

function describeLayer(layer: any) {
  const uValue = calculateUValue(layer?.thickness_m > 0 && layer?.conductivity_w_mk > 0 ? [layer] : []);
  return {
    uValue,
    resistance: uValue > 0 ? 1 / uValue : 0,
    conductivity: toNumber(layer?.conductivity_w_mk),
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

  return labels.map((local) => {
    const existing = faces.find((face: any) => face?.local === local || face?.local === local.replace("PAREDE ", "PAREDE 0")) ?? {};
    const wallIndex = local.startsWith("PAREDE") ? Number(local.replace("PAREDE", "").trim()) - 1 : -1;
    const wallLength = wallIndex >= 0 ? (toNumber(existing.wall_length_m) || wallLengths[wallIndex] || 0) : null;
    const wallHeight = wallIndex >= 0 ? (toNumber(existing.wall_height_m) || height || 0) : null;
    const calculatedArea = wallIndex >= 0 ? toNumber(wallLength) * toNumber(wallHeight) : floorArea;

    return {
      local,
      wall_length_m: wallLength,
      wall_height_m: wallHeight,
      material_thickness: existing.material_thickness ?? "",
      panel_area_m2: existing.panel_area_m2 ?? calculatedArea,
      layers: Array.isArray(existing.layers) ? existing.layers : [],
      u_value_w_m2k: existing.u_value_w_m2k ?? null,
      transmission_w: existing.transmission_w ?? null,
      transmission_kcal_h: existing.transmission_kcal_h ?? null,
      external_temp_c: existing.external_temp_c ?? null,
      solar_orientation: existing.solar_orientation ?? "",
      color: existing.color ?? "",
      glass_area_m2: existing.glass_area_m2 ?? 0,
      glass_type: existing.glass_type ?? "",
      door_area_m2: existing.door_area_m2 ?? 0,
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

function FaceLayersDialog({ face, faceIndex, thermalMaterials, onChange }: { face: any; faceIndex: number; thermalMaterials: any[]; onChange: (index: number, layers: any[], uValue: number) => void }) {
  const layers = Array.isArray(face.layers) ? face.layers : [];
  const uValue = calculateUValue(layers);
  const updateLayer = (layerIndex: number, patch: Record<string, unknown>) => {
    const next = layers.map((layer: any, index: number) => index === layerIndex ? { ...layer, ...patch } : layer);
    onChange(faceIndex, next, calculateUValue(next));
  };
  const addLayer = () => {
    const material = thermalMaterials.find((item) => item.material_name === "Painel isotérmico PUR") ?? thermalMaterials[0];
    const next = [...layers, { material_id: material?.id ?? null, material_name: material?.material_name ?? "Material", category: material?.category ?? null, thickness_m: Number(material?.typical_thickness_mm ?? 100) / 1000, conductivity_w_mk: Number(material?.thermal_conductivity_w_mk ?? 0.022), position: layers.length }];
    onChange(faceIndex, next, calculateUValue(next));
  };
  const removeLayer = (layerIndex: number) => {
    const next = layers.filter((_: any, index: number) => index !== layerIndex).map((layer: any, index: number) => ({ ...layer, position: index }));
    onChange(faceIndex, next, calculateUValue(next));
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5"><Layers className="h-3.5 w-3.5" /> {layers.length || "Camadas"}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Camadas térmicas — {face.local}</DialogTitle>
          <DialogDescription>Monte a composição construtiva para calcular o coeficiente U desta face.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <ColdProCalculatedInfo label="U calculado" value={`${fmtColdPro(uValue, 3)} W/m²K`} description="Inclui resistências superficiais interna e externa." tone={uValue > 0 ? "success" : "warning"} />
          <div className="space-y-2">
            {layers.map((layer: any, layerIndex: number) => (
              <div key={layerIndex} className="grid items-end gap-2 rounded-lg border p-3 md:grid-cols-[1fr_120px_120px_36px]">
                <ColdProField label="Material">
                  <ColdProSelect value={layer.material_id ?? layer.material_name ?? ""} onChange={(e) => {
                    const material = thermalMaterials.find((item) => item.id === e.target.value);
                    if (!material) return updateLayer(layerIndex, { material_name: e.target.value });
                    updateLayer(layerIndex, { material_id: material.id, material_name: material.material_name, category: material.category, conductivity_w_mk: Number(material.thermal_conductivity_w_mk), thickness_m: Number(material.typical_thickness_mm ?? 0) > 0 ? Number(material.typical_thickness_mm) / 1000 : layer.thickness_m });
                  }}>
                    {thermalMaterials.map((material) => <option key={material.id} value={material.id}>{material.material_name}</option>)}
                  </ColdProSelect>
                </ColdProField>
                <ColdProField label="Espessura" unit="mm"><ColdProInput type="number" value={toNumber(layer.thickness_m) * 1000 || ""} onChange={(e) => updateLayer(layerIndex, { thickness_m: toNumber(e.target.value) / 1000 })} /></ColdProField>
                <ColdProField label="k" unit="W/mK"><ColdProInput type="number" value={layer.conductivity_w_mk ?? ""} onChange={(e) => updateLayer(layerIndex, { conductivity_w_mk: numberOrNull(e.target.value) ?? 0 })} /></ColdProField>
                <Button type="button" variant="outline" size="icon" onClick={() => removeLayer(layerIndex)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" onClick={addLayer} className="gap-2"><Plus className="h-4 w-4" /> Adicionar camada</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ColdProEnvironmentForm({ environment, insulationMaterials, thermalMaterials = [], onSave }: Props) {
  const [form, setForm] = React.useState<any>(environment);
  const [activeFaceIndex, setActiveFaceIndex] = React.useState(0);
  const [floorInsulationMaterialId, setFloorInsulationMaterialId] = React.useState<string>(environment?.insulation_material_id ?? "");
  React.useEffect(() => setForm(environment), [environment]);
  React.useEffect(() => setFloorInsulationMaterialId(environment?.insulation_material_id ?? ""), [environment]);

  const isClimatized = form?.environment_type === "climatized_room";
  const isSeed = form?.environment_type === "seed_storage";

  const set = (key: string, value: unknown) => setForm((prev: any) => ({ ...prev, [key]: value }));

  const num = (key: string) => ({
    type: "number" as const,
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
  const activeFace = constructionFaces[Math.min(activeFaceIndex, Math.max(0, constructionFaces.length - 1))];
  const selectedInsulation = insulationMaterials.find((item) => item.id === form?.insulation_material_id) ?? insulationMaterials[0];
  const selectedFloorInsulation = insulationMaterials.find((item) => item.id === floorInsulationMaterialId) ?? selectedInsulation;
  const wallLayerInfo = describeLayer(makeInsulationLayer(selectedInsulation, form?.wall_thickness_mm));
  const ceilingLayerInfo = describeLayer(makeInsulationLayer(selectedInsulation, form?.ceiling_thickness_mm));
  const floorLayerInfo = describeLayer(makeInsulationLayer(selectedFloorInsulation, form?.floor_thickness_mm));

  const geometricFloorArea = getFloorArea(layout, length, width, geometry, constructionFaces);
  const floorFace = constructionFaces.find((face) => face.local === "PISO");
  const ceilingFace = constructionFaces.find((face) => face.local === "TETO");
  const floorArea = toNumber(floorFace?.panel_area_m2) || geometricFloorArea;
  const ceilingArea = toNumber(ceilingFace?.panel_area_m2) || geometricFloorArea;
  const volume = floorArea * height;
  const deltaT = toNumber(form?.external_temp_c) - toNumber(form?.internal_temp_c);
  const totalPanelArea = constructionFaces.reduce((sum, face) => sum + toNumber(face.panel_area_m2), 0);
  const totalGlassArea = constructionFaces.reduce((sum, face) => sum + toNumber(face.glass_area_m2), 0);
  const totalDoorArea = constructionFaces.reduce((sum, face) => sum + toNumber(face.door_area_m2), 0);
  const wallPanelArea = constructionFaces.filter((face) => face.local.startsWith("PAREDE")).reduce((sum, face) => sum + toNumber(face.panel_area_m2), 0);
  const dimensionError = layout !== "custom_polygon" && (length <= 0 || width <= 0 || height <= 0);
  const customDimensionError = layout === "custom_polygon" && (floorArea <= 0 || height <= 0 || wallCount < 3);
  const hoursError = toNumber(form?.operation_hours_day) < 0 || toNumber(form?.operation_hours_day) > 24 || toNumber(form?.compressor_runtime_hours_day) < 0 || toNumber(form?.compressor_runtime_hours_day) > 24;
  const safetyError = toNumber(form?.safety_factor_percent) < 0;
  const canSave = !dimensionError && !customDimensionError && !hoursError && !safetyError && String(form?.name ?? "").trim().length > 0;

  const setGeometry = (key: keyof Omit<Geometry, "local">, value: unknown) => {
    const nextGeometry = { ...geometry, [key]: value };
    set("construction_faces", [...constructionFaces, nextGeometry]);
  };

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
      const oppositeIndex = updated.local === "PAREDE 1" ? 2 : updated.local === "PAREDE 3" ? 0 : updated.local === "PAREDE 2" ? 3 : updated.local === "PAREDE 4" ? 1 : -1;
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

  const setFaceLayers = (index: number, layers: any[], uValue: number) => {
    const next = normalizeFaces(form?.construction_faces, layout, wallCount, length, width, height, geometry);
    next[index] = { ...next[index], layers, u_value_w_m2k: uValue };
    set("construction_faces", [...next, geometry]);
  };

  const applyInsulationToFaces = (materialId = form?.insulation_material_id, wallThickness = form?.wall_thickness_mm, ceilingThickness = form?.ceiling_thickness_mm, floorThickness = form?.floor_thickness_mm, floorMaterialId = floorInsulationMaterialId) => {
    const wallMaterial = insulationMaterials.find((item) => item.id === materialId) ?? selectedInsulation;
    const floorMaterial = insulationMaterials.find((item) => item.id === floorMaterialId) ?? wallMaterial;
    const next = normalizeFaces(form?.construction_faces, layout, wallCount, length, width, height, geometry).map((face) => {
      if (face.local === "PISO" && !form?.has_floor_insulation) return { ...face, layers: [], u_value_w_m2k: null };
      if (face.local === "PISO") return applyLayerToFace(face, makeInsulationLayer(floorMaterial, floorThickness));
      if (face.local === "TETO") return applyLayerToFace(face, makeInsulationLayer(wallMaterial, ceilingThickness));
      return applyLayerToFace(face, makeInsulationLayer(wallMaterial, wallThickness));
    });
    set("construction_faces", [...next, geometry]);
  };

  const setInsulationMaterial = (materialId: string) => {
    set("insulation_material_id", materialId);
    if (!floorInsulationMaterialId) setFloorInsulationMaterialId(materialId);
    applyInsulationToFaces(materialId, form?.wall_thickness_mm, form?.ceiling_thickness_mm, form?.floor_thickness_mm, floorInsulationMaterialId || materialId);
  };

  const setInsulationThickness = (key: string, value: unknown) => {
    const thickness = numberOrNull(value);
    set(key, thickness);
    applyInsulationToFaces(form?.insulation_material_id, key === "wall_thickness_mm" ? thickness : form?.wall_thickness_mm, key === "ceiling_thickness_mm" ? thickness : form?.ceiling_thickness_mm, key === "floor_thickness_mm" ? thickness : form?.floor_thickness_mm, floorInsulationMaterialId);
  };

  const setFloorInsulated = (enabled: boolean) => {
    setForm((prev: any) => ({ ...prev, has_floor_insulation: enabled }));
    const floorIndex = constructionFaces.findIndex((face) => face.local === "PISO");
    if (floorIndex >= 0) {
      const layer = makeInsulationLayer(selectedFloorInsulation, form?.floor_thickness_mm);
      const next = [...constructionFaces];
      next[floorIndex] = enabled ? applyLayerToFace(next[floorIndex], layer) : { ...next[floorIndex], layers: [], u_value_w_m2k: null };
      set("construction_faces", [...next, geometry]);
    }
  };

  const setSolarFace = (faceName: string) => {
    set("west_face_insolation", faceName !== "Sem sol direto");
    const next = constructionFaces.map((face) => ({
      ...face,
      solar_orientation: faceName === face.local || (faceName === "Teto" && face.local === "TETO") ? "Sol direto" : "",
    }));
    set("construction_faces", [...next, geometry]);
  };

  const currentSolarFace = constructionFaces.find((face) => face.solar_orientation === "Sol direto")?.local;

  return (
    <div className="rounded-xl border bg-background p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Ambiente</h2>
          <p className="mt-1 text-sm text-muted-foreground">Dimensões, geometria da câmara, temperatura, umidade e isolamento do espaço refrigerado.</p>
        </div>
      </div>

      <Tabs defaultValue="gerais" className="w-full">
        <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1 p-1">
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
                <ColdProField label="UR externa" unit="%"><ColdProInput {...num("external_relative_humidity_percent")} placeholder="70" /></ColdProField>
                <ColdProField label="UR interna" unit="%"><ColdProInput {...num("relative_humidity_percent")} placeholder="70" /></ColdProField>
                <ColdProField label="Pressão atm." unit="kPa"><ColdProInput {...num("atmospheric_pressure_kpa")} placeholder="92,6" /></ColdProField>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <ColdProCalculatedInfo label="Diferença térmica" value={`${fmtColdPro(deltaT)} °C`} description="Temperatura externa menos interna." tone={deltaT > 0 ? "info" : "warning"} />
                {deltaT <= 0 ? <ColdProValidationMessage>Temperatura externa menor ou igual à interna. Confira se o regime está correto.</ColdProValidationMessage> : null}
              </div>
            </ColdProFormSection>

            <ColdProFormSection title="Formato, dimensões e paredes" description="Selecione o desenho da câmara para calcular volume, teto, piso e paredes com medidas diferentes." icon={<DraftingCompass className="h-4 w-4" />}>
              <div className="grid gap-5 xl:grid-cols-[1fr_260px]">
                <div className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-4">
                    {CHAMBER_LAYOUTS.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setLayout(item.value)}
                        className={`rounded-lg border p-3 text-left transition hover:border-primary ${layout === item.value ? "border-primary bg-primary/10" : "bg-background"}`}
                      >
                        <ChamberShapePreview layout={item.value} />
                        <span className="block text-sm font-semibold">{item.label}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">{item.description}</span>
                      </button>
                    ))}
                  </div>

                      <div className="grid grid-cols-1 gap-x-10 md:grid-cols-[1.4fr_0.8fr]">
                    <div>
                          <div className="grid gap-x-10 md:grid-cols-2">
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
                      <ColdProCalculatedInfo label="Formato" value={`${wallCount} paredes`} description="As áreas finais saem da tabela de faces." />
                      <ColdProCalculatedInfo label="Base geométrica" value={`${fmtColdPro(geometricFloorArea)} m²`} description="Referência inicial para teto e piso." tone={dimensionError || customDimensionError ? "warning" : "info"} />
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
                    <ColdProSelect value={form?.insulation_material_id ?? ""} onChange={(e) => setInsulationMaterial(e.target.value)}>
                      <option value="">Selecione</option>
                      {insulationMaterials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
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
                  <ColdProField label="Piso isolado">
                    <ColdProSelect value={form?.has_floor_insulation ? "sim" : "nao"} onChange={(e) => setFloorInsulated(e.target.value === "sim")}>
                      <option value="nao">Não</option>
                      <option value="sim">Sim</option>
                    </ColdProSelect>
                  </ColdProField>
                  <ColdProField label="Material piso">
                    <ColdProSelect disabled={!form?.has_floor_insulation} value={floorInsulationMaterialId || form?.insulation_material_id || ""} onChange={(e) => { setFloorInsulationMaterialId(e.target.value); applyInsulationToFaces(form?.insulation_material_id, form?.wall_thickness_mm, form?.ceiling_thickness_mm, form?.floor_thickness_mm, e.target.value); }}>
                      <option value="">Mesmo das paredes</option>
                      {insulationMaterials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </ColdProSelect>
                  </ColdProField>
                  <ColdProField label="Esp. piso" unit="mm"><ColdProSelect disabled={!form?.has_floor_insulation} value={form?.floor_thickness_mm ?? ""} onChange={(e) => setInsulationThickness("floor_thickness_mm", e.target.value)}>{!INSULATION_THICKNESS_OPTIONS_MM.includes(toNumber(form?.floor_thickness_mm)) && form?.floor_thickness_mm ? <option value={form.floor_thickness_mm}>{form.floor_thickness_mm}</option> : null}{INSULATION_THICKNESS_OPTIONS_MM.map((value) => <option key={value} value={value}>{value}</option>)}</ColdProSelect></ColdProField>
                  <ColdProCalculatedInfo label="U piso" value={form?.has_floor_insulation ? `${fmtColdPro(floorLayerInfo.uValue, 3)} W/m²K` : "Sem isolamento"} description={form?.has_floor_insulation ? `k ${fmtColdPro(floorLayerInfo.conductivity, 3)} W/mK` : "Piso não entra como painel isolado."} tone={form?.has_floor_insulation && floorLayerInfo.uValue > 0 ? "success" : "warning"} />
                </div>
              </div>
            </ColdProFormSection>

            <ColdProFormSection title="Paredes, painéis e aberturas" description="Complete cada face da câmara com material, orientação solar, vidros e portas." icon={<Grid3X3 className="h-4 w-4" />}>
              <div className="mb-4 grid gap-3 md:grid-cols-4">
                <ColdProCalculatedInfo label="Volume final" value={`${fmtColdPro(volume)} m³`} description="Área do piso × altura" tone={dimensionError || customDimensionError ? "warning" : "success"} />
                <ColdProCalculatedInfo label="Piso / teto" value={`${fmtColdPro(floorArea)} / ${fmtColdPro(ceilingArea)} m²`} />
                <ColdProCalculatedInfo label="Área de paredes" value={`${fmtColdPro(wallPanelArea)} m²`} />
                <ColdProCalculatedInfo label="Vidro / portas" value={`${fmtColdPro(totalGlassArea)} / ${fmtColdPro(totalDoorArea)} m²`} />
              </div>
              <div className="mb-4 grid gap-5 lg:grid-cols-[280px_1fr]">
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="mb-3 text-sm font-semibold">Insolação e face ativa</div>
                  <ColdProField label="Face norte">
                    <ColdProSelect value={activeFace?.local ?? ""} onChange={(e) => setActiveFaceIndex(Math.max(0, constructionFaces.findIndex((face) => face.local === e.target.value)))}>
                      {constructionFaces.map((face) => <option key={face.local} value={face.local}>{face.local}</option>)}
                    </ColdProSelect>
                  </ColdProField>
                  <ChamberShapePreview layout={layout} />
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    {constructionFaces.map((face, index) => (
                      <button key={face.local} type="button" onClick={() => setActiveFaceIndex(index)} className={`rounded-md border px-2 py-1.5 text-left ${activeFaceIndex === index ? "border-primary bg-primary/10 text-primary" : "bg-background text-muted-foreground"}`}>{face.local}</button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-x-10 md:grid-cols-2">
                  <ColdProField label="Insolação face oeste">
                  <ColdProSelect value={form?.west_face_insolation ? "sim" : "nao"} onChange={(e) => set("west_face_insolation", e.target.value === "sim")}>
                    <option value="nao">Não</option>
                    <option value="sim">Sim</option>
                  </ColdProSelect>
                </ColdProField>
                  <ColdProField label="Piso com isolamento?">
                    <ColdProSelect value={form?.has_floor_insulation ? "sim" : "nao"} onChange={(e) => set("has_floor_insulation", e.target.value === "sim")}>
                      <option value="nao">Não</option>
                      <option value="sim">Sim</option>
                    </ColdProSelect>
                  </ColdProField>
                  <ColdProField label="Módulos/painéis" unit="un"><ColdProInput {...num("module_count")} /></ColdProField>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[1160px] text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Local</th>
                      <th className="px-3 py-2 text-left font-medium">Comp. m</th>
                      <th className="px-3 py-2 text-left font-medium">Altura m</th>
                      <th className="px-3 py-2 text-left font-medium">Material / espessura</th>
                      <th className="px-3 py-2 text-left font-medium">Área painel m²</th>
                      <th className="px-3 py-2 text-left font-medium">Temp. ext °C</th>
                      <th className="px-3 py-2 text-left font-medium">Orientação solar</th>
                      <th className="px-3 py-2 text-left font-medium">Cor</th>
                      <th className="px-3 py-2 text-left font-medium">Área vidro m²</th>
                      <th className="px-3 py-2 text-left font-medium">Tipo de vidro</th>
                      <th className="px-3 py-2 text-left font-medium">Área porta m²</th>
                      <th className="px-3 py-2 text-left font-medium">U / camadas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {constructionFaces.map((face, index) => {
                      const isWall = face.local.startsWith("PAREDE");
                      return (
                        <tr key={face.local} className="border-t">
                          <td className="px-3 py-2 font-medium text-foreground">{face.local}</td>
                          <td className="px-3 py-2"><ColdProInput type="number" disabled={!isWall} value={isWall ? face.wall_length_m ?? "" : ""} onChange={(e) => setFace(index, "wall_length_m", numberOrNull(e.target.value) ?? 0)} /></td>
                          <td className="px-3 py-2"><ColdProInput type="number" disabled={!isWall} value={isWall ? face.wall_height_m ?? "" : ""} onChange={(e) => setFace(index, "wall_height_m", numberOrNull(e.target.value) ?? 0)} /></td>
                          <td className="px-3 py-2"><ColdProInput value={face.material_thickness ?? ""} onChange={(e) => setFace(index, "material_thickness", e.target.value)} className="text-left" /></td>
                          <td className="px-3 py-2"><ColdProInput type="number" value={face.panel_area_m2 ?? ""} onChange={(e) => setFace(index, "panel_area_m2", numberOrNull(e.target.value) ?? 0)} /></td>
                          <td className="px-3 py-2"><ColdProInput type="number" value={face.external_temp_c ?? ""} onChange={(e) => setFace(index, "external_temp_c", numberOrNull(e.target.value))} /></td>
                          <td className="px-3 py-2"><ColdProInput value={face.solar_orientation ?? ""} onChange={(e) => setFace(index, "solar_orientation", e.target.value)} className="text-left" /></td>
                          <td className="px-3 py-2"><ColdProInput value={face.color ?? ""} onChange={(e) => setFace(index, "color", e.target.value)} className="text-left" /></td>
                          <td className="px-3 py-2"><ColdProInput type="number" value={face.glass_area_m2 ?? ""} onChange={(e) => setFace(index, "glass_area_m2", numberOrNull(e.target.value) ?? 0)} /></td>
                          <td className="px-3 py-2"><ColdProInput value={face.glass_type ?? ""} onChange={(e) => setFace(index, "glass_type", e.target.value)} className="text-left" /></td>
                          <td className="px-3 py-2"><ColdProInput type="number" value={face.door_area_m2 ?? ""} onChange={(e) => setFace(index, "door_area_m2", numberOrNull(e.target.value) ?? 0)} /></td>
                          <td className="px-3 py-2"><FaceLayersDialog face={face} faceIndex={index} thermalMaterials={thermalMaterials} onChange={setFaceLayers} /></td>
                        </tr>
                      );
                    })}
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
        <button type="button" disabled={!canSave} onClick={() => onSave({ ...form, name: String(form?.name ?? "").trim(), chamber_layout_type: layout, wall_count: wallCount, volume_m3: volume, construction_faces: [...constructionFaces, geometry], total_panel_area_m2: totalPanelArea, total_glass_area_m2: totalGlassArea, total_door_area_m2: totalDoorArea })} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
          <Save className="h-4 w-4" /> Salvar ambiente
        </button>
      </div>
    </div>
  );
}
