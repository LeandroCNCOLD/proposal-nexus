import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { autoFillFromNomus } from "@/integrations/proposal-editor/server.functions";

/**
 * Hook para auto-preencher o documento da proposta a partir do Nomus.
 * Inclui as tabelas estruturadas (investimento, impostos, pagamento).
 *
 * - `overwriteManualFields = false` (padrão): preserva edições manuais.
 * - `overwriteManualFields = true`: reprocessa tudo do zero.
 */
export function useAutoFillDocumentFromNomus(proposalId: string) {
  const qc = useQueryClient();
  const autoFill = useServerFn(autoFillFromNomus);

  return useMutation({
    mutationFn: (opts?: { overwriteManualFields?: boolean }) =>
      autoFill({
        data: {
          proposalId,
          overwriteManualFields: opts?.overwriteManualFields ?? false,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposal-document", proposalId] });
      qc.invalidateQueries({ queryKey: ["proposal-tables", proposalId] });
    },
  });
}
