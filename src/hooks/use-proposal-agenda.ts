import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type AgendaEntry = {
  id: string;
  proposal_number: string | null;
  client_name: string;
  tipo: string;
  status: string;
  data_inicio: string;
  data_fim: string;
  duracao_min: number;
  local: string | null;
  link_reuniao: string | null;
  sdr_nome: string | null;
  closer_nome: string;
  contato_cliente: string | null;
  email_cliente: string | null;
  telefone_cliente: string | null;
  observacoes: string | null;
  resultado: string | null;
  created_at: string;
};

export function useProposalAgenda(proposalNumber: string | null | undefined) {
  return useQuery({
    queryKey: ["proposal-agenda", proposalNumber],
    enabled: !!proposalNumber,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_agenda")
        .select("*")
        .eq("proposal_number", proposalNumber!)
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AgendaEntry[];
    },
  });
}

export function useCreateAgendaEntry(proposalId: string, proposalNumber: string | null | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      tipo: string;
      data_inicio: string;
      duracao_min: number;
      client_name: string;
      closer_nome: string;
      local?: string | null;
      link_reuniao?: string | null;
      contato_cliente?: string | null;
      email_cliente?: string | null;
      telefone_cliente?: string | null;
      observacoes?: string | null;
    }) => {
      const inicio = new Date(input.data_inicio);
      const fim = new Date(inicio.getTime() + input.duracao_min * 60_000);
      const { data, error } = await supabase
        .from("crm_agenda")
        .insert({
          proposal_number: proposalNumber ?? null,
          client_name: input.client_name,
          tipo: input.tipo,
          data_inicio: inicio.toISOString(),
          data_fim: fim.toISOString(),
          duracao_min: input.duracao_min,
          local: input.local ?? null,
          link_reuniao: input.link_reuniao ?? null,
          closer_nome: input.closer_nome,
          contato_cliente: input.contato_cliente ?? null,
          email_cliente: input.email_cliente ?? null,
          telefone_cliente: input.telefone_cliente ?? null,
          observacoes: input.observacoes ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      await supabase.from("proposal_timeline_events").insert({
        proposal_id: proposalId,
        event_type: "observacao",
        description: `Reunião agendada: ${input.tipo} em ${inicio.toLocaleString("pt-BR")} com ${input.closer_nome}`,
        user_id: user?.id,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposal-agenda", proposalNumber] });
      qc.invalidateQueries({ queryKey: ["proposal-timeline", proposalId] });
      qc.invalidateQueries({ queryKey: ["agenda"] });
      toast.success("Reunião agendada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateAgendaStatus(proposalId: string, proposalNumber: string | null | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { id: string; status: string; resultado?: string | null }) => {
      const { error } = await supabase
        .from("crm_agenda")
        .update({ status: input.status, resultado: input.resultado ?? null })
        .eq("id", input.id);
      if (error) throw error;
      await supabase.from("proposal_timeline_events").insert({
        proposal_id: proposalId,
        event_type: "observacao",
        description: `Reunião marcada como ${input.status}${input.resultado ? ` — ${input.resultado}` : ""}`,
        user_id: user?.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposal-agenda", proposalNumber] });
      qc.invalidateQueries({ queryKey: ["proposal-timeline", proposalId] });
      qc.invalidateQueries({ queryKey: ["agenda"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
