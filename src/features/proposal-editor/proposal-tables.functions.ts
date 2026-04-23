import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  upsertProposalTableInputSchema,
  listProposalTablesInputSchema,
} from "./proposal-tables.schema";
// ProposalTable type is the consumer-side shape; server returns raw JSON rows.

export const listProposalTables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listProposalTablesInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    let query = supabase
      .from("proposal_tables")
      .select("*")
      .eq("proposal_id", data.proposalId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (data.pageId) {
      query = query.eq("page_id", data.pageId);
    }

    const { data: rows, error } = await query;

    if (error) {
      throw new Error(`Erro ao listar tabelas da proposta: ${error.message}`);
    }

    return (rows ?? []) as unknown as Array<Record<string, unknown>>;
  });

export const upsertProposalTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertProposalTableInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const payload = {
      ...(data.id ? { id: data.id } : {}),
      proposal_id: data.proposal_id,
      page_id: data.page_id ?? null,
      table_type: data.table_type,
      title: data.title ?? null,
      subtitle: data.subtitle ?? null,
      rows: data.rows as never,
      settings: data.settings as never,
      sort_order: data.sort_order ?? 0,
    };

    const { data: row, error } = await supabase
      .from("proposal_tables")
      .upsert(payload as never, { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Erro ao salvar tabela da proposta: ${error.message}`);
    }

    return row as unknown as Record<string, unknown>;
  });

export const deleteProposalTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { error } = await supabase
      .from("proposal_tables")
      .delete()
      .eq("id", data.id);

    if (error) {
      throw new Error(`Erro ao excluir tabela da proposta: ${error.message}`);
    }

    return { success: true as const };
  });
