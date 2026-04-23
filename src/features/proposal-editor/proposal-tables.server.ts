import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ProposalTable } from "./proposal-tables.types";

export async function getProposalTablesByProposalId(
  proposalId: string,
): Promise<ProposalTable[]> {
  const { data, error } = await supabaseAdmin
    .from("proposal_tables")
    .select("*")
    .eq("proposal_id", proposalId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Erro ao carregar tabelas da proposta: ${error.message}`);
  }

  return (data ?? []) as unknown as ProposalTable[];
}
