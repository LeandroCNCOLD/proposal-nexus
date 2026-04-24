// Server functions do editor de propostas (CN Cold v2 — Page Builder com blocos)
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_PAGES,
  makeDefaultPage,
  type DocumentPage,
  type PageType,
  type DocumentBlock,
} from "./types";
import {
  getDefaultTableSettings,
  getDefaultTableRows,
} from "@/features/proposal-editor/proposal-tables.defaults";
import type {
  ProposalTableRow,
  ProposalTableType,
} from "@/features/proposal-editor/proposal-tables.types";
import type { ProposalTemplate, TemplateAsset } from "./template.types";

const proposalIdSchema = z.object({ proposalId: z.string().uuid() });
const TEMPLATE_BUCKET = "proposal-template-assets";

// Carrega histórico de revisões da família CN##### a partir do título da proposta.
// Retorna { revision, history } — revisão atual (0 se for original) e lista ordenada.
async function loadRevisionContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  proposalId: string,
  title: string | null,
): Promise<{ revision: number; history: Array<{ numero: string; date: string | null; total_value: number | null; is_current: boolean }> }> {
  const m = (title ?? "").match(/(CN\d{3,})/i);
  if (!m) return { revision: 0, history: [] };
  const cn = m[1].toUpperCase();
  const { data: rows } = await supabase
    .from("proposals")
    .select("id, total_value, created_at, nomus_id")
    .ilike("title", `%${cn}%`);
  const list = (rows ?? []) as Array<{ id: string; total_value: number | null; created_at: string; nomus_id: string | null }>;
  if (list.length <= 1) return { revision: 0, history: [] };
  const nomusIds = list.map((r) => r.nomus_id).filter(Boolean) as string[];
  const numMap = new Map<string, { numero: string | null; criada_em_nomus: string | null; data_emissao: string | null }>();
  if (nomusIds.length > 0) {
    const { data: np } = await supabase
      .from("nomus_proposals")
      .select("nomus_id, numero, criada_em_nomus, data_emissao")
      .in("nomus_id", nomusIds);
    (np ?? []).forEach((n: { nomus_id: string; numero: string | null; criada_em_nomus: string | null; data_emissao: string | null }) => numMap.set(n.nomus_id, n));
  }
  let currentRev = 0;
  const history = list.map((r) => {
    const nm = r.nomus_id ? numMap.get(r.nomus_id) ?? null : null;
    const numero = nm?.numero ?? cn;
    const revMatch = numero.match(/Rev\.?\s*(\d+)/i);
    const rev = revMatch ? parseInt(revMatch[1], 10) : 0;
    const isCurrent = r.id === proposalId;
    if (isCurrent) currentRev = rev;
    return {
      numero,
      date: nm?.criada_em_nomus ?? nm?.data_emissao ?? r.created_at,
      total_value: r.total_value,
      is_current: isCurrent,
    };
  }).sort((a, b) => {
    const ra = parseInt(a.numero.match(/Rev\.?\s*(\d+)/i)?.[1] ?? "0", 10);
    const rb = parseInt(b.numero.match(/Rev\.?\s*(\d+)/i)?.[1] ?? "0", 10);
    return rb - ra;
  });
  return { revision: currentRev, history };
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
 * template padrão (cores, pages_config, textos fixos).
 */
export const getProposalDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => proposalIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { proposalId } = data;

    const { data: existing, error: selErr } = await supabase
      .from("proposal_documents")
      .select("*")
      .eq("proposal_id", proposalId)
      .maybeSingle();

    if (selErr) throw new Error(selErr.message);
    if (existing) return { document: existing };

    const bundle = await loadDefaultTemplateBundle(supabase);
    const tplPages = bundle?.template?.pages_config as unknown;
    let pages: DocumentPage[] = DEFAULT_PAGES;
    if (Array.isArray(tplPages) && tplPages.length > 0) {
      // Converte pages_config simples (sem blocks) em páginas com blocos default
      pages = (tplPages as Array<Record<string, unknown>>).map((p, i) =>
        makeDefaultPage(
          (p.type as PageType) ?? "custom-rich",
          (p.title as string) ?? "Página",
          typeof p.order === "number" ? p.order : i,
        ),
      );
    }

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
        patch.pages = (pgs as Array<Record<string, unknown>>).map((p, i) =>
          makeDefaultPage(
            (p.type as PageType) ?? "custom-rich",
            (p.title as string) ?? "Página",
            typeof p.order === "number" ? p.order : i,
          ),
        );
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
    attached_pdf_paths: z.array(z.string()).optional(),
  }),
});

/** Salva (parcial) o documento. */
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
 * Auto-preenche os blocos do documento com dados do Nomus + cliente + contato.
 * Atualiza apenas blocos com `source = "nomus"` e que não estão `locked`.
 * Também popula tabelas estruturadas (investimento, impostos, pagamento).
 */
const autoFillSchema = z.object({
  proposalId: z.string().uuid(),
  overwriteManualFields: z.boolean().optional(),
});

export const autoFillFromNomus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => autoFillSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { proposalId } = data;

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
    if (!doc) throw new Error("Documento não encontrado. Abra o editor primeiro.");

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

    // Auto-fill blocos com source=nomus
    const pages = (doc.pages as unknown as DocumentPage[]) ?? [];
    const updatedPages: DocumentPage[] = pages.map((page) => {
      const updatedBlocks: DocumentBlock[] = page.blocks.map((block) => {
        if (block.source !== "nomus" || block.locked) return block;
        switch (block.type) {
          case "client_info":
            return {
              ...block,
              data: {
                ...block.data,
                cliente: cliente?.trade_name || cliente?.name || block.data.cliente,
                cnpj: cliente?.document || block.data.cnpj,
                endereco:
                  [cliente?.city, cliente?.state].filter(Boolean).join(" / ") ||
                  block.data.endereco,
              },
            };
          case "project_info":
            return {
              ...block,
              data: {
                ...block.data,
                projeto: proposal.title || block.data.projeto,
                numero: proposal.number || block.data.numero,
                data: new Date().toISOString().slice(0, 10),
              },
            };
          case "responsible_info":
            return {
              ...block,
              data: {
                ...block.data,
                responsavel: (nomusProp?.vendedor_nome as string) ?? block.data.responsavel,
              },
            };
          case "key_value_list":
            if (page.type === "context") {
              return {
                ...block,
                data: {
                  items: [
                    { label: "Cliente", value: cliente?.name ?? "" },
                    { label: "CNPJ", value: cliente?.document ?? "" },
                    {
                      label: "Endereço",
                      value: [cliente?.city, cliente?.state].filter(Boolean).join(" / "),
                    },
                    {
                      label: "Contato",
                      value: contato
                        ? `${contato.name ?? ""}${contato.email ? ` · ${contato.email}` : ""}`
                        : "",
                    },
                  ],
                },
              };
            }
            return block;
          case "included_items":
            if (page.type === "scope" && nomusItems.length > 0) {
              return {
                ...block,
                data: {
                  items: nomusItems.map(
                    (it, i) => (it.description as string) ?? `Item ${i + 1}`,
                  ),
                },
              };
            }
            return block;
          default:
            return block;
        }
      });
      return { ...page, blocks: updatedBlocks };
    });

    const { data: updated, error: uErr } = await supabase
      .from("proposal_documents")
      .update({
        pages: updatedPages as unknown as never,
        auto_filled_at: new Date().toISOString(),
        last_edited_by: userId,
        last_edited_at: new Date().toISOString(),
      } as never)
      .eq("proposal_id", proposalId)
      .select("*")
      .single();
    if (uErr) throw new Error(uErr.message);

    // ============= Tabelas estruturadas =============
    const findPageId = (...types: string[]): string | null => {
      const found = updatedPages.find((p) => types.includes(p.type));
      return found?.id ?? null;
    };

    const tablesUpdated: string[] = [];

    const upsertTable = async (
      tableType: ProposalTableType,
      pageId: string | null,
      rows: ProposalTableRow[],
      title?: string,
    ) => {
      if (!pageId || rows.length === 0) return;
      await supabase
        .from("proposal_tables")
        .delete()
        .eq("proposal_id", proposalId)
        .eq("page_id", pageId)
        .eq("table_type", tableType);

      const { error: insErr } = await supabase.from("proposal_tables").insert({
        proposal_id: proposalId,
        page_id: pageId,
        table_type: tableType,
        title: title ?? null,
        subtitle: null,
        rows: rows as never,
        settings: getDefaultTableSettings(tableType) as never,
        sort_order: 0,
        created_by: userId,
        updated_by: userId,
      } as never);
      if (insErr) {
        console.warn(`[autoFillFromNomus] falhou ao inserir tabela ${tableType}:`, insErr.message);
        return;
      }
      tablesUpdated.push(tableType);
    };

    if (nomusItems.length > 0) {
      const investimentoPageId = findPageId("investimento", "equipamento");
      const rows: ProposalTableRow[] = nomusItems.map((it, idx) => ({
        item: idx + 1,
        descricao: (it.description as string) ?? `Item ${idx + 1}`,
        quantidade: Number(it.quantity ?? 0),
        unidade: (it.unit_value_with_unit as string) ?? "un",
        valor_unitario: Number(it.unit_price ?? 0),
        valor_total: Number(it.total_with_discount ?? it.total ?? 0),
      }));
      await upsertTable("investimento", investimentoPageId, rows);
    }

    if (nomusProp) {
      const impostosPageId = findPageId("impostos");
      const valorProdutos = Number(nomusProp.valor_produtos ?? 0);
      const fmt = (recolher: unknown, fallback: string): string => {
        const v = Number(recolher ?? 0);
        if (!valorProdutos || !v) return fallback;
        const pct = (v / valorProdutos) * 100;
        return `${pct.toFixed(2).replace(".", ",")}%`;
      };
      const rows: ProposalTableRow[] = [
        {
          ipi: fmt(nomusProp.ipi_recolher, "0% (Isento)"),
          icms: fmt(nomusProp.icms_recolher, "12,00%"),
          pis: fmt(nomusProp.pis_recolher, "1,65%"),
          cofins: fmt(nomusProp.cofins_recolher, "7,60%"),
        },
      ];
      await upsertTable("impostos", impostosPageId, rows);
    }

    if (nomusProp) {
      const pagamentoPageId = findPageId("pagamento");
      const condNome = (nomusProp.condicao_pagamento_nome as string | null) ?? null;
      let rows: ProposalTableRow[] = getDefaultTableRows("pagamento");
      if (condNome) {
        const matches = condNome.match(/\d+/g);
        if (matches && matches.length >= 1) {
          const total = matches.length;
          const pct = Math.floor(100 / total);
          rows = matches.map((dias, i) => ({
            forma_pagamento: i === 0 ? "Depósito Bancário" : "Boleto Bancário",
            parcela: `${i + 1}/${total} (${dias} dias)`,
            porcentagem: i === total - 1 ? `${100 - pct * (total - 1)}%` : `${pct}%`,
          }));
        }
      }
      await upsertTable("pagamento", pagamentoPageId, rows, condNome ?? undefined);
    }

    return {
      document: updated,
      filledFromNomus: nomusItems.length,
      tablesUpdated,
    };
  });

/**
 * Gera o PDF da proposta usando o novo renderer baseado em blocos.
 * Sobe para storage `proposal-pdfs` e retorna URL assinada.
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

    // Carrega proposta + cliente
    const { data: proposal, error: pErr } = await supabase
      .from("proposals")
      .select(
        "id, number, title, valid_until, created_at, clients:client_id(name, trade_name)",
      )
      .eq("id", proposalId)
      .single();
    if (pErr || !proposal) throw new Error(pErr?.message ?? "Proposta não encontrada.");

    // Documento (páginas + blocos)
    const { data: doc, error: dErr } = await supabase
      .from("proposal_documents")
      .select("*")
      .eq("proposal_id", proposalId)
      .maybeSingle();
    if (dErr) throw new Error(dErr.message);
    if (!doc) throw new Error("Abra o editor da proposta antes de gerar o PDF.");

    // Tabelas estruturadas
    const { data: tables } = await supabase
      .from("proposal_tables")
      .select("*")
      .eq("proposal_id", proposalId);

    // Template (cores, dados bancários, branding)
    let template = null;
    if (doc.template_id) {
      const { data: tpl } = await supabase
        .from("proposal_templates")
        .select("*")
        .eq("id", doc.template_id)
        .maybeSingle();
      template = tpl;
    } else {
      const bundle = await loadDefaultTemplateBundle(supabase);
      template = bundle?.template ?? null;
    }

    // Renderiza
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { ProposalPdfDocument } = await import("./pdf/ProposalPdfDocument");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cliente = (proposal as any).clients;
    const revCtx = await loadRevisionContext(supabase, proposal.id, proposal.title);

    const baseBuffer = await renderToBuffer(
      ProposalPdfDocument({
        data: {
          proposal: {
            id: proposal.id,
            number: proposal.number,
            title: proposal.title,
            valid_until: proposal.valid_until,
            created_at: proposal.created_at,
            client_name: cliente?.trade_name ?? cliente?.name ?? null,
            revision: revCtx.revision,
            revision_history: revCtx.history,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pages: (doc.pages as any) ?? [],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tables: (tables as any) ?? [],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          template: template as any,
        },
      }) as never,
    );

    // Mescla PDFs anexados (best-effort)
    const attachedPaths = (doc.attached_pdf_paths as string[] | null) ?? [];
    const attachedBuffers: Uint8Array[] = [];
    for (const p of attachedPaths) {
      const { data: file, error } = await supabase.storage
        .from("proposal-files")
        .download(p);
      if (error || !file) {
        console.warn(`[generateProposalPdf] anexo não baixado: ${p}`, error?.message);
        continue;
      }
      attachedBuffers.push(new Uint8Array(await file.arrayBuffer()));
    }

    let finalBuffer: Uint8Array | Buffer = baseBuffer as Buffer;
    if (attachedBuffers.length > 0) {
      const { mergePdfBuffers } = await import("./pdf/merge");
      finalBuffer = await mergePdfBuffers(baseBuffer as Buffer, attachedBuffers);
    }

    // Upload
    const ts = Date.now();
    const path = `${proposalId}/${mode}-${ts}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("proposal-pdfs")
      .upload(path, finalBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (upErr) throw new Error(`Falha ao salvar PDF: ${upErr.message}`);

    const { data: signed, error: sErr } = await supabase.storage
      .from("proposal-pdfs")
      .createSignedUrl(path, 60 * 60); // 1h
    if (sErr) throw new Error(`Falha ao gerar URL: ${sErr.message}`);

    return {
      url: signed.signedUrl,
      path,
      mode,
      mergedAttachments: attachedBuffers.length,
    };
  });

// ============= Versões de envio (snapshot) =============

/**
 * Gera o PDF final, salva em `proposal-files`, e cria um registro em
 * `proposal_send_versions` com snapshot completo (proposta, documento, tabelas, template).
 * Marca versões anteriores como `is_current=false`.
 */
export const createProposalSendVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ proposalId: z.string().uuid(), notes: z.string().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { proposalId, notes } = data;

    // 1) Carrega proposta + cliente
    const { data: proposal, error: pErr } = await supabase
      .from("proposals")
      .select(
        "id, number, title, status, valid_until, payment_terms, delivery_term, total_value, created_at, clients:client_id(name, trade_name, document, city, state)",
      )
      .eq("id", proposalId)
      .single();
    if (pErr || !proposal) {
      return { ok: false as const, error: pErr?.message ?? "Proposta não encontrada." };
    }

    // 2) Documento
    const { data: doc, error: dErr } = await supabase
      .from("proposal_documents")
      .select("*")
      .eq("proposal_id", proposalId)
      .maybeSingle();
    if (dErr || !doc) {
      return { ok: false as const, error: dErr?.message ?? "Documento não encontrado." };
    }

    // 3) Tabelas estruturadas
    const { data: tables } = await supabase
      .from("proposal_tables")
      .select("*")
      .eq("proposal_id", proposalId);

    // 4) Template
    let template: Record<string, unknown> | null = null;
    if (doc.template_id) {
      const { data: tpl } = await supabase
        .from("proposal_templates")
        .select("*")
        .eq("id", doc.template_id)
        .maybeSingle();
      template = tpl as Record<string, unknown> | null;
    } else {
      const bundle = await loadDefaultTemplateBundle(supabase);
      template = (bundle?.template ?? null) as Record<string, unknown> | null;
    }

    // 5) Renderiza PDF + merge anexos
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { ProposalPdfDocument } = await import("./pdf/ProposalPdfDocument");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cliente = (proposal as any).clients;
    const revCtx = await loadRevisionContext(supabase, proposal.id, proposal.title);

    const baseBuffer = await renderToBuffer(
      ProposalPdfDocument({
        data: {
          proposal: {
            id: proposal.id,
            number: proposal.number,
            title: proposal.title,
            valid_until: proposal.valid_until,
            created_at: proposal.created_at,
            client_name: cliente?.trade_name ?? cliente?.name ?? null,
            revision: revCtx.revision,
            revision_history: revCtx.history,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pages: (doc.pages as any) ?? [],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tables: (tables as any) ?? [],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          template: template as any,
        },
      }) as never,
    );

    const attachedPaths = (doc.attached_pdf_paths as string[] | null) ?? [];
    const attachedBuffers: Uint8Array[] = [];
    for (const p of attachedPaths) {
      const { data: file, error } = await supabase.storage
        .from("proposal-files")
        .download(p);
      if (error || !file) continue;
      attachedBuffers.push(new Uint8Array(await file.arrayBuffer()));
    }

    let finalBuffer: Uint8Array | Buffer = baseBuffer as Buffer;
    if (attachedBuffers.length > 0) {
      const { mergePdfBuffers } = await import("./pdf/merge");
      finalBuffer = await mergePdfBuffers(baseBuffer as Buffer, attachedBuffers);
    }

    // 6) Próxima versão
    const { data: lastVer } = await supabase
      .from("proposal_send_versions")
      .select("version_number")
      .eq("proposal_id", proposalId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVer = ((lastVer as { version_number: number } | null)?.version_number ?? 0) + 1;
    const path = `${proposalId}/v${nextVer}-${Date.now()}.pdf`;

    // 7) Upload no bucket de envios
    const { error: upErr } = await supabase.storage
      .from("proposal-files")
      .upload(path, finalBuffer, { contentType: "application/pdf", upsert: false });
    if (upErr) return { ok: false as const, error: `Falha ao salvar PDF: ${upErr.message}` };

    // 8) Marca versões anteriores como não-atuais
    await supabase
      .from("proposal_send_versions")
      .update({ is_current: false } as never)
      .eq("proposal_id", proposalId);

    // 9) Snapshot
    const proposalSnapshot = {
      id: proposal.id,
      number: proposal.number,
      title: proposal.title,
      status: proposal.status,
      valid_until: proposal.valid_until,
      payment_terms: proposal.payment_terms,
      delivery_term: proposal.delivery_term,
      total_value: proposal.total_value,
      client_name: cliente?.trade_name ?? cliente?.name ?? null,
    };
    const documentSnapshot = {
      document_id: doc.id,
      proposal_id: doc.proposal_id,
      template_id: doc.template_id,
      pages: doc.pages,
      attached_pdf_paths: doc.attached_pdf_paths,
      updated_at: doc.updated_at,
    };
    const templateSnapshot = template
      ? {
          template_id: (template.id as string) ?? null,
          template_version: doc.template_version,
          name: (template.name as string) ?? null,
          colors: {
            primary: template.primary_color,
            accent: template.accent_color,
            accent2: template.accent_color_2,
          },
          empresa: {
            nome: template.empresa_nome,
            cidade: template.empresa_cidade,
            email: template.empresa_email,
            site: template.empresa_site,
            telefone: template.empresa_telefone,
          },
        }
      : null;

    const { data: ver, error: insErr } = await supabase
      .from("proposal_send_versions")
      .insert({
        proposal_id: proposalId,
        version_number: nextVer,
        pdf_storage_path: path,
        generated_by: userId,
        is_current: true,
        notes: notes ?? null,
        proposal_snapshot: proposalSnapshot as never,
        document_snapshot: documentSnapshot as never,
        tables_snapshot: ((tables ?? []) as unknown) as never,
        template_snapshot: templateSnapshot as never,
        metadata: {
          merged_attachments: attachedBuffers.length,
          generated_at: new Date().toISOString(),
        } as never,
      } as never)
      .select("id")
      .single();
    if (insErr) return { ok: false as const, error: `Falha ao registrar versão: ${insErr.message}` };

    return {
      ok: true as const,
      version_id: (ver as { id: string }).id,
      version_number: nextVer,
      path,
      mergedAttachments: attachedBuffers.length,
    };
  });

/** Lista versões geradas para uma proposta. */
export const listProposalSendVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => proposalIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("proposal_send_versions")
      .select(
        "id, version_number, pdf_storage_path, generated_at, generated_by, is_current, notes, metadata",
      )
      .eq("proposal_id", data.proposalId)
      .order("version_number", { ascending: false });
    if (error) throw new Error(error.message);
    return { versions: rows ?? [] };
  });

/** Gera URL assinada para download/visualização de uma versão. */
export const getProposalSendVersionUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ versionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: ver, error } = await supabase
      .from("proposal_send_versions")
      .select("pdf_storage_path")
      .eq("id", data.versionId)
      .single();
    if (error || !ver) throw new Error(error?.message ?? "Versão não encontrada.");
    const { data: signed, error: sErr } = await supabase.storage
      .from("proposal-files")
      .createSignedUrl((ver as { pdf_storage_path: string }).pdf_storage_path, 60 * 60);
    if (sErr) throw new Error(sErr.message);
    return { url: signed.signedUrl };
  });
