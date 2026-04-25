import type { ColdProState, ColdProApplicationMode } from "../types/coldPro.types";
import { Field, Section, inputClass, selectClass } from "./formBits";

const modes: Array<{ value: ColdProApplicationMode; label: string }> = [
  { value: "cold_room_chilled", label: "Câmara resfriados" },
  { value: "cold_room_frozen", label: "Câmara congelados" },
  { value: "seed_storage", label: "Armazenagem de sementes" },
  { value: "climatized_area", label: "Área climatizada" },
  { value: "continuous_girofreezer", label: "Giro freezer contínuo" },
  { value: "continuous_freezing_tunnel", label: "Túnel contínuo de congelamento" },
  { value: "continuous_cooling_tunnel", label: "Túnel contínuo de resfriamento" },
  { value: "static_freezing", label: "Congelamento estático" },
  { value: "static_cooling", label: "Resfriamento estático" },
];

export function ProjectDataTab({ state, setState }: { state: ColdProState; setState: (state: ColdProState) => void }) {
  const update = (patch: Partial<ColdProState["project"]>) => setState({ ...state, project: { ...state.project, ...patch } });
  return <Section title="Dados do Projeto"><div className="grid gap-4 md:grid-cols-2">
    <Field label="Nome do projeto"><input className={inputClass} value={state.project.name} onChange={(e) => update({ name: e.target.value })} /></Field>
    <Field label="Cliente"><input className={inputClass} value={state.project.customerName ?? ""} onChange={(e) => update({ customerName: e.target.value })} /></Field>
    <Field label="Modo de aplicação"><select className={selectClass} value={state.project.applicationMode} onChange={(e) => update({ applicationMode: e.target.value as ColdProApplicationMode })}>{modes.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></Field>
    <Field label="Altitude" unit="m"><input className={inputClass} type="number" value={state.project.altitudeM} onChange={(e) => update({ altitudeM: Number(e.target.value) })} /></Field>
    <Field label="Temperatura interna" unit="°C"><input className={inputClass} type="number" value={state.project.internalTempC} onChange={(e) => update({ internalTempC: Number(e.target.value) })} /></Field>
    <Field label="Temperatura externa" unit="°C"><input className={inputClass} type="number" value={state.project.externalTempC} onChange={(e) => update({ externalTempC: Number(e.target.value) })} /></Field>
    <div className="md:col-span-2"><Field label="Observações"><textarea className={`${inputClass} h-24 py-2`} value={state.project.notes ?? ""} onChange={(e) => update({ notes: e.target.value })} /></Field></div>
  </div></Section>;
}
