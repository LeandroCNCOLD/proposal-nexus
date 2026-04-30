ALTER TABLE public.proposal_items
  ADD COLUMN IF NOT EXISTS price_table_unit_price numeric(14,2),
  ADD COLUMN IF NOT EXISTS price_table_selected_at timestamptz;