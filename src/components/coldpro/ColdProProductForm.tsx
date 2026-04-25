import * as React from "react";
import { Package, Save, Snowflake, Thermometer, Weight } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ColdProField, ColdProInput, ColdProSelect } from "./ColdProField";
import {
  ColdProCalculatedInfo,
  ColdProFormSection,
  ColdProValidationMessage,
  fmtColdPro,
  numberOrNull,
} from "./ColdProFormPrimitives";

type Props = { environmentId: string; productCatalog?: any[]; onSave: (data: any) => void };

const initialForm = (environmentId: string) => ({
  environment_id: environmentId,
  product_id: null as string | null,
  product_name: "Produto genérico",
  mass_kg_day: 0,
  mass_kg_hour: 0,
  inlet_temp_c: 0,
  outlet_temp_c: 0,
  process_time_h: 24,
  packaging_mass_kg_day: 0,
  packaging_specific_heat_kcal_kg_c: 0.4,
  specific_heat_above_kcal_kg_c: 0.8,
  specific_heat_below_kcal_kg_c: 0.4,
  latent_heat_kcal_kg: 60,
  initial_freezing_temp_c: -1.5 as number | null,
  density_kg_m3: null as number | null,
  thermal_conductivity_unfrozen_w_m_k: null as number | null,
  thermal_conductivity_frozen_w_m_k: null as number | null,
  frozen_water_fraction: null as number | null,
  freezable_water_content_percent: null as number | null,
  characteristic_thickness_m: null as number | null,
  default_convective_coefficient_w_m2_k: null as number | null,
  allow_phase_change: true as boolean | null,
  respiration_rate_0c_w_kg: null as number | null,
  respiration_rate_5c_w_kg: null as number | null,
  respiration_rate_10c_w_kg: null as number | null,
  respiration_rate_15c_w_kg: null as number | null,
  respiration_rate_20c_w_kg: null as number | null,
});

export function ColdProProductForm({ environmentId, productCatalog = [], onSave }: Props) {
  const [selectedGroup, setSelectedGroup] = React.useState("");
  const [form, setForm] = React.useState(initialForm(environmentId));

  React.useEffect(() => setForm((prev) => ({ ...prev, environment_id: environmentId })), [environmentId]);

  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));
  const num = (key: keyof ReturnType<typeof initialForm>) => ({
    type: "number" as const,
    value: typeof form[key] === "boolean" ? "" : (form[key] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, numberOrNull(e.target.value)),
  });

  const groups = React.useMemo(() => Array.from(new Set(productCatalog.map((p) => p.category).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), "pt-BR")), [productCatalog]);
  const filteredProducts = React.useMemo(() => productCatalog.filter((p) => !selectedGroup || p.category === selectedGroup), [productCatalog, selectedGroup]);

  const applyGroup = (group: string) => {
    setSelectedGroup(group);
    setForm((prev) => ({ ...prev, product_id: null, product_name: group ? "" : "Produto genérico" }));
  };

  const applyProduct = (id: string) => {
    const p = productCatalog.find((item) => item.id === id);
    if (!p) return;
    setForm((prev) => ({
      ...prev,
      product_id: p.id,
      product_name: p.name,
      specific_heat_above_kcal_kg_c: Number(p.specific_heat_above_kcal_kg_c ?? prev.specific_heat_above_kcal_kg_c),
      specific_heat_below_kcal_kg_c: Number(p.specific_heat_below_kcal_kg_c ?? prev.specific_heat_below_kcal_kg_c),
      latent_heat_kcal_kg: Number(p.latent_heat_kcal_kg ?? prev.latent_heat_kcal_kg),
      initial_freezing_temp_c: p.initial_freezing_temp_c ?? prev.initial_freezing_temp_c,
      density_kg_m3: p.density_kg_m3 ?? null,
      thermal_conductivity_unfrozen_w_m_k: p.thermal_conductivity_unfrozen_w_m_k ?? p.thermal_conductivity_w_m_k ?? null,
      thermal_conductivity_frozen_w_m_k: p.thermal_conductivity_frozen_w_m_k ?? null,
      frozen_water_fraction: p.frozen_water_fraction ?? null,
      freezable_water_content_percent: p.freezable_water_content_percent ?? null,
      characteristic_thickness_m: p.characteristic_thickness_m ?? null,
      default_convective_coefficient_w_m2_k: p.default_convective_coefficient_w_m2_k ?? null,
      allow_phase_change: p.allow_phase_change ?? true,
      respiration_rate_0c_w_kg: p.respiration_rate_0c_w_kg ?? null,
      respiration_rate_5c_w_kg: p.respiration_rate_5c_w_kg ?? null,
      respiration_rate_10c_w_kg: p.respiration_rate_10c_w_kg ?? null,
      respiration_rate_15c_w_kg: p.respiration_rate_15c_w_kg ?? null,
      respiration_rate_20c_w_kg: p.respiration_rate_20c_w_kg ?? null,
    }));
  };

  const expectedHour = Number(form.mass_kg_day ?? 0) / Math.max(Number(form.process_time_h ?? 0), 1);
  const currentHour = Number(form.mass_kg_hour ?? 0);
  const massDiverges = currentHour > 0 && expectedHour > 0 && Math.abs(currentHour - expectedHour) / expectedHour > 0.15;
  const deltaT = Number(form.inlet_temp_c ?? 0) - Number(form.outlet_temp_c ?? 0);
  const requiredError = String(form.product_name ?? "").trim().length === 0;
  const processError = Number(form.process_time_h ?? 0) <= 0;
  const negativeError = [form.mass_kg_day, form.mass_kg_hour, form.packaging_mass_kg_day].some((v) => Number(v ?? 0) < 0);
  const canSave = !requiredError && !processError && !negativeError;

  return (
    <div className="rounded-xl border bg-background p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Produtos</h2>
          <p className="mt-1 text-sm text-muted-foreground">Produto, movimentação diária, temperaturas, embalagem e propriedades térmicas ASHRAE.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:min-w-80">
          <ColdProCalculatedInfo label="kg/h esperado" value={`${fmtColdPro(expectedHour)} kg/h`} description="Massa diária / tempo de processo" tone={massDiverges ? "warning" : "info"} />
          <ColdProCalculatedInfo label="ΔT produto" value={`${fmtColdPro(deltaT)} °C`} description="Entrada menos final" tone={deltaT >= 0 ? "info" : "warning"} />
        </div>
      </div>

      <Accordion type="multiple" defaultValue={["catalogo", "movimentacao", "temperaturas"]} className="space-y-3">
        <AccordionItem value="catalogo" className="rounded-xl border px-4">
          <AccordionTrigger className="hover:no-underline"><span className="inline-flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Catálogo ASHRAE</span></AccordionTrigger>
          <AccordionContent>
            <ColdProFormSection title="Seleção do produto" description="Selecione primeiro o grupo e depois o produto para carregar os dados térmicos cadastrados.">
              <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
                <ColdProField label="Grupo ASHRAE">
                  <ColdProSelect value={selectedGroup} onChange={(e) => applyGroup(e.target.value)}>
                    <option value="">Seleção manual</option>
                    {groups.map((group) => <option key={group} value={group}>{group}</option>)}
                  </ColdProSelect>
                </ColdProField>
                <ColdProField label="Produto">
                  <ColdProSelect value={form.product_id ?? ""} disabled={!selectedGroup} onChange={(e) => applyProduct(e.target.value)}>
                    <option value="">{selectedGroup ? "Selecione o produto" : "Selecione primeiro o grupo"}</option>
                    {filteredProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </ColdProSelect>
                </ColdProField>
                <ColdProField label="Nome do produto">
                  <ColdProInput type="text" value={form.product_name ?? ""} onChange={(e) => set("product_name", e.target.value)} className="text-left" />
                  <ColdProValidationMessage tone="error">{requiredError ? "Informe ou selecione um produto." : ""}</ColdProValidationMessage>
                </ColdProField>
              </div>
            </ColdProFormSection>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="movimentacao" className="rounded-xl border px-4">
          <AccordionTrigger className="hover:no-underline"><span className="inline-flex items-center gap-2"><Weight className="h-4 w-4 text-primary" /> Movimentação e processo</span></AccordionTrigger>
          <AccordionContent>
            <ColdProFormSection title="Carga de produto" description="Informe massa diária, massa horária e tempo disponível de processo.">
              <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
                <div>
                  <ColdProField label="Movimentação diária" unit="kg/dia"><ColdProInput {...num("mass_kg_day")} /></ColdProField>
                  <ColdProField label="Movimentação horária" unit="kg/h"><ColdProInput {...num("mass_kg_hour")} /></ColdProField>
                  <ColdProField label="Tempo de processo" unit="h"><ColdProInput {...num("process_time_h")} /></ColdProField>
                </div>
                <div className="space-y-3">
                  <ColdProCalculatedInfo label="Massa horária de referência" value={`${fmtColdPro(expectedHour)} kg/h`} description="Use para conferir se o campo kg/h está coerente." tone={massDiverges ? "warning" : "success"} />
                  <ColdProValidationMessage>{massDiverges ? `A massa horária informada (${fmtColdPro(currentHour)} kg/h) diverge mais de 15% da referência.` : ""}</ColdProValidationMessage>
                  <ColdProValidationMessage tone="error">{processError ? "Tempo de processo deve ser maior que zero." : negativeError ? "Massas não podem ser negativas." : ""}</ColdProValidationMessage>
                </div>
              </div>
            </ColdProFormSection>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="temperaturas" className="rounded-xl border px-4">
          <AccordionTrigger className="hover:no-underline"><span className="inline-flex items-center gap-2"><Thermometer className="h-4 w-4 text-primary" /> Temperaturas e propriedades térmicas</span></AccordionTrigger>
          <AccordionContent>
            <ColdProFormSection title="Dados térmicos" description="Temperaturas do produto e propriedades carregadas do catálogo ou ajustadas manualmente.">
              <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
                <div>
                  <ColdProField label="Temp. entrada produto" unit="°C"><ColdProInput {...num("inlet_temp_c")} /></ColdProField>
                  <ColdProField label="Temp. final produto" unit="°C"><ColdProInput {...num("outlet_temp_c")} /></ColdProField>
                  <ColdProField label="Temp. congelamento" unit="°C"><ColdProInput {...num("initial_freezing_temp_c")} /></ColdProField>
                  <ColdProField label="Densidade" unit="kg/m³"><ColdProInput {...num("density_kg_m3")} /></ColdProField>
                </div>
                <div>
                  <ColdProField label="Cp acima"><ColdProInput {...num("specific_heat_above_kcal_kg_c")} /></ColdProField>
                  <ColdProField label="Cp abaixo"><ColdProInput {...num("specific_heat_below_kcal_kg_c")} /></ColdProField>
                  <ColdProField label="Calor latente"><ColdProInput {...num("latent_heat_kcal_kg")} /></ColdProField>
                  <ColdProField label="Condutividade congelado"><ColdProInput {...num("thermal_conductivity_frozen_w_m_k")} /></ColdProField>
                  <ColdProField label="Fração água congelável"><ColdProInput {...num("frozen_water_fraction")} /></ColdProField>
                  <ColdProField label="Espessura característica" unit="m"><ColdProInput {...num("characteristic_thickness_m")} /></ColdProField>
                </div>
              </div>
              {deltaT < 0 ? <ColdProValidationMessage>Temperatura final maior que a entrada. Confira se é aquecimento intencional.</ColdProValidationMessage> : null}
            </ColdProFormSection>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="embalagem" className="rounded-xl border px-4">
          <AccordionTrigger className="hover:no-underline"><span className="inline-flex items-center gap-2"><Snowflake className="h-4 w-4 text-primary" /> Embalagem</span></AccordionTrigger>
          <AccordionContent>
            <ColdProFormSection title="Carga de embalagem" description="A embalagem entra como carga sensível adicional no produto.">
              <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
                <ColdProField label="Massa embalagem" unit="kg/dia"><ColdProInput {...num("packaging_mass_kg_day")} /></ColdProField>
                <ColdProField label="Cp embalagem"><ColdProInput {...num("packaging_specific_heat_kcal_kg_c")} /></ColdProField>
              </div>
            </ColdProFormSection>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="mt-5 flex justify-end border-t pt-4">
        <button type="button" disabled={!canSave} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => onSave({ ...form, product_name: String(form.product_name ?? "").trim() })}>
          <Save className="h-4 w-4" /> Salvar produto
        </button>
      </div>
    </div>
  );
}
