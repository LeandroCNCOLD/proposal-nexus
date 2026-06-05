create table if not exists public.crm_pipeline (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  proposal_number text not null,
  client_name text not null,
  city text,
  state char(2),
  value numeric(14,2) not null default 0,
  sdr_id uuid references auth.users(id),
  closer_id uuid references auth.users(id),
  sdr_name text,
  closer_name text,
  sdr_status text not null default 'Não Contatado'
    check (sdr_status in (
      'Não Contatado','Contatado - Aguardando Retorno','Reunião Agendada',
      'Reunião Realizada','Em Negociação com Closer','Proposta em Revisão',
      'Quente - Alta Chance de Fechamento','Perdido (com motivo)',
      'Kill / Arquivar','Fechado'
    )),
  temperature text not null default 'Morno'
    check (temperature in ('Frio','Morno','Quente','Muito Quente')),
  priority text not null default 'Média'
    check (priority in ('Alta','Média','Baixa')),
  last_contact_at date,
  next_contact_at date,
  meeting_scheduled boolean not null default false,
  meeting_date date,
  closer_confirmed text not null default 'Pendente'
    check (closer_confirmed in ('Sim','Não','Pendente')),
  call_result text,
  call_observation text,
  next_step text,
  probability_pct smallint check (probability_pct between 0 and 100),
  internal_note text,
  days_without_contact integer generated always as (
    case when last_contact_at is null then null
    else (current_date - last_contact_at)::integer end
  ) stored,
  value_range text generated always as (
    case
      when value >= 5000000 then 'Mega (>5M)'
      when value >= 2000000 then 'Grande (2-5M)'
      when value >= 500000  then 'Médio (500K-2M)'
      when value >= 100000  then 'Pequeno (100-500K)'
      else 'Micro (<100K)'
    end
  ) stored
);

create index if not exists crm_pipeline_sdr_idx      on public.crm_pipeline(sdr_id);
create index if not exists crm_pipeline_closer_idx   on public.crm_pipeline(closer_id);
create index if not exists crm_pipeline_status_idx   on public.crm_pipeline(sdr_status);
create index if not exists crm_pipeline_priority_idx on public.crm_pipeline(priority);
create index if not exists crm_pipeline_temp_idx     on public.crm_pipeline(temperature);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger crm_pipeline_updated_at
  before update on public.crm_pipeline
  for each row execute function public.set_updated_at();

alter table public.crm_pipeline enable row level security;
create policy "crm_pipeline_select" on public.crm_pipeline for select to authenticated using (true);
create policy "crm_pipeline_insert" on public.crm_pipeline for insert to authenticated with check (true);
create policy "crm_pipeline_update" on public.crm_pipeline for update to authenticated using (true);
create policy "crm_pipeline_delete" on public.crm_pipeline for delete to authenticated using (true);
