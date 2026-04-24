import * as React from "react";

type Props = { environment: any; onSave: (patch: Record<string, unknown>) => void };

export function ColdProExtraLoadsForm({ environment, onSave }: Props) {
  const [form, setForm] = React.useState<any>(environment);
  React.useEffect(() => setForm(environment), [environment]);
  const set = (key: string, value: unknown) =>
    setForm((prev: any) => ({ ...prev, [key]: value }));

  const input = (key: string, label: string, suffix?: string) => (
    <label className="space-y-1">
      <span className="text-xs text-muted-foreground">
        {label}
        {suffix ? <span className="ml-1 text-muted-foreground/60">({suffix})</span> : null}
      </span>
      <input
        type="number"
        className="w-full rounded-md border px-3 py-2 text-sm"
        value={form?.[key] ?? ""}
        onChange={(e) => set(key, Number(e.target.value))}
      />
    </label>
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-background p-4">
        <h3 className="mb-4 text-base font-semibold">Infiltração por portas</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {input("door_openings_per_day", "Aberturas/dia")}
          {input("door_width_m", "Largura porta", "m")}
          {input("door_height_m", "Altura porta", "m")}
          {input("infiltration_factor", "Fator infiltração")}
        </div>
      </section>

      <section className="rounded-2xl border bg-background p-4">
        <h3 className="mb-4 text-base font-semibold">Pessoas e iluminação</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {input("people_count", "Pessoas")}
          {input("people_hours_day", "Horas pessoas/dia")}
          {input("lighting_power_w", "Iluminação", "W")}
          {input("lighting_hours_day", "Horas iluminação")}
        </div>
      </section>

      <section className="rounded-2xl border bg-background p-4">
        <h3 className="mb-4 text-base font-semibold">Motores e cargas extras</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {input("motors_power_kw", "Motores internos", "kW")}
          {input("motors_hours_day", "Horas motores")}
          {input("fans_kcal_h", "Ventiladores", "kcal/h")}
          {input("defrost_kcal_h", "Degelo", "kcal/h")}
          {input("other_kcal_h", "Outros", "kcal/h")}
          {input("safety_factor_percent", "Fator de segurança", "%")}
          {input("compressor_runtime_hours_day", "Compressor", "h/dia")}
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          onClick={() => onSave(form)}
        >
          Salvar cargas extras
        </button>
      </div>
    </div>
  );
}
