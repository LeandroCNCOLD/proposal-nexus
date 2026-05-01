import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProposalDocumentContext } from "./document-context.functions";
import type { ProposalDocumentContext } from "./document-context.types";

/**
 * Hook único que entrega o ProposalDocumentContext ao editor de propostas e
 * a qualquer bloco filho. Substitui as queries ad-hoc espalhadas pelo
 * editor (proposal-dynamic-context, proposal-template-bundle parcial, etc.).
 */
export function useProposalDocumentContext(proposalId: string | undefined) {
  const fn = useServerFn(getProposalDocumentContext);
  return useQuery({
    queryKey: ["proposal-document-context", proposalId ?? null],
    queryFn: async (): Promise<ProposalDocumentContext> => {
      const res = await fn({ data: { proposalId: proposalId! } });
      return res.context;
    },
    enabled: !!proposalId,
    staleTime: 30_000,
  });
}
