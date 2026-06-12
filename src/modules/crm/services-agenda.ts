import { supabase } from '@/integrations/supabase/client';

export type AgendaItem = {
  id: string;
  created_at: string;
  updated_at?: string;
  pipeline_id: string | null;
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
  closer_confirmou: boolean;
  closer_confirmou_at?: string | null;
  lembrete_enviado?: boolean;
  observacoes: string | null;
  resultado: string | null;
  proxima_acao: string | null;
  data_proxima_acao: string | null;
};

export const TIPOS_REUNIAO = [
  'Reunião de Apresentação',
  'Reunião Técnica',
  'Reunião de Negociação',
  'Visita Técnica',
  'Demonstração',
  'Follow-up Agendado',
  'Fechamento',
  'Pós-venda',
] as const;

export const STATUS_REUNIAO = [
  'Agendado',
  'Confirmado',
  'Realizado',
  'Cancelado',
  'Reagendado',
  'Cliente não compareceu',
] as const;

export const CORES_TIPO: Record<string, string> = {
  'Reunião de Apresentação': 'bg-blue-500/20 border-blue-500 text-blue-700 dark:text-blue-300',
  'Reunião Técnica': 'bg-purple-500/20 border-purple-500 text-purple-700 dark:text-purple-300',
  'Reunião de Negociação': 'bg-orange-500/20 border-orange-500 text-orange-700 dark:text-orange-300',
  'Visita Técnica': 'bg-green-500/20 border-green-500 text-green-700 dark:text-green-300',
  'Demonstração': 'bg-cyan-500/20 border-cyan-500 text-cyan-700 dark:text-cyan-300',
  'Fechamento': 'bg-red-500/20 border-red-500 text-red-700 dark:text-red-300',
  'Follow-up Agendado': 'bg-gray-500/20 border-gray-500 text-gray-700 dark:text-gray-300',
  'Pós-venda': 'bg-teal-500/20 border-teal-500 text-teal-700 dark:text-teal-300',
};

export async function fetchAgenda(opts?: {
  inicio?: string;
  fim?: string;
  closer?: string;
  status?: string;
}) {
  let q = supabase
    .from('crm_agenda' as any)
    .select('*')
    .order('data_inicio', { ascending: true });

  if (opts?.inicio) q = q.gte('data_inicio', opts.inicio);
  if (opts?.fim) q = q.lte('data_inicio', opts.fim);
  if (opts?.closer) q = q.eq('closer_nome', opts.closer);
  if (opts?.status) q = q.eq('status', opts.status);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as AgendaItem[];
}

export async function fetchAgendaById(id: string) {
  const { data, error } = await supabase
    .from('crm_agenda' as any)
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as unknown as AgendaItem;
}

export async function fetchAgendaHoje() {
  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(hoje);
  fim.setHours(23, 59, 59, 999);
  return fetchAgenda({ inicio: inicio.toISOString(), fim: fim.toISOString() });
}

export async function fetchAgendaSemana() {
  const hoje = new Date();
  const dom = new Date(hoje);
  dom.setDate(hoje.getDate() - hoje.getDay());
  dom.setHours(0, 0, 0, 0);
  const sab = new Date(dom);
  sab.setDate(dom.getDate() + 6);
  sab.setHours(23, 59, 59, 999);
  return fetchAgenda({ inicio: dom.toISOString(), fim: sab.toISOString() });
}

export async function criarAgendamento(
  data: Omit<AgendaItem, 'id' | 'created_at' | 'updated_at'>,
) {
  const { data: result, error } = await supabase
    .from('crm_agenda' as any)
    .insert(data as any)
    .select()
    .single();
  if (error) throw error;
  const created = result as unknown as AgendaItem;

  const inicio = new Date(data.data_inicio);
  const lembretes = [
    {
      agenda_id: created.id,
      tipo: '24h',
      enviar_em: new Date(inicio.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      canal: 'sistema',
    },
    {
      agenda_id: created.id,
      tipo: '2h',
      enviar_em: new Date(inicio.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      canal: 'sistema',
    },
  ];
  await supabase.from('crm_agenda_lembretes' as any).insert(lembretes as any);

  return created;
}

export async function atualizarAgendamento(id: string, data: Partial<AgendaItem>) {
  const { data: result, error } = await supabase
    .from('crm_agenda' as any)
    .update({ ...data, updated_at: new Date().toISOString() } as any)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return result as unknown as AgendaItem;
}

export async function confirmarPresenca(id: string) {
  return atualizarAgendamento(id, {
    closer_confirmou: true,
    closer_confirmou_at: new Date().toISOString(),
    status: 'Confirmado',
  });
}

export async function registrarResultado(
  id: string,
  resultado: string,
  proxima_acao: string,
  data_proxima_acao: string,
  status: string,
) {
  return atualizarAgendamento(id, { resultado, proxima_acao, data_proxima_acao, status });
}

export async function cancelarAgendamento(id: string) {
  return atualizarAgendamento(id, { status: 'Cancelado' });
}

export async function fetchProximasReunioes(closer: string, dias = 7) {
  const inicio = new Date().toISOString();
  const fim = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();
  return fetchAgenda({ inicio, fim, closer });
}

export async function fetchReunioesSemConfirmacao() {
  const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('crm_agenda' as any)
    .select('*')
    .eq('closer_confirmou', false)
    .eq('status', 'Agendado')
    .lte('data_inicio', amanha)
    .order('data_inicio');
  if (error) throw error;
  return (data ?? []) as unknown as AgendaItem[];
}
