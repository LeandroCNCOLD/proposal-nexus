import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type SellerProposal = {
  id: string;
  number: string | null;
  title: string;
  status: string;
  temperature: string | null;
  total_value: number | null;
  win_probability: number | null;
  next_followup_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  nomus_proposal_id: string | null;
  nomus_seller_name: string | null;
  clients: { name: string | null; trade_name: string | null } | null;
};

export function useSellerProposals() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["seller-wallet", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: ids, error: idErr } = await supabase.rpc("proposals_for_seller", {
        _user_id: user!.id,
      });
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
