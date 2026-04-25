import * as React from "react";
import { Activity, Cloud, Droplets, Flame, Save, Sprout } from "lucide-react";
import { calculateAdvancedProcess } from "@/modules/coldpro/services/advancedProcesses/advancedProcessEngine";
import { ColdProField, ColdProInput, ColdProSelect } from "./ColdProField";
import { ColdProCalculatedInfo, ColdProFormSection, fmtColdPro, numberOrNull } from "./ColdProFormPrimitives";

const PROCESS_TYPES = [
  ["none", "Nenhum"],
  ["seed_humidity_control", "Sementes / controle de umidade"],
  ["banana_ripening", "Banana / maturação"],
  ["citrus_degreening", "Citros / desverdecimento"],
  ["potato_co2_control", "Batata / controle de CO₂"],
  ["controlled_atmosphere", "Atmosfera controlada"],
  ["ethylene_application", "Aplicação de etileno"],
  ["ethylene_removal", "Remoção de etileno"],
  ["co2_scrubbing", "Scrubber / remoção de CO₂"],
  ["humidity_control", "Controle de umidade"],
];

function n(value: unknown) {
  return Number(value ?? 0);
}

function field(name: string, label: string, unit: string | undefined, value: any, setDraft: React.Dispatch<React.SetStateAction<any>>) {
  return (
    <ColdProField label={label} unit={unit}>
      <ColdProInput type="number" step="any" value={value?.[name] ?? ""} onChange={(e) => setDraft((old: any) => ({ ...old, [name]: numberOrNull(e.target.value) }))} />
    </ColdProField>
  );
}

export function ColdProAdvancedProcessForm({ projectId, environment, process, onSave }: { projectId: string; environment: any; process?: any; onSave: (payload: any) => void }) {
  const [draft, setDraft] = React.useState<any>(() => ({
    id: process?.id,
    project_id: projectId,
    environment_id: environment?.id,
    advanced_process_type: process?.advanced_process_type ?? (environment?.environment_type === "seed_storage" ? "seed_humidity_control" : "none"),
    product_name: process?.product_name ?? "",
    product_mass_kg: process?.product_mass_kg ?? environment?.seed_mass_kg ?? 0,
    chamber_volume_m3: process?.chamber_volume_m3 ?? environment?.volume_m3 ?? 0,
    target_temperature_c: process?.target_temperature_c ?? environment?.internal_temp_c ?? 0,
    target_relative_humidity: process?.target_relative_humidity ?? environment?.relative_humidity_percent ?? 0,
    process_time_h: process?.process_time_h ?? 24,
    technical_notes: process?.technical_notes ?? "",
    external_temperature_c: process?.external_temperature_c ?? environment?.external_temp_c ?? 35,
    external_relative_humidity: process?.external_relative_humidity ?? environment?.external_relative_humidity_percent ?? 70,
    internal_temperature_c: process?.internal_temperature_c ?? environment?.internal_temp_c ?? 0,
    internal_relative_humidity: process?.internal_relative_humidity ?? environment?.relative_humidity_percent ?? 60,
    air_changes_per_hour: process?.air_changes_per_hour ?? environment?.air_changes_per_hour ?? 0,
    product_initial_moisture: process?.product_initial_moisture ?? environment?.seed_initial_moisture_percent ?? 0,
    product_final_moisture: process?.product_final_moisture ?? environment?.seed_final_moisture_percent ?? 0,
    stabilization_time_h: process?.stabilization_time_h ?? environment?.seed_stabilization_time_h ?? 24,
    ethylene_target_ppm: process?.ethylene_target_ppm ?? 0,
    ethylene_exposure_time_h: process?.ethylene_exposure_time_h ?? 24,
    ethylene_renewal_after_application: process?.ethylene_renewal_after_application ?? false,
    co2_generation_rate_m3_kg_h: process?.co2_generation_rate_m3_kg_h ?? 0,
    co2_limit_percent: process?.co2_limit_percent ?? 0,
    external_co2_percent: process?.external_co2_percent ?? 0.04,
    storage_time_h: process?.storage_time_h ?? 0,
    o2_target_percent: process?.o2_target_percent ?? 0,
    co2_target_percent: process?.co2_target_percent ?? 0,
    respiration_rate_w_kg: process?.respiration_rate_w_kg ?? 0,
    purge_airflow_m3_h: process?.purge_airflow_m3_h ?? 0,
    scrubber_enabled: process?.scrubber_enabled ?? false,
    air_renewal_m3_h: process?.air_renewal_m3_h ?? 0,
  }));
  const result = React.useMemo(() => calculateAdvancedProcess(draft), [draft]);

  return (
    <div className="space-y-4">
      <ColdProFormSection title="Processos Especiais / Atmosfera Controlada" description="Camada adicional para pós-colheita, umidade, etileno, CO₂ e atmosfera controlada." icon={<Activity className="h-4 w-4" />}>
        <div className="grid gap-3 lg:grid-cols-2">
          <ColdProField label="Tipo de processo">
            <ColdProSelect value={draft.advanced_process_type} onChange={(e) => setDraft((old: any) => ({ ...old, advanced_process_type: e.target.value }))}>
              {PROCESS_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </ColdProSelect>
          </ColdProField>
          <ColdProField label="Produto">
            <ColdProInput type="text" className="text-left" value={draft.product_name ?? ""} onChange={(e) => setDraft((old: any) => ({ ...old, product_name: e.target.value }))} />
          </ColdProField>
          {field("product_mass_kg", "Massa armazenada", "kg", draft, setDraft)}
          {field("chamber_volume_m3", "Volume da câmara", "m³", draft, setDraft)}
          {field("target_temperature_c", "Temperatura alvo", "°C", draft, setDraft)}
          {field("target_relative_humidity", "Umidade alvo", "%", draft, setDraft)}
          {field("process_time_h", "Tempo de processo", "h", draft, setDraft)}
          <ColdProField label="Observações técnicas">
            <textarea className="min-h-20 w-full rounded-md border border-transparent bg-muted/40 px-3 py-2 text-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15" value={draft.technical_notes ?? ""} onChange={(e) => setDraft((old: any) => ({ ...old, technical_notes: e.target.value }))} />
          </ColdProField>
        </div>
      </ColdProFormSection>

      <ColdProFormSection title="Controle de umidade" icon={<Droplets className="h-4 w-4" />}>
        <div className="grid gap-3 lg:grid-cols-2">
          {field("external_temperature_c", "Temperatura externa", "°C", draft, setDraft)}
          {field("external_relative_humidity", "Umidade externa", "%", draft, setDraft)}
          {field("internal_temperature_c", "Temperatura interna", "°C", draft, setDraft)}
          {field("internal_relative_humidity", "Umidade interna alvo", "%", draft, setDraft)}
          {field("air_changes_per_hour", "Trocas de ar", "1/h", draft, setDraft)}
          {field("air_renewal_m3_h", "Renovação manual", "m³/h", draft, setDraft)}
          {field("product_initial_moisture", "Umidade inicial produto", "%", draft, setDraft)}
          {field("product_final_moisture", "Umidade final desejada", "%", draft, setDraft)}
          {field("stabilization_time_h", "Tempo estabilização", "h", draft, setDraft)}
        </div>
      </ColdProFormSection>

      <ColdProFormSection title="Etileno / maturação / desverdecimento" icon={<Flame className="h-4 w-4" />}>
        <div className="grid gap-3 lg:grid-cols-2">
          {field("ethylene_target_ppm", "PPM alvo de etileno", "ppm", draft, setDraft)}
          {field("ethylene_exposure_time_h", "Tempo de exposição", "h", draft, setDraft)}
          <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={Boolean(draft.ethylene_renewal_after_application)} onChange={(e) => setDraft((old: any) => ({ ...old, ethylene_renewal_after_application: e.target.checked }))} /> Renovação após aplicação</label>
        </div>
      </ColdProFormSection>

      <ColdProFormSection title="CO₂ / respiração / purga" icon={<Cloud className="h-4 w-4" />}>
        <div className="grid gap-3 lg:grid-cols-2">
          {field("co2_generation_rate_m3_kg_h", "Taxa geração CO₂", "m³/kg·h", draft, setDraft)}
          {field("co2_limit_percent", "Limite máximo CO₂", "%", draft, setDraft)}
          {field("external_co2_percent", "CO₂ externo", "%", draft, setDraft)}
          {field("purge_airflow_m3_h", "Vazão de purga manual", "m³/h", draft, setDraft)}
          {field("respiration_rate_w_kg", "Taxa respiração", "W/kg", draft, setDraft)}
          {field("storage_time_h", "Tempo armazenamento", "h", draft, setDraft)}
        </div>
      </ColdProFormSection>

      <ColdProFormSection title="Atmosfera controlada" icon={<Sprout className="h-4 w-4" />}>
        <div className="grid gap-3 lg:grid-cols-2">
          {field("o2_target_percent", "O₂ alvo", "%", draft, setDraft)}
          {field("co2_target_percent", "CO₂ alvo", "%", draft, setDraft)}
          <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={Boolean(draft.scrubber_enabled)} onChange={(e) => setDraft((old: any) => ({ ...old, scrubber_enabled: e.target.checked }))} /> Sistema de scrubber</label>
        </div>
      </ColdProFormSection>

      <div className="rounded-xl border bg-background p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">Resultado técnico do processo especial</h3>
          <button type="button" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" onClick={() => onSave(draft)}><Save className="h-4 w-4" /> Salvar processo</button>
        </div>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          <ColdProCalculatedInfo label="Água do ar" value={`${fmtColdPro(result.humidity?.water_removed_air_kg_h)} kg/h`} />
          <ColdProCalculatedInfo label="Água do produto" value={`${fmtColdPro(result.humidity?.water_removed_product_kg_h)} kg/h`} />
          <ColdProCalculatedInfo label="Latente umidade" value={`${fmtColdPro(result.humidity?.total_kw)} kW`} />
          <ColdProCalculatedInfo label="Etileno teórico" value={`${fmtColdPro(result.ethylene?.ethylene_volume_l, 3)} L`} />
          <ColdProCalculatedInfo label="CO₂ gerado" value={`${fmtColdPro(result.co2?.co2_generated_m3_h, 5)} m³/h`} />
          <ColdProCalculatedInfo label="Purga mínima" value={`${fmtColdPro(result.co2?.purge_airflow_m3_h)} m³/h`} />
          <ColdProCalculatedInfo label="Carga purga" value={`${fmtColdPro(result.co2?.purge_thermal_load_kw)} kW`} />
          <ColdProCalculatedInfo label="Respiração" value={`${fmtColdPro(result.controlled_atmosphere?.respiration_load_kw)} kW`} />
        </div>
        {result.warnings.length ? <div className="mt-4 rounded-md bg-muted p-3 text-xs text-muted-foreground">{result.warnings.join(" ")}</div> : null}
        <div className="mt-3 text-xs text-muted-foreground">Carga adicional total: <b>{fmtColdPro(result.total_additional_kcal_h)} kcal/h</b> · {fmtColdPro(result.total_additional_kw)} kW</div>
      </div>
    </div>
  );
}
