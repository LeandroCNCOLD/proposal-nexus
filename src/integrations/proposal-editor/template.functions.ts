// Server functions para templates de proposta
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TemplateAsset, ProposalTemplate, TemplateBundle } from "./template.types";

const TEMPLATE_BUCKET = "proposal-template-assets";

async function buildAssetsWithUrls(
  supabase: { storage: { from: (b: string) => { getPublicUrl: (p: string) => { data: { publicUrl: string } } } } },
  rows: Array<{
    id: string;
    template_id: string;
    asset_kind: string;
    label: string | null;
    storage_path: string;
    position: number | null;
  }>,
): Promise<TemplateAsset[]> {
  return rows.map((r) => ({
    ...r,
    url: supabase.storage.from(TEMPLATE_BUCKET).getPublicUrl(r.storage_path).data.publicUrl,
  }));
}

/** Lista todos os templates com seus assets. */
export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: templates, error } = await supabase
      .from("proposal_templates")
      .select("*")
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (templates ?? []).map((t) => t.id);
    const { data: assets } = ids.length
      ? await supabase
          .from("proposal_template_assets")
          .select("*")
          .in("template_id", ids)
          .order("position", { ascending: true, nullsFirst: false })
      : { data: [] };

    const enrichedAssets = await buildAssetsWithUrls(
      supabase,
      (assets ?? []) as never,
    );

    return {
      templates: (templates ?? []) as unknown as ProposalTemplate[],
      assets: enrichedAssets,
    };
  });

/** Carrega template padrão (ou um template específico) com seus assets. */
const getTemplateSchema = z.object({
  templateId: z.string().uuid().optional(),
});

export const getTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => getTemplateSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<TemplateBundle | null> => {
    const { supabase } = context;

    let query = supabase.from("proposal_templates").select("*");
    if (data.templateId) {
      query = query.eq("id", data.templateId);
    } else {
      query = query.eq("is_default", true).eq("is_active", true);
    }
    const { data: tmpl, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    if (!tmpl) return null;

    const { data: assets } = await supabase
      .from("proposal_template_assets")
      .select("*")
      .eq("template_id", tmpl.id)
      .order("position", { ascending: true, nullsFirst: false });

    return {
      template: tmpl as unknown as ProposalTemplate,
      assets: await buildAssetsWithUrls(supabase, (assets ?? []) as never),
    };
  });

/** Atualiza textos/cores de um template. */
const updateTemplateSchema = z.object({
  templateId: z.string().uuid(),
  patch: z.object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    primary_color: z.string().optional(),
    accent_color: z.string().optional(),
    accent_color_2: z.string().optional(),
    empresa_nome: z.string().optional(),
    empresa_cidade: z.string().optional(),
    empresa_telefone: z.string().optional(),
    empresa_email: z.string().optional(),
    empresa_site: z.string().optional(),
    capa_titulo: z.string().nullable().optional(),
    capa_subtitulo: z.string().nullable().optional(),
    capa_tagline: z.string().nullable().optional(),
    sobre_titulo: z.string().nullable().optional(),
    sobre_paragrafos: z.array(z.string()).optional(),
    sobre_diferenciais: z.array(z.any()).optional(),
    cases_titulo: z.string().nullable().optional(),
    cases_subtitulo: z.string().nullable().optional(),
    cases_itens: z.array(z.any()).optional(),
    clientes_titulo: z.string().nullable().optional(),
    clientes_lista: z.array(z.string()).optional(),
    escopo_apresentacao_itens: z.array(z.string()).optional(),
    garantia_texto: z.string().nullable().optional(),
    garantia_itens: z.array(z.any()).optional(),
    dados_bancarios: z.array(z.any()).optional(),
    prazo_entrega_padrao: z.string().nullable().optional(),
    validade_padrao_dias: z.number().int().nullable().optional(),
    pages_config: z.array(z.any()).optional(),
    is_active: z.boolean().optional(),
  }),
});

export const updateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateTemplateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("proposal_templates")
      .update(data.patch as never)
      .eq("id", data.templateId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Marca um template como padrão (e desmarca os demais). */
export const setDefaultTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ templateId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error: e1 } = await supabase
      .from("proposal_templates")
      .update({ is_default: false } as never)
      .neq("id", data.templateId);
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await supabase
      .from("proposal_templates")
      .update({ is_default: true } as never)
      .eq("id", data.templateId);
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

/** Duplica um template existente. */
export const duplicateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ templateId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: src, error } = await supabase
      .from("proposal_templates")
      .select("*")
      .eq("id", data.templateId)
      .single();
    if (error) throw new Error(error.message);

    const srcRec = src as unknown as Record<string, unknown>;
    const rest: Record<string, unknown> = { ...srcRec };
    delete rest.id;
    delete rest.created_at;
    delete rest.updated_at;

    const { data: created, error: insErr } = await supabase
      .from("proposal_templates")
      .insert({
        ...rest,
        name: `${(src as { name: string }).name} (cópia)`,
        is_default: false,
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);
    return { templateId: (created as { id: string }).id };
  });

/** Remove um asset (registro + objeto no storage). */
export const deleteTemplateAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ assetId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error: selErr } = await supabase
      .from("proposal_template_assets")
      .select("id, storage_path")
      .eq("id", data.assetId)
      .single();
    if (selErr) throw new Error(selErr.message);

    await supabase.storage.from(TEMPLATE_BUCKET).remove([(row as { storage_path: string }).storage_path]);

    const { error: delErr } = await supabase
      .from("proposal_template_assets")
      .delete()
      .eq("id", data.assetId);
    if (delErr) throw new Error(delErr.message);
    return { ok: true };
  });

/** Registra um asset já enviado ao bucket. */
const registerAssetSchema = z.object({
  templateId: z.string().uuid(),
  storagePath: z.string().min(1),
  assetKind: z.string().min(1),
  label: z.string().optional(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().optional(),
});

export const registerTemplateAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => registerAssetSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: created, error } = await supabase
      .from("proposal_template_assets")
      .insert({
        template_id: data.templateId,
        asset_kind: data.assetKind,
        label: data.label ?? null,
        storage_path: data.storagePath,
        mime_type: data.mimeType ?? null,
        size_bytes: data.sizeBytes ?? null,
        uploaded_by: userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { assetId: (created as { id: string }).id };
  });
