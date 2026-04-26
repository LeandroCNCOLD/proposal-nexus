import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Loader2, Pencil, Plus, Snowflake, Sparkles, Thermometer, Trash2, Wind, Warehouse } from "lucide-react";
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
  useUpsertColdProAdvancedProcess,
  useCalculateColdProEnvironment,
  useAutoSelectColdProEquipment,
  usePushColdProToProposal,
  useGenerateColdProMemorialPdf,
  useAnalyzeColdProMemorial,
} from "@/features/coldpro/use-coldpro";
import { ColdProEnvironmentForm } from "@/components/coldpro/ColdProEnvironmentForm";
import { ColdProProductForm } from "@/components/coldpro/ColdProProductForm";
import { ColdProTunnelForm } from "@/components/coldpro/ColdProTunnelForm";
import { ColdProAdvancedProcessForm } from "@/components/coldpro/ColdProAdvancedProcessForm";
import { ColdProResultCard } from "@/components/coldpro/ColdProResultCard";
import { ColdProExtraLoadsForm } from "@/components/coldpro/ColdProExtraLoadsForm";
import { ColdProStepper, COLDPRO_STEPS } from "@/components/coldpro/ColdProStepper";
import { ColdProReport } from "@/components/coldpro/ColdProReport";
import { ColdProRealSelection } from "@/components/coldpro/ColdProRealSelection";
import { ColdProSectionLoadSummary } from "@/components/coldpro/ColdProSectionLoadSummary";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveCatalogEquipmentSelection } from "@/features/coldpro/catalog-selection.functions";
import { calculateExtraLoadPreview } from "@/features/coldpro/extra-loads-preview";

export const Route = createFileRoute("/app/coldpro/$id")({ component: ColdProProjectPage });

function fmt(value: unknown) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(Number(value ?? 0));
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
  const upsertAdvancedProcess = useUpsertColdProAdvancedProcess(id);
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

  const environments = data?.environments ?? [];
  const selectedEnv = environments.find((env: any) => env.id === selectedEnvId) ?? environments[0];
  const allProducts = data?.products ?? [];
  const products = allProducts.filter((p: any) => p.environment_id === selectedEnv?.id);
  const tunnel = (data?.tunnels ?? []).find((t: any) => t.environment_id === selectedEnv?.id);
  const advancedProcess = (data?.advancedProcesses ?? []).find((item: any) => item.environment_id === selectedEnv?.id);
  const result = (data?.results ?? []).find((r: any) => r.environment_id === selectedEnv?.id);
  const selection = (data?.selections ?? []).find((s: any) => s.environment_id === selectedEnv?.id);
  const environmentLoad = Number(result?.transmission_kcal_h ?? 0);
  const productLoad = Number(result?.product_kcal_h ?? 0) + Number(result?.packaging_kcal_h ?? 0) + Number(result?.calculation_breakdown?.respiration_kcal_h ?? 0) + Number(result?.tunnel_internal_load_kcal_h ?? 0);
  const extraPreview = calculateExtraLoadPreview(selectedEnv ?? {});
  const extraLoad = result ? Number(result.infiltration_kcal_h ?? 0) + Number(result.people_kcal_h ?? 0) + Number(result.lighting_kcal_h ?? 0) + Number(result.motors_kcal_h ?? 0) + Number(result.fans_kcal_h ?? 0) + Number(result.defrost_kcal_h ?? 0) + Number(result.other_kcal_h ?? 0) : extraPreview.subtotal_kcal_h;
  const catalogFanLoadKcalH = Number(selection?.curve_metadata?.fan_power_kw ?? 0) * Number(selection?.quantity ?? 1) * 859.845;

  React.useEffect(() => {
    if (!selectedEnvId && environments[0]?.id) setSelectedEnvId(environments[0].id);
  }, [selectedEnvId, environments]);

  React.useEffect(() => setProjectNameDraft(data?.project?.name ?? ""), [data?.project?.name]);
  React.useEffect(() => setTunnelExpertAnalysis(null), [selectedEnv?.id]);

  const completed: Record<number, boolean> = {
    0: !!selectedEnv?.length_m,
    1: products.length > 0 || !!tunnel,
    2: !!advancedProcess || !["seed_storage", "climatized_room"].includes(String(selectedEnv?.environment_type ?? "")),
    3: !!selectedEnv?.safety_factor_percent,
    4: !!result,
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
      await calculate.mutateAsync(selectedEnv.id);
      toast.success("Carga térmica calculada");
      setStepIndex(4);
      if (["blast_freezer", "cooling_tunnel"].includes(String(selectedEnv.environment_type))) {
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
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erro no cálculo");
    }
  }

  async function handleAutoSelect() {
    if (!selectedEnv) return;
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
    <div className="min-h-screen min-w-0 bg-muted/30">
      {/* HEADER ESTILO SELECT COLD: faixa escura com identidade */}
      <div className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground print:hidden">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-3 py-3 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3 sm:gap-6">
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
            Etapa {stepIndex + 1} / {COLDPRO_STEPS.length} — {COLDPRO_STEPS[stepIndex].title}
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-4 p-3 sm:p-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-6">
        {/* Sidebar de ambientes */}
        <aside className="space-y-4 print:hidden lg:sticky lg:top-4 lg:self-start">
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
        <div className="min-w-0 space-y-4">
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

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background px-4 py-3 shadow-sm print:hidden">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{selectedEnv.name}</div>
                  <div className="text-xs text-muted-foreground">{selectedEnv.environment_type} · {fmt(selectedEnv.volume_m3)} m³ · {selectedEnv.internal_temp_c}°C</div>
                </div>
                <button type="button" onClick={handleDeleteEnvironment} disabled={deleteEnv.isPending} className="inline-flex items-center gap-2 rounded-md border border-destructive/30 px-3 py-1.5 text-sm text-destructive transition hover:bg-destructive/10 disabled:opacity-50">
                  <Trash2 className="h-4 w-4" /> {deleteEnv.isPending ? "Excluindo..." : "Excluir ambiente"}
                </button>
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
                    totalLabel="Total calculado da aba Ambiente"
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
                      environment={selectedEnv}
                      product={products[0] ?? null}
                      tunnel={tunnel}
                      productCatalog={data?.productCatalog ?? []}
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
                      product={products.find((p: any) => p.id === editingProductId) ?? products[0] ?? null}
                      productCatalog={data?.productCatalog ?? []}
                      saving={upsertProduct.isPending}
                      onSave={(payload) =>
                        upsertProduct.mutate(payload, {
                          onSuccess: (row: any) => { setEditingProductId(row?.id ?? null); toast.success(payload.id ? "Produto atualizado" : "Produto adicionado"); },
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
                    totalLabel="Total calculado da aba Produtos"
                    total={productLoad}
                  />

                  <div className="rounded-2xl border bg-background p-4">
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
                              <button type="button" onClick={() => { if (window.confirm(`Excluir o produto "${p.product_name}"?`)) deleteProduct.mutate(p.id, { onSuccess: () => { if (editingProductId === p.id) setEditingProductId(null); toast.success("Produto excluído"); }, onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir") }); }} className="rounded-md border border-destructive/30 px-2 py-1 text-xs text-destructive hover:bg-destructive/10">Excluir</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2 - PROCESSOS ESPECIAIS */}
              {stepIndex === 2 && (
                <div className="space-y-4">
                  <ColdProAdvancedProcessForm
                    projectId={id}
                    environment={selectedEnv}
                    process={advancedProcess}
                    productCatalog={data?.productCatalog ?? []}
                    onSave={(payload) =>
                      upsertAdvancedProcess.mutate(payload, {
                        onSuccess: () => toast.success("Processo especial salvo"),
                        onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar processo especial"),
                      })
                    }
                  />
                  <ColdProSectionLoadSummary
                    title="Prévia dos processos especiais"
                    rows={[
                      { label: "Umidade, respiração e purga", value: result?.calculation_breakdown?.advanced_processes_kcal_h },
                    ]}
                    totalLabel="Total calculado da aba Processos Especiais"
                    total={Number(result?.calculation_breakdown?.advanced_processes_kcal_h ?? 0)}
                  />
                </div>
              )}

              {/* STEP 3 - CARGAS EXTRAS */}
              {stepIndex === 3 && (
                <div className="space-y-4">
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

              {/* STEP 4 - RESULTADO */}
              {stepIndex === 4 && (
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
                  <ColdProResultCard result={result} selection={selection} environment={selectedEnv} products={products} onAnalyze={handleAnalyzeMemorial} isAnalyzing={analyzeMemorial.isPending} />

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
                  <div className="rounded-2xl border bg-background p-4">
                    <h3 className="mb-2 text-base font-semibold">Seleção automática pela curva</h3>
                    <p className="mb-3 text-sm text-muted-foreground">
                      Seleciona automaticamente o melhor modelo usando a curva de rendimento, COP, potência e sobra técnica.
                    </p>
                    <div className="mb-4 grid gap-3 sm:grid-cols-2">
                      <label className="text-sm font-medium">
                        Qtd. mínima de equipamentos
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={autoMinQuantity}
                          onChange={(event) => setAutoMinQuantity(event.target.value)}
                          className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-right text-sm"
                        />
                      </label>
                      <label className="text-sm font-medium">
                        Tipo de equipamento
                        <select
                          value={autoEquipmentKind}
                          onChange={(event) => setAutoEquipmentKind(event.target.value as any)}
                          className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
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

                  {["blast_freezer", "cooling_tunnel"].includes(String(selectedEnv.environment_type)) ? (
                    <div className="rounded-2xl border bg-background p-4">
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
                        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                          Calcule a carga térmica para liberar a análise técnica do túnel.
                        </div>
                      ) : tunnelExpertAnalysis ? (
                        <div className="max-h-[520px] overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-4 text-sm leading-relaxed">
                          {tunnelExpertAnalysis}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                          Após calcular, a IA avalia se a seleção está adequada e sugere ajustes de temperatura, vazão, margem e porte do equipamento.
                        </div>
                      )}
                    </div>
                  ) : null}

                  <ColdProReport
                    project={data?.project}
                    environments={environments}
                    results={data?.results ?? []}
                    selections={data?.selections ?? []}
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
