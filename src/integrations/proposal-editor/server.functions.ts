// Server functions do editor de propostas (CN Cold)
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_PAGES,
  type ContextData,
  type CoverData,
  type DocumentPage,
  type ProposalTable,
  type ScopeItem,
  type SolutionData,
} from "./types";
import {
  getDefaultTableSettings,
  getDefaultTableRows,
} from "@/features/proposal-editor/proposal-tables.defaults";
import type {
  ProposalTableRow,
  ProposalTableType,
} from "@/features/proposal-editor/proposal-tables.types";
import type { ProposalTemplate, TemplateAsset, TemplatePageConfig } from "./template.types";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { PDFDocument } from "pdf-lib";
import { ProposalDocumentPdf } from "./pdf/ProposalDocument";

const proposalIdSchema = z.object({ proposalId: z.string().uuid() });

const TEMPLATE_BUCKET = "proposal-template-assets";
const ATTACHMENT_BUCKET = "proposal-files";

/**
 * Faz merge do PDF principal com os anexos (na ordem de attached_pdf_paths).
 * Anexos com falha de download são silenciosamente ignorados.
 */
async function mergeWithAttachments(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  mainPdf: Uint8Array,
  paths: string[],
): Promise<Uint8Array> {
  if (!paths || paths.length === 0) return mainPdf;
  const merged = await PDFDocument.load(mainPdf);
  for (const path of paths) {
    try {
      const { data: blob, error } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .download(path);
      if (error || !blob) continue;
      const buf = new Uint8Array(await blob.arrayBuffer());
      const attached = await PDFDocument.load(buf);
      const copied = await merged.copyPages(attached, attached.getPageIndices());
      copied.forEach((p) => merged.addPage(p));
    } catch (err) {
      console.warn(`[mergeWithAttachments] falhou em ${path}:`, err);
    }
  }
  return await merged.save();
}

async function loadDefaultTemplateBundle(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<{ template: ProposalTemplate; assets: TemplateAsset[] } | null> {
  const { data: tmpl } = await supabase
    .from("proposal_templates")
    .select("*")
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle();
  if (!tmpl) return null;

  const { data: assets } = await supabase
    .from("proposal_template_assets")
    .select("*")
    .eq("template_id", tmpl.id);

  const enriched: TemplateAsset[] = (assets ?? []).map(
    (a: { storage_path: string } & Record<string, unknown>) => ({
      ...(a as unknown as TemplateAsset),
      url: supabase.storage.from(TEMPLATE_BUCKET).getPublicUrl(a.storage_path).data.publicUrl,
    }),
  );

  return { template: tmpl as ProposalTemplate, assets: enriched };
}

/**
 * Carrega o documento da proposta. Se não existir, cria um aplicando o
 * template padrão (cores, pages_config, textos fixos) e retorna.
 */
export const getProposalDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => proposalIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { proposalId } = data;

    // Tenta carregar
    const { data: existing, error: selErr } = await supabase
      .from("proposal_documents")
      .select("*")
      .eq("proposal_id", proposalId)
      .maybeSingle();

    if (selErr) throw new Error(selErr.message);
    if (existing) return { document: existing };

    // Aplica template padrão
    const bundle = await loadDefaultTemplateBundle(supabase);
    const pages: DocumentPage[] = (bundle?.template.pages_config as unknown as DocumentPage[] | undefined)
      ?? DEFAULT_PAGES;

    // Cria com defaults + template padrão
    const { data: created, error: insErr } = await supabase
      .from("proposal_documents")
      .insert({
        proposal_id: proposalId,
        template_id: bundle?.template.id ?? null,
        pages: pages as unknown as never,
        last_edited_by: userId,
      })
      .select("*")
      .single();

    if (insErr) throw new Error(insErr.message);
    return { document: created };
  });

/** Troca o template aplicado ao documento da proposta. */
export const setProposalDocumentTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        proposalId: z.string().uuid(),
        templateId: z.string().uuid().nullable(),
        applyPagesConfig: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { proposalId, templateId, applyPagesConfig } = data;

    const patch: Record<string, unknown> = {
      template_id: templateId,
      last_edited_by: userId,
      last_edited_at: new Date().toISOString(),
    };

    if (applyPagesConfig && templateId) {
      const { data: tmpl } = await supabase
        .from("proposal_templates")
        .select("pages_config")
        .eq("id", templateId)
        .maybeSingle();
      const pgs = (tmpl as { pages_config?: unknown } | null)?.pages_config;
      if (Array.isArray(pgs) && pgs.length > 0) {
        patch.pages = pgs;
      }
    }

    const { data: updated, error } = await supabase
      .from("proposal_documents")
      .update(patch as never)
      .eq("proposal_id", proposalId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { document: updated };
  });

const upsertSchema = z.object({
  proposalId: z.string().uuid(),
  patch: z.object({
    pages: z.array(z.any()).optional(),
    cover_data: z.record(z.any()).optional(),
    solution_data: z.record(z.any()).optional(),
    context_data: z.record(z.any()).optional(),
    scope_items: z.array(z.any()).optional(),
    warranty_text: z.record(z.any()).optional(),
    custom_blocks: z.array(z.any()).optional(),
    attached_pdf_paths: z.array(z.string()).optional(),
    manually_edited_fields: z.array(z.string()).optional(),
  }),
});

/**
 * Salva (parcial) o documento. Atualiza last_edited_by/at automaticamente.
 */
export const upsertProposalDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { proposalId, patch } = data;

    const { data: updated, error } = await supabase
      .from("proposal_documents")
      .update({
        ...patch,
        last_edited_by: userId,
        last_edited_at: new Date().toISOString(),
      } as never)
      .eq("proposal_id", proposalId)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return { document: updated };
  });

/**
 * Auto-preenche o documento com dados do Nomus + clientes + contatos + escopo.
 * Não sobrescreve campos listados em `manually_edited_fields`.
 */
export const autoFillFromNomus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => proposalIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { proposalId } = data;

    // Carrega documento + proposta + cliente + contato + nomus_proposal
    const { data: proposal, error: pErr } = await supabase
      .from("proposals")
      .select(
        "id, number, title, valid_until, nomus_proposal_id, nomus_id, client_id, contact_id, clients:client_id(name, trade_name, document, city, state), client_contacts:contact_id(name, email, phone, role)",
      )
      .eq("id", proposalId)
      .single();
    if (pErr) throw new Error(pErr.message);

    const { data: doc, error: dErr } = await supabase
      .from("proposal_documents")
      .select("*")
      .eq("proposal_id", proposalId)
      .maybeSingle();
    if (dErr) throw new Error(dErr.message);

    const manuallyEdited = new Set<string>(doc?.manually_edited_fields ?? []);

    // Nomus proposal (busca por nomus_proposal_id ou nomus_id)
    let nomusProp: Record<string, unknown> | null = null;
    let nomusItems: Array<Record<string, unknown>> = [];
    const nomusKey = proposal.nomus_proposal_id ?? proposal.nomus_id;
    if (nomusKey) {
      const { data: np } = await supabase
        .from("nomus_proposals")
        .select("*")
        .eq("nomus_id", nomusKey)
        .maybeSingle();
      if (np) {
        nomusProp = np as Record<string, unknown>;
        const { data: items } = await supabase
          .from("nomus_proposal_items")
          .select("*")
          .eq("nomus_proposal_id", (np as { id: string }).id)
          .order("position", { ascending: true });
        nomusItems = (items ?? []) as Array<Record<string, unknown>>;
      }
    }

    const cliente = proposal.clients as
      | { name?: string; trade_name?: string; document?: string; city?: string; state?: string }
      | null;
    const contato = proposal.client_contacts as
      | { name?: string; email?: string; phone?: string; role?: string }
      | null;

    const setIf = <T extends Record<string, unknown>>(target: T, prefix: string, key: string, value: unknown): T => {
      const fieldKey = `${prefix}.${key}`;
      if (manuallyEdited.has(fieldKey)) return target;
      if (value === undefined || value === null || value === "") return target;
      return { ...target, [key]: value };
    };

    let cover_data = (doc?.cover_data ?? {}) as Record<string, unknown>;
    cover_data = setIf(cover_data, "cover_data", "cliente", cliente?.trade_name || cliente?.name);
    cover_data = setIf(cover_data, "cover_data", "projeto", proposal.title);
    cover_data = setIf(cover_data, "cover_data", "numero", proposal.number);
    cover_data = setIf(cover_data, "cover_data", "data", new Date().toISOString().slice(0, 10));
    cover_data = setIf(cover_data, "cover_data", "responsavel", (nomusProp?.vendedor_nome as string) ?? null);

    let context_data = (doc?.context_data ?? {}) as Record<string, unknown>;
    context_data = setIf(context_data, "context_data", "cliente_razao", cliente?.name);
    context_data = setIf(context_data, "context_data", "fantasia", cliente?.trade_name);
    context_data = setIf(context_data, "context_data", "cnpj", cliente?.document);
    context_data = setIf(
      context_data,
      "context_data",
      "endereco",
      [cliente?.city, cliente?.state].filter(Boolean).join(" / ") || null,
    );
    if (!manuallyEdited.has("context_data.contatos") && contato?.name) {
      context_data = {
        ...context_data,
        contatos: [
          {
            nome: contato.name,
            cargo: contato.role ?? "",
            email: contato.email ?? "",
            telefone: contato.phone ?? "",
          },
        ],
      };
    }
    context_data = setIf(
      context_data,
      "context_data",
      "prazo_validade",
      proposal.valid_until ? `Validade: ${proposal.valid_until}` : null,
    );

    // Escopo a partir dos itens da proposta Nomus
    let scope_items = (doc?.scope_items ?? []) as Array<Record<string, unknown>>;
    if (!manuallyEdited.has("scope_items") && nomusItems.length > 0) {
      scope_items = nomusItems.map((it, idx) => ({
        id: (it.id as string) ?? `scope-${idx}`,
        titulo: (it.description as string) ?? `Item ${idx + 1}`,
        descricao: (it.additional_info as string) ?? "",
        quantidade: Number(it.quantity ?? 0),
        unidade: (it.unit_value_with_unit as string) ?? "un",
        valor_unitario: Number(it.unit_price ?? 0),
        valor_total: Number(it.total_with_discount ?? it.total ?? 0),
      }));
    }

    const { data: updated, error: uErr } = await supabase
      .from("proposal_documents")
      .upsert(
        {
          proposal_id: proposalId,
          pages: (doc?.pages as never) ?? (DEFAULT_PAGES as unknown as never),
          cover_data: cover_data as never,
          context_data: context_data as never,
          scope_items: scope_items as never,
          auto_filled_at: new Date().toISOString(),
          last_edited_by: userId,
          last_edited_at: new Date().toISOString(),
        },
        { onConflict: "proposal_id" },
      )
      .select("*")
      .single();
    if (uErr) throw new Error(uErr.message);

    return { document: updated, filledFromNomus: nomusItems.length };
  });

/**
 * Gera o PDF da proposta. Modo `preview` retorna URL temporária assinada
 * sem persistir versão. Modo `final` será implementado na Etapa 4.
 */
const generateSchema = z.object({
  proposalId: z.string().uuid(),
  mode: z.enum(["preview", "final", "preview-inline"]).default("preview"),
});

export const generateProposalPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => generateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { proposalId, mode } = data;

    const { data: doc, error } = await supabase
      .from("proposal_documents")
      .select("*")
      .eq("proposal_id", proposalId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) throw new Error("Documento não encontrado. Abra o editor primeiro.");

    const pages = (doc.pages as unknown as DocumentPage[]) ?? DEFAULT_PAGES;
    const cover = (doc.cover_data ?? {}) as CoverData;
    const solution = (doc.solution_data ?? {}) as SolutionData;
    const ctx = (doc.context_data ?? {}) as ContextData;
    const scope = (doc.scope_items ?? []) as unknown as ScopeItem[];
    const warranty = (doc.warranty_text ?? {}) as { html?: string; text?: string };

    // Carrega tabelas estruturadas
    const { data: tablesRows } = await supabase
      .from("proposal_tables")
      .select("*")
      .eq("proposal_id", proposalId);
    const tables = (tablesRows ?? []) as unknown as ProposalTable[];

    // Carrega template (do documento ou padrão)
    let bundle: { template: ProposalTemplate; assets: TemplateAsset[] } | null = null;
    if (doc.template_id) {
      const { data: tmpl } = await supabase
        .from("proposal_templates")
        .select("*")
        .eq("id", doc.template_id)
        .maybeSingle();
      if (tmpl) {
        const { data: assets } = await supabase
          .from("proposal_template_assets")
          .select("*")
          .eq("template_id", tmpl.id);
        const enriched: TemplateAsset[] = (assets ?? []).map((a) => ({
          ...(a as unknown as TemplateAsset),
          url: supabase.storage.from(TEMPLATE_BUCKET).getPublicUrl(a.storage_path).data.publicUrl,
        }));
        bundle = { template: tmpl as unknown as ProposalTemplate, assets: enriched };
      }
    }
    if (!bundle) bundle = await loadDefaultTemplateBundle(supabase);

    const storageBaseUrl = `${process.env.VITE_SUPABASE_URL ?? ""}/storage/v1/object/public/proposal-attachments`;
    const element = createElement(ProposalDocumentPdf, {
      pages,
      cover,
      solution,
      context: ctx,
      scope,
      warranty,
      template: bundle?.template ?? null,
      assets: bundle?.assets ?? [],
      tables,
      storageBaseUrl,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(element as any);
    const finalBuffer = await mergeWithAttachments(
      supabase,
      new Uint8Array(buffer),
      (doc.attached_pdf_paths ?? []) as string[],
    );

    // Modo preview-inline: retorna base64 direto, sem upload (muito mais rápido para prévia ao vivo)
    if (mode === "preview-inline") {
      // Converte Uint8Array → base64 sem usar Buffer (compatível com Worker)
      let binary = "";
      const bytes = finalBuffer;
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(
          null,
          Array.from(bytes.subarray(i, i + chunk)) as unknown as number[],
        );
      }
      const base64 = btoa(binary);
      return { url: null as string | null, path: null as string | null, mode, contentBase64: base64, mime: "application/pdf" };
    }

    const path = `${proposalId}/${mode}-${Date.now()}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("proposal-pdfs")
      .upload(path, finalBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (upErr) throw new Error(`Falha ao salvar PDF: ${upErr.message}`);

    const { data: signed, error: sErr } = await supabase.storage
      .from("proposal-pdfs")
      .createSignedUrl(path, 60 * 30); // 30 min
    if (sErr) throw new Error(sErr.message);

    return { url: signed.signedUrl, path, mode, contentBase64: null as string | null, mime: "application/pdf" };
  });

/**
 * Cria uma versão imutável de envio com snapshots completos do template e do
 * documento (incluindo tabelas estruturadas) + caminho do PDF gerado.
 */
const sendVersionSchema = z.object({
  proposalId: z.string().uuid(),
  notes: z.string().optional(),
});

export const createProposalSendVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sendVersionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { proposalId, notes } = data;

    // 1) Carrega documento + template + tabelas
    const { data: doc, error: dErr } = await supabase
      .from("proposal_documents")
      .select("*")
      .eq("proposal_id", proposalId)
      .single();
    if (dErr) throw new Error(dErr.message);

    let templateRow: ProposalTemplate | null = null;
    let templateAssets: TemplateAsset[] = [];
    if (doc.template_id) {
      const { data: tmpl } = await supabase
        .from("proposal_templates")
        .select("*")
        .eq("id", doc.template_id)
        .maybeSingle();
      if (tmpl) {
        templateRow = tmpl as unknown as ProposalTemplate;
        const { data: assets } = await supabase
          .from("proposal_template_assets")
          .select("*")
          .eq("template_id", doc.template_id);
        templateAssets = (assets ?? []).map((a) => ({
          ...(a as unknown as TemplateAsset),
          url: supabase.storage.from(TEMPLATE_BUCKET).getPublicUrl(a.storage_path).data.publicUrl,
        }));
      }
    }
    if (!templateRow) {
      const fallback = await loadDefaultTemplateBundle(supabase);
      templateRow = fallback?.template ?? null;
      templateAssets = fallback?.assets ?? [];
    }

    const { data: tablesRows } = await supabase
      .from("proposal_tables")
      .select("*")
      .eq("proposal_id", proposalId);
    const tables = (tablesRows ?? []) as unknown as ProposalTable[];

    // 2) Renderiza PDF final
    const pages = (doc.pages as unknown as DocumentPage[]) ?? DEFAULT_PAGES;
    const cover = (doc.cover_data ?? {}) as CoverData;
    const solution = (doc.solution_data ?? {}) as SolutionData;
    const ctx = (doc.context_data ?? {}) as ContextData;
    const scope = (doc.scope_items ?? []) as unknown as ScopeItem[];
    const warranty = (doc.warranty_text ?? {}) as { html?: string; text?: string };

    const storageBaseUrlV = `${process.env.VITE_SUPABASE_URL ?? ""}/storage/v1/object/public/proposal-attachments`;
    const element = createElement(ProposalDocumentPdf, {
      pages,
      cover,
      solution,
      context: ctx,
      scope,
      warranty,
      template: templateRow,
      assets: templateAssets,
      tables,
      storageBaseUrl: storageBaseUrlV,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(element as any);
    const finalBuffer = await mergeWithAttachments(
      supabase,
      new Uint8Array(buffer),
      (doc.attached_pdf_paths ?? []) as string[],
    );

    const finalPath = `${proposalId}/final-${Date.now()}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("proposal-pdfs")
      .upload(finalPath, finalBuffer, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error(`Falha ao salvar PDF final: ${upErr.message}`);

    // 3) Próximo número de versão
    const { data: prev } = await supabase
      .from("proposal_send_versions")
      .select("version_number")
      .eq("proposal_id", proposalId)
      .order("version_number", { ascending: false })
      .limit(1);
    const nextVersion =
      ((prev?.[0] as { version_number?: number } | undefined)?.version_number ?? 0) + 1;

    // marca versões anteriores como não-correntes
    await supabase
      .from("proposal_send_versions")
      .update({ is_current: false } as never)
      .eq("proposal_id", proposalId);

    // 4) Snapshots imutáveis
    const templateSnapshot = templateRow
      ? {
          template_id: templateRow.id,
          template_version: doc.template_version,
          name: templateRow.name,
          primary_color: templateRow.primary_color,
          accent_color: templateRow.accent_color,
          accent_color_2: templateRow.accent_color_2,
          pages_config: templateRow.pages_config,
          empresa_nome: templateRow.empresa_nome,
          empresa_email: templateRow.empresa_email,
          empresa_telefone: templateRow.empresa_telefone,
          empresa_site: templateRow.empresa_site,
          empresa_cidade: templateRow.empresa_cidade,
        }
      : null;

    const documentSnapshot = {
      pages,
      cover_data: cover,
      solution_data: solution,
      context_data: ctx,
      scope_items: scope,
      warranty_text: warranty,
      tables,
    };

    const { data: created, error: insErr } = await supabase
      .from("proposal_send_versions")
      .insert({
        proposal_id: proposalId,
        version_number: nextVersion,
        pdf_storage_path: finalPath,
        template_snapshot: templateSnapshot as never,
        document_snapshot: documentSnapshot as never,
        is_current: true,
        notes: notes ?? null,
        generated_by: userId,
      } as never)
      .select("*")
      .single();
    if (insErr) throw new Error(insErr.message);

    return { version: created, path: finalPath };
  });
