import * as React from "react";
import { DoorOpen, Lightbulb, Save, ShieldPlus, Snowflake, Zap } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ColdProField, ColdProInput } from "./ColdProField";
import { ColdProCalculatedInfo, ColdProFormSection, ColdProValidationMessage, fmtColdPro, numberOrNull } from "./ColdProFormPrimitives";
import { calculateExtraLoadPreview, suggestedInfiltrationFactor } from "@/features/coldpro/extra-loads-preview";

type Props = { environment: any; catalogFanLoadKcalH?: number; onSave: (patch: Record<string, unknown>) => void };

export function ColdProExtraLoadsForm({ environment, catalogFanLoadKcalH = 0, onSave }: Props) {
  const [form, setForm] = React.useState<any>(environment);
  React.useEffect(() => setForm(environment), [environment]);
  const set = (key: string, value: unknown) => setForm((prev: any) => ({ ...prev, [key]: value }));
  const num = (key: string) => ({ type: "number" as const, value: form?.[key] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, numberOrNull(e.target.value)) });

  const hoursInvalid = [form.people_hours_day, form.lighting_hours_day, form.motors_hours_day].some((v) => Number(v ?? 0) < 0 || Number(v ?? 0) > 24);
  const negativeInvalid = [form.door_openings_per_day, form.door_width_m, form.door_height_m, form.infiltration_factor, form.air_changes_per_hour, form.fresh_air_m3_h, form.door_infiltration_m3_h, form.people_count, form.lighting_power_w, form.motors_power_kw, form.fans_kcal_h, form.defrost_kcal_h, form.other_kcal_h, form.safety_factor_percent].some((v) => Number(v ?? 0) < 0);
  const canSave = !hoursInvalid && !negativeInvalid;
  const preview = calculateExtraLoadPreview(form ?? {});
  const suggestedFactor = suggestedInfiltrationFactor(form ?? {});
  const internalPower = Number(form.lighting_power_w ?? 0) / 1000 + Number(form.motors_power_kw ?? 0);
  const save = () => onSave({ ...form, infiltration_factor: Number(form?.infiltration_factor ?? 0) > 0 ? form.infiltration_factor : suggestedFactor });

  return (
    <div className="min-w-0 rounded-xl border bg-background p-3 shadow-sm sm:p-5">
      <div className="mb-5 flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Cargas extras</h2>
          <p className="mt-1 text-sm text-muted-foreground">Renovação de ar, pessoas, iluminação, motores, ventiladores, degelo e fator de segurança.</p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 md:w-auto md:min-w-80">
          <ColdProCalculatedInfo label="Total automático" value={`${fmtColdPro(preview.subtotal_kcal_h)} kcal/h`} description="Infiltração + internas + adicionais" />
          <ColdProCalculatedInfo label="Com segurança" value={`${fmtColdPro(preview.total_with_safety_kcal_h)} kcal/h`} description="Total da aba + fator de segurança" tone="success" />
        </div>
      </div>

      <Accordion type="multiple" defaultValue={["infiltracao", "pessoas", "motores", "seguranca"]} className="space-y-3">
        <AccordionItem value="infiltracao" className="rounded-xl border px-4">
          <AccordionTrigger className="hover:no-underline"><span className="inline-flex items-center gap-2"><DoorOpen className="h-4 w-4 text-primary" /> Infiltração / renovação de ar</span></AccordionTrigger>
          <AccordionContent>
            <ColdProFormSection title="Ventilação através de portas" description="Dados usados para estimar a carga de infiltração por abertura de portas.">
              <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
                <div>
                  <ColdProField label="Aberturas por dia" unit="/dia"><ColdProInput {...num("door_openings_per_day")} /></ColdProField>
                  <ColdProField label="Largura da porta" unit="m"><ColdProInput {...num("door_width_m")} /></ColdProField>
                  <ColdProField label="Altura da porta" unit="m"><ColdProInput {...num("door_height_m")} /></ColdProField>
                </div>
                <div>
                  <ColdProField label="Fator infiltração"><ColdProInput {...num("infiltration_factor")} /></ColdProField>
                  <ColdProField label="Trocas de ar" unit="vol/h"><ColdProInput {...num("air_changes_per_hour")} /></ColdProField>
                  <ColdProField label="Ar externo contínuo" unit="m³/h"><ColdProInput {...num("fresh_air_m3_h")} /></ColdProField>
                  <ColdProField label="Infiltração porta" unit="m³/h"><ColdProInput {...num("door_infiltration_m3_h")} /></ColdProField>
                  <ColdProCalculatedInfo label="Carga de infiltração" value={`${fmtColdPro(preview.infiltration_kcal_h)} kcal/h`} description={`Área ${fmtColdPro(preview.doorArea)} m² · fator ${fmtColdPro(preview.infiltrationFactor)} · ar ${fmtColdPro(preview.continuousAirM3H)} m³/h`} tone={preview.infiltration_kcal_h > 0 ? "success" : "warning"} />
                </div>
              </div>
            </ColdProFormSection>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="gelo" className="rounded-xl border px-4">
          <AccordionTrigger className="hover:no-underline"><span className="inline-flex items-center gap-2"><Snowflake className="h-4 w-4 text-primary" /> Bloqueio por gelo no evaporador</span></AccordionTrigger>
          <AccordionContent>
            <ColdProFormSection title="Risco de gelo por abertura de portas" description="Estimativa técnica do efeito da umidade infiltrada sobre rendimento, bloqueio e carga adicional.">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <ColdProCalculatedInfo label="Gelo estimado" value={`${fmtColdPro(preview.evaporator_frost.frost_kg_day)} kg/dia`} description={`${fmtColdPro(preview.evaporator_frost.moisture_delta_g_m3)} g/m³ de umidade excedente`} tone={preview.evaporator_frost.frost_kg_day > 0 ? "warning" : "success"} />
                <ColdProCalculatedInfo label="Perda de rendimento" value={`${fmtColdPro(preview.evaporator_frost.efficiency_loss_percent)}%`} description={`Carga adicional ${fmtColdPro(preview.evaporator_frost.additional_load_kcal_h)} kcal/h`} tone={preview.evaporator_frost.efficiency_loss_percent > 10 ? "warning" : "success"} />
                <ColdProCalculatedInfo label="Degelo recomendado" value={preview.evaporator_frost.recommended_defrost_interval_h ? `${fmtColdPro(preview.evaporator_frost.recommended_defrost_interval_h)} h` : "Sem risco"} description="Intervalo preventivo estimado" />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <ColdProCalculatedInfo label="Operação normal" value={preview.evaporator_frost.normal_block_hours ? `${fmtColdPro(preview.evaporator_frost.normal_block_hours)} h` : "Sem bloqueio"} description="Tempo estimado até bloqueio" />
                <ColdProCalculatedInfo label="Operação arriscada" value={preview.evaporator_frost.risky_block_hours ? `${fmtColdPro(preview.evaporator_frost.risky_block_hours)} h` : "Sem bloqueio"} description="Portas/umidade acima do previsto" tone="warning" />
                <ColdProCalculatedInfo label="Operação complexa" value={preview.evaporator_frost.complex_block_hours ? `${fmtColdPro(preview.evaporator_frost.complex_block_hours)} h` : "Sem bloqueio"} description="Alta movimentação e alta umidade" tone="warning" />
              </div>
            </ColdProFormSection>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="pessoas" className="rounded-xl border px-4">
          <AccordionTrigger className="hover:no-underline"><span className="inline-flex items-center gap-2"><Lightbulb className="h-4 w-4 text-primary" /> Pessoas e iluminação</span></AccordionTrigger>
          <AccordionContent>
            <ColdProFormSection title="Ocupação e iluminação" description="Cargas internas ligadas à operação diária do ambiente.">
              <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
                <div>
                  <ColdProField label="Nº de pessoas" unit="un"><ColdProInput {...num("people_count")} /></ColdProField>
                  <ColdProField label="Horas de pessoas" unit="h/dia"><ColdProInput {...num("people_hours_day")} /></ColdProField>
                </div>
                <div>
                  <ColdProField label="Iluminação" unit="W"><ColdProInput {...num("lighting_power_w")} /></ColdProField>
                  <ColdProField label="Horas de iluminação" unit="h/dia"><ColdProInput {...num("lighting_hours_day")} /></ColdProField>
                  <ColdProCalculatedInfo label="Carga ocupação + iluminação" value={`${fmtColdPro(preview.people_kcal_h + preview.lighting_kcal_h)} kcal/h`} description={`Pessoas ${fmtColdPro(preview.people_kcal_h)} · iluminação ${fmtColdPro(preview.lighting_kcal_h)}`} />
                </div>
              </div>
            </ColdProFormSection>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="motores" className="rounded-xl border px-4">
          <AccordionTrigger className="hover:no-underline"><span className="inline-flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Motores e outras cargas</span></AccordionTrigger>
          <AccordionContent>
            <ColdProFormSection title="Cargas elétricas e adicionais" description="Motores internos, ventiladores, degelo e demais cargas informadas manualmente.">
              <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
                <div>
                  <ColdProField label="Motores internos" unit="kW"><ColdProInput {...num("motors_power_kw")} /></ColdProField>
                  <ColdProField label="Horas de motores" unit="h/dia"><ColdProInput {...num("motors_hours_day")} /></ColdProField>
                  <ColdProField label="Ventiladores" unit="kcal/h"><ColdProInput {...num("fans_kcal_h")} /></ColdProField>
                  {catalogFanLoadKcalH > 0 ? <button type="button" onClick={() => set("fans_kcal_h", catalogFanLoadKcalH)} className="mb-4 rounded-md border bg-background px-3 py-2 text-xs font-medium hover:bg-muted">Usar ventiladores do catálogo ({fmtColdPro(catalogFanLoadKcalH)} kcal/h)</button> : null}
                </div>
                <div>
                  <ColdProField label="Degelo" unit="kcal/h"><ColdProInput {...num("defrost_kcal_h")} /></ColdProField>
                  <ColdProField label="Outras cargas" unit="kcal/h"><ColdProInput {...num("other_kcal_h")} /></ColdProField>
                  <ColdProCalculatedInfo label="Motores e cargas adicionais" value={`${fmtColdPro(preview.motors_kcal_h + preview.fans_kcal_h + preview.defrost_kcal_h + preview.other_kcal_h)} kcal/h`} description={`Potência elétrica base ${fmtColdPro(internalPower)} kW`} />
                </div>
              </div>
            </ColdProFormSection>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="seguranca" className="rounded-xl border px-4">
          <AccordionTrigger className="hover:no-underline"><span className="inline-flex items-center gap-2"><ShieldPlus className="h-4 w-4 text-primary" /> Segurança</span></AccordionTrigger>
          <AccordionContent>
            <ColdProFormSection title="Fator de segurança" description="Margem aplicada sobre o subtotal calculado.">
              <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
                <ColdProField label="Fator de segurança" unit="%"><ColdProInput {...num("safety_factor_percent")} /></ColdProField>
                <ColdProCalculatedInfo label="Carga de segurança" value={`${fmtColdPro(preview.safety_kcal_h)} kcal/h`} description={`${fmtColdPro(form?.safety_factor_percent)}% sobre ${fmtColdPro(preview.subtotal_kcal_h)} kcal/h`} tone={Number(form?.safety_factor_percent ?? 0) >= 0 ? "success" : "warning"} />
              </div>
            </ColdProFormSection>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="mt-4 space-y-1">
        <ColdProValidationMessage tone="error">{hoursInvalid ? "Horas devem estar entre 0 e 24." : ""}</ColdProValidationMessage>
        <ColdProValidationMessage tone="error">{negativeInvalid ? "Valores de cargas, dimensões e quantidades não podem ser negativos." : ""}</ColdProValidationMessage>
      </div>

      <div className="mt-5 flex justify-end border-t pt-4">
        <button type="button" disabled={!canSave} onClick={save} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
          <Save className="h-4 w-4" /> Salvar cargas extras
        </button>
      </div>
    </div>
  );
}
