
CREATE TABLE IF NOT EXISTS public.crm_agenda (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  pipeline_id uuid,
  proposal_number text,
  client_name text not null,
  tipo text not null check (tipo in (
    'Reunião de Apresentação','Reunião Técnica','Reunião de Negociação',
    'Visita Técnica','Demonstração','Follow-up Agendado','Fechamento','Pós-venda'
  )),
  status text not null default 'Agendado' check (status in (
    'Agendado','Confirmado','Realizado','Cancelado','Reagendado','Cliente não compareceu'
  )),
  data_inicio timestamptz not null,
  data_fim timestamptz not null,
  duracao_min integer not null default 60,
  local text,
  link_reuniao text,
  sdr_nome text,
  closer_nome text not null,
  contato_cliente text,
  email_cliente text,
  telefone_cliente text,
  closer_confirmou boolean not null default false,
  closer_confirmou_at timestamptz,
  lembrete_enviado boolean not null default false,
  observacoes text,
  resultado text,
  proxima_acao text,
  data_proxima_acao date
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_agenda TO authenticated;
GRANT ALL ON public.crm_agenda TO service_role;

ALTER TABLE public.crm_agenda ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agenda_all" ON public.crm_agenda
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS crm_agenda_data_idx ON public.crm_agenda(data_inicio);
CREATE INDEX IF NOT EXISTS crm_agenda_closer_idx ON public.crm_agenda(closer_nome);
CREATE INDEX IF NOT EXISTS crm_agenda_status_idx ON public.crm_agenda(status);
CREATE INDEX IF NOT EXISTS crm_agenda_pipeline_idx ON public.crm_agenda(pipeline_id);

CREATE TRIGGER crm_agenda_updated_at
  BEFORE UPDATE ON public.crm_agenda
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.crm_agenda_lembretes (
  id uuid primary key default gen_random_uuid(),
  agenda_id uuid references public.crm_agenda(id) on delete cascade,
  tipo text not null check (tipo in ('24h','2h','30min','custom')),
  enviar_em timestamptz not null,
  enviado boolean not null default false,
  canal text not null default 'sistema' check (canal in ('sistema','email','whatsapp'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_agenda_lembretes TO authenticated;
GRANT ALL ON public.crm_agenda_lembretes TO service_role;

ALTER TABLE public.crm_agenda_lembretes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lembretes_all" ON public.crm_agenda_lembretes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
