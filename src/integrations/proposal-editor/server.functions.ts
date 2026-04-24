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
 * Geração de PDF temporariamente desativada — será reimplementada na próxima fase
 * para o novo schema de blocos.
 */
const generateSchema = z.object({
  proposalId: z.string().uuid(),
  mode: z.enum(["preview", "final", "preview-inline"]).default("preview"),
});

export const generateProposalPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => generateSchema.parse(input))
  .handler(async ({ data }) => {
    void data;
    throw new Error(
      "Geração de PDF está sendo refatorada para o novo Page Builder. Disponível em breve.",
    );
  });
