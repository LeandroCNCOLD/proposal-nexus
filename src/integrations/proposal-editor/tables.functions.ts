// Server functions para tabelas estruturadas vinculadas a páginas de uma proposta
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ProposalTable } from "./types";

const proposalIdSchema = z.object({ proposalId: z.string().uuid() });

export const listProposalTables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => proposalIdSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ tables: ProposalTable[] }> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("proposal_tables")
      .select("*")
      .eq("proposal_id", data.proposalId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { tables: (rows ?? []) as unknown as ProposalTable[] };
  });

const upsertSchema = z.object({
  proposalId: z.string().uuid(),
  pageId: z.string().min(1),
  type: z.string().min(1),
  title: z.string().nullable().optional(),
  rows: z.array(z.record(z.any())),
  columns: z.array(z.any()).nullable().optional(),
});

export const upsertProposalTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const payload = {
      proposal_id: data.proposalId,
      page_id: data.pageId,
      type: data.type,
      title: data.title ?? null,
      rows: data.rows as never,
      columns: (data.columns ?? null) as never,
    };
    const { data: row, error } = await supabase
      .from("proposal_tables")
      .upsert(payload, { onConflict: "proposal_id,page_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { table: row as unknown as ProposalTable };
  });

export const deleteProposalTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("proposal_tables").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
