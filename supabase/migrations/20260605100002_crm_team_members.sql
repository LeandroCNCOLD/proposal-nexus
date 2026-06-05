create table if not exists public.crm_team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) unique,
  name text not null,
  role text not null check (role in ('SDR','Closer','Gestor')),
  avatar_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

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

alter table public.crm_team_members enable row level security;
create policy "crm_team_read" on public.crm_team_members
  for select to authenticated using (true);
