import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { renderToBuffer } from "@react-pdf/renderer";
import * as React from "react";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ColdProMemorialPdf } from "./ColdProMemorialPdf";

const inputSchema = z.object({
  projectId: z.string().uuid(),
  attachToProposal: z.boolean().optional().default(true),
});

function firstImagePath(model: any): string | null {
  return model?.plugin_image_path
    ?? model?.split_image_path
    ?? model?.biblock_image_path
    ?? model?.plugin_image_paths?.[0]
    ?? model?.split_image_paths?.[0]
    ?? model?.biblock_image_paths?.[0]
    ?? null;
}

function imageMimeType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

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

    // Render PDF para buffer
    const pdfElement = React.createElement(ColdProMemorialPdf, {
      project,
      environments: environments ?? [],
      results: results ?? [],
      selections: enrichedSelections,
      products: products ?? [],
      generatedAt,
    });

    // @react-pdf/renderer renderToBuffer aceita o elemento Document
    const buffer = await renderToBuffer(pdfElement as any);

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
        size_bytes: buffer.length,
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
      sizeBytes: buffer.length,
      attachedToProposalId: data.attachToProposal ? project.proposal_id ?? null : null,
    };
  });
