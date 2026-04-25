import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Plus, Snowflake, Thermometer, Wind, Warehouse } from "lucide-react";
import { toast } from "sonner";
import {
  useColdProProjectBundle,
  useCreateColdProEnvironment,
  useUpdateColdProEnvironment,
  useUpsertColdProProduct,
  useUpsertColdProTunnel,
  useCalculateColdProEnvironment,
  useAutoSelectColdProEquipment,
  usePushColdProToProposal,
  useGenerateColdProMemorialPdf,
} from "@/features/coldpro/use-coldpro";
import { ColdProEnvironmentForm } from "@/components/coldpro/ColdProEnvironmentForm";
import { ColdProProductForm } from "@/components/coldpro/ColdProProductForm";
import { ColdProTunnelForm } from "@/components/coldpro/ColdProTunnelForm";
import { ColdProResultCard } from "@/components/coldpro/ColdProResultCard";
import { ColdProExtraLoadsForm } from "@/components/coldpro/ColdProExtraLoadsForm";
import { ColdProStepper, COLDPRO_STEPS } from "@/components/coldpro/ColdProStepper";
import { ColdProReport } from "@/components/coldpro/ColdProReport";
import { ColdProRealSelection } from "@/components/coldpro/ColdProRealSelection";
import { ColdProSectionLoadSummary } from "@/components/coldpro/ColdProSectionLoadSummary";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveCatalogEquipmentSelection } from "@/features/coldpro/catalog-selection.functions";

export const Route = createFileRoute("/app/coldpro/$id")({ component: ColdProProjectPage });

function fmt(value: unknown) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(Number(value ?? 0));
}

function ColdProProjectPage() {
  const { id } = Route.useParams();
  const { data, isLoading } = useColdProProjectBundle(id);
  const createEnv = useCreateColdProEnvironment(id);
  const updateEnv = useUpdateColdProEnvironment(id);
  const upsertProduct = useUpsertColdProProduct(id);
  const upsertTunnel = useUpsertColdProTunnel(id);
  const calculate = useCalculateColdProEnvironment(id);
  const autoSelect = useAutoSelectColdProEquipment(id);
  const pushToProposal = usePushColdProToProposal(id);
  const generatePdf = useGenerateColdProMemorialPdf(id);
  const [lastPdfUrl, setLastPdfUrl] = React.useState<string | null>(null);
  const qc = useQueryClient();
  const saveCatalogSel = useMutation({
    mutationFn: (payload: any) => saveCatalogEquipmentSelection({ data: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coldpro-project", id] }),
  });

  const [selectedEnvId, setSelectedEnvId] = React.useState<string | null>(null);
  const [stepIndex, setStepIndex] = React.useState(0);

  const environments = data?.environments ?? [];
  const selectedEnv = environments.find((env: any) => env.id === selectedEnvId) ?? environments[0];
  const allProducts = data?.products ?? [];
  const products = allProducts.filter((p: any) => p.environment_id === selectedEnv?.id);
  const tunnel = (data?.tunnels ?? []).find((t: any) => t.environment_id === selectedEnv?.id);
  const result = (data?.results ?? []).find((r: any) => r.environment_id === selectedEnv?.id);
  const selection = (data?.selections ?? []).find((s: any) => s.environment_id === selectedEnv?.id);
  const environmentLoad = Number(result?.transmission_kcal_h ?? 0);
  const productLoad = Number(result?.product_kcal_h ?? 0) + Number(result?.packaging_kcal_h ?? 0) + Number(result?.calculation_breakdown?.respiration_kcal_h ?? 0) + Number(result?.tunnel_internal_load_kcal_h ?? 0);
  const extraLoad = Number(result?.infiltration_kcal_h ?? 0) + Number(result?.people_kcal_h ?? 0) + Number(result?.lighting_kcal_h ?? 0) + Number(result?.motors_kcal_h ?? 0) + Number(result?.fans_kcal_h ?? 0) + Number(result?.defrost_kcal_h ?? 0) + Number(result?.other_kcal_h ?? 0);

  React.useEffect(() => {
    if (!selectedEnvId && environments[0]?.id) setSelectedEnvId(environments[0].id);
  }, [selectedEnvId, environments]);

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

  async function handleCalculate() {
    if (!selectedEnv) return;
    try {
      await calculate.mutateAsync(selectedEnv.id);
      toast.success("Carga térmica calculada");
      setStepIndex(3);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro no cálculo");
    }
  }

  async function handleAutoSelect() {
    if (!selectedEnv) return;
    try {
      await autoSelect.mutateAsync(selectedEnv.id);
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

  async function handleGeneratePdf() {
    try {
      const res = await generatePdf.mutateAsync(true);
      setLastPdfUrl(res.signedUrl ?? null);
      toast.success(
        res.attachedToProposalId
          ? "Memorial PDF gerado e anexado à proposta."
          : "Memorial PDF gerado.",
      );
      if (res.signedUrl) window.open(res.signedUrl, "_blank");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar PDF");
    }
  }

  function next() {
    setStepIndex((i) => Math.min(i + 1, COLDPRO_STEPS.length - 1));
  }
  function prev() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* HEADER ESTILO SELECT COLD: faixa escura com identidade */}
      <div className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground print:hidden">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link to="/app/coldpro" className="text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground">
              ← Projetos
            </Link>
            <div className="h-6 w-px bg-sidebar-border" />
            <div>
              <div className="text-[11px] uppercase tracking-widest text-sidebar-foreground/60">
                CN ColdPro · Cálculo térmico
              </div>
              <div className="text-sm font-semibold">{data?.project?.name ?? "Novo projeto"}</div>
            </div>
          </div>
          <div className="text-[11px] text-sidebar-foreground/70">
            Etapa {stepIndex + 1} / {COLDPRO_STEPS.length} — {COLDPRO_STEPS[stepIndex].title}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] grid grid-cols-1 gap-6 p-6 md:grid-cols-[260px_1fr]">
        {/* Sidebar de ambientes */}
        <aside className="space-y-4 print:hidden md:sticky md:top-4 md:self-start">
          <div className="rounded-xl border bg-background p-4 shadow-sm">
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

          <div className="rounded-xl border bg-background p-4 shadow-sm">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Ambientes do projeto
            </h2>
            {environments.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                Nenhum ambiente. Crie o primeiro acima.
              </div>
            ) : (
              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {environments.map((env: any) => (
                  <button
                    key={env.id}
                    type="button"
                    className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                      env.id === selectedEnv?.id
                        ? "border-primary/40 bg-primary/10 shadow-sm"
                        : "border-transparent hover:bg-muted"
                    }`}
                    onClick={() => {
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
        <div className="space-y-4">
          {!selectedEnv ? (
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

              {/* STEP 0 - AMBIENTE */}
              {stepIndex === 0 && (
                <div className="space-y-4">
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
                    total={environmentLoad}
                  />
                </div>
              )}

              {/* STEP 1 - PRODUTOS / TÚNEL */}
              {stepIndex === 1 && (
                <div className="space-y-6">
                  {["blast_freezer", "cooling_tunnel"].includes(selectedEnv.environment_type) ? (
                    <ColdProTunnelForm
                      environmentId={selectedEnv.id}
                      tunnel={tunnel}
                      onSave={(payload) =>
                        upsertTunnel.mutate(payload, {
                          onSuccess: () => toast.success("Túnel salvo"),
                          onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
                        })
                      }
                    />
                  ) : (
                    <ColdProProductForm
                      environmentId={selectedEnv.id}
                      productCatalog={data?.productCatalog ?? []}
                      onSave={(payload) =>
                        upsertProduct.mutate(payload, {
                          onSuccess: () => toast.success("Produto adicionado"),
                          onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
                        })
                      }
                    />
                  )}

                  <ColdProSectionLoadSummary
                    title="Prévia da carga de produto"
                    rows={[
                      { label: "Produto", value: result?.product_kcal_h },
                      { label: "Embalagem", value: result?.packaging_kcal_h },
                      { label: "Respiração", value: result?.calculation_breakdown?.respiration_kcal_h },
                      { label: "Túnel / processo", value: result?.tunnel_internal_load_kcal_h },
                    ]}
                    total={productLoad}
                  />

                  <div className="rounded-2xl border bg-background p-4">
                    <h3 className="mb-3 text-base font-semibold">Produtos cadastrados</h3>
                    {products.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Nenhum produto/processo cadastrado.</div>
                    ) : (
                      <div className="space-y-2">
                        {products.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                            <div>
                              <b>{p.product_name}</b> · {fmt(p.mass_kg_day)} kg/dia · entrada {p.inlet_temp_c}°C → final{" "}
                              {p.outlet_temp_c}°C
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
                <div className="space-y-4">
                  <ColdProExtraLoadsForm
                    environment={selectedEnv}
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
                      { label: "Infiltração", value: result?.infiltration_kcal_h },
                      { label: "Pessoas", value: result?.people_kcal_h },
                      { label: "Iluminação", value: result?.lighting_kcal_h },
                      { label: "Motores", value: result?.motors_kcal_h },
                      { label: "Ventiladores", value: result?.fans_kcal_h },
                      { label: "Degelo", value: result?.defrost_kcal_h },
                      { label: "Outras cargas", value: result?.other_kcal_h },
                    ]}
                    total={extraLoad}
                  />
                </div>
              )}

              {/* STEP 3 - RESULTADO */}
              {stepIndex === 3 && (
                <div className="space-y-6">
                  <div className="rounded-2xl border bg-background p-4">
                    <h3 className="mb-2 text-base font-semibold">Calcular carga térmica</h3>
                    <p className="mb-3 text-sm text-muted-foreground">
                      Use as informações cadastradas nas etapas anteriores para gerar o cálculo da carga térmica do ambiente.
                    </p>
                    <button
                      type="button"
                      className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
                      onClick={handleCalculate}
                      disabled={calculate.isPending}
                    >
                      {calculate.isPending ? "Calculando..." : "Calcular carga térmica"}
                    </button>
                  </div>
                  <ColdProResultCard result={result} />

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
                          curveMetadata: { score: cand.score, warnings: cand.warnings },
                          notes: `Curva de rendimento · Tevap ${cand.point_used.evaporation_temp_c}°C / Tcond ${cand.point_used.condensation_temp_c}°C${cand.point_used.polynomial ? " · polinomial" : cand.point_used.interpolated ? " · interpolado" : ""}`,
                        });
                        toast.success(`${cand.model.modelo} selecionado`);
                      } catch (e: any) {
                        toast.error(e?.message ?? "Erro ao salvar seleção");
                      }
                    }}
                  />

                  {/* Auto-select pela curva */}
                  <div className="rounded-2xl border bg-background p-4">
                    <h3 className="mb-2 text-base font-semibold">Seleção automática pela curva</h3>
                    <p className="mb-3 text-sm text-muted-foreground">
                      Seleciona automaticamente o melhor modelo usando a curva de rendimento, COP, potência e sobra técnica.
                    </p>
                    <button
                      type="button"
                      className="rounded-md border bg-background px-4 py-2 text-sm hover:bg-muted"
                      onClick={handleAutoSelect}
                      disabled={autoSelect.isPending}
                    >
                      {autoSelect.isPending ? "Selecionando..." : "Selecionar melhor modelo"}
                    </button>
                  </div>

                  {selection ? (
                    <div className="rounded-2xl border bg-background p-4">
                      <h3 className="mb-3 text-base font-semibold">Equipamento selecionado</h3>
                      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                        <div>Modelo: <b>{selection.model}</b></div>
                        <div>Qtd.: <b>{fmt(selection.quantity)}</b></div>
                        <div>Capacidade total: <b>{fmt(selection.capacity_total_kcal_h)} kcal/h</b></div>
                        <div>Sobra: <b>{fmt(selection.surplus_percent)}%</b></div>
                        <div>Vazão total: <b>{fmt(selection.air_flow_total_m3_h)} m³/h</b></div>
                        <div>Trocas/h: <b>{fmt(selection.air_changes_hour)}</b></div>
                        <div>Potência: <b>{selection.total_power_kw ? `${fmt(selection.total_power_kw)} kW` : "—"}</b></div>
                        <div>COP: <b>{selection.cop ? fmt(selection.cop) : "—"}</b></div>
                        <div>Método: <b>{selection.selection_method === "polynomial" ? "Curva polinomial" : selection.selection_method === "interpolated" ? "Interpolado" : "Ponto de curva"}</b></div>
                      </div>
                    </div>
                  ) : null}

                  <ColdProReport
                    project={data?.project}
                    environments={environments}
                    results={data?.results ?? []}
                    selections={data?.selections ?? []}
                    products={allProducts}
                    onPushToProposal={handlePushToProposal}
                    isPushing={pushToProposal.isPending}
                    onGeneratePdf={handleGeneratePdf}
                    isGeneratingPdf={generatePdf.isPending}
                    lastPdfUrl={lastPdfUrl}
                  />
                </div>
              )}

              {/* Navegação inferior */}
              <div className="flex items-center justify-between rounded-xl border bg-background px-4 py-3 shadow-sm print:hidden">
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
