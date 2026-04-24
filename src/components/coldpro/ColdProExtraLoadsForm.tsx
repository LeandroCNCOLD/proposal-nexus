import * as React from "react";
import { Save } from "lucide-react";
import {
  ColdProField,
  ColdProInput,
  ColdProSectionTitle,
} from "./ColdProField";

type Props = { environment: any; onSave: (patch: Record<string, unknown>) => void };

export function ColdProExtraLoadsForm({ environment, onSave }: Props) {
  const [form, setForm] = React.useState<any>(environment);
  React.useEffect(() => setForm(environment), [environment]);
  const set = (key: string, value: unknown) =>
    setForm((prev: any) => ({ ...prev, [key]: value }));

  const num = (key: string) => ({
    type: "number" as const,
    value: form?.[key] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      set(key, e.target.value === "" ? null : Number(e.target.value)),
  });

  return (
    <div className="rounded-xl border bg-background p-8 shadow-sm">
      <ColdProSectionTitle>Infiltração por portas</ColdProSectionTitle>
      <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
        <div>
          <ColdProField label="Aberturas por dia" unit="/dia">
            <ColdProInput {...num("door_openings_per_day")} />
          </ColdProField>
          <ColdProField label="Largura da porta" unit="m">
            <ColdProInput {...num("door_width_m")} />
          </ColdProField>
        </div>
        <div>
          <ColdProField label="Altura da porta" unit="m">
            <ColdProInput {...num("door_height_m")} />
          </ColdProField>
          <ColdProField label="Fator infiltração">
            <ColdProInput {...num("infiltration_factor")} />
          </ColdProField>
        </div>
      </div>

      <ColdProSectionTitle>Pessoas e iluminação</ColdProSectionTitle>
      <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
        <div>
          <ColdProField label="Nº de pessoas" unit="un">
            <ColdProInput {...num("people_count")} />
          </ColdProField>
          <ColdProField label="Horas de pessoas" unit="h/dia">
            <ColdProInput {...num("people_hours_day")} />
          </ColdProField>
        </div>
        <div>
          <ColdProField label="Iluminação" unit="W">
            <ColdProInput {...num("lighting_power_w")} />
          </ColdProField>
          <ColdProField label="Horas de iluminação" unit="h/dia">
            <ColdProInput {...num("lighting_hours_day")} />
          </ColdProField>
        </div>
      </div>

      <ColdProSectionTitle>Motores e cargas extras</ColdProSectionTitle>
      <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
        <div>
          <ColdProField label="Motores internos" unit="kW">
            <ColdProInput {...num("motors_power_kw")} />
          </ColdProField>
          <ColdProField label="Horas de motores" unit="h/dia">
            <ColdProInput {...num("motors_hours_day")} />
          </ColdProField>
          <ColdProField label="Ventiladores" unit="kcal/h">
            <ColdProInput {...num("fans_kcal_h")} />
          </ColdProField>
        </div>
        <div>
          <ColdProField label="Degelo" unit="kcal/h">
            <ColdProInput {...num("defrost_kcal_h")} />
          </ColdProField>
          <ColdProField label="Outras cargas" unit="kcal/h">
            <ColdProInput {...num("other_kcal_h")} />
          </ColdProField>
          <ColdProField label="Fator de segurança" unit="%">
            <ColdProInput {...num("safety_factor_percent")} />
          </ColdProField>
        </div>
      </div>

      <div className="mt-8 flex justify-end border-t border-border pt-4">
        <button
          type="button"
          onClick={() => onSave(form)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          <Save className="h-4 w-4" />
          Salvar cargas extras
        </button>
      </div>
    </div>
  );
}
