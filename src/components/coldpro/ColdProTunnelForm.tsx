import * as React from "react";
import { Fan, Package, Save, Settings, Wind } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ColdProField, ColdProInput, ColdProSelect } from "./ColdProField";
import { ColdProCalculatedInfo, ColdProFormSection, ColdProValidationMessage, fmtColdPro, numberOrNull } from "./ColdProFormPrimitives";

const defaultTunnel = (environmentId: string) => ({
  environment_id: environmentId,
  tunnel_type: "blast_freezer",
  operation_mode: "continuous",
  product_name: "Produto",
  product_thickness_mm: 0,
  product_unit_weight_kg: 0,
  units_per_cycle: 0,
  cycles_per_hour: 0,
  mass_kg_hour: 0,
  inlet_temp_c: 5,
  outlet_temp_c: -18,
  freezing_temp_c: -1.5,
  density_kg_m3: 0,
  thermal_conductivity_frozen_w_m_k: 0,
  convective_coefficient_w_m2_k: 0,
  air_temp_c: -35,
  air_velocity_m_s: 3,
  process_time_min: 60,
  specific_heat_above_kcal_kg_c: 0.8,
  specific_heat_below_kcal_kg_c: 0.4,
  latent_heat_kcal_kg: 60,
  packaging_mass_kg_hour: 0,
  packaging_specific_heat_kcal_kg_c: 0.4,
  belt_motor_kw: 0,
  internal_fans_kw: 0,
  other_internal_kw: 0,
});

export function ColdProTunnelForm({ environmentId, tunnel, onSave }: { environmentId: string; tunnel?: any; onSave: (data: any) => void }) {
  const [form, setForm] = React.useState<any>(defaultTunnel(environmentId));

  React.useEffect(() => setForm((prev: any) => ({ ...prev, ...(tunnel ?? {}), environment_id: environmentId })), [environmentId, tunnel?.id]);

  const set = (key: string, value: unknown) => setForm((prev: any) => ({ ...prev, [key]: value }));
  const num = (key: string) => ({ type: "number" as const, value: form?.[key] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, numberOrNull(e.target.value)) });
  const throughput = Number(form.units_per_cycle ?? 0) * Number(form.product_unit_weight_kg ?? 0) * Number(form.cycles_per_hour ?? 0);
  const massHour = Number(form.mass_kg_hour ?? 0) || throughput;
  const deltaT = Number(form.inlet_temp_c ?? 0) - Number(form.outlet_temp_c ?? 0);
  const processError = Number(form.process_time_min ?? 0) <= 0;
  const velocityWarning = Number(form.air_velocity_m_s ?? 0) <= 0 || Number(form.air_velocity_m_s ?? 0) > 10;
  const requiredError = String(form.product_name ?? "").trim().length === 0;
  const canSave = !processError && !requiredError;

  return (
    <div className="rounded-xl border bg-background p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Túnel de congelamento / resfriamento</h2>
          <p className="mt-1 text-sm text-muted-foreground">Configuração do túnel, produto, ar de processo e cargas internas.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:min-w-80">
          <ColdProCalculatedInfo label="Throughput" value={`${fmtColdPro(throughput)} kg/h`} description="un/ciclo × kg × ciclos/h" tone={throughput > 0 ? "success" : "warning"} />
          <ColdProCalculatedInfo label="ΔT produto" value={`${fmtColdPro(deltaT)} °C`} description="Entrada menos saída" tone={deltaT >= 0 ? "info" : "warning"} />
        </div>
      </div>

      <Tabs defaultValue="configuracao" className="w-full">
        <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1 p-1">
          <TabsTrigger value="configuracao">Configuração</TabsTrigger>
          <TabsTrigger value="produto">Produto</TabsTrigger>
          <TabsTrigger value="ar">Ar e processo</TabsTrigger>
          <TabsTrigger value="cargas">Cargas internas</TabsTrigger>
        </TabsList>

        <TabsContent value="configuracao">
          <ColdProFormSection title="Configuração do túnel" description="Defina o tipo de processo e modo de operação." icon={<Settings className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
              <ColdProField label="Tipo de túnel">
                <ColdProSelect value={form.tunnel_type} onChange={(e) => set("tunnel_type", e.target.value)}>
                  <option value="blast_freezer">Túnel de congelamento</option>
                  <option value="cooling_tunnel">Túnel de resfriamento</option>
                </ColdProSelect>
              </ColdProField>
              <ColdProField label="Operação">
                <ColdProSelect value={form.operation_mode} onChange={(e) => set("operation_mode", e.target.value)}>
                  <option value="continuous">Contínuo</option>
                  <option value="batch">Batelada</option>
                </ColdProSelect>
              </ColdProField>
            </div>
          </ColdProFormSection>
        </TabsContent>

        <TabsContent value="produto">
          <ColdProFormSection title="Produto e throughput" description="Dados físicos e vazão mássica do produto no túnel." icon={<Package className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
              <div>
                <ColdProField label="Produto"><ColdProInput type="text" value={form.product_name ?? ""} onChange={(e) => set("product_name", e.target.value)} className="text-left" /></ColdProField>
                <ColdProField label="Espessura produto" unit="mm"><ColdProInput {...num("product_thickness_mm")} /></ColdProField>
                <ColdProField label="Peso unitário" unit="kg"><ColdProInput {...num("product_unit_weight_kg")} /></ColdProField>
                <ColdProField label="Densidade" unit="kg/m³"><ColdProInput {...num("density_kg_m3")} /></ColdProField>
              </div>
              <div>
                <ColdProField label="Unidades/ciclo"><ColdProInput {...num("units_per_cycle")} /></ColdProField>
                <ColdProField label="Ciclos/h"><ColdProInput {...num("cycles_per_hour")} /></ColdProField>
                <ColdProField label="Massa direta" unit="kg/h"><ColdProInput {...num("mass_kg_hour")} /></ColdProField>
                <ColdProCalculatedInfo label="Massa usada no cálculo" value={`${fmtColdPro(massHour)} kg/h`} description="Usa massa direta ou throughput calculado." tone={massHour > 0 ? "success" : "warning"} />
              </div>
            </div>
            <ColdProValidationMessage tone="error">{requiredError ? "Informe o produto do túnel." : ""}</ColdProValidationMessage>
          </ColdProFormSection>
        </TabsContent>

        <TabsContent value="ar">
          <ColdProFormSection title="Ar e processo" description="Temperaturas, velocidade do ar, tempo de retenção e propriedades térmicas." icon={<Wind className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
              <div>
                <ColdProField label="Temp. entrada" unit="°C"><ColdProInput {...num("inlet_temp_c")} /></ColdProField>
                <ColdProField label="Temp. final" unit="°C"><ColdProInput {...num("outlet_temp_c")} /></ColdProField>
                <ColdProField label="Temp. congelamento" unit="°C"><ColdProInput {...num("freezing_temp_c")} /></ColdProField>
                <ColdProField label="Temp. ar" unit="°C"><ColdProInput {...num("air_temp_c")} /></ColdProField>
                <ColdProField label="Velocidade ar" unit="m/s"><ColdProInput {...num("air_velocity_m_s")} /></ColdProField>
                <ColdProField label="Tempo processo" unit="min"><ColdProInput {...num("process_time_min")} /></ColdProField>
              </div>
              <div>
                <ColdProField label="Cp acima"><ColdProInput {...num("specific_heat_above_kcal_kg_c")} /></ColdProField>
                <ColdProField label="Cp abaixo"><ColdProInput {...num("specific_heat_below_kcal_kg_c")} /></ColdProField>
                <ColdProField label="Calor latente"><ColdProInput {...num("latent_heat_kcal_kg")} /></ColdProField>
                <ColdProField label="Condutividade congelado"><ColdProInput {...num("thermal_conductivity_frozen_w_m_k")} /></ColdProField>
                <ColdProField label="Coef. convecção manual"><ColdProInput {...num("convective_coefficient_w_m2_k")} /></ColdProField>
                <ColdProValidationMessage>{velocityWarning ? "Confira a velocidade do ar. Valores usuais ficam acima de 0 e geralmente abaixo de 10 m/s." : ""}</ColdProValidationMessage>
                <ColdProValidationMessage tone="error">{processError ? "Tempo de processo deve ser maior que zero." : ""}</ColdProValidationMessage>
              </div>
            </div>
          </ColdProFormSection>
        </TabsContent>

        <TabsContent value="cargas">
          <ColdProFormSection title="Cargas internas" description="Embalagem, motores, ventiladores internos e demais potências dentro do túnel." icon={<Fan className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
              <div>
                <ColdProField label="Embalagem" unit="kg/h"><ColdProInput {...num("packaging_mass_kg_hour")} /></ColdProField>
                <ColdProField label="Cp embalagem"><ColdProInput {...num("packaging_specific_heat_kcal_kg_c")} /></ColdProField>
              </div>
              <div>
                <ColdProField label="Motor esteira" unit="kW"><ColdProInput {...num("belt_motor_kw")} /></ColdProField>
                <ColdProField label="Ventiladores internos" unit="kW"><ColdProInput {...num("internal_fans_kw")} /></ColdProField>
                <ColdProField label="Outras cargas" unit="kW"><ColdProInput {...num("other_internal_kw")} /></ColdProField>
              </div>
            </div>
          </ColdProFormSection>
        </TabsContent>
      </Tabs>

      <div className="mt-5 flex justify-end border-t pt-4">
        <button type="button" disabled={!canSave} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => onSave({ ...form, product_name: String(form.product_name ?? "").trim(), mass_kg_hour: Number(form.mass_kg_hour ?? 0) || throughput })}>
          <Save className="h-4 w-4" /> Salvar túnel
        </button>
      </div>
    </div>
  );
}
