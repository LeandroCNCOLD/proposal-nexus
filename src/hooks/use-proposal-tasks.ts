import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type ProposalTask = {
  id: string;
  proposal_id: string | null;
  title: string;
  description: string | null;
  assignee_id: string | null;
  due_date: string | null;
  priority: "baixa" | "media" | "alta";
  status: "pendente" | "em_andamento" | "concluida" | "cancelada";
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function useProposalTasks(proposalId: string) {
  return useQuery({
    queryKey: ["proposal-tasks", proposalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposal_tasks")
        .select("*")
        .eq("proposal_id", proposalId)
        .order("status", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as ProposalTask[];
    },
  });
}

export function useCreateProposalTask(proposalId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string | null;
      assignee_id?: string | null;
      due_date?: string | null;
      priority?: "baixa" | "media" | "alta";
    }) => {
      const { data, error } = await supabase
        .from("proposal_tasks")
        .insert({
          proposal_id: proposalId,
          title: input.title,
          description: input.description ?? null,
          assignee_id: input.assignee_id ?? null,
          due_date: input.due_date ?? null,
          priority: input.priority ?? "media",
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      await supabase.from("proposal_timeline_events").insert({
        proposal_id: proposalId,
        event_type: "observacao",
        description: `Tarefa criada: ${input.title}`,
        user_id: user?.id,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposal-tasks", proposalId] });
      qc.invalidateQueries({ queryKey: ["proposal-timeline", proposalId] });
      toast.success("Tarefa criada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateProposalTask(proposalId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<ProposalTask> }) => {
      const patch: any = { ...input.patch };
      if (patch.status === "concluida" && !patch.completed_at) {
        patch.completed_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from("proposal_tasks")
        .update(patch)
        .eq("id", input.id);
      if (error) throw error;
      if (patch.status === "concluida") {
        const { data: t } = await supabase
          .from("proposal_tasks")
          .select("title")
          .eq("id", input.id)
          .maybeSingle();
        await supabase.from("proposal_timeline_events").insert({
          proposal_id: proposalId,
          event_type: "observacao",
          description: `Tarefa concluída: ${t?.title ?? input.id}`,
          user_id: user?.id,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposal-tasks", proposalId] });
      qc.invalidateQueries({ queryKey: ["proposal-timeline", proposalId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteProposalTask(proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("proposal_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposal-tasks", proposalId] });
      toast.success("Tarefa removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
