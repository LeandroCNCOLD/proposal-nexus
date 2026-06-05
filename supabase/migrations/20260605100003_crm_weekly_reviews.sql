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

alter table public.crm_weekly_reviews enable row level security;
create policy "crm_weekly_all" on public.crm_weekly_reviews
  for all to authenticated using (true) with check (true);
