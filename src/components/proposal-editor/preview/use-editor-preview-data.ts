import { useProposalTables } from "@/features/proposal-editor/use-proposal-tables";
import { usePlaceholderContext } from "@/features/proposal-editor/placeholders/use-placeholder-context";

export function useEditorPreviewData(
  proposalId: string,
  templateBundle?: { template?: Parameters<typeof usePlaceholderContext>[1] extends infer T ? T extends { template?: infer X } ? X : never : never } | null,
) {
  const { data, isLoading } = useProposalTables({ proposalId });
  const { context: placeholderContext } = usePlaceholderContext(proposalId, templateBundle ?? null);
  return {
    tables: data?.tables ?? [],
    isLoadingTables: isLoading,
    placeholderContext,
  };
}

