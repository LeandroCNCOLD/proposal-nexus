// Server functions do editor de propostas (CN Cold)
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_PAGES } from "./types";

const proposalIdSchema = z.object({ proposalId: z.string().uuid() });

/**
 * Carrega o documento da proposta. Se não existir, cria um com a estrutura
 * padrão (7 páginas do template CN Cold) e retorna.
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

    // Cria com defaults
    const { data: created, error: insErr } = await supabase
      .from("proposal_documents")
      .insert({
        proposal_id: proposalId,
        pages: DEFAULT_PAGES as unknown as never,
        last_edited_by: userId,
      })
      .select("*")
      .single();

    if (insErr) throw new Error(insErr.message);
    return { document: created };
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
