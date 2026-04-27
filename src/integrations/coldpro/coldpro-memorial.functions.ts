import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildColdProMemorialPdfBuffer } from "./coldproMemorialPdfLib";
import { normalizeColdProEnvironmentResult } from "@/modules/coldpro/core/environmentResultNormalizer";
import { consolidateColdProProjectResult } from "@/modules/coldpro/core/projectResultConsolidator";
import { buildColdProEnvironmentAIContext, buildColdProProjectAIContext, buildColdProAISystemPrompt } from "@/modules/coldpro/core/aiTechnicalContextBuilder";

const inputSchema = z.object({
  projectId: z.string().uuid(),
  attachToProposal: z.boolean().optional().default(true),
  aiAnalysis: z.string().max(20000).nullable().optional(),
  reportType: z.enum(["full", "proposal_summary"]).optional().default("full"),
});

const analysisInputSchema = z.object({
  projectId: z.string().uuid(),
  question: z.string().max(12000).optional().default(""),
  previousAnalysis: z.string().max(20000).nullable().optional(),
});

function firstImagePath(model: any): string | null {
  const candidates = [
    model?.plugin_image_path,
    model?.split_image_path,
    model?.biblock_image_path,
    ...(model?.plugin_image_paths ?? []),
    ...(model?.split_image_paths ?? []),
    ...(model?.biblock_image_paths ?? []),
  ].filter(Boolean) as string[];
  return candidates.find((path) => /\.(png|jpe?g)$/i.test(path)) ?? candidates[0] ?? null;
}

function imageMimeType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

function closestPerformancePoint(selection: any, points: any[] = []) {
  const candidates = points.filter((point) => point.equipment_model_id === selection?.equipment_model_id);
  if (!candidates.length) return null;
  const targetRoom = Number(selection?.curve_temperature_room_c ?? NaN);
  const targetEvap = Number(selection?.curve_evaporation_temp_c ?? NaN);
  const targetCond = Number(selection?.curve_condensation_temp_c ?? NaN);
  return candidates
    .map((point) => {
      const score =
        (Number.isFinite(targetRoom) ? Math.abs(Number(point.temperature_room_c ?? 0) - targetRoom) : 0) +
        (Number.isFinite(targetEvap) ? Math.abs(Number(point.evaporation_temp_c ?? 0) - targetEvap) : 0) +
        (Number.isFinite(targetCond) ? Math.abs(Number(point.condensation_temp_c ?? 0) - targetCond) : 0);
      return { point, score };
    })
    .sort((a, b) => a.score - b.score)[0]?.point ?? candidates[0];
}

function fmt(value: unknown, digits = 1): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(Number.isFinite(n) ? n : 0);
}

function latestRowsByEnvironment<T extends { environment_id?: string | null }>(rows: T[] = []) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const environmentId = row.environment_id;
    if (!environmentId || seen.has(environmentId)) return false;
    seen.add(environmentId);
    return true;
  });
}

function buildAiPrompt({ project, environments, results, selections, products, question, previousAnalysis }: any) {
  const consolidated = consolidateColdProProjectResult({ project, environments, results, selections, products, advancedProcesses: [] });
  const normalizedEnvironments = (environments ?? []).map((env: any) => {
    const result = (results ?? []).find((item: any) => item.environment_id === env.id);
    const selection = (selections ?? []).find((item: any) => item.environment_id === env.id);
    const envProducts = (products ?? []).filter((item: any) => item.environment_id === env.id);
    const normalizedResult = normalizeColdProEnvironmentResult({ environment: env, result, selection, products: envProducts });
    return { environment: normalizedResult.environment, aiContext: buildColdProEnvironmentAIContext(normalizedResult) };
  });
  const payload = {
    project: { name: project?.name ?? "Projeto", applicationType: project?.application_type ?? "não informada" },
    request: question || "Faça uma análise completa e aponte pontos técnicos relevantes para validação antes da emissão do PDF.",
    previousAnalysis: previousAnalysis || undefined,
    projectContext: buildColdProProjectAIContext(consolidated),
    environments: normalizedEnvironments,
  };
  return JSON.stringify(payload, null, 2).slice(0, 12000);
}

function buildTechnicalFallbackAnalysis({ project, environments, results, selections, products, question }: any): string {
  const totalKcal = (results ?? []).reduce((sum: number, item: any) => sum + Number(item?.total_required_kcal_h ?? 0), 0);
  const totalKw = (results ?? []).reduce((sum: number, item: any) => sum + Number(item?.total_required_kw ?? 0), 0);
  const lines = [
    `## Conclusão executiva`,
    `O memorial do projeto ${project?.name ?? "ColdPro"} apresenta carga térmica consolidada de ${fmt(totalKcal, 0)} kcal/h (${fmt(totalKw, 1)} kW), considerando transmissão, produto, infiltração, cargas internas, degelo e fator de segurança configurado.`,
    question ? `Solicitação analisada: ${question}` : `Análise gerada automaticamente com base nas premissas e resultados calculados no memorial.`,
    `## Validação das premissas`,
  ];
  for (const env of environments ?? []) {
    const r = (results ?? []).find((item: any) => item.environment_id === env.id);
    const s = (selections ?? []).find((item: any) => item.environment_id === env.id);
    const envProducts = (products ?? []).filter((item: any) => item.environment_id === env.id);
    const audit = r?.calculation_breakdown?.thermalCalculationResult ?? r?.calculation_breakdown?.mathematical_audit;
    const required = Number(audit?.carga_requerida_validada ?? r?.total_required_kcal_h ?? 0);
    const offered = Number(audit?.capacidade_total_corrigida ?? s?.capacity_total_kcal_h ?? 0);
    const margin = audit?.sobra_percentual ?? (required > 0 && offered > 0 ? ((offered - required) / required) * 100 : null);
    lines.push(
      `### ${env.name}`,
      `Dimensões: ${fmt(env.length_m)} x ${fmt(env.width_m)} x ${fmt(env.height_m)} m; volume ${fmt(env.volume_m3)} m³; regime ${fmt(env.internal_temp_c)} °C interno e ${fmt(env.external_temp_c)} °C externo.`,
      `thermalCalculationResult validado: carga requerida ${fmt(required, 0)} kcal/h, capacidade total corrigida ${fmt(offered, 0)} kcal/h, sobra ${margin === null ? "—" : fmt(margin, 1)}% e status ${audit?.status_dimensionamento ?? "pendente"}.`,
    );
    if (envProducts.length) lines.push(`Produtos/processo informados: ${envProducts.map((p: any) => `${p.product_name} (${fmt(p.mass_kg_day, 0)} kg/dia)`).join(", ")}. Validar temperaturas de entrada, tempo de processo e dados de mudança de estado antes da emissão final.`);
    if (r?.calculation_breakdown?.infiltration_technical) {
      const inf = r.calculation_breakdown.infiltration_technical;
      lines.push(`Infiltração/umidade: ar por porta ${fmt(inf.doorInfiltrationM3Day, 0)} m³/dia, carga sensível ${fmt(inf.sensibleKcalH, 0)} kcal/h, carga latente ${fmt(inf.latentKcalH, 0)} kcal/h e formação estimada de gelo ${fmt(inf.iceKgDay)} kg/dia.`);
    }
    if (s) lines.push(`Seleção ofertada: ${s.quantity} x ${s.model}, capacidade total ${fmt(offered, 0)} kcal/h${margin === null ? "" : `, margem ${fmt(margin, 1)}%`}. ${margin !== null && margin < 5 ? "A margem está apertada e recomenda revisão técnica." : "A margem deve ser validada frente ao regime real de operação."}`);
  }
  lines.push(`## Recomendação final`, `Revisar dados críticos de porta, umidade externa, produto, degelo e horas de operação. O PDF pode ser emitido com este laudo técnico automático; se necessário, uma análise por IA mais extensa deve ser rodada em uma etapa assíncrona para não travar a tela.`);
  return lines.join("\n\n");
}

async function loadColdProAnalysisBundle(projectId: string) {
  const supabase = supabaseAdmin;
  const { data: project, error: pErr } = await supabase.from("coldpro_projects").select("*").eq("id", projectId).single();
  if (pErr || !project) throw new Error(pErr?.message ?? "Projeto não encontrado");
  const { data: environments } = await supabase.from("coldpro_environments").select("*").eq("coldpro_project_id", projectId).order("sort_order", { ascending: true });
  const envIds = (environments ?? []).map((e: any) => e.id);
  const [{ data: results }, { data: selections }, { data: products }] = await Promise.all([
    envIds.length ? supabase.from("coldpro_results").select("*").in("environment_id", envIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [] as any[] }),
    envIds.length ? supabase.from("coldpro_equipment_selections").select("*").in("environment_id", envIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [] as any[] }),
    envIds.length ? supabase.from("coldpro_environment_products").select("*").in("environment_id", envIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  return { project, environments: environments ?? [], results: latestRowsByEnvironment(results ?? []), selections: latestRowsByEnvironment(selections ?? []), products: products ?? [] };
}

async function generateAiAnalysis(input: any): Promise<string | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        max_tokens: 900,
        temperature: 0.2,
        messages: [
          { role: "system", content: buildColdProAISystemPrompt() },
          { role: "user", content: buildAiPrompt(input) },
        ],
      }),
    });
    clearTimeout(timeout);
    if (!response.ok) {
      const statusText = response.status === 429 ? "limite de uso da IA atingido" : response.status === 402 ? "créditos de IA insuficientes" : `erro ${response.status}`;
      return `Laudo por IA não gerado automaticamente: ${statusText}. O memorial técnico permanece válido com as premissas e cálculos apresentados; recomenda-se revisão técnica final pelo responsável.`;
    }
    const json = await response.json();
    return String(json?.choices?.[0]?.message?.content ?? "").trim() || null;
  } catch (error) {
    clearTimeout(timeout);
    console.error("Erro ao gerar laudo IA do memorial ColdPro", error);
    return "Laudo por IA não gerado automaticamente dentro do tempo seguro da aplicação. O memorial técnico permanece válido com as premissas e cálculos apresentados; recomenda-se revisão técnica final pelo responsável ou tentar novamente com uma pergunta mais objetiva.";
  }
}

export const analyzeColdProMemorial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(analysisInputSchema)
  .handler(async ({ data }) => {
    const bundle = await loadColdProAnalysisBundle(data.projectId);
    const fallback = buildTechnicalFallbackAnalysis({ ...bundle, question: data.question });
    const analysis = await Promise.race([
      generateAiAnalysis({ ...bundle, question: data.question, previousAnalysis: data.previousAnalysis }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 9500)),
    ]);
    return { analysis: analysis ?? fallback };
  });

/**
 * Gera PDF do memorial técnico do ColdPro, salva no bucket `proposal-files`
 * e cria registro em `documents` (vinculado à proposta se houver).
 * Retorna URL assinada para download.
 */
export const generateColdProMemorialPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(inputSchema)
  .handler(async ({ data }) => {
    const supabase = supabaseAdmin;

    // Carrega bundle do projeto
    const { data: project, error: pErr } = await supabase
      .from("coldpro_projects")
      .select("*")
      .eq("id", data.projectId)
      .single();
    if (pErr || !project) throw new Error(pErr?.message ?? "Projeto não encontrado");

    const { data: environments } = await supabase
      .from("coldpro_environments")
      .select("*")
      .eq("coldpro_project_id", data.projectId)
      .order("sort_order", { ascending: true });

    const envIds = (environments ?? []).map((e: any) => e.id);

    const [{ data: results }, { data: selections }, { data: products }] = await Promise.all([
      envIds.length
        ? supabase.from("coldpro_results").select("*").in("environment_id", envIds).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      envIds.length
        ? supabase.from("coldpro_equipment_selections").select("*").in("environment_id", envIds).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      envIds.length
        ? supabase.from("coldpro_environment_products").select("*").in("environment_id", envIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const latestResults = latestRowsByEnvironment(results ?? []);
    const latestSelections = latestRowsByEnvironment(selections ?? []);

    const equipmentModelIds = Array.from(new Set(latestSelections.map((item: any) => item.equipment_model_id).filter(Boolean)));
    const [{ data: equipmentModels }, { data: compressors }, { data: condensers }, { data: evaporators }, { data: performancePoints }] = equipmentModelIds.length
      ? await supabase
          .from("coldpro_equipment_models")
          .select("*")
          .in("id", equipmentModelIds)
          .then(async (modelsRes) => Promise.all([
            Promise.resolve(modelsRes),
            supabase.from("coldpro_equipment_compressors").select("*").in("equipment_model_id", equipmentModelIds),
            supabase.from("coldpro_equipment_condensers").select("*").in("equipment_model_id", equipmentModelIds),
            supabase.from("coldpro_equipment_evaporators").select("*").in("equipment_model_id", equipmentModelIds),
            supabase.from("coldpro_equipment_performance_points").select("*").in("equipment_model_id", equipmentModelIds),
          ]))
      : [{ data: [] as any[] }, { data: [] as any[] }, { data: [] as any[] }, { data: [] as any[] }, { data: [] as any[] }];

    const equipmentImagesByModel = new Map<string, { equipment_image_path: string | null; equipment_image_url: string | null; equipment_image_data_url: string | null }>();
    await Promise.all((equipmentModels ?? []).map(async (model: any) => {
      const path = firstImagePath(model);
      const publicUrl = path ? supabase.storage.from("coldpro-equipment-images").getPublicUrl(path).data.publicUrl : null;
      let dataUrl: string | null = null;
      if (path) {
        const { data: blob } = await supabase.storage.from("coldpro-equipment-images").download(path);
        if (blob) {
          const buffer = Buffer.from(await blob.arrayBuffer());
          dataUrl = `data:${imageMimeType(path)};base64,${buffer.toString("base64")}`;
        }
      }
      equipmentImagesByModel.set(model.id, { equipment_image_path: path, equipment_image_url: publicUrl, equipment_image_data_url: dataUrl });
    }));

    const enrichedSelections = latestSelections.map((item: any) => ({
      ...item,
      ...(equipmentImagesByModel.get(item.equipment_model_id) ?? {}),
      catalog_model: (equipmentModels ?? []).find((model: any) => model.id === item.equipment_model_id) ?? null,
      catalog_compressor: (compressors ?? []).find((row: any) => row.equipment_model_id === item.equipment_model_id) ?? null,
      catalog_condenser: (condensers ?? []).find((row: any) => row.equipment_model_id === item.equipment_model_id) ?? null,
      catalog_evaporator: (evaporators ?? []).find((row: any) => row.equipment_model_id === item.equipment_model_id) ?? null,
      catalog_performance: closestPerformancePoint(item, performancePoints ?? []),
    }));

    const generatedAt = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const aiAnalysis = data.aiAnalysis?.trim() || buildTechnicalFallbackAnalysis({ project, environments: environments ?? [], results: latestResults, selections: enrichedSelections, products: products ?? [] });

    // Render PDF para buffer sem WebAssembly, compatível com o ambiente publicado.
    const buffer = await buildColdProMemorialPdfBuffer({
      project,
      environments: environments ?? [],
      results: latestResults,
      selections: enrichedSelections,
      products: products ?? [],
      generatedAt,
      aiAnalysis,
      reportType: data.reportType,
    });

    // Upload no storage
    const safeName = (project.name ?? "projeto")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .toLowerCase()
      .slice(0, 60);
    const ts = Date.now();
    const storagePath = `coldpro-memorials/${project.id}/${safeName}-${data.reportType === "proposal_summary" ? "resumo-proposta" : "memorial"}-rev${project.revision ?? 0}-${ts}.pdf`;

    const { error: upErr } = await supabase.storage
      .from("proposal-files")
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (upErr) throw new Error(`Falha ao salvar PDF: ${upErr.message}`);

    // Registra em documents
    const { data: docRow, error: docErr } = await supabase
      .from("documents")
      .insert({
        name: `${data.reportType === "proposal_summary" ? "Resumo para proposta" : "Memorial"} CN ColdPro — ${project.name} (rev ${project.revision ?? 0}).pdf`,
        category: data.reportType === "proposal_summary" ? "coldpro_proposal_summary" : "coldpro_memorial",
        storage_path: storagePath,
        mime_type: "application/pdf",
        size_bytes: buffer.byteLength,
        proposal_id: data.attachToProposal ? project.proposal_id ?? null : null,
        metadata: {
          source: "coldpro",
          coldpro_project_id: project.id,
          revision: project.revision ?? 0,
          environments_count: (environments ?? []).length,
          report_type: data.reportType,
        },
      })
      .select("id")
      .single();
    if (docErr) throw new Error(`Falha ao registrar documento: ${docErr.message}`);

    if (data.attachToProposal && project.proposal_id && data.reportType === "proposal_summary") {
      const { data: proposalDoc } = await supabase
        .from("proposal_documents")
        .select("attached_pdf_paths")
        .eq("proposal_id", project.proposal_id)
        .maybeSingle();
      const currentPaths = Array.isArray(proposalDoc?.attached_pdf_paths) ? proposalDoc.attached_pdf_paths : [];
      await supabase
        .from("proposal_documents")
        .update({ attached_pdf_paths: Array.from(new Set([...currentPaths, storagePath])) })
        .eq("proposal_id", project.proposal_id);
    }

    // URL assinada para download imediato (1h)
    const { data: signed } = await supabase.storage
      .from("proposal-files")
      .createSignedUrl(storagePath, 3600);

    return {
      success: true,
      documentId: docRow.id,
      storagePath,
      signedUrl: signed?.signedUrl ?? null,
      sizeBytes: buffer.byteLength,
      attachedToProposalId: data.attachToProposal ? project.proposal_id ?? null : null,
    };
  });
