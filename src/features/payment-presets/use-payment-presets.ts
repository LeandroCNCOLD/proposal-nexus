import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPaymentPreset,
  listPaymentPresets,
  togglePaymentPresetActive,
  updatePaymentPreset,
} from "./payment-presets.functions";
import {
  getProposalFinancial,
  saveProposalFinancial,
} from "./proposal-financial.functions";

const PRESETS_KEY = ["payment-presets"];

export function usePaymentPresets(onlyActive = false) {
  return useQuery({
    queryKey: [...PRESETS_KEY, { onlyActive }],
    queryFn: () => listPaymentPresets({ data: { onlyActive } }),
  });
}

export function useCreatePaymentPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof createPaymentPreset>[0]["data"]) =>
      createPaymentPreset({ data: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRESETS_KEY }),
  });
}

export function useUpdatePaymentPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof updatePaymentPreset>[0]["data"]) =>
      updatePaymentPreset({ data: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRESETS_KEY }),
  });
}

export function useTogglePaymentPresetActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof togglePaymentPresetActive>[0]["data"]) =>
      togglePaymentPresetActive({ data: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PRESETS_KEY }),
  });
}

export function useProposalFinancial(proposalId: string) {
  return useQuery({
    queryKey: ["proposal-financial", proposalId],
    queryFn: () => getProposalFinancial({ data: { proposalId } }),
    enabled: !!proposalId,
  });
}

export function useSaveProposalFinancial(proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof saveProposalFinancial>[0]["data"]) =>
      saveProposalFinancial({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposal-financial", proposalId] });
      qc.invalidateQueries({ queryKey: ["proposal", proposalId] });
    },
  });
}
