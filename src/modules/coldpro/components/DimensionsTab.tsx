import type { ColdProState } from "../types/coldPro.types";
import { calculateVolumeM3, defaultSurfaces } from "../services/surfaceAreaService";
import { Field, Section, inputClass } from "./formBits";

export function DimensionsTab({ state, setState }: { state: ColdProState; setState: (state: ColdProState) => void }) {
  const update = (patch: Partial<ColdProState["dimensions"]>) => {
    const dimensions = { ...state.dimensions, ...patch };
    dimensions.volumeM3 = calculateVolumeM3(dimensions);
    setState({ ...state, dimensions, infiltration: { ...state.infiltration, internalTempC: state.project.internalTempC, externalTempC: state.project.externalTempC }, surfaces: defaultSurfaces(dimensions, state.project.externalTempC) });
  };
  return <Section title="Dimensões"><div className="grid gap-4 md:grid-cols-4">
    <Field label="Comprimento" unit="m"><input className={inputClass} type="number" value={state.dimensions.lengthM} onChange={(e) => update({ lengthM: Number(e.target.value) })} /></Field>
    <Field label="Largura" unit="m"><input className={inputClass} type="number" value={state.dimensions.widthM} onChange={(e) => update({ widthM: Number(e.target.value) })} /></Field>
    <Field label="Altura" unit="m"><input className={inputClass} type="number" value={state.dimensions.heightM} onChange={(e) => update({ heightM: Number(e.target.value) })} /></Field>
    <Field label="Volume" unit="m³"><input className={inputClass} readOnly value={state.dimensions.volumeM3} /></Field>
  </div></Section>;
}
