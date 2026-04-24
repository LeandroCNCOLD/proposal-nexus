import * as React from "react";
import { Save } from "lucide-react";
import {
  ColdProField,
  ColdProInput,
  ColdProSelect,
  ColdProSectionTitle,
} from "./ColdProField";

type Props = {
  environment: any;
  insulationMaterials: any[];
  onSave: (patch: Record<string, unknown>) => void;
};

export function ColdProEnvironmentForm({ environment, insulationMaterials, onSave }: Props) {
  const [form, setForm] = React.useState<any>(environment);
  React.useEffect(() => setForm(environment), [environment]);
  const isTunnel = ["blast_freezer", "cooling_tunnel"].includes(form?.environment_type);
  const isClimatized = form?.environment_type === "climatized_room";
  const isSeed = form?.environment_type === "seed_storage";

  const set = (key: string, value: unknown) =>
    setForm((prev: any) => ({ ...prev, [key]: value }));

  const num = (key: string) => ({
    type: "number" as const,
    value: form?.[key] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      set(key, e.target.value === "" ? null : Number(e.target.value)),
  });

  // Volume calculado em tempo real
  const volume = React.useMemo(() => {
    const L = Number(form?.length_m ?? 0);
    const W = Number(form?.width_m ?? 0);
    const H = Number(form?.height_m ?? 0);
    return L * W * H;
  }, [form?.length_m, form?.width_m, form?.height_m]);

  return (
    <div className="rounded-xl border bg-background p-8 shadow-sm">
      {/* TIPO DE CÂMARA */}
      <ColdProSectionTitle>Tipo de câmara</ColdProSectionTitle>
      <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
        <div>
          <ColdProField label="Tipo de aplicação">
            <ColdProSelect
              value={form?.environment_type ?? "cold_room"}
              onChange={(e) => set("environment_type", e.target.value)}
            >
              <option value="cold_room">Câmara resfriados</option>
              <option value="freezer_room">Câmara congelados</option>
              <option value="antechamber">Antecâmara</option>
              <option value="blast_freezer">Túnel congelamento</option>
              <option value="cooling_tunnel">Túnel resfriamento</option>
              <option value="seed_storage">Câmara de sementes</option>
              <option value="climatized_room">Ambiente climatizado</option>
            </ColdProSelect>
          </ColdProField>
          <ColdProField label="Nome do ambiente">
            <ColdProInput
              type="text"
              value={form?.name ?? ""}
              onChange={(e) => set("name", e.target.value)}
              className="text-left"
            />
          </ColdProField>
          <ColdProField label="Isolamento">
            <ColdProSelect
              value={form?.insulation_material_id ?? ""}
              onChange={(e) => set("insulation_material_id", e.target.value)}
            >
              <option value="">Selecione</option>
              {insulationMaterials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </ColdProSelect>
          </ColdProField>
        </div>
        <div>
          <ColdProField label="Espessura parede" unit="mm">
            <ColdProInput {...num("wall_thickness_mm")} />
          </ColdProField>
          <ColdProField label="Espessura teto" unit="mm">
            <ColdProInput {...num("ceiling_thickness_mm")} />
          </ColdProField>
          <ColdProField label="Espessura piso" unit="mm">
            <ColdProInput {...num("floor_thickness_mm")} />
          </ColdProField>
        </div>
      </div>

      {/* DIMENSÕES */}
      <ColdProSectionTitle>Dimensões internas</ColdProSectionTitle>
      <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
        <div>
          <ColdProField label="Comprimento" unit="m">
            <ColdProInput {...num("length_m")} />
          </ColdProField>
          <ColdProField label="Largura" unit="m">
            <ColdProInput {...num("width_m")} />
          </ColdProField>
          <ColdProField label="Altura" unit="m">
            <ColdProInput {...num("height_m")} />
          </ColdProField>
        </div>
        <div>
          <ColdProField label="Volume interno" unit="m³">
            <ColdProInput readOnlyValue readOnly value={volume.toFixed(2)} />
          </ColdProField>
          <ColdProField label="Tempo compressor" unit="h/dia">
            <ColdProInput {...num("compressor_runtime_hours_day")} />
          </ColdProField>
          <ColdProField label="Operação diária" unit="h/dia">
            <ColdProInput {...num("operation_hours_day")} />
          </ColdProField>
        </div>
      </div>

      {/* CONDIÇÕES */}
      <ColdProSectionTitle>Condições de operação</ColdProSectionTitle>
      <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
        <div>
          <ColdProField label="Temperatura interna" unit="°C">
            <ColdProInput {...num("internal_temp_c")} />
          </ColdProField>
          {(isClimatized || isSeed) ? (
            <ColdProField label="Umidade relativa interna" unit="%">
              <ColdProInput {...num("relative_humidity_percent")} />
            </ColdProField>
          ) : null}
          {isTunnel ? (
            <ColdProField label="Temperatura de referência do processo" unit="°C">
              <ColdProInput {...num("internal_temp_c")} />
            </ColdProField>
          ) : null}
        </div>
        <div>
          <ColdProField label="Temperatura externa" unit="°C">
            <ColdProInput {...num("external_temp_c")} />
          </ColdProField>
          <ColdProField label="Temperatura sob o piso" unit="°C">
            <ColdProInput {...num("floor_temp_c")} />
          </ColdProField>
          <ColdProField label="Piso isolado">
            <ColdProSelect value={form?.has_floor_insulation ? "sim" : "nao"} onChange={(e) => set("has_floor_insulation", e.target.value === "sim")}>
              <option value="nao">Não</option>
              <option value="sim">Sim</option>
            </ColdProSelect>
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
          Salvar ambiente
        </button>
      </div>
    </div>
  );
}
