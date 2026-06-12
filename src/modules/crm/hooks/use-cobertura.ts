import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCoberturaGeral,
  fetchCoberturaPorSdr,
  fetchCoberturaHistorico,
  fetchLeadsDescobertos,
  salvarSnapshotCobertura,
} from "../services-cobertura";

const KEY = ["crm", "cobertura"] as const;

export function useCoberturaGeral() {
  return useQuery({
    queryKey: [...KEY, "geral"],
    queryFn: fetchCoberturaGeral,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useCoberturaPorSdr() {
  return useQuery({
    queryKey: [...KEY, "sdr"],
    queryFn: fetchCoberturaPorSdr,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useCoberturaHistorico(dias = 14) {
  return useQuery({
    queryKey: [...KEY, "historico", dias],
    queryFn: () => fetchCoberturaHistorico(dias),
    staleTime: 5 * 60_000,
  });
}

export function useLeadsDescobertos() {
  return useQuery({
    queryKey: [...KEY, "descobertos"],
    queryFn: () => fetchLeadsDescobertos(50),
    staleTime: 30_000,
  });
}

export function useSalvarSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: salvarSnapshotCobertura,
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY] }),
  });
}

export function corCobertura(pct: number) {
  if (pct >= 80)
    return {
      text: "text-green-700",
      bg: "bg-green-50",
      badge: "bg-green-100 text-green-800",
      bar: "#16a34a",
      label: "Meta atingida",
    };
  if (pct >= 50)
    return {
      text: "text-yellow-700",
      bg: "bg-yellow-50",
      badge: "bg-yellow-100 text-yellow-800",
      bar: "#d97706",
      label: "Em progresso",
    };
  return {
    text: "text-red-700",
    bg: "bg-red-50",
    badge: "bg-red-100 text-red-800",
    bar: "#dc2626",
    label: "Abaixo da meta",
  };
}
