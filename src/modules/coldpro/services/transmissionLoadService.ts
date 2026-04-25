import type { ColdProProjectData, ColdProSurface } from "../types/coldPro.types";
import { round } from "../utils/numbers";
import { glassSolarWatts, glassTransmissionWatts, GLASS_U_VALUES_W_M2K } from "./glassLoadService";

export function calculateSurfaceTransmission(surface: ColdProSurface, project: Pick<ColdProProjectData, "internalTempC" | "externalTempC">) {
  const referenceTemp = surface.surfaceType === "floor" && !surface.hasFloorInsulation
    ? surface.soilTempC ?? 20
    : surface.externalTempC ?? project.externalTempC;
  const deltaT = Math.max(0, referenceTemp - project.internalTempC);
  const areaTotal = Math.max(0, surface.areaTotalM2);
  const areaGlass = Math.min(areaTotal, Math.max(0, surface.areaGlassM2));
  const areaDoor = Math.min(areaTotal - areaGlass, Math.max(0, surface.areaDoorM2));
  const areaOpaque = Math.max(0, areaTotal - areaGlass - areaDoor);
  const opaqueW = areaOpaque * surface.uOpaqueWM2K * deltaT;
  const glassW = glassTransmissionWatts(areaGlass, surface.glassType, deltaT);
  const doorW = areaDoor * surface.uDoorWM2K * deltaT;
  const solarW = glassSolarWatts(areaGlass, surface.solarLevel, surface.solarFactor);
  const totalW = opaqueW + glassW + doorW + solarW;
  return {
    label: surface.label,
    surfaceType: surface.surfaceType,
    areaTotalM2: round(areaTotal, 2),
    areaOpaqueM2: round(areaOpaque, 2),
    areaGlassM2: round(areaGlass, 2),
    areaDoorM2: round(areaDoor, 2),
    deltaT,
    uOpaqueWM2K: surface.uOpaqueWM2K,
    uGlassWM2K: GLASS_U_VALUES_W_M2K[surface.glassType],
    uDoorWM2K: surface.uDoorWM2K,
    opaqueW: round(opaqueW, 2),
    glassW: round(glassW, 2),
    doorW: round(doorW, 2),
    solarW: round(solarW, 2),
    totalW: round(totalW, 2),
    totalKw: round(totalW / 1000, 3),
  };
}

export function calculateTransmissionLoad(surfaces: ColdProSurface[], project: Pick<ColdProProjectData, "internalTempC" | "externalTempC">) {
  const bySurface = surfaces.map((surface) => calculateSurfaceTransmission(surface, project));
  const totalW = bySurface.reduce((sum, item) => sum + item.totalW, 0);
  const solarW = bySurface.reduce((sum, item) => sum + item.solarW, 0);
  const glassW = bySurface.reduce((sum, item) => sum + item.glassW, 0);
  return { totalKw: round(totalW / 1000, 3), totalW: round(totalW, 2), solarKw: round(solarW / 1000, 3), glassKw: round((glassW + solarW) / 1000, 3), bySurface };
}
