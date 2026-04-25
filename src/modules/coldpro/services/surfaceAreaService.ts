import type { ColdProDimensions, ColdProSurface } from "../types/coldPro.types";
import { round } from "../utils/numbers";

export function calculateVolumeM3(dimensions: Pick<ColdProDimensions, "lengthM" | "widthM" | "heightM">) {
  return round(Math.max(0, dimensions.lengthM) * Math.max(0, dimensions.widthM) * Math.max(0, dimensions.heightM), 3);
}

export function defaultSurfaces(dimensions: ColdProDimensions, externalTempC: number): ColdProSurface[] {
  const ceilingFloor = round(dimensions.lengthM * dimensions.widthM, 2);
  const wallLong = round(dimensions.lengthM * dimensions.heightM, 2);
  const wallShort = round(dimensions.widthM * dimensions.heightM, 2);
  const base = { areaGlassM2: 0, areaDoorM2: 0, uOpaqueWM2K: 0.25, uDoorWM2K: 1.5, glassType: "none" as const, solarLevel: "sem_sol" as const, solarFactor: 0.75, externalTempC };
  return [
    { ...base, surfaceType: "ceiling", label: "Teto", areaTotalM2: ceilingFloor },
    { ...base, surfaceType: "wall", label: "Parede 1", areaTotalM2: wallLong },
    { ...base, surfaceType: "wall", label: "Parede 2", areaTotalM2: wallShort },
    { ...base, surfaceType: "wall", label: "Parede 3", areaTotalM2: wallLong },
    { ...base, surfaceType: "wall", label: "Parede 4", areaTotalM2: wallShort },
    { ...base, surfaceType: "floor", label: "Piso", areaTotalM2: ceilingFloor, soilTempC: 20, hasFloorInsulation: true },
  ];
}
