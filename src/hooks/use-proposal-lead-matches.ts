import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ProposalLeadMatch = {
  proposal_id: string;
  lead_id: string;
  match_type: "cnpj" | "titulo";
  proposal_title: string | null;
  lead_code: string | null;
  client_name: string | null;
};

type ByProposal = Map<string, ProposalLeadMatch>;
type ByLead = Map<string, ProposalLeadMatch>;

/**
 * Carrega cruzamentos Propostas Nomus ↔ Leads SDR a partir da view
 * `v_proposal_lead_matches`. Passe apenas um dos filtros; o outro é opcional.
 * Retorna dois Maps para lookup O(1) (chaveados por proposal_id e lead_id).
 */
export function useProposalLeadMatches(opts: {
  proposalIds?: string[];
  leadIds?: string[];
}) {
  const proposalIds = useMemo(
    () => Array.from(new Set((opts.proposalIds ?? []).filter(Boolean))).sort(),
    [opts.proposalIds],
  );
  const leadIds = useMemo(
    () => Array.from(new Set((opts.leadIds ?? []).filter(Boolean))).sort(),
    [opts.leadIds],
  );

  const enabled = proposalIds.length > 0 || leadIds.length > 0;

  const { data = [] } = useQuery({
    queryKey: ["proposal-lead-matches", { proposalIds, leadIds }],
    enabled,
    queryFn: async () => {
      let q = supabase
        .from("v_proposal_lead_matches" as any)
        .select("proposal_id, lead_id, match_type, proposal_title, lead_code, client_name");
      if (proposalIds.length > 0) q = q.in("proposal_id", proposalIds);
      if (leadIds.length > 0) q = q.in("lead_id", leadIds);
      const { data, error } = await q;
      if (error) {
        console.warn("[proposal-lead-matches] erro:", error.message);
        return [] as ProposalLeadMatch[];
      }
      return (data ?? []) as ProposalLeadMatch[];
    },
  });

  const byProposal = useMemo<ByProposal>(() => {
    const m: ByProposal = new Map();
    for (const row of data) {
      // Prioriza match por CNPJ
      const cur = m.get(row.proposal_id);
      if (!cur || (cur.match_type === "titulo" && row.match_type === "cnpj")) {
        m.set(row.proposal_id, row);
      }
    }
    return m;
  }, [data]);

  const byLead = useMemo<ByLead>(() => {
    const m: ByLead = new Map();
    for (const row of data) {
      const cur = m.get(row.lead_id);
      if (!cur || (cur.match_type === "titulo" && row.match_type === "cnpj")) {
        m.set(row.lead_id, row);
      }
    }
    return m;
  }, [data]);

  return { matches: data, byProposal, byLead };
}
