import * as React from "react";
import { Package, Save, Search, Snowflake, Thermometer, Weight } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ColdProField, ColdProInput, ColdProSelect } from "./ColdProField";
import { ColdProCalculatedInfo, ColdProFormSection, ColdProValidationMessage, fmtColdPro, numberOrNull } from "./ColdProFormPrimitives";

type Props = { environmentId: string; product?: any | null; productCatalog?: any[]; saving?: boolean; onSave: (data: any) => void };

const initialForm = (environmentId: string) => ({
  id: undefined as string | undefined,
  environment_id: environmentId,
  product_id: null as string | null,
  product_name: "Produto genérico",
  product_load_mode: "daily_intake",
  stored_mass_kg: 0,
  daily_turnover_percent: 30,
  daily_movement_kg: 0,
  hourly_movement_kg: 0,
  recovery_time_h: 20,
  is_freezing_inside_storage_room: false,
  freezing_batch_mass_kg: 0,
  freezing_batch_time_h: 12,
  movement_basis: "manual_daily",
  mass_kg_day: 0,
  mass_kg_hour: 0,
  inlet_temp_c: 0,
  outlet_temp_c: 0,
  process_time_h: 24,
  packaging_mass_kg_day: 0,
  packaging_specific_heat_kcal_kg_c: 0.4,
  specific_heat_above_kj_kg_k: null as number | null,
  specific_heat_below_kj_kg_k: null as number | null,
  specific_heat_above_kcal_kg_c: 0.8,
  specific_heat_below_kcal_kg_c: 0.4,
  latent_heat_kj_kg: null as number | null,
  latent_heat_kcal_kg: 60,
  initial_freezing_temp_c: -1.5 as number | null,
  density_kg_m3: null as number | null,
  water_content_percent: null as number | null,
  protein_content_percent: null as number | null,
  fat_content_percent: null as number | null,
  carbohydrate_content_percent: null as number | null,
  fiber_content_percent: null as number | null,
  ash_content_percent: null as number | null,
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
  respiration_rate_0c_mw_kg: null as number | null,
  respiration_rate_5c_mw_kg: null as number | null,
  respiration_rate_10c_mw_kg: null as number | null,
  respiration_rate_15c_mw_kg: null as number | null,
  respiration_rate_20c_mw_kg: null as number | null,
  notes: null as string | null,
});

export function ColdProProductForm({ environmentId, product, productCatalog = [], saving = false, onSave }: Props) {
  const [selectedGroup, setSelectedGroup] = React.useState("");
  const [productSearch, setProductSearch] = React.useState("");
  const [form, setForm] = React.useState(initialForm(environmentId));

  React.useEffect(() => {
    setForm((prev) => ({ ...initialForm(environmentId), ...product, environment_id: environmentId, id: product?.id ?? prev.id }));
  }, [environmentId, product]);

  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));
  const num = (key: keyof ReturnType<typeof initialForm>) => ({ type: "number" as const, value: typeof form[key] === "boolean" ? "" : (form[key] ?? ""), onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, numberOrNull(e.target.value)) });

  const normalizeSearch = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const productInitials = (value: unknown) => normalizeSearch(value).split(/[^a-z0-9]+/).filter(Boolean).map((word) => word[0]).join("");
  const groups = React.useMemo(() => Array.from(new Set(productCatalog.map((p) => p.category).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), "pt-BR")), [productCatalog]);
  const filteredProducts = React.useMemo(() => {
    const query = normalizeSearch(productSearch);
    return productCatalog
      .filter((p) => !selectedGroup || p.category === selectedGroup)
      .filter((p) => !query || normalizeSearch(p.name).includes(query) || normalizeSearch(p.category).includes(query) || productInitials(p.name).startsWith(query))
      .sort((a, b) => {
        if (!query) return String(a.name).localeCompare(String(b.name), "pt-BR");
        const aName = normalizeSearch(a.name);
        const bName = normalizeSearch(b.name);
        const aScore = aName.startsWith(query) ? 0 : productInitials(a.name).startsWith(query) ? 1 : aName.includes(query) ? 2 : 3;
        const bScore = bName.startsWith(query) ? 0 : productInitials(b.name).startsWith(query) ? 1 : bName.includes(query) ? 2 : 3;
        return aScore - bScore || String(a.name).localeCompare(String(b.name), "pt-BR");
      });
  }, [productCatalog, productSearch, selectedGroup]);

  const applyGroup = (group: string) => {
    setSelectedGroup(group);
    setProductSearch("");
    setForm((prev) => ({ ...prev, product_id: null, product_name: group ? "" : "Produto genérico" }));
  };

  const applyProduct = (id: string) => {
    const p = productCatalog.find((item) => item.id === id);
    if (!p) return;
    setForm((prev) => ({
      ...prev,
      product_id: p.id,
      product_name: p.name,
      specific_heat_above_kj_kg_k: p.specific_heat_above_kj_kg_k ?? null,
      specific_heat_below_kj_kg_k: p.specific_heat_below_kj_kg_k ?? null,
      specific_heat_above_kcal_kg_c: Number(p.specific_heat_above_kcal_kg_c ?? prev.specific_heat_above_kcal_kg_c),
      specific_heat_below_kcal_kg_c: Number(p.specific_heat_below_kcal_kg_c ?? prev.specific_heat_below_kcal_kg_c),
      latent_heat_kj_kg: p.latent_heat_kj_kg ?? null,
      latent_heat_kcal_kg: Number(p.latent_heat_kcal_kg ?? prev.latent_heat_kcal_kg),
      initial_freezing_temp_c: p.initial_freezing_temp_c ?? prev.initial_freezing_temp_c,
      density_kg_m3: p.density_kg_m3 ?? null,
      water_content_percent: p.water_content_percent ?? null,
      protein_content_percent: p.protein_content_percent ?? null,
      fat_content_percent: p.fat_content_percent ?? null,
      carbohydrate_content_percent: p.carbohydrate_content_percent ?? null,
      fiber_content_percent: p.fiber_content_percent ?? null,
      ash_content_percent: p.ash_content_percent ?? null,
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
      respiration_rate_0c_mw_kg: p.respiration_rate_0c_mw_kg ?? null,
      respiration_rate_5c_mw_kg: p.respiration_rate_5c_mw_kg ?? null,
      respiration_rate_10c_mw_kg: p.respiration_rate_10c_mw_kg ?? null,
      respiration_rate_15c_mw_kg: p.respiration_rate_15c_mw_kg ?? null,
      respiration_rate_20c_mw_kg: p.respiration_rate_20c_mw_kg ?? null,
      notes: p.notes ?? null,
    }));
    setSelectedGroup(p.category ?? "");
    setProductSearch(p.name ?? "");
  };

  const mode = String(form.product_load_mode ?? "daily_intake");
  const stockMovement = Number(form.stored_mass_kg ?? 0) * Number(form.daily_turnover_percent ?? 0) / 100;
  const dailyMovement = mode === "storage_turnover" ? stockMovement : mode === "room_pull_down_or_freezing" ? Number(form.freezing_batch_mass_kg ?? 0) : Number(form.daily_movement_kg ?? 0) || Number(form.mass_kg_day ?? 0);
  const recoveryHours = mode === "room_pull_down_or_freezing" ? Number(form.freezing_batch_time_h ?? 0) : Number(form.recovery_time_h ?? 0) || Number(form.process_time_h ?? 0);
  const hourlyReference = mode === "hourly_intake" ? Number(form.hourly_movement_kg ?? 0) || Number(form.mass_kg_hour ?? 0) : dailyMovement / Math.max(recoveryHours || 0, 1);
  const deltaT = Number(form.inlet_temp_c ?? 0) - Number(form.outlet_temp_c ?? 0);
  const requiredError = String(form.product_name ?? "").trim().length === 0;
  const modeError = mode === "storage_turnover" ? Number(form.stored_mass_kg ?? 0) <= 0 || Number(form.daily_turnover_percent ?? 0) <= 0 : mode === "hourly_intake" ? hourlyReference <= 0 : mode === "room_pull_down_or_freezing" ? Number(form.freezing_batch_mass_kg ?? 0) <= 0 || Number(form.freezing_batch_time_h ?? 0) <= 0 : dailyMovement <= 0 || recoveryHours <= 0;
  const negativeError = [form.mass_kg_day, form.mass_kg_hour, form.packaging_mass_kg_day, form.stored_mass_kg, form.daily_turnover_percent, form.daily_movement_kg, form.hourly_movement_kg, form.freezing_batch_mass_kg].some((v) => Number(v ?? 0) < 0);
  const canSave = !requiredError && !modeError && !negativeError;

  const save = () => {
    if (saving) return;
    const movement_basis = mode === "storage_turnover" ? "calculated_from_stock" : mode === "hourly_intake" ? "manual_hourly" : mode === "room_pull_down_or_freezing" ? "batch_recovery" : "manual_daily";
    onSave({
      ...form,
      product_name: String(form.product_name ?? "").trim(),
      movement_basis,
      is_freezing_inside_storage_room: mode === "room_pull_down_or_freezing",
      daily_movement_kg: mode === "storage_turnover" ? stockMovement : dailyMovement,
      hourly_movement_kg: hourlyReference,
      recovery_time_h: recoveryHours,
      mass_kg_day: mode === "hourly_intake" ? 0 : dailyMovement,
      mass_kg_hour: mode === "hourly_intake" ? hourlyReference : 0,
      process_time_h: mode === "hourly_intake" ? 1 : recoveryHours,
    });
  };

  return (
    <div className="min-w-0 rounded-xl border bg-background p-3 shadow-sm sm:p-5">
      <div className="mb-5 flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{form.id ? "Editar produto" : "Produtos"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Carga estocada, giro diário, entrada horária ou recuperação/congelamento dentro da câmara.</p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 md:w-auto md:min-w-80">
          <ColdProCalculatedInfo label="Base horária" value={`${fmtColdPro(hourlyReference)} kg/h`} description={mode === "hourly_intake" ? "vazão/pico informado" : "massa ÷ tempo"} tone={hourlyReference > 0 ? "success" : "warning"} />
          <ColdProCalculatedInfo label="ΔT produto" value={`${fmtColdPro(deltaT)} °C`} description="Entrada menos final" tone={deltaT >= 0 ? "info" : "warning"} />
        </div>
      </div>

      <Accordion type="multiple" defaultValue={["catalogo", "movimentacao", "temperaturas"]} className="space-y-3">
        <AccordionItem value="catalogo" className="rounded-xl border px-4">
          <AccordionTrigger className="hover:no-underline"><span className="inline-flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Catálogo ASHRAE</span></AccordionTrigger>
          <AccordionContent>
            <ColdProFormSection title="Seleção do produto" description="A fonte ASHRAE/CN ColdPro carrega propriedades térmicas; estoque e tempo são dados da aplicação.">
              <div className="grid grid-cols-1 gap-x-10 xl:grid-cols-2">
                <ColdProField label="Pesquisar produto" className="xl:col-span-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <ColdProInput type="search" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Digite o nome ou iniciais do produto" className="pl-9 text-left" />
                  </div>
                </ColdProField>
                <ColdProField label="Grupo ASHRAE"><ColdProSelect value={selectedGroup} onChange={(e) => applyGroup(e.target.value)}><option value="">Seleção manual</option>{groups.map((group) => <option key={group} value={group}>{group}</option>)}</ColdProSelect></ColdProField>
                <ColdProField label="Produto"><ColdProSelect value={form.product_id ?? ""} disabled={filteredProducts.length === 0} onChange={(e) => applyProduct(e.target.value)}><option value="">{filteredProducts.length ? "Selecione o produto" : "Nenhum produto encontrado"}</option>{filteredProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</ColdProSelect></ColdProField>
                <ColdProField label="Nome do produto"><ColdProInput type="text" value={form.product_name ?? ""} onChange={(e) => set("product_name", e.target.value)} className="text-left" /><ColdProValidationMessage tone="error">{requiredError ? "Informe ou selecione um produto." : ""}</ColdProValidationMessage></ColdProField>
              </div>
            </ColdProFormSection>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="movimentacao" className="rounded-xl border px-4">
          <AccordionTrigger className="hover:no-underline"><span className="inline-flex items-center gap-2"><Weight className="h-4 w-4 text-primary" /> Movimentação e processo</span></AccordionTrigger>
          <AccordionContent>
            <ColdProFormSection title="Como esta carga entra na câmara?" description="Escolha a base real do cálculo para não misturar kg/dia, kg/h e tempo de recuperação.">
              <ColdProField label="Modo de cálculo da carga">
                <ColdProSelect value={mode} onChange={(e) => set("product_load_mode", e.target.value)}>
                  <option value="storage_turnover">Estoque com giro percentual</option>
                  <option value="daily_intake">Entrada diária informada</option>
                  <option value="hourly_intake">Entrada horária / pico conhecido</option>
                  <option value="room_pull_down_or_freezing">Lote para resfriar/congelar na câmara</option>
                </ColdProSelect>
              </ColdProField>

              {mode === "storage_turnover" ? <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2"><div><ColdProField label="Carga total estocada" unit="kg"><ColdProInput {...num("stored_mass_kg")} /></ColdProField><ColdProField label="Movimentação diária" unit="%"><ColdProInput {...num("daily_turnover_percent")} /></ColdProField></div><div><ColdProField label="Tempo de recuperação" unit="h"><ColdProInput {...num("recovery_time_h")} /></ColdProField><ColdProCalculatedInfo label="Massa movimentada" value={`${fmtColdPro(stockMovement)} kg/dia`} description="estoque × percentual" tone={stockMovement > 0 ? "success" : "warning"} /></div></div> : null}

              {mode === "daily_intake" ? <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2"><ColdProField label="Entrada diária" unit="kg/dia"><ColdProInput {...num("daily_movement_kg")} /></ColdProField><ColdProField label="Tempo de recuperação/processo" unit="h"><ColdProInput {...num("recovery_time_h")} /></ColdProField></div> : null}

              {mode === "hourly_intake" ? <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2"><ColdProField label="Entrada horária / pico" unit="kg/h"><ColdProInput {...num("hourly_movement_kg")} /></ColdProField><ColdProCalculatedInfo label="Aplicação" value="kg/h direto" description="não divide por tempo novamente" tone="info" /></div> : null}

              {mode === "room_pull_down_or_freezing" ? <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2"><div><ColdProField label="Massa do lote" unit="kg"><ColdProInput {...num("freezing_batch_mass_kg")} /></ColdProField><ColdProField label="Tempo desejado" unit="h"><ColdProInput {...num("freezing_batch_time_h")} /></ColdProField></div><div><ColdProCalculatedInfo label="Carga distribuída" value={`${fmtColdPro(hourlyReference)} kg/h`} description="lote ÷ tempo desejado" tone={hourlyReference > 0 ? "success" : "warning"} /><ColdProValidationMessage tone="warning">Câmara de armazenagem pode recuperar produto, mas congelamento depende de circulação, embalagem, empilhamento e área exposta; para carga intensa ou recorrente, considerar túnel dedicado.</ColdProValidationMessage></div></div> : null}

              <ColdProValidationMessage tone="error">{modeError ? "Preencha os campos obrigatórios do modo de carga escolhido." : negativeError ? "Massas e percentuais não podem ser negativos." : ""}</ColdProValidationMessage>
            </ColdProFormSection>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="temperaturas" className="rounded-xl border px-4">
          <AccordionTrigger className="hover:no-underline"><span className="inline-flex items-center gap-2"><Thermometer className="h-4 w-4 text-primary" /> Temperaturas e propriedades térmicas</span></AccordionTrigger>
          <AccordionContent>
            <ColdProFormSection title="Dados térmicos" description="Temperaturas do produto e propriedades carregadas do catálogo ou ajustadas manualmente.">
              <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2"><div>
                <ColdProField label="Temp. entrada produto" unit="°C"><ColdProInput {...num("inlet_temp_c")} /></ColdProField>
                <ColdProField label="Temp. final produto" unit="°C"><ColdProInput {...num("outlet_temp_c")} /></ColdProField>
                <ColdProField label="Temp. congelamento" unit="°C"><ColdProInput {...num("initial_freezing_temp_c")} /></ColdProField>
                <ColdProField label="Densidade" unit="kg/m³"><ColdProInput {...num("density_kg_m3")} /></ColdProField>
                <ColdProField label="Água" unit="%"><ColdProInput {...num("water_content_percent")} /></ColdProField>
                <ColdProField label="Proteína" unit="%"><ColdProInput {...num("protein_content_percent")} /></ColdProField>
              </div><div>
                <ColdProField label="Cp acima"><ColdProInput {...num("specific_heat_above_kcal_kg_c")} /></ColdProField>
                <ColdProField label="Cp abaixo"><ColdProInput {...num("specific_heat_below_kcal_kg_c")} /></ColdProField>
                <ColdProField label="Calor latente"><ColdProInput {...num("latent_heat_kcal_kg")} /></ColdProField>
                <ColdProField label="Calor latente" unit="kJ/kg"><ColdProInput {...num("latent_heat_kj_kg")} /></ColdProField>
                <ColdProField label="Condutividade congelado"><ColdProInput {...num("thermal_conductivity_frozen_w_m_k")} /></ColdProField>
                <ColdProField label="Fração água congelável"><ColdProInput {...num("frozen_water_fraction")} /></ColdProField>
              </div></div>
              {deltaT < 0 ? <ColdProValidationMessage>Temperatura final maior que a entrada. Confira se é aquecimento intencional.</ColdProValidationMessage> : null}
            </ColdProFormSection>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="embalagem" className="rounded-xl border px-4">
          <AccordionTrigger className="hover:no-underline"><span className="inline-flex items-center gap-2"><Snowflake className="h-4 w-4 text-primary" /> Embalagem</span></AccordionTrigger>
          <AccordionContent>
            <ColdProFormSection title="Carga de embalagem" description="A embalagem entra como carga sensível adicional no produto.">
              <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2"><ColdProField label="Massa embalagem" unit="kg/dia"><ColdProInput {...num("packaging_mass_kg_day")} /></ColdProField><ColdProField label="Cp embalagem"><ColdProInput {...num("packaging_specific_heat_kcal_kg_c")} /></ColdProField></div>
            </ColdProFormSection>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="mt-5 flex justify-end border-t pt-4">
        <button type="button" disabled={!canSave || saving} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50" onClick={save}>
          <Save className="h-4 w-4" /> {saving ? "Salvando..." : form.id ? "Atualizar produto" : "Salvar produto"}
        </button>
      </div>
    </div>
  );
}
