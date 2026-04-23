import { useProposalTables } from "@/features/proposal-editor/use-proposal-tables";

export function useEditorPreviewData(proposalId: string) {
  const { data, isLoading } = useProposalTables({ proposalId });
  return {
    tables: data?.tables ?? [],
    isLoadingTables: isLoading,
  };
}
