
-- =========================================================
-- Fase 1 do CRM: tabela-espelho de processos + suporte a funis
-- =========================================================

-- 1) nomus_processes: espelho 1:1 do endpoint /processos do Nomus
create table if not exists public.nomus_processes (
  id uuid primary key default gen_random_uuid(),
  nomus_id text not null unique,

  -- Dados puros vindos do Nomus
  nome text,
  pessoa text,
  descricao text,
  tipo text,
  etapa text,
  prioridade text,
  equipe text,
  origem text,
  responsavel text,
  reportador text,

  data_criacao date,
  data_hora_programada timestamptz,
  proximo_contato date,

  -- Vínculos locais resolvidos
  cliente_id uuid,
  proposal_id uuid,

  -- Payload original e controle de sync
  raw jsonb,
  synced_at timestamptz not null default now(),
  last_pushed_at timestamptz,
  local_dirty boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_nomus_processes_tipo on public.nomus_processes(tipo);
create index if not exists idx_nomus_processes_etapa on public.nomus_processes(etapa);
create index if not exists idx_nomus_processes_responsavel on public.nomus_processes(responsavel);
create index if not exists idx_nomus_processes_cliente on public.nomus_processes(cliente_id);
create index if not exists idx_nomus_processes_proposal on public.nomus_processes(proposal_id);
create index if not exists idx_nomus_processes_proximo_contato on public.nomus_processes(proximo_contato);
create index if not exists idx_nomus_processes_local_dirty on public.nomus_processes(local_dirty) where local_dirty = true;

alter table public.nomus_processes enable row level security;

create policy "nomus_processes_select"
  on public.nomus_processes for select to authenticated using (true);

create policy "nomus_processes_insert"
  on public.nomus_processes for insert to authenticated
  with check (auth.uid() is not null);

create policy "nomus_processes_update"
  on public.nomus_processes for update to authenticated
  using (auth.uid() is not null);

create policy "nomus_processes_delete"
  on public.nomus_processes for delete to authenticated
  using (public.has_any_role(auth.uid(), array['gerente_comercial'::app_role, 'diretoria'::app_role, 'admin'::app_role]));

create trigger trg_nomus_processes_updated_at
  before update on public.nomus_processes
  for each row execute function public.set_updated_at();


-- 2) crm_funnel_stages: cache de etapas por tipo
create table if not exists public.crm_funnel_stages (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  etapa text not null,
  display_order int not null default 0,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  is_hidden boolean not null default false,
  color text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tipo, etapa)
);

create index if not exists idx_crm_funnel_stages_tipo on public.crm_funnel_stages(tipo);

alter table public.crm_funnel_stages enable row level security;

create policy "crm_funnel_stages_select"
  on public.crm_funnel_stages for select to authenticated using (true);

create policy "crm_funnel_stages_insert"
  on public.crm_funnel_stages for insert to authenticated
  with check (auth.uid() is not null);

create policy "crm_funnel_stages_update"
  on public.crm_funnel_stages for update to authenticated
  using (auth.uid() is not null);

create policy "crm_funnel_stages_delete"
  on public.crm_funnel_stages for delete to authenticated
  using (public.has_any_role(auth.uid(), array['gerente_comercial'::app_role, 'diretoria'::app_role, 'admin'::app_role]));

create trigger trg_crm_funnel_stages_updated_at
  before update on public.crm_funnel_stages
  for each row execute function public.set_updated_at();


-- 3) crm_user_funnels: preferência por usuário (quais tipos quer ver no Kanban)
create table if not exists public.crm_user_funnels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tipo text not null,
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tipo)
);

create index if not exists idx_crm_user_funnels_user on public.crm_user_funnels(user_id);

alter table public.crm_user_funnels enable row level security;

create policy "crm_user_funnels_select_own"
  on public.crm_user_funnels for select to authenticated
  using (user_id = auth.uid() or public.has_any_role(auth.uid(), array['admin'::app_role, 'diretoria'::app_role]));

create policy "crm_user_funnels_insert_own"
  on public.crm_user_funnels for insert to authenticated
  with check (user_id = auth.uid());

create policy "crm_user_funnels_update_own"
  on public.crm_user_funnels for update to authenticated
  using (user_id = auth.uid());

create policy "crm_user_funnels_delete_own"
  on public.crm_user_funnels for delete to authenticated
  using (user_id = auth.uid());

create trigger trg_crm_user_funnels_updated_at
  before update on public.crm_user_funnels
  for each row execute function public.set_updated_at();
