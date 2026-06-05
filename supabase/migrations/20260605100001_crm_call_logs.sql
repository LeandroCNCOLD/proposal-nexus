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

create index if not exists crm_call_logs_pipeline_idx on public.crm_call_logs(pipeline_id);
create index if not exists crm_call_logs_sdr_idx      on public.crm_call_logs(sdr_id);
create index if not exists crm_call_logs_date_idx     on public.crm_call_logs(call_date desc);

alter table public.crm_call_logs enable row level security;
create policy "crm_call_logs_all" on public.crm_call_logs
  for all to authenticated using (true) with check (true);
