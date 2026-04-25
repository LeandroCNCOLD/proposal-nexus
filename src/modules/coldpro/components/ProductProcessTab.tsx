import type { ColdProState } from "../types/coldPro.types";
import { Field, Section, inputClass, selectClass } from "./formBits";

export function ProductProcessTab({ state, setState }: { state: ColdProState; setState: (state: ColdProState) => void }) {
  const update = (patch: Partial<ColdProState["process"]>) => setState({ ...state, process: { ...state.process, ...patch } });
  return <Section title="Produto / Processo"><div className="grid gap-4 md:grid-cols-4">
    <Field label="Produto"><input className={inputClass} value={state.process.productName} onChange={(e) => update({ productName: e.target.value })} /></Field>
    <Field label="Categoria"><input className={inputClass} value={state.process.productCategory ?? ""} onChange={(e) => update({ productCategory: e.target.value })} /></Field>
    <Field label="Operação"><select className={selectClass} value={state.process.operationMode} onChange={(e) => update({ operationMode: e.target.value as any })}><option value="batch">Batelada</option><option value="continuous">Contínuo</option></select></Field>
    <Field label="Produção" unit="kg/h"><input className={inputClass} type="number" value={state.process.productionKgH} onChange={(e) => update({ productionKgH: Number(e.target.value) })} /></Field>
    <Field label="Massa lote" unit="kg"><input className={inputClass} type="number" value={state.process.batchMassKg} onChange={(e) => update({ batchMassKg: Number(e.target.value) })} /></Field>
    <Field label="Tempo batelada" unit="h"><input className={inputClass} type="number" value={state.process.batchTimeH} onChange={(e) => update({ batchTimeH: Number(e.target.value) })} /></Field>
    <Field label="Ti" unit="°C"><input className={inputClass} type="number" value={state.process.inletTempC} onChange={(e) => update({ inletTempC: Number(e.target.value) })} /></Field>
    <Field label="Tf" unit="°C"><input className={inputClass} type="number" value={state.process.outletTempC} onChange={(e) => update({ outletTempC: Number(e.target.value) })} /></Field>
    <Field label="T congelamento" unit="°C"><input className={inputClass} type="number" value={state.process.freezingTempC} onChange={(e) => update({ freezingTempC: Number(e.target.value) })} /></Field>
    <Field label="Cp acima" unit="kJ/kg.K"><input className={inputClass} type="number" value={state.process.cpAboveKjKgK} onChange={(e) => update({ cpAboveKjKgK: Number(e.target.value) })} /></Field>
    <Field label="Cp abaixo" unit="kJ/kg.K"><input className={inputClass} type="number" value={state.process.cpBelowKjKgK} onChange={(e) => update({ cpBelowKjKgK: Number(e.target.value) })} /></Field>
    <Field label="Latente" unit="kJ/kg"><input className={inputClass} type="number" value={state.process.latentHeatKjKg} onChange={(e) => update({ latentHeatKjKg: Number(e.target.value) })} /></Field>
    <Field label="Retenção" unit="min"><input className={inputClass} type="number" value={state.process.retentionTimeMin ?? 0} onChange={(e) => update({ retentionTimeMin: Number(e.target.value) })} /></Field>
    <Field label="Espessura produto" unit="m"><input className={inputClass} type="number" step="0.001" value={state.process.productThicknessM ?? 0} onChange={(e) => update({ productThicknessM: Number(e.target.value) })} /></Field>
    <Field label="Densidade produto" unit="kg/m³"><input className={inputClass} type="number" value={state.process.productDensityKgM3 ?? 0} onChange={(e) => update({ productDensityKgM3: Number(e.target.value) })} /></Field>
    <Field label="Velocidade ar" unit="m/s"><input className={inputClass} type="number" value={state.process.airVelocityMS ?? 0} onChange={(e) => update({ airVelocityMS: Number(e.target.value) })} /></Field>
  </div></Section>;
}
