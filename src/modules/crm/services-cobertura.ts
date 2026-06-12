import { supabase } from "@/integrations/supabase/client";

export type CoberturaGeral = {
  total: number;
  ativas: number;
  frias: number;
  sem_cobertura: number;
  nunca_contatadas: number;
  valor_total: number;
  valor_ativo: number;
  valor_frio: number;
  valor_sem_cobertura: number;
  valor_nunca_contatado: number;
  pct_ativa: number | null;
  pct_fria: number | null;
  pct_sem_cobertura: number | null;
  pct_nunca_contatada: number | null;
  media_dias_sem_contato: number | null;
  max_dias_sem_contato: number | null;
  alta_prioridade_descoberta: number;
  valor_alta_prioridade_descoberta: number;
  quentes_descobertos: number;
  calculado_em: string;
};

export type CoberturaPorSdr = {
  sdr_nome: string;
  locked_by_sdr_id: string | null;
  total_leads: number;
  ativos: number;
  frios: number;
  sem_cobertura: number;
  valor_carteira: number;
  valor_ativo: number;
  pct_cobertura: number | null;
  alta_prioridade_descoberta: number;
  quentes_descobertos: number;
  status_meta: string;
};

export type CoberturaHistoricoRow = {
  data: string;
  pct_ativa: number | null;
  ativas: number | null;
  total: number | null;
  valor_ativo: number | null;
};

export type LeadDescoberto = {
  id: string;
  proposal_number: string;
  client_name: string;
  state: string | null;
  value: number;
  temperature: string | null;
  priority: string | null;
  last_contact_at: string | null;
  locked_by_sdr_name: string | null;
  sdr_status: string | null;
};

export async function fetchCoberturaGeral(): Promise<CoberturaGeral> {
  const { data, error } = await (supabase as any)
    .from("crm_cobertura_carteira")
    .select("*")
    .single();
  if (error) throw error;
  return data as CoberturaGeral;
}

export async function fetchCoberturaPorSdr(): Promise<CoberturaPorSdr[]> {
  const { data, error } = await (supabase as any)
    .from("crm_cobertura_por_sdr")
    .select("*");
  if (error) throw error;
  return (data ?? []) as CoberturaPorSdr[];
}

export async function fetchCoberturaHistorico(dias = 14): Promise<CoberturaHistoricoRow[]> {
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - dias);
  const { data, error } = await (supabase as any)
    .from("crm_cobertura_historico")
    .select("data, pct_ativa, ativas, total, valor_ativo")
    .gte("data", inicio.toISOString().slice(0, 10))
    .order("data", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CoberturaHistoricoRow[];
}

export async function fetchLeadsDescobertos(limit = 50): Promise<LeadDescoberto[]> {
  const limite = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("sdr_leads")
    .select(
      "id,lead_code,client_name,state,value,temperature,priority,last_contact_at,locked_by_sdr_name,sdr_status"
    )
    .or(`locked_by_sdr_id.is.null,last_contact_at.lt.${limite}`)
    .not("sdr_status", "in", '("Kill / Arquivar","Fechado","Perdido (com motivo)")')
    .order("value", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    proposal_number: r.lead_code,
    client_name: r.client_name,
    state: r.state,
    value: Number(r.value ?? 0),
    temperature: r.temperature,
    priority: r.priority,
    last_contact_at: r.last_contact_at,
    locked_by_sdr_name: r.locked_by_sdr_name,
    sdr_status: r.sdr_status,
  }));
}

export async function salvarSnapshotCobertura(): Promise<void> {
  const { error } = await (supabase as any).rpc("salvar_snapshot_cobertura");
  if (error) throw error;
}
