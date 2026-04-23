import { useProposalTables } from "@/features/proposal-editor/use-proposal-tables";
import { usePlaceholderContext } from "@/features/proposal-editor/placeholders/use-placeholder-context";

interface TemplateBundleLike {
  template?: {
    empresa_nome?: string | null;
    empresa_email?: string | null;
    empresa_telefone?: string | null;
    empresa_site?: string | null;
    empresa_cidade?: string | null;
  } | null;
}

export function useEditorPreviewData(
  proposalId: string,
  templateBundle?: TemplateBundleLike | null,
) {
  const { data, isLoading } = useProposalTables({ proposalId });
  const { context: placeholderContext } = usePlaceholderContext(
    proposalId,
    templateBundle ?? null,
  );
  return {
    tables: data?.tables ?? [],
    isLoadingTables: isLoading,
    placeholderContext,
  };
}
