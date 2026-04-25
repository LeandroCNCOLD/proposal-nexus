import type { ColdProState } from "../types/coldPro.types";
import { calculateInfiltrationLoad } from "../services/infiltrationLoadService";
import { Field, Section, inputClass } from "./formBits";

export function InfiltrationTab({ state, setState }: { state: ColdProState; setState: (state: ColdProState) => void }) {
  const update = (patch: Partial<ColdProState["infiltration"]>) => setState({ ...state, infiltration: { ...state.infiltration, ...patch } });
  const calc = calculateInfiltrationLoad(state.infiltration);
  return <Section title="Infiltração"><div className="grid gap-4 md:grid-cols-4">
    <Field label="Altitude" unit="m"><input className={inputClass} type="number" value={state.infiltration.altitudeM} onChange={(e) => update({ altitudeM: Number(e.target.value) })} /></Field>
    <Field label="Volume infiltrado" unit="m³/h"><input className={inputClass} type="number" value={state.infiltration.airVolumeInfiltratedM3H} onChange={(e) => update({ airVolumeInfiltratedM3H: Number(e.target.value) })} /></Field>
    <Field label="Renovação" unit="m³/h"><input className={inputClass} type="number" value={state.infiltration.airRenovationM3H} onChange={(e) => update({ airRenovationM3H: Number(e.target.value) })} /></Field>
    <Field label="Aberturas/dia"><input className={inputClass} type="number" value={state.infiltration.doorOpeningsPerDay} onChange={(e) => update({ doorOpeningsPerDay: Number(e.target.value) })} /></Field>
    <Field label="Área porta" unit="m²"><input className={inputClass} type="number" value={state.infiltration.doorAreaM2} onChange={(e) => update({ doorAreaM2: Number(e.target.value) })} /></Field>
    <Field label="Fator abertura"><input className={inputClass} type="number" value={state.infiltration.openingFactor} onChange={(e) => update({ openingFactor: Number(e.target.value) })} /></Field>
    <Field label="Densidade ar" unit="kg/m³"><input className={inputClass} readOnly value={calc.densityKgM3} /></Field>
    <Field label="Carga" unit="kW"><input className={inputClass} readOnly value={calc.totalKw} /></Field>
  </div></Section>;
}
