import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listColdProProjects, createColdProProject, getColdProProjectBundle, createColdProEnvironment, updateColdProEnvironment, upsertColdProEnvironmentProduct, upsertColdProTunnel, calculateColdProEnvironment, autoSelectColdProEquipment } from "./coldpro.functions";

export function useColdProProjects() {
  return useQuery({ queryKey: ["coldpro-projects"], queryFn: () => listColdProProjects() });
}
export function useCreateColdProProject() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: { proposal_id?: string | null; name: string; application_type: string }) => createColdProProject({ data }), onSuccess: () => qc.invalidateQueries({ queryKey: ["coldpro-projects"] }) });
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
export function useUpsertColdProProduct(projectId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: any) => upsertColdProEnvironmentProduct({ data }), onSuccess: () => qc.invalidateQueries({ queryKey: ["coldpro-project", projectId] }) });
}
export function useUpsertColdProTunnel(projectId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: any) => upsertColdProTunnel({ data }), onSuccess: () => qc.invalidateQueries({ queryKey: ["coldpro-project", projectId] }) });
}
export function useCalculateColdProEnvironment(projectId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (environmentId: string) => calculateColdProEnvironment({ data: { environmentId } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["coldpro-project", projectId] }) });
}
export function useAutoSelectColdProEquipment(projectId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (environmentId: string) => autoSelectColdProEquipment({ data: { environmentId } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["coldpro-project", projectId] }) });
}
