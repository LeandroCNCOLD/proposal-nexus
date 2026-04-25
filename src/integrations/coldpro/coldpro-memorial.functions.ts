import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildColdProMemorialPdfBuffer } from "./coldproMemorialPdfLib";

const inputSchema = z.object({
  projectId: z.string().uuid(),
  attachToProposal: z.boolean().optional().default(true),
  aiAnalysis: z.string().max(20000).nullable().optional(),
});

const analysisInputSchema = z.object({
  projectId: z.string().uuid(),
  question: z.string().max(2000).optional().default(""),
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

function fmt(value: unknown, digits = 1): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(Number.isFinite(n) ? n : 0);
}

function buildAiPrompt({ project, environments, results, selections, products, question, previousAnalysis }: any) {
  const lines = [
    `Projeto: ${project?.name ?? "Projeto"}. Aplicação: ${project?.application_type ?? "não informada"}.`,
    `Atue como um agente de IA especialista em engenharia frigorífica industrial, psicrometria, formação de gelo, degelo, seleção de evaporadores/condensadores e auditoria de carga térmica.`,
    `Gere um laudo técnico e comercial final, em português do Brasil, para encerrar um memorial de cálculo frigorífico. Seja objetivo, auditável, profissional e crítico quando houver risco técnico.`,
    `Estruture em: Conclusão executiva, Validação das premissas, Análise psicrométrica/infiltração/umidade/gelo, Análise de produto/mudança de estado, Comparação carga requerida x ofertada, Riscos/observações e Recomendação final.`,
    `Não invente dados ausentes; quando faltar dado, indique que deve ser validado.`,
    question ? `Pergunta/solicitação do usuário para esta análise: ${question}` : `Faça uma análise completa e aponte pontos técnicos relevantes para validação antes da emissão do PDF.`,
    previousAnalysis ? `Análise anterior para contexto: ${previousAnalysis}` : "",
  ];
  for (const env of environments ?? []) {
    const r = (results ?? []).find((item: any) => item.environment_id === env.id);
    const s = (selections ?? []).find((item: any) => item.environment_id === env.id);
    const envProducts = (products ?? []).filter((item: any) => item.environment_id === env.id);
    lines.push(`Ambiente ${env.name}: ${fmt(env.length_m)} x ${fmt(env.width_m)} x ${fmt(env.height_m)} m, volume ${fmt(env.volume_m3)} m³, Tint ${fmt(env.internal_temp_c)} °C, Text ${fmt(env.external_temp_c)} °C.`);
    lines.push(`Carga requerida: ${fmt(r?.total_required_kcal_h, 0)} kcal/h (${fmt(r?.total_required_kw)} kW). Parcelas: transmissão ${fmt(r?.transmission_kcal_h, 0)}, produto ${fmt(r?.product_kcal_h, 0)}, infiltração ${fmt(r?.infiltration_kcal_h, 0)}, internas ${fmt(Number(r?.people_kcal_h ?? 0) + Number(r?.lighting_kcal_h ?? 0) + Number(r?.motors_kcal_h ?? 0) + Number(r?.fans_kcal_h ?? 0), 0)} kcal/h.`);
    if (s) lines.push(`Equipamento ofertado: ${s.quantity} x ${s.model}, capacidade total ${fmt(s.capacity_total_kcal_h, 0)} kcal/h, sobra ${fmt(s.surplus_percent)}%, COP ${s.cop ? fmt(s.cop, 2) : "não informado"}.`);
    for (const p of envProducts) lines.push(`Produto ${p.product_name}: massa ${fmt(p.mass_kg_day, 0)} kg/dia, entrada ${fmt(p.inlet_temp_c)} °C, final ${fmt(p.outlet_temp_c)} °C, congelamento ${p.initial_freezing_temp_c ?? "não informado"} °C, Cp acima ${fmt(p.specific_heat_above_kcal_kg_c, 3)}, Cp abaixo ${fmt(p.specific_heat_below_kcal_kg_c, 3)}, latente ${fmt(p.latent_heat_kcal_kg, 2)} kcal/kg, água ${p.water_content_percent ?? "não informado"}%, fração congelada ${p.frozen_water_fraction ?? p.freezable_water_content_percent ?? "não informada"}.`);
  }
  return lines.join("\n").slice(0, 12000);
}

async function loadColdProAnalysisBundle(projectId: string) {
  const supabase = supabaseAdmin;
  const { data: project, error: pErr } = await supabase.from("coldpro_projects").select("*").eq("id", projectId).single();
  if (pErr || !project) throw new Error(pErr?.message ?? "Projeto não encontrado");
  const { data: environments } = await supabase.from("coldpro_environments").select("*").eq("coldpro_project_id", projectId).order("sort_order", { ascending: true });
  const envIds = (environments ?? []).map((e: any) => e.id);
  const [{ data: results }, { data: selections }, { data: products }] = await Promise.all([
    envIds.length ? supabase.from("coldpro_results").select("*").in("environment_id", envIds) : Promise.resolve({ data: [] as any[] }),
    envIds.length ? supabase.from("coldpro_equipment_selections").select("*").in("environment_id", envIds) : Promise.resolve({ data: [] as any[] }),
    envIds.length ? supabase.from("coldpro_environment_products").select("*").in("environment_id", envIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  return { project, environments: environments ?? [], results: results ?? [], selections: selections ?? [], products: products ?? [] };
}

async function generateAiAnalysis(input: any): Promise<string | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-pro-preview",
        messages: [
          { role: "system", content: "Você é um agente técnico sênior de engenharia frigorífica. Responda como consultor especialista, com análise crítica, base técnica, recomendações práticas e sem inventar dados. Quando o usuário fizer uma pergunta, responda diretamente e conecte a resposta ao memorial de cálculo." },
          { role: "user", content: buildAiPrompt(input) },
        ],
      }),
    });
    if (!response.ok) {
      const statusText = response.status === 429 ? "limite de uso da IA atingido" : response.status === 402 ? "créditos de IA insuficientes" : `erro ${response.status}`;
      return `Laudo por IA não gerado automaticamente: ${statusText}. O memorial técnico permanece válido com as premissas e cálculos apresentados; recomenda-se revisão técnica final pelo responsável.`;
    }
    const json = await response.json();
    return String(json?.choices?.[0]?.message?.content ?? "").trim() || null;
  } catch (error) {
    console.error("Erro ao gerar laudo IA do memorial ColdPro", error);
    return "Laudo por IA não gerado automaticamente por indisponibilidade momentânea. O memorial técnico permanece válido com as premissas e cálculos apresentados; recomenda-se revisão técnica final pelo responsável.";
  }
}

export const analyzeColdProMemorial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(analysisInputSchema)
  .handler(async ({ data }) => {
    const bundle = await loadColdProAnalysisBundle(data.projectId);
    const analysis = await generateAiAnalysis({ ...bundle, question: data.question, previousAnalysis: data.previousAnalysis });
    return { analysis: analysis ?? "Não foi possível gerar a análise técnica por IA neste momento." };
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
        ? supabase.from("coldpro_results").select("*").in("environment_id", envIds)
        : Promise.resolve({ data: [] as any[] }),
      envIds.length
        ? supabase.from("coldpro_equipment_selections").select("*").in("environment_id", envIds)
        : Promise.resolve({ data: [] as any[] }),
      envIds.length
        ? supabase.from("coldpro_environment_products").select("*").in("environment_id", envIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const equipmentModelIds = Array.from(new Set((selections ?? []).map((item: any) => item.equipment_model_id).filter(Boolean)));
    const { data: equipmentModels } = equipmentModelIds.length
      ? await supabase
          .from("coldpro_equipment_models")
          .select("id, plugin_image_path, split_image_path, biblock_image_path, plugin_image_paths, split_image_paths, biblock_image_paths")
          .in("id", equipmentModelIds)
      : { data: [] as any[] };

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

    const enrichedSelections = (selections ?? []).map((item: any) => ({
      ...item,
      ...(equipmentImagesByModel.get(item.equipment_model_id) ?? {}),
    }));

    const generatedAt = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const aiAnalysis = data.aiAnalysis?.trim() || await generateAiAnalysis({ project, environments: environments ?? [], results: results ?? [], selections: enrichedSelections, products: products ?? [] });

    // Render PDF para buffer sem WebAssembly, compatível com o ambiente publicado.
    const buffer = await buildColdProMemorialPdfBuffer({
      project,
      environments: environments ?? [],
      results: results ?? [],
      selections: enrichedSelections,
      products: products ?? [],
      generatedAt,
      aiAnalysis,
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
    const storagePath = `coldpro-memorials/${project.id}/${safeName}-rev${project.revision ?? 0}-${ts}.pdf`;

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
        name: `Memorial CN ColdPro — ${project.name} (rev ${project.revision ?? 0}).pdf`,
        category: "coldpro_memorial",
        storage_path: storagePath,
        mime_type: "application/pdf",
        size_bytes: buffer.byteLength,
        proposal_id: data.attachToProposal ? project.proposal_id ?? null : null,
        metadata: {
          source: "coldpro",
          coldpro_project_id: project.id,
          revision: project.revision ?? 0,
          environments_count: (environments ?? []).length,
        },
      })
      .select("id")
      .single();
    if (docErr) throw new Error(`Falha ao registrar documento: ${docErr.message}`);

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
