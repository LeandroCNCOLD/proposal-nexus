import type { ColdProState } from "../types/coldPro.types";
import { Field, Section, inputClass } from "./formBits";

export function InternalLoadsTab({ state, setState }: { state: ColdProState; setState: (state: ColdProState) => void }) {
  const update = (patch: Partial<ColdProState["internalLoads"]>) => setState({ ...state, internalLoads: { ...state.internalLoads, ...patch } });
  return <Section title="Cargas Internas"><div className="grid gap-4 md:grid-cols-4">
    <Field label="Pessoas"><input className={inputClass} type="number" value={state.internalLoads.peopleQuantity} onChange={(e) => update({ peopleQuantity: Number(e.target.value) })} /></Field>
    <Field label="Carga por pessoa" unit="W"><input className={inputClass} type="number" value={state.internalLoads.peopleLoadW} onChange={(e) => update({ peopleLoadW: Number(e.target.value) })} /></Field>
    <Field label="Iluminação" unit="W/m²"><input className={inputClass} type="number" value={state.internalLoads.lightingWM2} onChange={(e) => update({ lightingWM2: Number(e.target.value) })} /></Field>
    <Field label="Área iluminação" unit="m²"><input className={inputClass} type="number" value={state.internalLoads.lightingAreaM2} onChange={(e) => update({ lightingAreaM2: Number(e.target.value) })} /></Field>
    <Field label="Motores" unit="kW"><input className={inputClass} type="number" value={state.internalLoads.motorsPowerKw} onChange={(e) => update({ motorsPowerKw: Number(e.target.value) })} /></Field>
    <Field label="Embalagem" unit="kg"><input className={inputClass} type="number" value={state.internalLoads.packagingMassKg} onChange={(e) => update({ packagingMassKg: Number(e.target.value) })} /></Field>
    <Field label="Respiração" unit="W/kg"><input className={inputClass} type="number" value={state.internalLoads.respirationRateWKg} onChange={(e) => update({ respirationRateWKg: Number(e.target.value) })} /></Field>
    <Field label="Massa respiração" unit="kg"><input className={inputClass} type="number" value={state.internalLoads.respirationMassKg} onChange={(e) => update({ respirationMassKg: Number(e.target.value) })} /></Field>
    <Field label="Fator segurança"><input className={inputClass} type="number" step="0.01" value={state.internalLoads.safetyFactor} onChange={(e) => update({ safetyFactor: Number(e.target.value) })} /></Field>
    <Field label="Fator degelo"><input className={inputClass} type="number" step="0.01" value={state.internalLoads.defrostFactor} onChange={(e) => update({ defrostFactor: Number(e.target.value) })} /></Field>
    <Field label="Fator ventiladores"><input className={inputClass} type="number" step="0.01" value={state.internalLoads.fanFactor} onChange={(e) => update({ fanFactor: Number(e.target.value) })} /></Field>
    <Field label="Fator operacional"><input className={inputClass} type="number" step="0.01" value={state.internalLoads.operationalFactor} onChange={(e) => update({ operationalFactor: Number(e.target.value) })} /></Field>
  </div></Section>;
}
