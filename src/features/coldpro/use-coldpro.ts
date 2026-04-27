import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listColdProProjects, createColdProProject, updateColdProProject, getColdProProjectBundle, createColdProEnvironment, updateColdProEnvironment, deleteColdProEnvironment, upsertColdProEnvironmentProduct, deleteColdProEnvironmentProduct, upsertColdProTunnel, upsertColdProAdvancedProcess, calculateColdProEnvironment, autoSelectColdProEquipment } from "./coldpro.functions";
import { pushColdProToProposal } from "./push-coldpro-to-proposal.functions";
import { analyzeColdProMemorial, generateColdProMemorialPdf } from "@/integrations/coldpro/coldpro-memorial.functions";

function upsertByEnvironment<T extends { environment_id?: string | null }>(rows: T[] = [], next: T) {
  const environmentId = next.environment_id;
  if (!environmentId) return rows;
  const filtered = rows.filter((row) => row.environment_id !== environmentId);
  return [next, ...filtered];
}

export function useColdProProjects() {
  return useQuery({ queryKey: ["coldpro-projects"], queryFn: () => listColdProProjects() });
}
export function useCreateColdProProject() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: { proposal_id?: string | null; name: string; application_type: string }) => createColdProProject({ data }), onSuccess: () => qc.invalidateQueries({ queryKey: ["coldpro-projects"] }) });
}
export function useUpdateColdProProject(projectId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: { id: string; name: string }) => updateColdProProject({ data }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["coldpro-project", projectId] }); qc.invalidateQueries({ queryKey: ["coldpro-projects"] }); } });
}
export function useColdProProjectBundle(projectId: string) {
  return useQuery({ queryKey: ["coldpro-project", projectId], queryFn: () => getColdProProjectBundle({ data: { projectId } }), enabled: !!projectId });
}
export function useCreateColdProEnvironment(projectId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: { name: string; environment_type: string }) => createColdProEnvironment({ data: { projectId, ...data } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["coldpro-project", projectId] }) });
}
export function useUpdateColdProEnvironment(projectId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: { id: string; patch: Record<string, unknown> }) => updateColdProEnvironment({ data }), onSuccess: () => qc.invalidateQueries({ queryKey: ["coldpro-project", projectId] }) });
}
export function useDeleteColdProEnvironment(projectId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => deleteColdProEnvironment({ data: { id } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["coldpro-project", projectId] }) });
}
export function useUpsertColdProProduct(projectId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: any) => upsertColdProEnvironmentProduct({ data }), onSuccess: () => qc.invalidateQueries({ queryKey: ["coldpro-project", projectId] }) });
}
export function useDeleteColdProProduct(projectId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => deleteColdProEnvironmentProduct({ data: { id } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["coldpro-project", projectId] }) });
}
export function useUpsertColdProTunnel(projectId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: any) => upsertColdProTunnel({ data }), onSuccess: () => qc.invalidateQueries({ queryKey: ["coldpro-project", projectId] }) });
}
export function useUpsertColdProAdvancedProcess(projectId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: any) => upsertColdProAdvancedProcess({ data }), onSuccess: () => qc.invalidateQueries({ queryKey: ["coldpro-project", projectId] }) });
}
export function useCalculateColdProEnvironment(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (environmentId: string) => calculateColdProEnvironment({ data: { environmentId } }),
    onSuccess: (result: any) => {
      qc.setQueryData(["coldpro-project", projectId], (current: any) =>
        current ? { ...current, results: upsertByEnvironment(current.results ?? [], result) } : current,
      );
      return qc.invalidateQueries({ queryKey: ["coldpro-project", projectId] });
    },
  });
}
export function useAutoSelectColdProEquipment(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: string | { environmentId: string; minQuantity?: number; equipmentKind?: "plugin" | "biblock" | "split" | null }) => {
      const payload = typeof input === "string" ? { environmentId: input } : input;
      return autoSelectColdProEquipment({ data: payload });
    },
    onSuccess: (selection: any) => {
      qc.setQueryData(["coldpro-project", projectId], (current: any) =>
        current ? { ...current, selections: upsertByEnvironment(current.selections ?? [], selection) } : current,
      );
      return qc.invalidateQueries({ queryKey: ["coldpro-project", projectId] });
    },
  });
}
export function usePushColdProToProposal(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mode: "append" | "replace_coldpro_items" = "append") =>
      pushColdProToProposal({ data: { projectId, mode } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coldpro-project", projectId] }),
  });
}
export function useGenerateColdProMemorialPdf(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: boolean | { attachToProposal?: boolean; aiAnalysis?: string | null; reportType?: "full" | "proposal_summary" } = true) => {
      const payload = typeof input === "boolean" ? { attachToProposal: input } : input;
      return generateColdProMemorialPdf({ data: { projectId, attachToProposal: payload.attachToProposal ?? true, aiAnalysis: payload.aiAnalysis ?? null, reportType: payload.reportType ?? "full" } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coldpro-project", projectId] }),
  });
}

export function useAnalyzeColdProMemorial(projectId: string) {
  return useMutation({
    mutationFn: (data: { question?: string; previousAnalysis?: string | null }) =>
      analyzeColdProMemorial({ data: { projectId, ...data } }),
  });
}
