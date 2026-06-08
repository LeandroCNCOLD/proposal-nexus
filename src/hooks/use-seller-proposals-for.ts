import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SellerProposal } from "@/hooks/use-seller-proposals";

export function useSellerProposalsFor(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["seller-wallet-for", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: ids, error: idErr } = await supabase.rpc("proposals_for_seller", { _user_id: userId! });
      if (idErr) throw idErr;
      const list = (ids ?? []) as Array<{ proposal_id: string }>;
      if (list.length === 0) return [] as SellerProposal[];
      const { data, error } = await supabase
        .from("proposals")
        .select(
          "id, number, title, status, temperature, total_value, win_probability, next_followup_at, sent_at, created_at, updated_at, nomus_proposal_id, nomus_seller_name, clients(name, trade_name)"
        )
        .in("id", list.map((r) => r.proposal_id))
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SellerProposal[];
    },
  });
}
