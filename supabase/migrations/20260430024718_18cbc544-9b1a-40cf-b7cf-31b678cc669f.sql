ALTER TABLE public.nomus_proposal_items
  ADD COLUMN IF NOT EXISTS price_table_id uuid REFERENCES public.nomus_price_tables(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS price_table_nomus_id text,
  ADD COLUMN IF NOT EXISTS price_table_name text,
  ADD COLUMN IF NOT EXISTS price_table_match_method text;

ALTER TABLE public.proposal_items
  ADD COLUMN IF NOT EXISTS price_table_id uuid REFERENCES public.nomus_price_tables(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS price_table_nomus_id text,
  ADD COLUMN IF NOT EXISTS price_table_name text,
  ADD COLUMN IF NOT EXISTS price_table_match_method text;

CREATE INDEX IF NOT EXISTS idx_nomus_proposal_items_price_table_id
  ON public.nomus_proposal_items(price_table_id);

CREATE INDEX IF NOT EXISTS idx_nomus_proposal_items_price_lookup
  ON public.nomus_proposal_items(nomus_product_id, price_table_id);

CREATE INDEX IF NOT EXISTS idx_proposal_items_price_table_id
  ON public.proposal_items(price_table_id);