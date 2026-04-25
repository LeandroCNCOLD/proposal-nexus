import * as React from "react";
import { Box, Ruler, Save, ShieldCheck, Thermometer } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ColdProField,
  ColdProInput,
  ColdProSelect,
} from "./ColdProField";
import {
  ColdProCalculatedInfo,
  ColdProFieldHint,
  ColdProFormSection,
  ColdProValidationMessage,
  fmtColdPro,
  numberOrNull,
} from "./ColdProFormPrimitives";

type Props = {
  environment: any;
  insulationMaterials: any[];
  onSave: (patch: Record<string, unknown>) => void;
};

const APPLICATIONS = [
  { value: "cold_room", label: "Câmara resfriados" },
  { value: "freezer_room", label: "Câmara congelados" },
  { value: "antechamber", label: "Antecâmara" },
  { value: "blast_freezer", label: "Túnel congelamento" },
  { value: "cooling_tunnel", label: "Túnel resfriamento" },
  { value: "seed_storage", label: "Câmara de sementes" },
  { value: "climatized_room", label: "Ambiente climatizado" },
];

export function ColdProEnvironmentForm({ environment, insulationMaterials, onSave }: Props) {
  const [form, setForm] = React.useState<any>(environment);
  React.useEffect(() => setForm(environment), [environment]);

  const isClimatized = form?.environment_type === "climatized_room";
  const isSeed = form?.environment_type === "seed_storage";

  const set = (key: string, value: unknown) => setForm((prev: any) => ({ ...prev, [key]: value }));

  const num = (key: string) => ({
    type: "number" as const,
    value: form?.[key] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, numberOrNull(e.target.value)),
  });

  const volume = React.useMemo(() => Number(form?.length_m ?? 0) * Number(form?.width_m ?? 0) * Number(form?.height_m ?? 0), [form?.length_m, form?.width_m, form?.height_m]);
  const deltaT = Number(form?.external_temp_c ?? 0) - Number(form?.internal_temp_c ?? 0);
  const dimensionError = ["length_m", "width_m", "height_m"].some((key) => Number(form?.[key] ?? 0) <= 0);
  const hoursError = Number(form?.operation_hours_day ?? 0) < 0 || Number(form?.operation_hours_day ?? 0) > 24 || Number(form?.compressor_runtime_hours_day ?? 0) < 0 || Number(form?.compressor_runtime_hours_day ?? 0) > 24;
  const safetyError = Number(form?.safety_factor_percent ?? 0) < 0;
  const canSave = !dimensionError && !hoursError && !safetyError && String(form?.name ?? "").trim().length > 0;

  return (
    <div className="rounded-xl border bg-background p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Ambiente</h2>
          <p className="mt-1 text-sm text-muted-foreground">Dimensões, temperatura, umidade e isolamento do espaço refrigerado.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:min-w-80">
          <ColdProCalculatedInfo label="Volume" value={`${fmtColdPro(volume)} m³`} description="Calculado pelas dimensões internas" />
          <ColdProCalculatedInfo label="ΔT" value={`${fmtColdPro(deltaT)} °C`} description="Externa menos interna" tone={deltaT > 0 ? "info" : "warning"} />
        </div>
      </div>

      <Tabs defaultValue="gerais" className="w-full">
        <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1 p-1">
          <TabsTrigger value="gerais">Dados gerais</TabsTrigger>
          <TabsTrigger value="dimensoes">Dimensões</TabsTrigger>
          <TabsTrigger value="condicoes">Condições</TabsTrigger>
          <TabsTrigger value="isolamento">Isolamento</TabsTrigger>
        </TabsList>

        <TabsContent value="gerais">
          <ColdProFormSection title="Dados gerais" description="Identifique o ambiente e defina o regime diário de operação." icon={<Box className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
              <div>
                <ColdProField label="Nome do ambiente">
                  <ColdProInput type="text" value={form?.name ?? ""} onChange={(e) => set("name", e.target.value)} className="text-left tabular-nums" />
                  <ColdProValidationMessage tone="error">{String(form?.name ?? "").trim() ? "" : "Informe um nome para o ambiente."}</ColdProValidationMessage>
                </ColdProField>
                <ColdProField label="Tipo de aplicação">
                  <ColdProSelect value={form?.environment_type ?? "cold_room"} onChange={(e) => set("environment_type", e.target.value)}>
                    {APPLICATIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </ColdProSelect>
                </ColdProField>
              </div>
              <div>
                <ColdProField label="Operação diária" unit="h/dia">
                  <ColdProInput {...num("operation_hours_day")} />
                </ColdProField>
                <ColdProField label="Tempo compressor" unit="h/dia">
                  <ColdProInput {...num("compressor_runtime_hours_day")} />
                  <ColdProValidationMessage tone="error">{hoursError ? "Horas devem estar entre 0 e 24." : ""}</ColdProValidationMessage>
                </ColdProField>
              </div>
            </div>
          </ColdProFormSection>
        </TabsContent>

        <TabsContent value="dimensoes">
          <ColdProFormSection title="Dimensões internas" description="Use medidas internas úteis da câmara para o cálculo de transmissão." icon={<Ruler className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
              <div>
                <ColdProField label="Comprimento" unit="m"><ColdProInput {...num("length_m")} /></ColdProField>
                <ColdProField label="Largura" unit="m"><ColdProInput {...num("width_m")} /></ColdProField>
                <ColdProField label="Altura" unit="m"><ColdProInput {...num("height_m")} /></ColdProField>
                <ColdProValidationMessage tone="error">{dimensionError ? "Comprimento, largura e altura devem ser maiores que zero." : ""}</ColdProValidationMessage>
              </div>
              <div className="space-y-3">
                <ColdProCalculatedInfo label="Volume interno calculado" value={`${fmtColdPro(volume)} m³`} description="Atualiza automaticamente ao alterar as dimensões." tone={dimensionError ? "warning" : "success"} />
                <ColdProCalculatedInfo label="Área aproximada de troca" value={`${fmtColdPro(2 * ((Number(form?.length_m ?? 0) * Number(form?.width_m ?? 0)) + (Number(form?.length_m ?? 0) * Number(form?.height_m ?? 0)) + (Number(form?.width_m ?? 0) * Number(form?.height_m ?? 0))))} m²`} description="Referência visual para transmissão térmica." />
              </div>
            </div>
          </ColdProFormSection>
        </TabsContent>

        <TabsContent value="condicoes">
          <ColdProFormSection title="Condições de operação" description="Temperaturas, umidade e piso usados no cálculo do ambiente." icon={<Thermometer className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
              <div>
                <ColdProField label="Temperatura interna" unit="°C"><ColdProInput {...num("internal_temp_c")} /></ColdProField>
                <ColdProField label="Temperatura externa" unit="°C"><ColdProInput {...num("external_temp_c")} /></ColdProField>
                <ColdProField label="Temperatura sob o piso" unit="°C"><ColdProInput {...num("floor_temp_c")} /></ColdProField>
              </div>
              <div className="space-y-3">
                {(isClimatized || isSeed) ? (
                  <ColdProField label="Umidade relativa interna" unit="%"><ColdProInput {...num("relative_humidity_percent")} /></ColdProField>
                ) : null}
                <ColdProCalculatedInfo label="Diferença térmica" value={`${fmtColdPro(deltaT)} °C`} description="Quanto maior o ΔT, maior a carga de transmissão." tone={deltaT > 0 ? "info" : "warning"} />
                {deltaT <= 0 ? <ColdProValidationMessage>Temperatura externa menor ou igual à interna. Confira se o regime está correto.</ColdProValidationMessage> : null}
              </div>
            </div>
          </ColdProFormSection>
        </TabsContent>

        <TabsContent value="isolamento">
          <ColdProFormSection title="Isolamento" description="Material, espessuras e condição do piso isolado." icon={<ShieldCheck className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
              <div>
                <ColdProField label="Material isolante">
                  <ColdProSelect value={form?.insulation_material_id ?? ""} onChange={(e) => set("insulation_material_id", e.target.value)}>
                    <option value="">Selecione</option>
                    {insulationMaterials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </ColdProSelect>
                </ColdProField>
                <ColdProField label="Piso isolado">
                  <ColdProSelect value={form?.has_floor_insulation ? "sim" : "nao"} onChange={(e) => set("has_floor_insulation", e.target.value === "sim")}>
                    <option value="nao">Não</option>
                    <option value="sim">Sim</option>
                  </ColdProSelect>
                </ColdProField>
              </div>
              <div>
                <ColdProField label="Espessura parede" unit="mm"><ColdProInput {...num("wall_thickness_mm")} /></ColdProField>
                <ColdProField label="Espessura teto" unit="mm"><ColdProInput {...num("ceiling_thickness_mm")} /></ColdProField>
                <ColdProField label="Espessura piso" unit="mm"><ColdProInput {...num("floor_thickness_mm")} /></ColdProField>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><ColdProFieldHint>Espessuras maiores reduzem a carga de transmissão. Use valores reais do painel instalado/projetado.</ColdProFieldHint> Referência técnica de isolamento.</div>
              </div>
            </div>
          </ColdProFormSection>
        </TabsContent>
      </Tabs>

      <div className="mt-5 flex justify-end border-t pt-4">
        <button type="button" disabled={!canSave} onClick={() => onSave({ ...form, name: String(form?.name ?? "").trim(), volume_m3: volume })} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
          <Save className="h-4 w-4" /> Salvar ambiente
        </button>
      </div>
    </div>
  );
}
