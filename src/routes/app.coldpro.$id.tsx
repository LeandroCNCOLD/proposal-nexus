import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Calculator, Download, FileText, Loader2, Pencil, Printer, Snowflake, Sparkles, Thermometer, Trash2, Wind, Warehouse } from "lucide-react";
import { toast } from "sonner";
import {
  useColdProProjectBundle,
  useCreateColdProEnvironment,
  useUpdateColdProProject,
  useUpdateColdProEnvironment,
  useDeleteColdProEnvironment,
  useUpsertColdProProduct,
  useDeleteColdProProduct,
  useUpsertColdProTunnel,
  useCalculateColdProEnvironment,
  useAutoSelectColdProEquipment,
  usePushColdProToProposal,
  useGenerateColdProMemorialPdf,
  useAnalyzeColdProMemorial,
} from "@/features/coldpro/use-coldpro";
import { ColdProEnvironmentForm } from "@/components/coldpro/ColdProEnvironmentForm";
import { ColdProProductForm } from "@/components/coldpro/ColdProProductForm";
import { ColdProTunnelForm } from "@/components/coldpro/ColdProTunnelForm";
import { ColdProResultCard } from "@/components/coldpro/ColdProResultCard";
import { ColdProExtraLoadsForm } from "@/components/coldpro/ColdProExtraLoadsForm";
import { ColdProStepper, COLDPRO_STEPS } from "@/components/coldpro/ColdProStepper";
import { ColdProReport } from "@/components/coldpro/ColdProReport";
import { ColdProProjectResultDashboard } from "@/modules/coldpro/components/results/ColdProProjectResultDashboard";
import { EnergySummary } from "@/modules/coldpro/components/results/EnergySummary";
import { EquipmentOptimizationSummary } from "@/modules/coldpro/components/results/EquipmentOptimizationSummary";
import { ProjectRecommendationSummary } from "@/modules/coldpro/components/results/ProjectRecommendationSummary";
import { ColdProRealSelection } from "@/components/coldpro/ColdProRealSelection";
import { ColdProSectionLoadSummary } from "@/components/coldpro/ColdProSectionLoadSummary";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveCatalogEquipmentSelection } from "@/features/coldpro/catalog-selection.functions";
import { calculateExtraLoadPreview } from "@/features/coldpro/extra-loads-preview";
import { databaseToTunnelInput } from "@/modules/coldpro/adapters/databaseToTunnelInput";
import { calculateTunnelEngine } from "@/modules/coldpro/engines/tunnelEngine";
import { auditColdProTechnicalConsistency } from "@/modules/coldpro/core/technicalAudit";

export const Route = createFileRoute("/app/coldpro/$id")({ component: ColdProProjectPage });

function fmt(value: unknown) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(Number(value ?? 0));
}

function isFiniteValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toFiniteValue(value: unknown): number | null {
  if (isFiniteValue(value)) return value;
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function firstFinite(...values: unknown[]) {
  for (const value of values) {
    const parsed = toFiniteValue(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function formatNumber(value: unknown, decimals = 2) {
  const parsed = toFiniteValue(value);
  return parsed !== null ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(parsed) : "—";
}

function formatKw(value: unknown) {
  return toFiniteValue(value) !== null ? `${formatNumber(value, 2)} kW` : "—";
}


function formatCurrencyLocal(value: unknown) {
  const parsed = toFiniteValue(value);
  return parsed !== null ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parsed) : "—";
}

function CommercialField({ label, value, onChange, prefix, suffix, min = 0, step = "0.01" }: { label: string; value: string; onChange: (value: string) => void; prefix?: string; suffix?: string; min?: number; step?: string }) {
  return (
    <label className="text-xs font-medium text-muted-foreground">
      {label}
      <div className="mt-1 flex h-8 items-center rounded-md border bg-background px-2 focus-within:ring-2 focus-within:ring-primary/20">
        {prefix ? <span className="mr-1 text-[12px] text-muted-foreground">{prefix}</span> : null}
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-right text-[13px] font-medium outline-none"
        />
        {suffix ? <span className="ml-1 text-[12px] text-muted-foreground">{suffix}</span> : null}
      </div>
    </label>
  );
}

function CommercialMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function EnvironmentCommercialSummary({ commercial }: { commercial: any }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="mb-2 flex items-center gap-2">
        <Calculator className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Resumo comercial local do ambiente</h3>
      </div>
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        <CommercialMetric label="Quantidade" value={formatNumber(commercial.quantity, 0)} />
        <CommercialMetric label="Valor unitário" value={formatCurrencyLocal(commercial.unitPrice)} />
        <CommercialMetric label="Investimento total" value={formatCurrencyLocal(commercial.investmentTotal)} />
        <CommercialMetric label="COP" value={formatNumber(commercial.cop, 2)} />
        <CommercialMetric label="Potência elétrica" value={formatKw(commercial.electricalPowerKW)} />
        <CommercialMetric label="Consumo diário" value={`${formatNumber(commercial.kWhDay, 0)} kWh`} />
        <CommercialMetric label="Consumo mensal" value={`${formatNumber(commercial.kWhMonth, 0)} kWh`} />
        <CommercialMetric label="Custo mensal" value={formatCurrencyLocal(commercial.monthlyCost)} />
        <CommercialMetric label="Custo anual" value={formatCurrencyLocal(commercial.annualCost)} />
        <CommercialMetric label="Custo por kg" value={commercial.costPerKg !== null ? `${formatCurrencyLocal(commercial.costPerKg)}/kg` : "—"} />
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Simulação comercial local: não salva no banco, não altera o cálculo térmico, não altera COP e não altera a energia mensal original.
      </p>
    </div>
  );
}

function ThermalLoadSummary({ result }: { result: any }) {
  const tunnel = result?.calculation_breakdown?.tunnel ?? result?.calculationBreakdown?.tunnel ?? {};
  const loads = tunnel?.loads ?? tunnel?.persistedLoads ?? {};
  const rows = [
    { label: "Produto", value: firstFinite(result?.productLoadKW, result?.product_load_kw, result?.tunnel_product_load_kw, tunnel?.productLoadKW, loads?.productLoadKW), format: formatKw },
    { label: "Transmissão", value: firstFinite(result?.transmissionLoadKW, result?.transmission_load_kw, result?.tunnel_transmission_load_kw, tunnel?.transmissionLoadKW, loads?.transmissionLoadKW), format: formatKw },
    { label: "Infiltração", value: firstFinite(result?.infiltrationLoadKW, result?.infiltration_load_kw, result?.tunnel_infiltration_load_kw, tunnel?.infiltrationLoadKW, loads?.infiltrationLoadKW), format: formatKw },
    { label: "Interna", value: firstFinite(result?.internalLoadKW, result?.internal_load_kw, result?.tunnel_internal_load_kw, tunnel?.internalLoadKW, loads?.internalLoadKW), format: formatKw },
    { label: "Total", value: firstFinite(result?.totalKW, result?.total_kw, result?.total_required_kw, result?.tunnel_total_load_kw, tunnel?.totalKW, loads?.totalKW), format: formatKw },
    { label: "Total", value: firstFinite(result?.totalKcalH, result?.total_kcal_h, result?.total_required_kcal_h, result?.tunnel_total_load_kcal_h, tunnel?.totalKcalH, loads?.totalKcalH), format: (value: unknown) => (isFiniteValue(value) ? `${formatNumber(value, 0)} kcal/h` : "—") },
    { label: "Total", value: firstFinite(result?.totalTR, result?.total_tr, result?.total_required_tr, result?.tunnel_total_load_tr, tunnel?.totalTR, loads?.totalTR), format: (value: unknown) => (isFiniteValue(value) ? `${formatNumber(value, 2)} TR` : "—") },
  ];

  return (
    <div className="rounded-xl border bg-background p-3">
      <h3 className="mb-2 text-sm font-semibold">Carga térmica</h3>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`} className="min-w-0 rounded-lg border bg-muted/20 p-2.5">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{row.label}</div>
            <div className="mt-1 text-sm font-semibold tabular-nums text-foreground sm:text-base">{row.format(row.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function commercialEquipmentName(item: any) {
  return String(item?.equipmentName ?? item?.equipment_name ?? item?.equipment?.model ?? item?.equipment?.name ?? item?.model ?? item?.name ?? "—");
}

function EnvironmentCommercialProposal({ project, environment, result, selection, products, commercial }: { project: any; environment: any; result: any; selection: any; products: any[]; commercial: any }) {
  const optimization = result?.equipmentOptimization ?? result?.equipment_optimization ?? result?.optimization ?? result?.calculation_breakdown?.equipmentOptimization ?? result?.calculation_breakdown?.equipment_optimization ?? {};
  const ranking = Array.isArray(optimization?.ranking) && optimization.ranking.length ? optimization.ranking : selection ? [selection] : [];
  const baselineMonthlyCost = ranking.reduce((max: number | null, item: any) => {
    const value = firstFinite(item?.estimatedMonthlyCost, item?.estimated_monthly_cost);
    return value !== null ? Math.max(max ?? value, value) : max;
  }, null);
  const monthlySavings = baselineMonthlyCost !== null && commercial.monthlyCost !== null ? Math.max(0, baselineMonthlyCost - commercial.monthlyCost) : null;
  const annualSavings = monthlySavings !== null ? monthlySavings * 12 : null;
  const paybackMonths = annualSavings && annualSavings > 0 && commercial.investmentTotal > 0 ? commercial.investmentTotal / annualSavings * 12 : null;
  const roiPercent = annualSavings && commercial.investmentTotal > 0 ? annualSavings / commercial.investmentTotal * 100 : null;

  return (
    <section id="coldpro-commercial-proposal" className="space-y-4 rounded-lg border bg-background p-4">
      <header className="border-b pb-3">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">CN ColdPro · Proposta comercial automática</div>
        <h2 className="mt-1 text-xl font-bold">{project?.name ?? "Projeto"}</h2>
        <div className="mt-1 text-sm text-muted-foreground">Ambiente: {environment?.name ?? "—"} · Emissão {new Date().toLocaleDateString("pt-BR")}</div>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <CommercialMetric label="Investimento total" value={formatCurrencyLocal(commercial.investmentTotal)} />
        <CommercialMetric label="Payback estimado" value={paybackMonths !== null ? `${formatNumber(paybackMonths, 1)} meses` : "—"} />
        <CommercialMetric label="ROI anual estimado" value={roiPercent !== null ? `${formatNumber(roiPercent, 1)}%` : "—"} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border bg-muted/20 p-3">
          <h3 className="mb-2 text-sm font-semibold">Resumo técnico-comercial</h3>
          <div className="grid gap-x-5 gap-y-1 text-sm sm:grid-cols-2">
            <div>Carga requerida: <b>{formatKw(result?.total_required_kw)}</b></div>
            <div>Total requerido: <b>{formatNumber(result?.total_required_kcal_h, 0)} kcal/h</b></div>
            <div>Equipamento: <b>{commercialEquipmentName(selection)}</b></div>
            <div>Quantidade: <b>{formatNumber(commercial.quantity, 0)} un.</b></div>
            <div>Potência elétrica: <b>{formatKw(commercial.electricalPowerKW)}</b></div>
            <div>COP: <b>{formatNumber(commercial.cop, 2)}</b></div>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/20 p-3">
          <h3 className="mb-2 text-sm font-semibold">Energia e custo operacional</h3>
          <div className="grid gap-x-5 gap-y-1 text-sm sm:grid-cols-2">
            <div>Consumo diário: <b>{formatNumber(commercial.kWhDay, 0)} kWh</b></div>
            <div>Consumo mensal: <b>{formatNumber(commercial.kWhMonth, 0)} kWh</b></div>
            <div>Custo mensal: <b>{formatCurrencyLocal(commercial.monthlyCost)}</b></div>
            <div>Custo anual: <b>{formatCurrencyLocal(commercial.annualCost)}</b></div>
            <div>Custo por kg: <b>{commercial.costPerKg !== null ? `${formatCurrencyLocal(commercial.costPerKg)}/kg` : "—"}</b></div>
            <div>Economia anual estimada: <b>{formatCurrencyLocal(annualSavings)}</b></div>
          </div>
        </div>
      </div>

      {ranking.length ? (
        <div className="rounded-lg border bg-muted/20 p-3">
          <h3 className="mb-2 text-sm font-semibold">Comparação de equipamentos</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="border px-2 py-1 text-left">#</th>
                  <th className="border px-2 py-1 text-left">Equipamento</th>
                  <th className="border px-2 py-1 text-right">Margem</th>
                  <th className="border px-2 py-1 text-right">Custo mensal</th>
                  <th className="border px-2 py-1 text-right">Score</th>
                  <th className="border px-2 py-1 text-right">Potência</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((item: any, index: number) => (
                  <tr key={`${commercialEquipmentName(item)}-${index}`}>
                    <td className="border px-2 py-1">{index + 1}</td>
                    <td className="border px-2 py-1">{commercialEquipmentName(item)}</td>
                    <td className="border px-2 py-1 text-right">{item?.capacityMarginPercent != null ? `${formatNumber(item.capacityMarginPercent, 2)}%` : "—"}</td>
                    <td className="border px-2 py-1 text-right">{formatCurrencyLocal(item?.estimatedMonthlyCost)}</td>
                    <td className="border px-2 py-1 text-right">{formatNumber(item?.scores?.final, 2)}</td>
                    <td className="border px-2 py-1 text-right">{formatKw(item?.estimatedElectricalPowerKW)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {products.length ? (
        <div className="rounded-lg border bg-muted/20 p-3 text-sm">
          <h3 className="mb-2 text-sm font-semibold">Escopo do ambiente</h3>
          <div className="grid gap-1 sm:grid-cols-2">
            {products.map((product: any) => (
              <div key={product.id}>{product.product_name}: <b>{formatNumber(product.mass_kg_day, 0)} kg/dia</b></div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ColdProProjectPage() {
  const { id } = Route.useParams();
  const { data, isLoading } = useColdProProjectBundle(id);
  const createEnv = useCreateColdProEnvironment(id);
  const updateProject = useUpdateColdProProject(id);
  const updateEnv = useUpdateColdProEnvironment(id);
  const deleteEnv = useDeleteColdProEnvironment(id);
  const upsertProduct = useUpsertColdProProduct(id);
  const deleteProduct = useDeleteColdProProduct(id);
  const upsertTunnel = useUpsertColdProTunnel(id);
  const calculate = useCalculateColdProEnvironment(id);
  const autoSelect = useAutoSelectColdProEquipment(id);
  const pushToProposal = usePushColdProToProposal(id);
  const generatePdf = useGenerateColdProMemorialPdf(id);
  const analyzeMemorial = useAnalyzeColdProMemorial(id);
  const [lastPdfUrl, setLastPdfUrl] = React.useState<string | null>(null);
  const qc = useQueryClient();
  const saveCatalogSel = useMutation({
    mutationFn: (payload: any) => saveCatalogEquipmentSelection({ data: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coldpro-project", id] }),
  });

  const [selectedEnvId, setSelectedEnvId] = React.useState<string | null>(null);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [editingProjectName, setEditingProjectName] = React.useState(false);
  const [projectNameDraft, setProjectNameDraft] = React.useState("");
  const [editingProductId, setEditingProductId] = React.useState<string | null>(null);
  const [autoMinQuantity, setAutoMinQuantity] = React.useState("1");
  const [autoEquipmentKind, setAutoEquipmentKind] = React.useState<"ALL" | "plugin" | "biblock" | "split">("ALL");
  const [tunnelExpertAnalysis, setTunnelExpertAnalysis] = React.useState<string | null>(null);
  const [showProjectReport, setShowProjectReport] = React.useState(false);
  const [showEnvironmentReport, setShowEnvironmentReport] = React.useState(false);
  const [showCommercialProposal, setShowCommercialProposal] = React.useState(false);
  const [energyTariff, setEnergyTariff] = React.useState("0.95");
  const [commercialQuantity, setCommercialQuantity] = React.useState("1");
  const [equipmentUnitPrice, setEquipmentUnitPrice] = React.useState("0");

  const environments = data?.environments ?? [];
  const selectedEnv = environments.find((env: any) => env.id === selectedEnvId) ?? environments[0];
  const allProducts = data?.products ?? [];
  const products = allProducts.filter((p: any) => p.environment_id === selectedEnv?.id);
  const tunnel = (data?.tunnels ?? []).find((t: any) => t.environment_id === selectedEnv?.id);
  const savedResult = (data?.results ?? []).find((r: any) => r.environment_id === selectedEnv?.id);
  const calculatedResult = calculate.data?.environment_id === selectedEnv?.id ? calculate.data : null;
  const result = calculatedResult ?? savedResult;
  const savedSelection = (data?.selections ?? []).find((s: any) => s.environment_id === selectedEnv?.id);
  const mutationSelection = autoSelect.data?.environment_id === selectedEnv?.id ? autoSelect.data : saveCatalogSel.data?.environment_id === selectedEnv?.id ? saveCatalogSel.data : null;
  const selection = mutationSelection ?? savedSelection;
  const currentResults = React.useMemo(
    () => (result && selectedEnv?.id ? [result, ...(data?.results ?? []).filter((item: any) => item.environment_id !== selectedEnv.id)] : data?.results ?? []),
    [data?.results, result, selectedEnv?.id],
  );
  const currentSelections = React.useMemo(
    () => (selection && selectedEnv?.id ? [selection, ...(data?.selections ?? []).filter((item: any) => item.environment_id !== selectedEnv.id)] : data?.selections ?? []),
    [data?.selections, selection, selectedEnv?.id],
  );
  const tunnelPreview = tunnel && selectedEnv ? calculateTunnelEngine(databaseToTunnelInput(tunnel, selectedEnv)) : null;
  const technicalAudit = React.useMemo(() => auditColdProTechnicalConsistency({ environment: selectedEnv, result, tunnel: tunnelPreview ?? tunnel, products, advancedProcesses: [], selection }), [selectedEnv, result, tunnelPreview, tunnel, products, selection]);
  const environmentLoad = Number(result?.transmission_kcal_h ?? 0);
  const savedProductLoad = Number(result?.product_kcal_h ?? 0) + Number(result?.packaging_kcal_h ?? 0) + Number(result?.calculation_breakdown?.respiration_kcal_h ?? 0) + Number(result?.tunnel_internal_load_kcal_h ?? 0);
  const productLoad = savedProductLoad > 0 ? savedProductLoad : Number(tunnelPreview?.totalKcalH ?? 0);
  const extraPreview = calculateExtraLoadPreview(selectedEnv ?? {});
  const extraLoad = result ? Number(result.infiltration_kcal_h ?? 0) + Number(result.people_kcal_h ?? 0) + Number(result.lighting_kcal_h ?? 0) + Number(result.motors_kcal_h ?? 0) + Number(result.fans_kcal_h ?? 0) + Number(result.defrost_kcal_h ?? 0) + Number(result.other_kcal_h ?? 0) : extraPreview.subtotal_kcal_h;
  const catalogFanLoadKcalH = Number(selection?.curve_metadata?.fan_power_kw ?? 0) * Number(selection?.quantity ?? 1) * 859.845;
  const selectedQuantity = firstFinite(selection?.quantity, selection?.curve_metadata?.quantidade) ?? 1;
  const energy = result?.energySimulation ?? result?.energy_simulation ?? result?.calculation_breakdown?.energySimulation ?? result?.calculation_breakdown?.energy_simulation ?? {};
  const commercialQuantityNumber = Math.max(1, Math.ceil(firstFinite(commercialQuantity) ?? selectedQuantity ?? 1));
  const commercialUnitPrice = Math.max(0, firstFinite(equipmentUnitPrice) ?? 0);
  const commercialTariff = Math.max(0, firstFinite(energyTariff) ?? 0);
  const commercialCop = firstFinite(selection?.cop, selection?.curve_metadata?.cop, result?.cop, result?.COP, result?.copData?.cop, result?.cop_data?.cop, energy?.cop, energy?.assumptions?.cop);
  const commercialElectricalPowerKW = firstFinite(selection?.total_power_kw, selection?.curve_metadata?.potencia_eletrica_kw, energy?.electricalPowerKW, energy?.electrical_power_kw, commercialCop && result?.total_required_kw ? Number(result.total_required_kw) / commercialCop : null);
  const commercialOperatingHours = firstFinite(energy?.assumptions?.operatingHoursPerDay, result?.operatingHoursPerDay, result?.operating_hours_per_day) ?? 8;
  const commercialOperatingDays = firstFinite(energy?.assumptions?.operatingDaysPerMonth, result?.operatingDaysPerMonth, result?.operating_days_per_month) ?? 22;
  const commercialProcessedMassMonth = firstFinite(energy?.processedMassKgMonth, energy?.processed_mass_kg_month, energy?.assumptions?.monthlyProcessedMassKg, energy?.assumptions?.monthly_processed_mass_kg);
  const commercialKWhDay = commercialElectricalPowerKW !== null ? commercialElectricalPowerKW * commercialOperatingHours : null;
  const commercialKWhMonth = commercialKWhDay !== null ? commercialKWhDay * commercialOperatingDays : null;
  const commercialMonthlyCost = commercialKWhMonth !== null ? commercialKWhMonth * commercialTariff : null;
  const commercialSummary = {
    quantity: commercialQuantityNumber,
    unitPrice: commercialUnitPrice,
    investmentTotal: commercialQuantityNumber * commercialUnitPrice,
    cop: commercialCop,
    electricalPowerKW: commercialElectricalPowerKW,
    kWhDay: commercialKWhDay,
    kWhMonth: commercialKWhMonth,
    monthlyCost: commercialMonthlyCost,
    annualCost: commercialMonthlyCost !== null ? commercialMonthlyCost * 12 : null,
    costPerKg: commercialMonthlyCost !== null && commercialProcessedMassMonth && commercialProcessedMassMonth > 0 ? commercialMonthlyCost / commercialProcessedMassMonth : null,
  };

  React.useEffect(() => {
    if (!selectedEnvId && environments[0]?.id) setSelectedEnvId(environments[0].id);
  }, [selectedEnvId, environments]);

  React.useEffect(() => setProjectNameDraft(data?.project?.name ?? ""), [data?.project?.name]);
  React.useEffect(() => setTunnelExpertAnalysis(null), [selectedEnv?.id]);
  React.useEffect(() => setShowEnvironmentReport(false), [selectedEnv?.id]);
  React.useEffect(() => setShowCommercialProposal(false), [selectedEnv?.id]);
  React.useEffect(() => {
    if (selection?.quantity) setCommercialQuantity(String(Math.max(1, Math.ceil(Number(selection.quantity) || 1))));
  }, [selection?.quantity, selectedEnv?.id]);

  const completed: Record<number, boolean> = {
    0: !!selectedEnv?.length_m,
    1: products.length > 0 || !!tunnel,
    2: !!selectedEnv?.safety_factor_percent,
    3: !!result,
  };

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando CN ColdPro...</div>;

  async function handleCreateEnv(type = "cold_room") {
    const env = await createEnv.mutateAsync({
      name: `Ambiente ${environments.length + 1}`,
      environment_type: type,
    });
    setSelectedEnvId(env.id);
    setStepIndex(0);
  }

  async function handleSaveProjectName() {
    const name = projectNameDraft.trim();
    if (!name) return toast.error("Informe o nome do projeto");
    try {
      await updateProject.mutateAsync({ id, name });
      setEditingProjectName(false);
      toast.success("Nome do projeto atualizado");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar projeto");
    }
  }

  async function handleDeleteEnvironment() {
    if (!selectedEnv) return;
    if (!window.confirm(`Excluir o ambiente "${selectedEnv.name}" e todos os dados vinculados?`)) return;
    try {
      await deleteEnv.mutateAsync(selectedEnv.id);
      const nextEnv = environments.find((env: any) => env.id !== selectedEnv.id);
      setSelectedEnvId(nextEnv?.id ?? null);
      setStepIndex(0);
      toast.success("Ambiente excluído");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao excluir ambiente");
    }
  }

  async function handleCalculate() {
    if (!selectedEnv) return;
    try {
      const calculated = await calculate.mutateAsync(selectedEnv.id);
      toast.success("Carga térmica calculada");
      setStepIndex(COLDPRO_STEPS.length - 1);
      const postAudit = auditColdProTechnicalConsistency({ environment: selectedEnv, result: calculated, tunnel: tunnelPreview ?? tunnel, products, advancedProcesses: [], selection });
      if (["blast_freezer", "cooling_tunnel"].includes(String(selectedEnv.environment_type)) && !postAudit.isBlocked) {
        try {
          await autoSelect.mutateAsync({ environmentId: selectedEnv.id, minQuantity: 1, equipmentKind: null });
          toast.success("Melhor equipamento CN Cold pré-selecionado");
        } catch (selectionError: any) {
          toast.warning(selectionError?.message ?? "Cálculo concluído, mas nenhum equipamento foi pré-selecionado.");
        }
        const analysis = await handleAnalyzeMemorial(
          `Analise tecnicamente o túnel ${selectedEnv.name} após o cálculo e a pré-seleção de equipamento. Atue como especialista em túnel de congelamento/resfriamento: valide carga térmica, temperatura interna, temperatura de evaporação, vazão/velocidade de ar quando disponíveis, tempo estimado de processo, margem da seleção, COP e eficiência. Dê insights práticos sobre melhorar desempenho, reduzir tempo de congelamento, ajustar temperatura do túnel, aumentar ou reduzir porte do equipamento e riscos técnicos. Seja criterioso e não invente dados ausentes.`,
        );
        if (analysis) setTunnelExpertAnalysis(analysis);
      } else if (postAudit.isBlocked) {
        toast.warning("Cálculo preliminar/bloqueado: corrija produto/processo, infiltração e degelo antes da seleção final.");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erro no cálculo");
    }
  }

  async function handleRecalculateEnvironment(environmentId: string, successMessage: string) {
    try {
      await calculate.mutateAsync(environmentId);
      toast.success(successMessage);
    } catch (e: any) {
      toast.warning(e?.message ? `Dados salvos, mas o recálculo falhou: ${e.message}` : "Dados salvos, mas o recálculo falhou.");
    }
  }

  async function handleSaveTunnel(payload: any) {
    if (!selectedEnv) return;
    try {
      await upsertTunnel.mutateAsync(payload);
      await handleRecalculateEnvironment(selectedEnv.id, "Túnel salvo e carga recalculada");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    }
  }

  async function handleSaveProduct(payload: any) {
    if (!selectedEnv) return;
    try {
      const row = await upsertProduct.mutateAsync(payload);
      setEditingProductId(row?.id ?? null);
      await handleRecalculateEnvironment(selectedEnv.id, payload.id ? "Produto salvo e carga recalculada" : "Produto adicionado e carga recalculada");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    }
  }

  async function handleDeleteProduct(product: any) {
    if (!selectedEnv) return;
    if (!window.confirm(`Excluir o produto "${product.product_name}"?`)) return;
    try {
      await deleteProduct.mutateAsync(product.id);
      if (editingProductId === product.id) setEditingProductId(null);
      await handleRecalculateEnvironment(selectedEnv.id, "Produto excluído e carga recalculada");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao excluir");
    }
  }

  async function handleAutoSelect() {
    if (!selectedEnv) return;
    if (technicalAudit.isBlocked) {
      toast.error("Seleção baseada em carga preliminar inválida/incompleta.");
      return;
    }
    try {
      await autoSelect.mutateAsync({
        environmentId: selectedEnv.id,
        minQuantity: Math.max(1, Math.ceil(Number(autoMinQuantity || 1))),
        equipmentKind: autoEquipmentKind === "ALL" ? null : autoEquipmentKind,
      });
      toast.success("Equipamento selecionado");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao selecionar equipamento");
    }
  }

  async function handlePushToProposal() {
    try {
      const res = await pushToProposal.mutateAsync("append");
      toast.success(`${res.inserted_items} item(ns) enviados para a proposta.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar para proposta");
    }
  }

  function handlePrintEnvironmentReport() {
    setShowEnvironmentReport(true);
    setShowCommercialProposal(true);
    window.setTimeout(() => window.print(), 80);
  }

  async function handleGeneratePdf(aiAnalysis?: string | null, reportType: "full" | "proposal_summary" = "full") {
    try {
      const res = await generatePdf.mutateAsync({ attachToProposal: true, aiAnalysis, reportType });
      setLastPdfUrl(res.signedUrl ?? null);
      toast.success(
        reportType === "proposal_summary" && res.attachedToProposalId
          ? "Resumo PDF gerado e anexado à proposta."
          : res.attachedToProposalId
          ? "Memorial PDF gerado e anexado à proposta."
          : "Memorial PDF gerado.",
      );
      if (res.signedUrl) window.open(res.signedUrl, "_blank");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar PDF");
    }
  }

  async function handleAnalyzeMemorial(question: string, previousAnalysis?: string | null) {
    try {
      const res = await analyzeMemorial.mutateAsync({ question, previousAnalysis });
      return res.analysis;
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar análise por IA");
      return null;
    }
  }

  function next() {
    setStepIndex((i) => Math.min(i + 1, COLDPRO_STEPS.length - 1));
  }
  function prev() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  return (
    <div className="coldpro-page min-h-screen min-w-0 bg-muted/30">
      {/* HEADER ESTILO SELECT COLD: faixa escura com identidade */}
      <div className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground print:hidden">
        <div className="flex flex-col gap-1.5 px-3 py-2 sm:px-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/app/coldpro" className="text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground">
              ← Projetos
            </Link>
            <div className="h-6 w-px bg-sidebar-border" />
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-widest text-sidebar-foreground/60">
                  CN ColdPro · Cálculo térmico
                </div>
                {editingProjectName ? (
                  <div className="mt-1 flex max-w-xl gap-2">
                    <input value={projectNameDraft} onChange={(event) => setProjectNameDraft(event.target.value)} className="h-8 min-w-0 flex-1 rounded-md border border-sidebar-border bg-background px-2 text-sm text-foreground" />
                    <button type="button" onClick={handleSaveProjectName} disabled={updateProject.isPending} className="rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50">Salvar</button>
                    <button type="button" onClick={() => { setEditingProjectName(false); setProjectNameDraft(data?.project?.name ?? ""); }} className="rounded-md px-2 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent">Cancelar</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setEditingProjectName(true)} className="group mt-0.5 flex max-w-xl items-center gap-2 text-left text-sm font-semibold">
                    <span className="truncate">{data?.project?.name ?? "Novo projeto"}</span><Pencil className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
                  </button>
                )}
              </div>
          </div>
          <div className="text-[11px] text-sidebar-foreground/70">
            {showProjectReport ? "Relatório Geral do Projeto" : `Etapa ${stepIndex + 1} / ${COLDPRO_STEPS.length} — ${COLDPRO_STEPS[stepIndex].title}`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 p-2 sm:p-3 lg:grid-cols-[210px_minmax(0,1fr)]">
        {/* Sidebar de ambientes */}
        <aside className="space-y-2 print:hidden lg:sticky lg:top-3 lg:self-start">
          <div className="rounded-lg border bg-background p-2.5 shadow-sm">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Novo ambiente
            </h2>
            <div className="grid grid-cols-1 gap-2">
              {[
                { type: "cold_room", label: "Câmara fria", icon: Thermometer },
                { type: "freezer_room", label: "Câmara congelados", icon: Snowflake },
                { type: "blast_freezer", label: "Túnel congelamento", icon: Wind },
                { type: "cooling_tunnel", label: "Túnel resfriamento", icon: Warehouse },
              ].map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    className="inline-flex items-center justify-start gap-2 rounded-lg border border-transparent px-3 py-2 text-[12px] text-muted-foreground transition hover:border-primary/20 hover:bg-primary/5 hover:text-foreground"
                    onClick={() => handleCreateEnv(opt.type)}
                  >
                    <Icon className="h-3.5 w-3.5 text-primary" /> {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border bg-background p-2.5 shadow-sm">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Ambientes do projeto
            </h2>
            <button
              type="button"
              onClick={() => setShowProjectReport(true)}
              disabled={environments.length === 0}
              className={`mb-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition disabled:opacity-50 ${
                showProjectReport ? "border-primary/40 bg-primary/10 text-primary" : "hover:bg-muted"
              }`}
            >
              <FileText className="h-4 w-4" /> Gerar relatório geral
            </button>
            {environments.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                Nenhum ambiente. Crie o primeiro acima.
              </div>
            ) : (
              <div className="flex max-h-[420px] gap-2 overflow-x-auto pr-1 lg:block lg:space-y-2 lg:overflow-y-auto">
                {environments.map((env: any) => (
                  <button
                    key={env.id}
                    type="button"
                    className={`min-w-48 rounded-lg border px-3 py-2.5 text-left text-sm transition lg:w-full ${
                      env.id === selectedEnv?.id
                        ? "border-primary/40 bg-primary/10 shadow-sm"
                        : "border-transparent hover:bg-muted"
                    }`}
                    onClick={() => {
                      setShowProjectReport(false);
                      setSelectedEnvId(env.id);
                      setStepIndex(0);
                    }}
                  >
                    <div className="font-medium leading-tight">{env.name}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {fmt(env.volume_m3)} m³ · {env.internal_temp_c}°C
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Conteúdo principal */}
        <div className="min-w-0 space-y-2">
          {showProjectReport && environments.length > 0 ? (
            <div className="space-y-3">
              <ColdProProjectResultDashboard
                project={data?.project}
                environments={environments}
                results={currentResults}
                selections={currentSelections}
                products={allProducts}
                advancedProcesses={data?.advancedProcesses ?? []}
                onAnalyze={handleAnalyzeMemorial}
                isAnalyzing={analyzeMemorial.isPending}
              />

              <ColdProReport
                project={data?.project}
                environments={environments}
                results={currentResults}
                selections={currentSelections}
                products={allProducts}
                advancedProcesses={data?.advancedProcesses ?? []}
                onPushToProposal={handlePushToProposal}
                isPushing={pushToProposal.isPending}
                onGeneratePdf={handleGeneratePdf}
                onAnalyze={handleAnalyzeMemorial}
                isGeneratingPdf={generatePdf.isPending}
                isAnalyzing={analyzeMemorial.isPending}
                lastPdfUrl={lastPdfUrl}
              />
            </div>
          ) : !selectedEnv ? (
            <div className="rounded-xl border border-dashed bg-background p-10 text-center text-sm text-muted-foreground">
              Crie um ambiente na barra lateral para iniciar o cálculo de carga térmica.
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border bg-background shadow-sm print:hidden">
                <ColdProStepper
                  currentStep={stepIndex}
                  completed={completed}
                  onStepClick={setStepIndex}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 shadow-sm print:hidden">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{selectedEnv.name}</div>
                  <div className="text-xs text-muted-foreground">{selectedEnv.environment_type} · {fmt(selectedEnv.volume_m3)} m³ · {selectedEnv.internal_temp_c}°C</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={handleCalculate} disabled={calculate.isPending} className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition hover:bg-muted disabled:opacity-50">
                    {calculate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                    {calculate.isPending ? "Recalculando..." : "Recalcular ambiente"}
                  </button>
                  <button type="button" onClick={handleDeleteEnvironment} disabled={deleteEnv.isPending} className="inline-flex items-center gap-2 rounded-md border border-destructive/30 px-3 py-1.5 text-sm text-destructive transition hover:bg-destructive/10 disabled:opacity-50">
                    <Trash2 className="h-4 w-4" /> {deleteEnv.isPending ? "Excluindo..." : "Excluir ambiente"}
                  </button>
                </div>
              </div>

              {/* STEP 0 - AMBIENTE */}
              {stepIndex === 0 && (
                <div className="space-y-3">
                  <ColdProEnvironmentForm
                    environment={selectedEnv}
                    insulationMaterials={data?.insulationMaterials ?? []}
                    thermalMaterials={data?.thermalMaterials ?? []}
                    onSave={(patch) => {
                      updateEnv.mutate(
                        { id: selectedEnv.id, patch },
                        {
                          onSuccess: () => toast.success("Ambiente salvo"),
                          onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
                        },
                      );
                    }}
                  />
                  <ColdProSectionLoadSummary
                    title="Prévia da carga do ambiente"
                    rows={[{ label: "Transmissão por paredes, teto e piso", value: result?.transmission_kcal_h }]}
                    totalLabel="Total calculado da aba Ambiente"
                    total={environmentLoad}
                  />
                </div>
              )}

              {/* STEP 1 - PRODUTOS / TÚNEL */}
              {stepIndex === 1 && (
                <div className="space-y-3">
                  {["blast_freezer", "cooling_tunnel"].includes(selectedEnv.environment_type) ? (
                    <ColdProTunnelForm
                      environmentId={selectedEnv.id}
                      environment={selectedEnv}
                      product={products[0] ?? null}
                      tunnel={tunnel}
                      productCatalog={data?.productCatalog ?? []}
                      onSave={handleSaveTunnel}
                    />
                  ) : (
                    <ColdProProductForm
                      environmentId={selectedEnv.id}
                      product={products.find((p: any) => p.id === editingProductId) ?? products[0] ?? null}
                      productCatalog={data?.productCatalog ?? []}
                      saving={upsertProduct.isPending || calculate.isPending}
                      onSave={handleSaveProduct}
                    />
                  )}

                  <ColdProSectionLoadSummary
                    title="Prévia da carga de produto"
                    rows={[
                      { label: "Produto", value: Number(result?.product_kcal_h ?? 0) || (tunnelPreview ? tunnelPreview.productLoadKW * 859.845 : 0) },
                      { label: "Embalagem", value: Number(result?.packaging_kcal_h ?? 0) || (tunnelPreview ? tunnelPreview.packagingLoadKW * 859.845 : 0) },
                      { label: "Respiração", value: result?.calculation_breakdown?.respiration_kcal_h },
                      { label: "Túnel / processo", value: Number(result?.tunnel_internal_load_kcal_h ?? 0) || (tunnelPreview ? tunnelPreview.internalLoadKW * 859.845 : 0) },
                    ]}
                    totalLabel="Total calculado da aba Produtos"
                    total={productLoad}
                  />

                  <div className="rounded-lg border bg-background p-3">
                    <h3 className="mb-3 text-base font-semibold">Produtos cadastrados</h3>
                    {products.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Nenhum produto/processo cadastrado.</div>
                    ) : (
                      <div className="space-y-2">
                        {products.map((p: any) => (
                          <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                            <div>
                              <b>{p.product_name}</b> · {fmt(p.mass_kg_day)} kg/dia · entrada {p.inlet_temp_c}°C → final{" "}
                              {p.outlet_temp_c}°C
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => setEditingProductId(p.id)} className="rounded-md border px-2 py-1 text-xs hover:bg-muted">Editar</button>
                              <button type="button" onClick={() => handleDeleteProduct(p)} disabled={deleteProduct.isPending || calculate.isPending} className="rounded-md border border-destructive/30 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50">Excluir</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2 - CARGAS EXTRAS */}
              {stepIndex === 2 && (
                <div className="space-y-3">
                  <ColdProExtraLoadsForm
                    environment={selectedEnv}
                    catalogFanLoadKcalH={catalogFanLoadKcalH}
                    onSave={(patch) =>
                      updateEnv.mutate(
                        { id: selectedEnv.id, patch },
                        {
                          onSuccess: () => toast.success("Cargas extras salvas"),
                          onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
                        },
                      )
                    }
                  />
                  <ColdProSectionLoadSummary
                    title="Prévia das cargas extras"
                    rows={[
                      { label: "Infiltração", value: result?.infiltration_kcal_h ?? extraPreview.infiltration_kcal_h },
                      { label: "Pessoas", value: result?.people_kcal_h ?? extraPreview.people_kcal_h },
                      { label: "Iluminação", value: result?.lighting_kcal_h ?? extraPreview.lighting_kcal_h },
                      { label: "Motores", value: result?.motors_kcal_h ?? extraPreview.motors_kcal_h },
                      { label: "Ventiladores", value: result?.fans_kcal_h ?? extraPreview.fans_kcal_h },
                      { label: "Degelo", value: result?.defrost_kcal_h ?? extraPreview.defrost_kcal_h },
                      { label: "Outras cargas", value: result?.other_kcal_h ?? extraPreview.other_kcal_h },
                      { label: "Segurança", value: result?.safety_kcal_h ?? extraPreview.safety_kcal_h, muted: true },
                    ]}
                    totalLabel="Total calculado da aba Cargas extras + segurança"
                    total={result ? extraLoad + Number(result.safety_kcal_h ?? 0) : extraPreview.total_with_safety_kcal_h}
                  />
                </div>
              )}

              {/* STEP 3 - RESULTADO */}
              {stepIndex === 3 && (
                <div className="space-y-3">
                  <div className="rounded-lg border bg-background p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="mb-1 text-base font-semibold">Resultado e ações do ambiente</h3>
                        <p className="text-sm text-muted-foreground">
                          Calcule, selecione equipamento e gere o relatório do ambiente atual.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted" onClick={() => setStepIndex(0)}>
                          <Pencil className="h-4 w-4" /> Editar
                        </button>
                        <button type="button" className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50" onClick={handleCalculate} disabled={calculate.isPending}>
                          {calculate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                          {calculate.isPending ? "Calculando..." : "Calcular carga"}
                        </button>
                        <button type="button" className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50" onClick={handleAutoSelect} disabled={!result || autoSelect.isPending || technicalAudit.isBlocked}>
                          {autoSelect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Snowflake className="h-4 w-4" />}
                          {autoSelect.isPending ? "Selecionando..." : "Selecionar automático"}
                        </button>
                        <button type="button" className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50" onClick={() => setShowEnvironmentReport((value) => !value)} disabled={!result}>
                          <FileText className="h-4 w-4" /> Gerar relatório
                        </button>
                        <button type="button" className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50" onClick={() => setShowCommercialProposal((value) => !value)} disabled={!result}>
                          <FileText className="h-4 w-4" /> Gerar proposta
                        </button>
                        <button type="button" className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50" onClick={handlePrintEnvironmentReport} disabled={!result}>
                          <Printer className="h-4 w-4" /> Imprimir PDF
                        </button>
                        <button type="button" className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50" onClick={() => handleGeneratePdf(null, "full")} disabled={!result || generatePdf.isPending}>
                          {generatePdf.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          Gerar PDF
                        </button>
                      </div>
                    </div>
                  </div>

                  {result && technicalAudit.isPreliminary ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                      <div className="font-semibold">Resultado preliminar. Corrigir dados obrigatórios antes da emissão técnica.</div>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {[...technicalAudit.blockers, ...technicalAudit.warnings].map((item) => <li key={item.code}>{item.message}</li>)}
                      </ul>
                    </div>
                  ) : null}

                  <div className="rounded-lg border bg-background p-3 print:hidden">
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold">Parâmetros comerciais locais</h3>
                      <p className="text-xs text-muted-foreground">Valores usados apenas para simulação nesta tela. Não são salvos e não alteram o resultado calculado.</p>
                    </div>
                    <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                      <CommercialField label="Valor da energia" value={energyTariff} onChange={setEnergyTariff} prefix="R$" suffix="/kWh" step="0.01" />
                      <CommercialField label="Quantidade de equipamentos" value={commercialQuantity} onChange={setCommercialQuantity} suffix="un." min={1} step="1" />
                      <CommercialField label="Valor unitário" value={equipmentUnitPrice} onChange={setEquipmentUnitPrice} prefix="R$" step="0.01" />
                    </div>
                  </div>

                  <EnvironmentCommercialSummary commercial={commercialSummary} />
                  {showCommercialProposal && result ? (
                    <EnvironmentCommercialProposal
                      project={data?.project}
                      environment={selectedEnv}
                      result={result}
                      selection={selection}
                      products={products}
                      commercial={commercialSummary}
                    />
                  ) : null}
                  <ColdProResultCard result={result} selection={selection} environment={selectedEnv} products={products} advancedProcesses={data?.advancedProcesses ?? []} onAnalyze={handleAnalyzeMemorial} isAnalyzing={analyzeMemorial.isPending} />
                  <div className="coldpro-grid">
                    <ThermalLoadSummary result={result} />
                    <EnergySummary result={result} />
                    <EquipmentOptimizationSummary result={result} selection={selection} />
                    <ProjectRecommendationSummary result={result} />
                  </div>

                  {/* Seleção por curva real do catálogo */}
                  <ColdProRealSelection
                    environment={selectedEnv}
                    result={result}
                    isSelecting={saveCatalogSel.isPending}
                    onSelect={async (cand) => {
                      try {
                        await saveCatalogSel.mutateAsync({
                          environmentId: selectedEnv.id,
                          equipmentModelId: cand.model.id,
                          modelName: cand.model.modelo,
                          refrigerant: cand.refrigerant,
                          quantity: cand.quantity,
                          capacityUnitKcalH: cand.capacity_unit_kcal_h,
                          capacityTotalKcalH: cand.capacity_total_kcal_h,
                          airFlowUnitM3H: cand.evaporator_airflow_m3_h,
                          airFlowTotalM3H: cand.air_flow_total_m3_h,
                          totalPowerKw: cand.total_power_kw,
                          cop: cand.cop,
                          surplusKcalH: cand.surplus_kcal_h,
                          surplusPercent: cand.surplus_percent,
                          airChangesHour: cand.air_changes_hour,
                          selectionMethod: cand.point_used.polynomial ? "polynomial" : cand.point_used.interpolated ? "interpolated" : "catalog_point",
                          curveTemperatureRoomC: cand.point_used.temperature_room_c,
                          curveEvaporationTempC: cand.point_used.evaporation_temp_c,
                          curveCondensationTempC: cand.point_used.condensation_temp_c,
                          curvePolynomialR2: cand.point_used.polynomial_r2,
                          curveInterpolated: cand.point_used.interpolated,
                          curveMetadata: { score: cand.score, warnings: cand.warnings, fan_power_kw: cand.fan_power_kw, capacity_nominal_kcal_h: cand.capacity_nominal_kcal_h, capacidade_corrigida_kcal_h: cand.capacity_unit_kcal_h, capacidade_total_corrigida_kcal_h: cand.capacity_total_kcal_h, fonte_curva: cand.curve_source, modelo: cand.model.modelo, quantidade: cand.quantity, temperatura_interna_c: cand.point_used.temperature_room_c, tevap_c: cand.point_used.evaporation_temp_c, tcond_c: cand.point_used.condensation_temp_c, refrigerante: cand.refrigerant, potencia_eletrica_kw: cand.total_power_kw, cop: cand.cop, vazao_m3_h: cand.air_flow_total_m3_h, versao_calculo: "coldpro-validation-v1", data_curva: new Date().toISOString() },
                          notes: `Curva de rendimento · Tevap ${cand.point_used.evaporation_temp_c}°C / Tcond ${cand.point_used.condensation_temp_c}°C${cand.point_used.polynomial ? " · polinomial" : cand.point_used.interpolated ? " · interpolado" : ""}`,
                        });
                        toast.success(`${cand.model.modelo} selecionado`);
                      } catch (e: any) {
                        toast.error(e?.message ?? "Erro ao salvar seleção");
                      }
                    }}
                  />

                  {/* Auto-select pela curva */}
                  <div className="rounded-lg border bg-background p-3">
                    <h3 className="mb-2 text-base font-semibold">Seleção automática pela curva</h3>
                    <p className="mb-3 text-sm text-muted-foreground">
                      Seleciona automaticamente o melhor modelo usando a curva de rendimento, COP, potência e sobra técnica.
                    </p>
                    <div className="mb-3 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
                      <label className="text-sm font-medium">
                        Qtd. mínima de equipamentos
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={autoMinQuantity}
                          onChange={(event) => setAutoMinQuantity(event.target.value)}
                          className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-right text-[13px]"
                        />
                      </label>
                      <label className="text-sm font-medium">
                        Tipo de equipamento
                        <select
                          value={autoEquipmentKind}
                          onChange={(event) => setAutoEquipmentKind(event.target.value as any)}
                          className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-[13px]"
                        >
                          <option value="ALL">Todos</option>
                          <option value="plugin">Plug-in</option>
                          <option value="biblock">Bi-bloco</option>
                          <option value="split">Split</option>
                        </select>
                      </label>
                    </div>
                    <button
                      type="button"
                      className="rounded-md border bg-background px-4 py-2 text-sm hover:bg-muted"
                      onClick={handleAutoSelect}
                      disabled={autoSelect.isPending || technicalAudit.isBlocked}
                    >
                      {autoSelect.isPending ? "Selecionando..." : "Selecionar melhor modelo"}
                    </button>
                  </div>

                  {selection ? (
                    <div className="rounded-lg border bg-background p-3">
                      <h3 className="mb-3 text-base font-semibold">Equipamento selecionado</h3>
                      <div className="grid gap-2 text-[13px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                        <div>Modelo: <b>{selection.model}</b></div>
                        <div>Qtd. seleção: <b>{fmt(selection.quantity)}</b></div>
                        <div>Qtd. comercial: <b>{formatNumber(commercialQuantityNumber, 0)}</b></div>
                        <div>Capacidade total: <b>{fmt(selection.capacity_total_kcal_h)} kcal/h</b></div>
                        <div>Sobra: <b>{fmt(selection.surplus_percent)}%</b></div>
                        <div>Vazão total: <b>{fmt(selection.air_flow_total_m3_h)} m³/h</b></div>
                        <div>Trocas/h: <b>{fmt(selection.air_changes_hour)}</b></div>
                        <div>Potência: <b>{selection.total_power_kw ? `${fmt(selection.total_power_kw)} kW` : "—"}</b></div>
                        <div>COP: <b>{selection.cop ? fmt(selection.cop) : "—"}</b></div>
                        <div>Valor unitário: <b>{formatCurrencyLocal(commercialUnitPrice)}</b></div>
                        <div>Investimento total: <b>{formatCurrencyLocal(commercialSummary.investmentTotal)}</b></div>
                        <div>Método: <b>{selection.selection_method === "polynomial" ? "Curva polinomial" : selection.selection_method === "interpolated" ? "Interpolado" : "Ponto de curva"}</b></div>
                      </div>
                    </div>
                  ) : null}

                  {showEnvironmentReport && result ? (
                    <div id="coldpro-environment-report" className="space-y-3 rounded-lg border bg-background p-3">
                      <div className="print:hidden">
                        <h3 className="text-base font-semibold">Relatório do ambiente — {selectedEnv.name}</h3>
                        <p className="text-sm text-muted-foreground">Relatório filtrado para o ambiente atual com dados térmicos, equipamento e simulação comercial local.</p>
                      </div>
                      <EnvironmentCommercialSummary commercial={commercialSummary} />
                      <ColdProReport
                        project={data?.project}
                        environments={[selectedEnv]}
                        results={[result]}
                        selections={selection ? [selection] : []}
                        products={products}
                        advancedProcesses={(data?.advancedProcesses ?? []).filter((item: any) => item.environment_id === selectedEnv.id)}
                        lastPdfUrl={lastPdfUrl}
                      />
                    </div>
                  ) : null}

                  {["blast_freezer", "cooling_tunnel"].includes(String(selectedEnv.environment_type)) ? (
                    <div className="rounded-lg border bg-background p-3">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="flex items-center gap-2 text-base font-semibold">
                            <Sparkles className="h-4 w-4 text-primary" /> Especialista IA em túnel
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Análise técnica criteriosa liberada após o cálculo e a pré-seleção do equipamento.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
                          onClick={async () => {
                            const analysis = await handleAnalyzeMemorial(
                              `Reavalie tecnicamente o túnel ${selectedEnv.name} e gere novos insights de engenharia sobre eficiência, tempo de congelamento/resfriamento, temperatura de evaporação, vazão de ar, margem do equipamento selecionado e oportunidades de otimização.`,
                              tunnelExpertAnalysis,
                            );
                            if (analysis) setTunnelExpertAnalysis(analysis);
                          }}
                          disabled={!result || analyzeMemorial.isPending}
                        >
                          {analyzeMemorial.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                          {tunnelExpertAnalysis ? "Atualizar análise" : "Gerar análise"}
                        </button>
                      </div>
                      {!result ? (
                        <div className="rounded-lg border border-dashed p-3 text-[13px] text-muted-foreground">
                          Calcule a carga térmica para liberar a análise técnica do túnel.
                        </div>
                      ) : tunnelExpertAnalysis ? (
                        <div className="max-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-[13px] leading-relaxed">
                          {tunnelExpertAnalysis}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed p-3 text-[13px] text-muted-foreground">
                          Após calcular, a IA avalia se a seleção está adequada e sugere ajustes de temperatura, vazão, margem e porte do equipamento.
                        </div>
                      )}
                    </div>
                  ) : null}

                </div>
              )}

              {/* Navegação inferior */}
              <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 shadow-sm print:hidden">
                <button
                  type="button"
                  onClick={prev}
                  disabled={stepIndex === 0}
                  className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <ArrowLeft className="h-4 w-4" /> Anterior
                </button>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  {COLDPRO_STEPS[stepIndex].description}
                </div>
                <button
                  type="button"
                  onClick={next}
                  disabled={stepIndex === COLDPRO_STEPS.length - 1}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-40"
                >
                  Próxima etapa <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
