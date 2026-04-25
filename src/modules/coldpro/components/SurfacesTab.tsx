import type { ColdProGlassType, ColdProSolarLevel, ColdProState } from "../types/coldPro.types";
import { calculateSurfaceTransmission } from "../services/transmissionLoadService";
import { Field, Section, inputClass, selectClass } from "./formBits";

const glassTypes: ColdProGlassType[] = ["none", "vidro_simples", "vidro_duplo", "vidro_triplo", "low_e_duplo", "vidro_frigorifico_aquecido"];
const solarLevels: ColdProSolarLevel[] = ["sem_sol", "moderado", "forte", "critico"];

export function SurfacesTab({ state, setState }: { state: ColdProState; setState: (state: ColdProState) => void }) {
  const updateSurface = (index: number, patch: any) => setState({ ...state, surfaces: state.surfaces.map((s, i) => i === index ? { ...s, ...patch } : s) });
  return <Section title="Isolamento / Superfícies"><div className="space-y-3">
    {state.surfaces.map((surface, index) => {
      const calc = calculateSurfaceTransmission(surface, state.project);
      return <div key={surface.label} className="rounded-md border p-3"><div className="mb-3 flex items-center justify-between gap-3"><b>{surface.label}</b><span className="text-sm text-muted-foreground">{calc.totalKw} kW</span></div>
        <div className="grid gap-3 md:grid-cols-6">
          <Field label="Área total" unit="m²"><input className={inputClass} type="number" value={surface.areaTotalM2} onChange={(e) => updateSurface(index, { areaTotalM2: Number(e.target.value) })} /></Field>
          <Field label="Área vidro" unit="m²"><input className={inputClass} type="number" value={surface.areaGlassM2} onChange={(e) => updateSurface(index, { areaGlassM2: Number(e.target.value) })} /></Field>
          <Field label="Área porta" unit="m²"><input className={inputClass} type="number" value={surface.areaDoorM2} onChange={(e) => updateSurface(index, { areaDoorM2: Number(e.target.value) })} /></Field>
          <Field label="U opaco"><input className={inputClass} type="number" step="0.01" value={surface.uOpaqueWM2K} onChange={(e) => updateSurface(index, { uOpaqueWM2K: Number(e.target.value) })} /></Field>
          <Field label="Vidro"><select className={selectClass} value={surface.glassType} onChange={(e) => updateSurface(index, { glassType: e.target.value as ColdProGlassType })}>{glassTypes.map((g) => <option key={g} value={g}>{g}</option>)}</select></Field>
          <Field label="Sol"><select className={selectClass} value={surface.solarLevel} onChange={(e) => updateSurface(index, { solarLevel: e.target.value as ColdProSolarLevel })}>{solarLevels.map((s) => <option key={s} value={s}>{s}</option>)}</select></Field>
        </div></div>;
    })}
  </div></Section>;
}
