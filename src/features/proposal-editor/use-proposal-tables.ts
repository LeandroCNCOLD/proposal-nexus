import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listProposalTables,
  upsertProposalTable,
  deleteProposalTable,
} from "./proposal-tables.functions";
import type {
  ListProposalTablesInput,
  UpsertProposalTableInput,
} from "./proposal-tables.types";

export function useProposalTables(input: ListProposalTablesInput) {
  return useQuery({
    queryKey: ["proposal-tables", input.proposalId, input.pageId ?? "all"],
    queryFn: () => listProposalTables({ data: input }),
    enabled: !!input.proposalId,
  });
}

export function useUpsertProposalTable(proposalId: string, pageId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpsertProposalTableInput) =>
      upsertProposalTable({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["proposal-tables", proposalId, pageId ?? "all"],
      });
      queryClient.invalidateQueries({
        queryKey: ["proposal-tables", proposalId],
      });
    },
  });
}

export function useDeleteProposalTable(proposalId: string, pageId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteProposalTable({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["proposal-tables", proposalId, pageId ?? "all"],
      });
      queryClient.invalidateQueries({
        queryKey: ["proposal-tables", proposalId],
      });
    },
  });
}
