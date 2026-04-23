alter table public.proposal_send_versions
  add column if not exists tables_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists proposal_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_proposal_send_versions_proposal_id
  on public.proposal_send_versions(proposal_id);

create index if not exists idx_proposal_send_versions_version_number
  on public.proposal_send_versions(proposal_id, version_number);