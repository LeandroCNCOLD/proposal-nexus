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
grant select, insert, update, delete on public.crm_pipeline to authenticated;
grant all on public.crm_pipeline to service_role;
alter table public.crm_pipeline enable row level security;
create index if not exists crm_pipeline_sdr_idx      on public.crm_pipeline(sdr_id);
create index if not exists crm_pipeline_closer_idx   on public.crm_pipeline(closer_id);
create index if not exists crm_pipeline_status_idx   on public.crm_pipeline(sdr_status);
create index if not exists crm_pipeline_priority_idx on public.crm_pipeline(priority);
create index if not exists crm_pipeline_temp_idx     on public.crm_pipeline(temperature);
drop trigger if exists crm_pipeline_updated_at on public.crm_pipeline;
create trigger crm_pipeline_updated_at
  before update on public.crm_pipeline
  for each row execute function public.set_updated_at();
create policy "crm_pipeline_select" on public.crm_pipeline for select to authenticated using (true);
create policy "crm_pipeline_insert" on public.crm_pipeline for insert to authenticated with check (true);
create policy "crm_pipeline_update" on public.crm_pipeline for update to authenticated using (true);
create policy "crm_pipeline_delete" on public.crm_pipeline for delete to authenticated using (true);

create table if not exists public.crm_call_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  pipeline_id uuid references public.crm_pipeline(id) on delete cascade,
  sdr_id uuid references auth.users(id),
  sdr_name text not null,
  call_date date not null default current_date,
  call_time time,
  duration_min smallint,
  result text check (result in (
    'Atendeu - Muito interessado','Atendeu - Pediu retorno',
    'Atendeu - Resistência de preço','Atendeu - Projeto parado/cancelado',
    'Não atendeu - WhatsApp','Não atendeu - Caixa postal',
    'Número inválido','Concorrente ganhou','Outros'
  )),
  temperature_after text check (temperature_after in ('Frio','Morno','Quente','Muito Quente')),
  meeting_booked boolean not null default false,
  observation text
);
grant select, insert, update, delete on public.crm_call_logs to authenticated;
grant all on public.crm_call_logs to service_role;
alter table public.crm_call_logs enable row level security;
create index if not exists crm_call_logs_pipeline_idx on public.crm_call_logs(pipeline_id);
create index if not exists crm_call_logs_sdr_idx      on public.crm_call_logs(sdr_id);
create index if not exists crm_call_logs_date_idx     on public.crm_call_logs(call_date desc);
create policy "crm_call_logs_all" on public.crm_call_logs
  for all to authenticated using (true) with check (true);

create table if not exists public.crm_team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) unique,
  name text not null,
  role text not null check (role in ('SDR','Closer','Gestor')),
  avatar_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.crm_team_members to authenticated;
grant all on public.crm_team_members to service_role;
alter table public.crm_team_members enable row level security;
insert into public.crm_team_members (name, role) values
  ('Katlin',  'SDR'),
  ('Silmar',  'SDR'),
  ('Tais',    'SDR'),
  ('Vitor',   'SDR'),
  ('Rafael',  'Closer'),
  ('Elton',   'Closer'),
  ('Rodrigo', 'Closer'),
  ('Leandro', 'Gestor')
on conflict do nothing;
create policy "crm_team_read" on public.crm_team_members
  for select to authenticated using (true);

create table if not exists public.crm_weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  week_start date not null unique,
  total_calls integer not null default 0,
  meetings_booked integer not null default 0,
  meetings_held integer not null default 0,
  hot_deals_count integer not null default 0,
  learnings text,
  bottlenecks text,
  next_week_plan text
);
grant select, insert, update, delete on public.crm_weekly_reviews to authenticated;
grant all on public.crm_weekly_reviews to service_role;
alter table public.crm_weekly_reviews enable row level security;
create policy "crm_weekly_all" on public.crm_weekly_reviews
  for all to authenticated using (true) with check (true);