import * as React from "react";

type Props = { environment: any; insulationMaterials: any[]; onSave: (patch: Record<string, unknown>) => void };
export function ColdProEnvironmentForm({ environment, insulationMaterials, onSave }: Props) {
  const [form, setForm] = React.useState<any>(environment);
  React.useEffect(() => setForm(environment), [environment]);
  const set = (key: string, value: unknown) => setForm((prev: any) => ({ ...prev, [key]: value }));
  const input = (key: string, label: string, type = "number") => (
    <label className="space-y-1"><span className="text-xs text-muted-foreground">{label}</span><input type={type} className="w-full rounded-md border px-3 py-2 text-sm" value={form?.[key] ?? ""} onChange={(e) => set(key, type === "number" ? Number(e.target.value) : e.target.value)} /></label>
  );
  return <div className="rounded-2xl border bg-background p-4"><h3 className="mb-4 text-base font-semibold">Dados do ambiente</h3><div className="grid grid-cols-3 gap-3">
    {input("name", "Nome", "text")}{input("length_m", "Comprimento (m)")}{input("width_m", "Largura (m)")}{input("height_m", "Altura (m)")}{input("internal_temp_c", "Temp. interna (°C)")}{input("external_temp_c", "Temp. externa (°C)")}
    <label className="space-y-1"><span className="text-xs text-muted-foreground">Tipo de aplicação</span><select className="w-full rounded-md border px-3 py-2 text-sm" value={form?.environment_type ?? "cold_room"} onChange={(e) => set("environment_type", e.target.value)}><option value="cold_room">Câmara resfriados</option><option value="freezer_room">Câmara congelados</option><option value="antechamber">Antecâmara</option><option value="blast_freezer">Túnel congelamento</option><option value="cooling_tunnel">Túnel resfriamento</option><option value="seed_storage">Câmara sementes</option></select></label>
    <label className="space-y-1"><span className="text-xs text-muted-foreground">Isolamento</span><select className="w-full rounded-md border px-3 py-2 text-sm" value={form?.insulation_material_id ?? ""} onChange={(e) => set("insulation_material_id", e.target.value)}><option value="">Selecione</option>{insulationMaterials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
    {input("wall_thickness_mm", "Painel parede (mm)")}{input("ceiling_thickness_mm", "Painel teto (mm)")}{input("floor_thickness_mm", "Piso (mm)")}{input("compressor_runtime_hours_day", "Compressor h/dia")}{input("safety_factor_percent", "Segurança (%)")}{input("door_openings_per_day", "Aberturas/dia")}{input("door_width_m", "Largura porta (m)")}{input("door_height_m", "Altura porta (m)")}{input("infiltration_factor", "Fator infiltração")}{input("people_count", "Pessoas")}{input("people_hours_day", "Horas pessoas/dia")}{input("lighting_power_w", "Iluminação (W)")}{input("lighting_hours_day", "Horas iluminação")}{input("motors_power_kw", "Motores internos (kW)")}{input("motors_hours_day", "Horas motores")}{input("fans_kcal_h", "Ventiladores (kcal/h)")}{input("defrost_kcal_h", "Degelo (kcal/h)")}{input("other_kcal_h", "Outros (kcal/h)")}
  </div><div className="mt-4 flex justify-end"><button type="button" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" onClick={() => onSave(form)}>Salvar ambiente</button></div></div>;
}
