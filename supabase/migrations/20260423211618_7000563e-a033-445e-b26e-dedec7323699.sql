drop table if exists public.proposal_tables cascade;

create table public.proposal_tables (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  page_id text null,
  table_type text not null,
  title text null,
  subtitle text null,
  rows jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create index idx_proposal_tables_proposal_id on public.proposal_tables(proposal_id);
create index idx_proposal_tables_page_id on public.proposal_tables(page_id);
create index idx_proposal_tables_type on public.proposal_tables(table_type);
create unique index uq_proposal_tables_proposal_page_type_sort
  on public.proposal_tables(proposal_id, coalesce(page_id, ''), table_type, sort_order);

create or replace function public.set_proposal_tables_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_proposal_tables_updated_at on public.proposal_tables;
create trigger trg_set_proposal_tables_updated_at
before update on public.proposal_tables
for each row
execute function public.set_proposal_tables_updated_at();

alter table public.proposal_tables enable row level security;

create policy "proposal_tables_select_authenticated"
on public.proposal_tables for select to authenticated using (true);

create policy "proposal_tables_insert_authenticated"
on public.proposal_tables for insert to authenticated with check (true);

create policy "proposal_tables_update_authenticated"
on public.proposal_tables for update to authenticated using (true) with check (true);

create policy "proposal_tables_delete_authenticated"
on public.proposal_tables for delete to authenticated using (true);

create or replace function public.proposal_table_default_settings(p_table_type text)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case p_table_type
    when 'equipamentos' then jsonb_build_object(
      'show_header', true,
      'repeat_header', true,
      'currency_columns', jsonb_build_array('valor_unitario', 'valor_total'),
      'sum_columns', jsonb_build_array('valor_total'),
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'item', 'label', 'Item', 'width', 8, 'type', 'number'),
        jsonb_build_object('key', 'descricao', 'label', 'Descrição', 'width', 52, 'type', 'text'),
        jsonb_build_object('key', 'quantidade', 'label', 'Qtd.', 'width', 10, 'type', 'number'),
        jsonb_build_object('key', 'unidade', 'label', 'Unidade', 'width', 10, 'type', 'text'),
        jsonb_build_object('key', 'valor_total', 'label', 'Valor Total', 'width', 20, 'type', 'currency')
      )
    )
    when 'investimento' then jsonb_build_object(
      'show_header', true,
      'repeat_header', true,
      'currency_columns', jsonb_build_array('valor_unitario', 'valor_total'),
      'sum_columns', jsonb_build_array('valor_total'),
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'item', 'label', 'Item', 'width', 8, 'type', 'number'),
        jsonb_build_object('key', 'descricao', 'label', 'Descrição do Escopo de Fornecimento', 'width', 52, 'type', 'text'),
        jsonb_build_object('key', 'quantidade', 'label', 'Qtd.', 'width', 10, 'type', 'number'),
        jsonb_build_object('key', 'unidade', 'label', 'Unidade', 'width', 10, 'type', 'text'),
        jsonb_build_object('key', 'valor_total', 'label', 'Valor Total', 'width', 20, 'type', 'currency')
      ),
      'show_grand_total', true,
      'grand_total_label', 'Valor Total Geral do Investimento'
    )
    when 'impostos' then jsonb_build_object(
      'show_header', true,
      'repeat_header', false,
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'ipi', 'label', 'IPI', 'width', 25, 'type', 'text'),
        jsonb_build_object('key', 'icms', 'label', 'ICMS', 'width', 25, 'type', 'text'),
        jsonb_build_object('key', 'pis', 'label', 'PIS', 'width', 25, 'type', 'text'),
        jsonb_build_object('key', 'cofins', 'label', 'Cofins', 'width', 25, 'type', 'text')
      )
    )
    when 'pagamento' then jsonb_build_object(
      'show_header', true,
      'repeat_header', false,
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'forma_pagamento', 'label', 'Forma de Pagamento', 'width', 50, 'type', 'text'),
        jsonb_build_object('key', 'parcela', 'label', 'Parcela', 'width', 20, 'type', 'text'),
        jsonb_build_object('key', 'porcentagem', 'label', 'Porcentagem', 'width', 30, 'type', 'text')
      )
    )
    when 'caracteristicas' then jsonb_build_object(
      'show_header', false,
      'repeat_header', false,
      'columns', jsonb_build_array(
        jsonb_build_object('key', 'label', 'label', 'Campo', 'width', 45, 'type', 'text'),
        jsonb_build_object('key', 'value', 'label', 'Valor', 'width', 55, 'type', 'text')
      )
    )
    else jsonb_build_object(
      'show_header', true,
      'repeat_header', false,
      'columns', '[]'::jsonb
    )
  end;
$$;